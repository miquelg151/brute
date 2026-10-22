import { CLASSES, FISTS_DAMAGE, ORIGINS, PETS, WEAPONS } from './catalog';
import { Rng } from './rng';
import { addStats, type Appearance, type Character } from './types';

export type Team = 0 | 1;

/** Static info about each fighter or pet, so a replay can be drawn without the characters. */
export interface UnitInfo {
  team: Team;
  isMain: boolean;
  name: string;
  /** Class id for main fighters, pet id for pets. */
  defId: string;
  maxHp: number;
  appearance?: Appearance;
}

export type HitKind = 'melee' | 'double' | 'combo' | 'counter' | 'throw';

export type FightEvent =
  | { t: 'draw'; actor: number; weapon: string }
  | { t: 'hit'; actor: number; target: number; kind: HitKind; weapon: string | null; damage: number; hp: number }
  | { t: 'block'; actor: number; target: number; kind: HitKind; weapon: string | null; damage: number; hp: number }
  | { t: 'dodge'; actor: number; target: number; kind: HitKind }
  | { t: 'disarm'; actor: number; target: number; weapon: string }
  | { t: 'heal'; actor: number; amount: number; hp: number }
  | { t: 'death'; actor: number };

export interface FightLog {
  seed: number;
  roster: UnitInfo[];
  events: FightEvent[];
  winner: Team;
}

/** Safety cap. If reached, the side with the higher health percentage wins. */
export const MAX_ACTIONS = 400;
const GAUGE_FULL = 100;

interface Unit {
  idx: number;
  team: Team;
  isMain: boolean;
  maxHp: number;
  hp: number;
  /** Strength for main fighters, flat damage for pets. */
  power: number;
  agility: number;
  speed: number;
  armor: number;
  dodgeBonus: number;
  gauge: number;
  tieBreak: number;
  undrawn: string[];
  weapon: string | null;
  skills: Set<string>;
  secondWindUsed: boolean;
}

export function maxHpFor(health: number, hpPercent: number): number {
  return Math.floor(((30 + 5 * health) * (100 + hpPercent)) / 100);
}

function buildUnits(c: Character, team: Team, roster: UnitInfo[], units: Unit[]): void {
  const cls = CLASSES[c.classId];
  const origin = ORIGINS[c.originId];
  if (!cls || !origin) throw new Error(`Invalid character '${c.name}'`);
  const stats = addStats(cls.baseStats, c.bonusStats);
  const skills = new Set(c.skills);
  const maxHp = maxHpFor(stats.health, origin.hpPercent);

  roster.push({ team, isMain: true, name: c.name, defId: c.classId, maxHp, appearance: { ...c.appearance } });
  units.push({
    idx: units.length,
    team,
    isMain: true,
    maxHp,
    hp: maxHp,
    power: stats.strength,
    agility: stats.agility,
    speed: stats.speed,
    armor: origin.armor + (skills.has('iron_skin') ? 3 : 0),
    dodgeBonus: origin.dodge + (skills.has('sixth_sense') ? 6 : 0),
    gauge: origin.initiative + (skills.has('quick_start') ? 50 : 0),
    tieBreak: 0,
    undrawn: [...c.weapons],
    weapon: null,
    skills,
    secondWindUsed: false,
  });

  const petBoost = skills.has('pack_leader') ? 125 : 100;
  for (const petId of c.pets) {
    const pet = PETS[petId];
    if (!pet) throw new Error(`Unknown pet '${petId}'`);
    const petHp = Math.floor((pet.maxHp * petBoost) / 100);
    roster.push({ team, isMain: false, name: pet.name, defId: pet.id, maxHp: petHp });
    units.push({
      idx: units.length,
      team,
      isMain: false,
      maxHp: petHp,
      hp: petHp,
      power: Math.floor((pet.damage * petBoost) / 100),
      agility: pet.agility,
      speed: pet.speed + (skills.has('whistle') ? 4 : 0),
      armor: 0,
      dodgeBonus: 0,
      gauge: 0,
      tieBreak: 0,
      undrawn: [],
      weapon: null,
      skills: new Set(),
      secondWindUsed: false,
    });
  }
}

/**
 * Simulates a whole fight. Pure and deterministic: the same characters and seed
 * always produce the same log. Team 0 is `a`, team 1 is `b`.
 */
export function runFight(a: Character, b: Character, seed: number): FightLog {
  const rng = new Rng(seed);
  const roster: UnitInfo[] = [];
  const units: Unit[] = [];
  buildUnits(a, 0, roster, units);
  buildUnits(b, 1, roster, units);
  for (const u of units) u.tieBreak = rng.next();

  const events: FightEvent[] = [];
  let winner: Team | null = null;
  const mains: [Unit, Unit] = [units.find((u) => u.isMain && u.team === 0)!, units.find((u) => u.isMain && u.team === 1)!];

  const alive = (u: Unit) => u.hp > 0;
  const enemiesOf = (u: Unit) => units.filter((e) => e.team !== u.team && alive(e));

  const pickTarget = (u: Unit): Unit => {
    const enemyMain = mains[u.team === 0 ? 1 : 0];
    const pets = enemiesOf(u).filter((e) => !e.isMain);
    if (pets.length === 0 || rng.chance(65)) return enemyMain;
    return rng.pick(pets);
  };

  const dodgeChance = (att: Unit, def: Unit): number => {
    const weapon = att.weapon ? WEAPONS[att.weapon] : undefined;
    let accuracy = weapon?.accuracy ?? 0;
    if (weapon?.heavy && accuracy < 0 && att.skills.has('heavy_hands')) accuracy = 0;
    const chance = 5 + 4 * def.agility - 2 * att.agility + def.dodgeBonus - accuracy;
    return Math.max(0, Math.min(40, chance));
  };

  const baseDamage = (att: Unit, kind: HitKind): number => {
    if (!att.isMain) return att.power;
    const weapon = att.weapon ? WEAPONS[att.weapon] : undefined;
    let dmg = att.power + (weapon ? weapon.damage : FISTS_DAMAGE + (att.skills.has('iron_fists') ? 4 : 0));
    if (weapon?.heavy && att.skills.has('heavy_hands')) dmg = Math.floor((dmg * 125) / 100);
    if (kind === 'throw') dmg = Math.floor((dmg * (att.skills.has('thrower') ? 200 : 150)) / 100);
    if (att.skills.has('fury') && att.hp * 100 < att.maxHp * 30) dmg = Math.floor((dmg * 130) / 100);
    return dmg;
  };

  const kill = (u: Unit, by: Unit) => {
    events.push({ t: 'death', actor: u.idx });
    if (u.isMain && winner === null) winner = by.team;
  };

  /** Resolves one attack. Returns true if the target survived. */
  const attack = (att: Unit, def: Unit, kind: HitKind): boolean => {
    const weaponId = att.isMain ? att.weapon : null;
    if (rng.chance(dodgeChance(att, def))) {
      events.push({ t: 'dodge', actor: att.idx, target: def.idx, kind });
      const melee = kind !== 'throw' && kind !== 'counter';
      if (melee && def.skills.has('counter') && rng.chance(50)) attack(def, att, 'counter');
      return true;
    }

    const roll = rng.int(80, 121);
    // Pets deal many small hits, so armor only counts half against them.
    const armor = att.isMain ? def.armor : Math.floor(def.armor / 2);
    let damage = Math.max(1, Math.floor((baseDamage(att, kind) * roll) / 100) - armor);
    const blocked = def.skills.has('shield') && rng.chance(30);
    if (blocked) damage = Math.max(1, Math.floor(damage / 4));
    def.hp = Math.max(0, def.hp - damage);
    events.push({ t: blocked ? 'block' : 'hit', actor: att.idx, target: def.idx, kind, weapon: weaponId, damage, hp: def.hp });

    if (def.hp === 0) {
      kill(def, att);
      return false;
    }
    if (att.skills.has('disarm') && def.weapon && rng.chance(15)) {
      events.push({ t: 'disarm', actor: att.idx, target: def.idx, weapon: def.weapon });
      def.weapon = null;
    }
    if (def.skills.has('second_wind') && !def.secondWindUsed && def.hp * 100 < def.maxHp * 25) {
      def.secondWindUsed = true;
      const amount = Math.floor(def.maxHp / 4);
      def.hp = Math.min(def.maxHp, def.hp + amount);
      events.push({ t: 'heal', actor: def.idx, amount, hp: def.hp });
    }
    return true;
  };

  const takeTurn = (u: Unit) => {
    const target = pickTarget(u);
    if (u.isMain && u.undrawn.length > 0 && rng.chance(u.weapon === null ? 50 : 15)) {
      const [weapon] = u.undrawn.splice(rng.int(0, u.undrawn.length), 1);
      u.weapon = weapon!;
      events.push({ t: 'draw', actor: u.idx, weapon: u.weapon });
    }
    if (u.isMain && u.weapon && rng.chance(u.skills.has('thrower') ? 35 : 8)) {
      attack(u, target, 'throw');
      u.weapon = null;
      return;
    }

    if (!attack(u, target, 'melee') || winner !== null || !alive(u)) return;
    if (u.isMain) {
      const doubleChance = Math.min(40, u.agility * 3 + (u.skills.has('double_strike') ? 15 : 0));
      if (rng.chance(doubleChance) && !attack(u, target, 'double')) return;
      if (winner !== null || !alive(u)) return;
      if (u.skills.has('combo')) {
        for (let extra = 0; extra < 2 && rng.chance(30); extra++) {
          if (!attack(u, target, 'combo') || winner !== null || !alive(u)) return;
        }
      }
    }
  };

  let actions = 0;
  while (winner === null && actions < MAX_ACTIONS) {
    for (const u of units) if (alive(u)) u.gauge += 10 + 2 * u.speed;
    const ready = units
      .filter((u) => alive(u) && u.gauge >= GAUGE_FULL)
      .sort((x, y) => y.gauge - x.gauge || x.tieBreak - y.tieBreak);
    for (const u of ready) {
      if (winner !== null) break;
      if (!alive(u)) continue;
      u.gauge -= GAUGE_FULL;
      takeTurn(u);
      actions++;
    }
  }

  if (winner === null) {
    // Timeout: higher health percentage wins; an exact tie goes to the defender.
    const [m0, m1] = mains;
    winner = m0.hp * m1.maxHp > m1.hp * m0.maxHp ? 0 : 1;
  }

  return { seed: seed >>> 0, roster, events, winner };
}
