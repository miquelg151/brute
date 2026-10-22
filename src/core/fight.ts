import { CLASSES, FISTS_DAMAGE, LOADOUT_SIZE, ORIGINS, PETS, WEAPONS } from './catalog';
import { maxHpFor } from './character';
import { STANCES, TARGETS, WEAPON_STYLES, type Stance, type TargetMode, type WeaponStyle } from './tactics';
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

export type HitKind = 'melee' | 'double' | 'combo' | 'counter' | 'throw' | 'special';

export type FightEvent =
  | { t: 'draw'; actor: number; weapon: string }
  | { t: 'hit'; actor: number; target: number; kind: HitKind; weapon: string | null; damage: number; hp: number }
  | { t: 'block'; actor: number; target: number; kind: HitKind; weapon: string | null; damage: number; hp: number }
  | { t: 'dodge'; actor: number; target: number; kind: HitKind }
  | { t: 'disarm'; actor: number; target: number; weapon: string }
  | { t: 'heal'; actor: number; amount: number; hp: number }
  /** A special-strike moment. `quality` is null when the player's input is still missing. */
  | { t: 'special'; actor: number; index: number; quality: number | null }
  | { t: 'death'; actor: number };

export interface FightLog {
  seed: number;
  roster: UnitInfo[];
  events: FightEvent[];
  /** Null while the fight is waiting for a special-strike input. */
  winner: Team | null;
}

/** Per-team choices and player inputs. Everything here is part of what makes a fight reproducible. */
export interface TeamOptions {
  stance?: Stance;
  target?: TargetMode;
  weaponStyle?: WeaponStyle;
  /** Weapons brought into this fight (subset of the owned ones, max LOADOUT_SIZE). Defaults to the first owned ones. */
  weapons?: string[];
  /** Warm-up minigame score, 0-100. */
  warmup?: number;
  /** True when a player is watching and can perform special strikes. */
  interactive?: boolean;
  /** Timing quality (0-100) of each special strike, in order. */
  specials?: number[];
}

export interface FightOptions {
  a?: TeamOptions;
  b?: TeamOptions;
}

/** Safety cap. If reached, the side with the higher health percentage wins. */
export const MAX_ACTIONS = 400;
/** Own-turn numbers on which an interactive fighter gets a special strike. */
export const SPECIAL_TURNS = [3, 7];
/** Below this timing quality the special fails and the turn plays normally. */
export const SPECIAL_MIN_QUALITY = 25;
/** Extra damage of a perfect special strike, in percent. */
export const SPECIAL_MAX_BONUS = 60;
/** A perfect warm-up adds this much damage, in percent. */
export const WARMUP_MAX_BONUS = 5;
const GAUGE_FULL = 100;
const DODGE_CAP = 40;

interface Unit {
  idx: number;
  team: Team;
  isMain: boolean;
  maxHp: number;
  hp: number;
  /** Strength for main fighters, flat damage for pets. */
  power: number;
  /** Percent multiplier on main fighter damage (stance, warm-up). */
  damagePct: number;
  agility: number;
  speed: number;
  armor: number;
  dodgeBonus: number;
  dodgeCap: number;
  gauge: number;
  tieBreak: number;
  undrawn: string[];
  weapon: string | null;
  skills: Set<string>;
  secondWindUsed: boolean;
  turns: number;
  interactive: boolean;
  specials: readonly number[];
  specialsUsed: number;
  /** Chance to aim at the enemy fighter while their pets are alive. */
  fighterChance: number;
  throwChance: number;
  drawChance: number;
}

/** The weapons actually brought into a fight: only owned ones, at most LOADOUT_SIZE. */
export function loadoutFor(c: Character, chosen?: readonly string[]): string[] {
  const pool = chosen ? c.weapons.filter((w) => chosen.includes(w)) : c.weapons;
  return pool.slice(0, LOADOUT_SIZE);
}

export function warmupBonus(score: number): number {
  return Math.floor((Math.max(0, Math.min(100, score)) * WARMUP_MAX_BONUS) / 100);
}

function buildUnits(c: Character, team: Team, opts: TeamOptions, roster: UnitInfo[], units: Unit[]): void {
  const cls = CLASSES[c.classId];
  const origin = ORIGINS[c.originId];
  if (!cls || !origin) throw new Error(`Invalid character '${c.name}'`);
  const stance = STANCES[opts.stance ?? 'balanced'];
  const fighterChance = TARGETS[opts.target ?? 'mixed'].fighterChance;
  const style = WEAPON_STYLES[opts.weaponStyle ?? 'normal'];
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
    damagePct: 100 + stance.damage + warmupBonus(opts.warmup ?? 0),
    agility: stats.agility,
    speed: stats.speed,
    armor: origin.armor + stance.armor + (skills.has('iron_skin') ? 3 : 0),
    dodgeBonus: origin.dodge + stance.dodge + (skills.has('sixth_sense') ? 6 : 0),
    dodgeCap: DODGE_CAP + Math.max(0, stance.dodge),
    gauge: origin.initiative + (skills.has('quick_start') ? 50 : 0),
    tieBreak: 0,
    undrawn: loadoutFor(c, opts.weapons),
    weapon: null,
    skills,
    secondWindUsed: false,
    turns: 0,
    interactive: opts.interactive ?? false,
    specials: opts.specials ?? [],
    specialsUsed: 0,
    fighterChance,
    // The Thrower skill makes any style except "keep" throw much more.
    throwChance: style.throwChance === 0 ? 0 : style.throwChance + (skills.has('thrower') ? 27 : 0),
    drawChance: style.drawChance,
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
      damagePct: 100,
      agility: pet.agility,
      speed: pet.speed + (skills.has('whistle') ? 4 : 0),
      armor: 0,
      dodgeBonus: 0,
      dodgeCap: DODGE_CAP,
      gauge: 0,
      tieBreak: 0,
      undrawn: [],
      weapon: null,
      skills: new Set(),
      secondWindUsed: false,
      turns: 0,
      interactive: false,
      specials: [],
      specialsUsed: 0,
      fighterChance,
      throwChance: 0,
      drawChance: 0,
    });
  }
}

/**
 * Simulates a whole fight. Pure and deterministic: the same characters, seed and
 * options always produce the same log. Team 0 is `a`, team 1 is `b`.
 *
 * If an interactive fighter reaches a special strike whose input is not in
 * `specials` yet, the log stops there with `winner: null`. Re-running with the
 * input appended reproduces the same events up to that point and continues.
 */
export function runFight(a: Character, b: Character, seed: number, options: FightOptions = {}): FightLog {
  const rng = new Rng(seed);
  const roster: UnitInfo[] = [];
  const units: Unit[] = [];
  buildUnits(a, 0, options.a ?? {}, roster, units);
  buildUnits(b, 1, options.b ?? {}, roster, units);
  for (const u of units) u.tieBreak = rng.next();

  const events: FightEvent[] = [];
  let winner: Team | null = null;
  let waitingForInput = false;
  const mains: [Unit, Unit] = [units.find((u) => u.isMain && u.team === 0)!, units.find((u) => u.isMain && u.team === 1)!];

  const alive = (u: Unit) => u.hp > 0;
  const enemiesOf = (u: Unit) => units.filter((e) => e.team !== u.team && alive(e));
  const enemyMainOf = (u: Unit) => mains[u.team === 0 ? 1 : 0];

  const pickTarget = (u: Unit): Unit => {
    const pets = enemiesOf(u).filter((e) => !e.isMain);
    if (pets.length === 0 || rng.chance(u.fighterChance)) return enemyMainOf(u);
    return rng.pick(pets);
  };

  const dodgeChance = (att: Unit, def: Unit): number => {
    const weapon = att.weapon ? WEAPONS[att.weapon] : undefined;
    let accuracy = weapon?.accuracy ?? 0;
    if (weapon?.heavy && accuracy < 0 && att.skills.has('heavy_hands')) accuracy = 0;
    const chance = 5 + 4 * def.agility - 2 * att.agility + def.dodgeBonus - accuracy;
    return Math.max(0, Math.min(def.dodgeCap, chance));
  };

  const baseDamage = (att: Unit, kind: HitKind, quality: number): number => {
    if (!att.isMain) return att.power;
    const weapon = att.weapon ? WEAPONS[att.weapon] : undefined;
    let dmg = att.power + (weapon ? weapon.damage : FISTS_DAMAGE + (att.skills.has('iron_fists') ? 4 : 0));
    if (weapon?.heavy && att.skills.has('heavy_hands')) dmg = Math.floor((dmg * 125) / 100);
    if (kind === 'throw') dmg = Math.floor((dmg * (att.skills.has('thrower') ? 200 : 150)) / 100);
    if (kind === 'special') dmg = Math.floor((dmg * (100 + (quality * SPECIAL_MAX_BONUS) / 100)) / 100);
    if (att.skills.has('fury') && att.hp * 100 < att.maxHp * 30) dmg = Math.floor((dmg * 130) / 100);
    return Math.floor((dmg * att.damagePct) / 100);
  };

  const kill = (u: Unit, by: Unit) => {
    events.push({ t: 'death', actor: u.idx });
    if (u.isMain && winner === null) winner = by.team;
  };

  /** Resolves one attack. Returns true if the target survived. Specials and throws cannot be dodged. */
  const attack = (att: Unit, def: Unit, kind: HitKind, quality = 0): boolean => {
    const weaponId = att.isMain ? att.weapon : null;
    if (kind !== 'special' && kind !== 'throw' && rng.chance(dodgeChance(att, def))) {
      events.push({ t: 'dodge', actor: att.idx, target: def.idx, kind });
      const melee = kind !== 'counter';
      if (melee && def.skills.has('counter') && rng.chance(50)) attack(def, att, 'counter');
      return true;
    }

    const roll = rng.int(80, 121);
    // Pets deal many small hits, so armor only counts half against them.
    const armor = att.isMain ? def.armor : Math.floor(def.armor / 2);
    let damage = Math.max(1, Math.floor((baseDamage(att, kind, quality) * roll) / 100) - armor);
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

  /** Returns true if the turn was consumed by a special strike (or is waiting for one). */
  const trySpecial = (u: Unit): boolean => {
    if (!u.isMain || !u.interactive || !SPECIAL_TURNS.includes(u.turns)) return false;
    const index = u.specialsUsed;
    const quality = u.specials[index];
    if (quality === undefined) {
      events.push({ t: 'special', actor: u.idx, index, quality: null });
      waitingForInput = true;
      return true;
    }
    u.specialsUsed++;
    const q = Math.max(0, Math.min(100, Math.round(quality)));
    events.push({ t: 'special', actor: u.idx, index, quality: q });
    if (q < SPECIAL_MIN_QUALITY) return false;
    attack(u, enemyMainOf(u), 'special', q);
    return true;
  };

  const takeTurn = (u: Unit) => {
    u.turns++;
    if (trySpecial(u)) return;
    const target = pickTarget(u);
    if (u.isMain && u.undrawn.length > 0 && rng.chance(u.weapon === null ? u.drawChance : 15)) {
      const [weapon] = u.undrawn.splice(rng.int(0, u.undrawn.length), 1);
      u.weapon = weapon!;
      events.push({ t: 'draw', actor: u.idx, weapon: u.weapon });
    }
    if (u.isMain && u.weapon && rng.chance(u.throwChance)) {
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
  while (winner === null && !waitingForInput && actions < MAX_ACTIONS) {
    for (const u of units) if (alive(u)) u.gauge += 10 + 2 * u.speed;
    const ready = units
      .filter((u) => alive(u) && u.gauge >= GAUGE_FULL)
      .sort((x, y) => y.gauge - x.gauge || x.tieBreak - y.tieBreak);
    for (const u of ready) {
      if (winner !== null || waitingForInput) break;
      if (!alive(u)) continue;
      u.gauge -= GAUGE_FULL;
      takeTurn(u);
      actions++;
    }
  }

  if (waitingForInput) return { seed: seed >>> 0, roster, events, winner: null };
  if (winner === null) {
    // Timeout: higher health percentage wins; an exact tie goes to the defender.
    const [m0, m1] = mains;
    winner = m0.hp * m1.maxHp > m1.hp * m0.maxHp ? 0 : 1;
  }
  return { seed: seed >>> 0, roster, events, winner };
}
