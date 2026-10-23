// The fight simulation. See docs/COMBAT.md for the rules in plain words.
import { CLASSES, FISTS_DAMAGE, GEAR, LEARNED_MANA, LOADOUT_SIZE, ORIGINS, PETS, SPELLS, WEAPONS, type GearDef } from './catalog';
import { CARDS, DECK_SIZE, botCardLevel, scaled } from './cards';
import { maxHpFor } from './character';
import { Rng } from './rng';
import { DEFAULT_PLAN, STANCES, TARGETS, WEAPON_STYLES, type Plan } from './tactics';
import { addStats, type Appearance, type Character } from './types';

export type Team = 0 | 1;

/** Static info about each unit, so a replay can be drawn without the characters. */
export interface UnitInfo {
  team: Team;
  isMain: boolean;
  name: string;
  /** Class id for main fighters, pet id for pets, 'spirit' for summons. */
  defId: string;
  maxHp: number;
  maxStamina: number;
  maxMana: number;
  appearance?: Appearance;
  /** Summoned units start hidden and appear with a 'summon' event. */
  summoned?: boolean;
}

export type HitKind = 'melee' | 'double' | 'combo' | 'counter' | 'throw' | 'special' | 'spell';

/** What a side decides at a break between rounds. */
export interface BreakChoice extends Plan {
  weapons: string[];
  /** Regain much more stamina and mana, but start the next round late. */
  recover: boolean;
}

export interface GearChoice {
  armor: string | null;
  accessory: string | null;
}

export type FightEvent =
  | { t: 'round'; round: number }
  /** Choices for the next round, per team. Null while that side's input is still missing. */
  | { t: 'break'; round: number; choices: [BreakChoice | null, BreakChoice | null] }
  | { t: 'draw'; actor: number; weapon: string }
  | { t: 'hit'; actor: number; target: number; kind: HitKind; weapon: string | null; damage: number; hp: number }
  | { t: 'block'; actor: number; target: number; kind: HitKind; weapon: string | null; damage: number; hp: number }
  | { t: 'dodge'; actor: number; target: number; kind: HitKind }
  /** A blinded unit's attack that missed. */
  | { t: 'miss'; actor: number; target: number }
  | { t: 'disarm'; actor: number; target: number; weapon: string }
  | { t: 'heal'; actor: number; amount: number; hp: number }
  | { t: 'cast'; actor: number; spell: string; target: number | null }
  /** A ward absorbed damage (or was raised, when absorbed is 0). */
  | { t: 'ward'; actor: number; absorbed: number; left: number }
  | { t: 'summon'; actor: number; owner: number; hp: number }
  | { t: 'unsummon'; actor: number }
  /** Out of stamina: the turn is spent catching breath. */
  | { t: 'rest'; actor: number }
  /** Current stamina and mana of a main fighter, sent when they change. */
  | { t: 'res'; actor: number; stamina: number; mana: number }
  /** Start of a tick (counted across rounds), so a replay knows where it is. */
  | { t: 'tick'; n: number }
  | { t: 'energy'; actor: number; energy: number }
  | { t: 'card'; actor: number; card: string; level: number }
  /** A special strike from the Special Strike card, with its timing quality. */
  | { t: 'special'; actor: number; quality: number }
  | { t: 'death'; actor: number };

export interface FightLog {
  seed: number;
  roster: UnitInfo[];
  events: FightEvent[];
  /** Null while the fight is waiting for a player input. */
  winner: Team | null;
}

/** A card played by the player: applied at the start of `tick` (ticks count across rounds from 0). */
export interface CardPlay {
  tick: number;
  card: string;
  /** Special Strike only: how well the timing bar was hit, 0-100. */
  quality?: number;
}

/** Per-team choices and player inputs. Everything here is part of what makes a fight reproducible. */
export interface TeamOptions extends Partial<Plan> {
  /** Weapons brought into this fight (owned ones only, max LOADOUT_SIZE). Defaults to the first owned ones. */
  weapons?: string[];
  gear?: GearChoice;
  /** True when a player controls this side: it plays its own cards and decides at breaks. */
  interactive?: boolean;
  /** Cards brought (id -> level). Missing: the first DECK_SIZE owned cards at bot level. */
  deck?: Record<string, number>;
  /** Interactive side: the cards the player played, in order. */
  plays?: CardPlay[];
  /** Bots: timing quality of their special strikes (missing: rolled 40-90). */
  specialQuality?: number;
  /** Choice at each break, in order. */
  breaks?: BreakChoice[];
}

export interface FightOptions {
  a?: TeamOptions;
  b?: TeamOptions;
}

export const ROUNDS = 3;
/** Length of a round, in initiative ticks. */
export const ROUND_TICKS = 45;
/** Below this timing quality the special fails and the turn plays normally. */
export const SPECIAL_MIN_QUALITY = 25;
/** Extra damage of a perfect special strike, in percent. */
export const SPECIAL_MAX_BONUS = 60;

export const MAX_ENERGY = 10;
export const START_ENERGY = 3;
/** One energy point every this many ticks. */
export const ENERGY_EVERY = 4;
/** Bots play a card when their energy reaches this (unless a rule fires earlier). */
const BOT_SPEND_AT = 8;

export const MAX_STAMINA = 100;
/** Base stamina cost of each kind of action, before stance and gear. */
export const STAMINA_COST = { melee: 7, heavy: 9, extra: 5, throw: 8, counter: 4, special: 20 } as const;
export const STAMINA_REGEN = 5;
export const MANA_REGEN = 4;
/** Below this much stamina a fighter is tired. */
export const TIRED_BELOW = 25;
const REST_STAMINA = 25;
const BREAK_STAMINA = 35;
const RECOVER_STAMINA = 70;
const BREAK_MANA = 25;
const RECOVER_MANA = 50;
const RECOVER_GAUGE = -40;
const MAGIC_RESIST_CAP = 60;
const GAUGE_FULL = 100;
const DODGE_CAP = 40;
/** Chance (%) that the Shield skill blocks a hit. */
const SHIELD_BLOCK = 25;
/** Casters' class mana grows by this much per level (less at the start, more later). */
const MANA_PER_LEVEL = 1;
/** A fighter's speed above this counts half, so very fast fighters don't get endless turns. Pets are not capped. */
const SPEED_SOFT_CAP = 6;

/** How much a unit's turn gauge fills each tick. */
function gaugeGain(speed: number, isMain: boolean): number {
  return 10 + 2 * speed - (isMain ? Math.max(0, speed - SPEED_SOFT_CAP) : 0);
}

interface Unit {
  idx: number;
  team: Team;
  isMain: boolean;
  maxHp: number;
  hp: number;
  /** Strength for main fighters, flat damage for pets and spirits. */
  power: number;
  magic: number;
  agility: number;
  speed: number;
  /** Values before the stance is applied, so the plan can change at breaks. */
  base: { armor: number; dodge: number; damagePct: number; staminaPct: number };
  armor: number;
  dodgeBonus: number;
  dodgeCap: number;
  /** Percent multiplier on damage (stance). */
  damagePct: number;
  /** Percent multiplier on stamina costs (stance, gear). */
  staminaPct: number;
  magicResist: number;
  startGauge: number;
  gauge: number;
  tieBreak: number;
  owned: string[];
  thrown: Set<string>;
  undrawn: string[];
  weapon: string | null;
  skills: Set<string>;
  spells: string[];
  plan: Plan;
  fighterChance: number;
  throwChance: number;
  drawChance: number;
  armorPierce: number;
  stamina: number;
  maxStamina: number;
  staminaRegen: number;
  mana: number;
  maxMana: number;
  ward: number;
  blinded: boolean;
  secondWindUsed: boolean;
  roundTurns: number;
  summonedThisRound: boolean;
  /** For spirits: their owner, and whether they are currently on the field. */
  owner: number;
  interactive: boolean;
  /** Card state (main fighters). */
  energy: number;
  deck: Record<string, number>;
  plays: readonly CardPlay[];
  specialQuality: number | undefined;
  /** Special Strike waiting for this unit's next turn: its quality and max bonus. */
  pendingSpecial: { quality: number; bonus: number } | null;
  lastEnergy: number;
  breaks: readonly BreakChoice[] | undefined;
  lastRes: string;
}

/** The weapons actually brought into a fight: only owned ones, at most LOADOUT_SIZE. */
export function loadoutFor(c: Character, chosen?: readonly string[]): string[] {
  const pool = chosen ? c.weapons.filter((w) => chosen.includes(w)) : c.weapons;
  return pool.slice(0, LOADOUT_SIZE);
}

/** Worn gear: the chosen pieces if owned, otherwise the first owned piece of each slot. */
export function gearFor(c: Character, chosen?: GearChoice): GearChoice {
  const pick = (slot: 'armor' | 'accessory', wanted: string | null | undefined) => {
    const owned = c.gear.filter((g) => GEAR[g]?.slot === slot);
    if (wanted !== undefined) return wanted !== null && owned.includes(wanted) ? wanted : null;
    return owned[0] ?? null;
  };
  return { armor: pick('armor', chosen?.armor), accessory: pick('accessory', chosen?.accessory) };
}

/** The cards a fighter brings when nobody chose: the first DECK_SIZE, at the bot level. */
export function defaultDeck(c: Character): Record<string, number> {
  const level = botCardLevel(c.level);
  return Object.fromEntries(c.cards.slice(0, DECK_SIZE).map((id) => [id, level]));
}

export function spellsOf(c: Character): string[] {
  return c.skills.filter((s) => SPELLS[s]);
}

/** Max mana: class mana plus gear, or a small pool for non-casters who learned a spell. */
export function maxManaFor(c: Character, gear: GearDef[]): number {
  const fromGear = gear.reduce((sum, g) => sum + (g.mana ?? 0), 0);
  const classMana = CLASSES[c.classId].mana;
  const base = classMana ? classMana + MANA_PER_LEVEL * c.level : spellsOf(c).length > 0 ? LEARNED_MANA : 0;
  return base > 0 ? base + fromGear : 0;
}

function applyPlan(u: Unit, plan: Plan): void {
  const stance = STANCES[plan.stance];
  const style = WEAPON_STYLES[plan.weaponStyle];
  u.plan = { ...plan };
  u.armor = Math.max(0, u.base.armor + stance.armor);
  u.dodgeBonus = u.base.dodge + stance.dodge;
  u.dodgeCap = DODGE_CAP + Math.max(0, stance.dodge);
  u.damagePct = u.base.damagePct + stance.damage;
  u.staminaPct = Math.round((u.base.staminaPct * stance.stamina) / 100);
  u.fighterChance = TARGETS[plan.target].fighterChance;
  // The Thrower skill makes any style except "keep" throw much more.
  u.throwChance = style.throwChance === 0 ? 0 : style.throwChance + (u.skills.has('thrower') ? 27 : 0);
  u.drawChance = style.drawChance;
  u.armorPierce = style.armorPierce;
}

function buildUnits(c: Character, team: Team, opts: TeamOptions, roster: UnitInfo[], units: Unit[]): void {
  const cls = CLASSES[c.classId];
  const origin = ORIGINS[c.originId];
  if (!cls || !origin) throw new Error(`Invalid character '${c.name}'`);
  const worn = gearFor(c, opts.gear);
  const gear = [worn.armor, worn.accessory].map((g) => (g ? GEAR[g] : undefined)).filter((g): g is GearDef => !!g);
  const sum = (key: keyof GearDef) => gear.reduce((total, g) => total + ((g[key] as number | undefined) ?? 0), 0);
  const stats = addStats(cls.baseStats, c.bonusStats);
  const skills = new Set(c.skills);
  const maxHp = maxHpFor(stats.health, origin.hpPercent);
  const maxMana = maxManaFor(c, gear);
  const owned = [...c.weapons];

  roster.push({ team, isMain: true, name: c.name, defId: c.classId, maxHp, maxStamina: MAX_STAMINA, maxMana, appearance: { ...c.appearance } });
  const main: Unit = {
    idx: units.length,
    team,
    isMain: true,
    maxHp,
    hp: maxHp,
    power: stats.strength + sum('strength'),
    magic: stats.magic,
    agility: stats.agility,
    speed: Math.max(0, stats.speed + sum('speed')),
    base: {
      armor: origin.armor + sum('armor') + (skills.has('iron_skin') ? 3 : 0),
      dodge: origin.dodge + sum('dodge') + (skills.has('sixth_sense') ? 6 : 0),
      damagePct: 100,
      staminaPct: 100 + sum('staminaCost'),
    },
    armor: 0,
    dodgeBonus: 0,
    dodgeCap: DODGE_CAP,
    damagePct: 100,
    staminaPct: 100,
    magicResist: Math.min(MAGIC_RESIST_CAP, cls.magicResist + sum('magicResist')),
    startGauge: origin.initiative + (skills.has('quick_start') ? 50 : 0),
    gauge: 0,
    tieBreak: 0,
    owned,
    thrown: new Set(),
    undrawn: loadoutFor(c, opts.weapons),
    weapon: null,
    skills,
    spells: spellsOf(c),
    plan: DEFAULT_PLAN,
    fighterChance: 0,
    throwChance: 0,
    drawChance: 0,
    armorPierce: 0,
    stamina: MAX_STAMINA,
    maxStamina: MAX_STAMINA,
    staminaRegen: STAMINA_REGEN + sum('staminaRegen'),
    mana: maxMana,
    maxMana,
    ward: 0,
    blinded: false,
    secondWindUsed: false,
    roundTurns: 0,
    summonedThisRound: false,
    owner: -1,
    interactive: opts.interactive ?? false,
    energy: START_ENERGY,
    deck: opts.deck ?? defaultDeck(c),
    plays: opts.plays ?? [],
    specialQuality: opts.specialQuality,
    pendingSpecial: null,
    lastEnergy: -1,
    breaks: opts.breaks,
    lastRes: '',
  };
  applyPlan(main, { stance: opts.stance ?? 'balanced', target: opts.target ?? 'mixed', weaponStyle: opts.weaponStyle ?? 'normal' });
  main.gauge = main.startGauge;
  units.push(main);

  const companion = (info: UnitInfo, hp: number, power: number, agility: number, speed: number): void => {
    roster.push(info);
    const u: Unit = {
      ...main,
      idx: units.length,
      isMain: false,
      maxHp: hp,
      hp: info.summoned ? 0 : hp,
      power,
      magic: 0,
      agility,
      speed,
      base: { armor: 0, dodge: 0, damagePct: 100, staminaPct: 100 },
      magicResist: 0,
      startGauge: 0,
      gauge: 0,
      owned: [],
      thrown: new Set(),
      undrawn: [],
      skills: new Set(),
      spells: [],
      maxMana: 0,
      mana: 0,
      owner: main.idx,
      interactive: false,
      deck: {},
      plays: [],
      breaks: undefined,
    };
    applyPlan(u, main.plan);
    units.push(u);
  };

  const petBoost = (skills.has('pack_leader') ? 125 : 100) + sum('petHealth');
  for (const petId of c.pets) {
    const pet = PETS[petId];
    if (!pet) throw new Error(`Unknown pet '${petId}'`);
    const petHp = Math.floor((pet.maxHp * petBoost) / 100);
    const petPower = Math.floor((pet.damage * (skills.has('pack_leader') ? 135 : 100)) / 100);
    companion(
      { team, isMain: false, name: pet.name, defId: pet.id, maxHp: petHp, maxStamina: 0, maxMana: 0 },
      petHp,
      petPower,
      pet.agility,
      pet.speed + (skills.has('whistle') ? 4 : 0),
    );
  }
  if (skills.has('spirit')) {
    const spiritHp = 10 + stats.magic;
    companion(
      { team, isMain: false, name: 'Spirit', defId: 'spirit', maxHp: spiritHp, maxStamina: 0, maxMana: 0, summoned: true },
      spiritHp,
      1 + Math.floor(stats.magic / 2),
      8,
      6,
    );
  }
}

/** The rule a side follows at breaks when nobody is choosing for it. */
function autoBreak(me: Unit, foe: Unit): BreakChoice {
  const mine = me.hp / me.maxHp;
  const theirs = foe.hp / foe.maxHp;
  let stance = me.plan.stance;
  if (mine + 0.15 < theirs) stance = foe.spells.length > 0 ? 'agile' : 'defensive';
  else if (mine > theirs + 0.15) stance = 'aggressive';
  return { ...me.plan, stance, weapons: [...me.undrawn, ...(me.weapon ? [me.weapon] : [])], recover: me.stamina < 35 };
}

/**
 * Simulates a whole fight. Pure and deterministic: the same characters, seed and
 * options always produce the same log. Team 0 is `a`, team 1 is `b`.
 *
 * If an interactive side reaches a break whose input is not
 * given yet, the log stops there with `winner: null`. Re-running with the input
 * appended reproduces the same events up to that point and continues.
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
  let waiting = false;
  const mains: [Unit, Unit] = [units.find((u) => u.isMain && u.team === 0)!, units.find((u) => u.isMain && u.team === 1)!];
  const characters: [Character, Character] = [a, b];

  const alive = (u: Unit) => u.hp > 0;
  const enemyMainOf = (u: Unit) => mains[u.team === 0 ? 1 : 0];
  const tired = (u: Unit) => u.isMain && u.stamina < TIRED_BELOW;
  const cost = (u: Unit, base: number) => (u.isMain ? Math.ceil((base * u.staminaPct) / 100) : 0);
  const canPay = (u: Unit, base: number) => u.stamina >= cost(u, base);
  const pay = (u: Unit, base: number): boolean => {
    if (!canPay(u, base)) return false;
    u.stamina -= cost(u, base);
    return true;
  };
  const emitRes = () => {
    for (const m of mains) {
      const key = `${m.stamina}/${m.mana}`;
      if (key !== m.lastRes) {
        m.lastRes = key;
        events.push({ t: 'res', actor: m.idx, stamina: m.stamina, mana: m.mana });
      }
    }
  };

  const pickTarget = (u: Unit): Unit => {
    const others = units.filter((e) => e.team !== u.team && alive(e) && !e.isMain);
    if (others.length === 0 || rng.chance(u.fighterChance)) return enemyMainOf(u);
    return rng.pick(others);
  };

  const dodgeChance = (att: Unit, def: Unit, magic = false): number => {
    const weapon = !magic && att.weapon ? WEAPONS[att.weapon] : undefined;
    let accuracy = weapon?.accuracy ?? 0;
    if (weapon?.heavy && accuracy < 0 && att.skills.has('heavy_hands')) accuracy = 0;
    const chance = 5 + 4 * def.agility - 2 * att.agility + def.dodgeBonus - accuracy - (tired(def) ? 10 : 0);
    const capped = Math.max(0, Math.min(def.dodgeCap, chance));
    // Spells are hard to dodge: a bit more than half the usual chance, unless the
    // defender fights in the Agile stance.
    return magic && def.plan.stance !== 'agile' ? Math.floor((capped * 60) / 100) : capped;
  };

  const baseDamage = (att: Unit, kind: HitKind, quality: number, specialBonus = SPECIAL_MAX_BONUS): number => {
    if (!att.isMain) return att.power;
    const weapon = att.weapon ? WEAPONS[att.weapon] : undefined;
    let dmg = att.power + (weapon ? weapon.damage : FISTS_DAMAGE + (att.skills.has('iron_fists') ? 4 : 0));
    if (weapon?.heavy && att.skills.has('heavy_hands')) dmg = Math.floor((dmg * 125) / 100);
    if (kind === 'throw') dmg = Math.floor((dmg * (att.skills.has('thrower') ? 200 : 150)) / 100);
    if (kind === 'special') dmg = Math.floor((dmg * (100 + (quality * specialBonus) / 100)) / 100);
    if (att.skills.has('fury') && att.hp * 100 < att.maxHp * 30) dmg = Math.floor((dmg * 130) / 100);
    if (tired(att)) dmg = Math.floor((dmg * 75) / 100);
    return Math.floor((dmg * att.damagePct) / 100);
  };

  const kill = (u: Unit, by: Unit) => {
    events.push({ t: 'death', actor: u.idx });
    if (u.isMain && winner === null) winner = by.team;
  };

  /** Applies damage through any ward, emits the hit, handles death and second wind. Returns true if the target survived. */
  const land = (att: Unit, def: Unit, kind: HitKind, damage: number, blocked: boolean): boolean => {
    if (def.ward > 0) {
      const absorbed = Math.min(def.ward, damage);
      def.ward -= absorbed;
      damage -= absorbed;
      events.push({ t: 'ward', actor: def.idx, absorbed, left: def.ward });
    }
    def.hp = Math.max(0, def.hp - damage);
    events.push({ t: blocked ? 'block' : 'hit', actor: att.idx, target: def.idx, kind, weapon: kind === 'spell' ? null : att.weapon, damage, hp: def.hp });
    if (def.hp === 0) {
      kill(def, att);
      return false;
    }
    if (def.skills.has('second_wind') && !def.secondWindUsed && def.hp * 100 < def.maxHp * 25) {
      def.secondWindUsed = true;
      const amount = Math.floor(def.maxHp / 4);
      def.hp = Math.min(def.maxHp, def.hp + amount);
      events.push({ t: 'heal', actor: def.idx, amount, hp: def.hp });
    }
    return true;
  };

  /** A blinded unit's next attack misses. Returns true if this attack was the one. */
  const missesBlind = (att: Unit, def: Unit): boolean => {
    if (!att.blinded) return false;
    att.blinded = false;
    events.push({ t: 'miss', actor: att.idx, target: def.idx });
    return true;
  };

  /** Resolves one physical attack. Returns true if the target survived. Specials and throws cannot be dodged. */
  const attack = (att: Unit, def: Unit, kind: HitKind, quality = 0, specialBonus = SPECIAL_MAX_BONUS): boolean => {
    if (missesBlind(att, def)) return true;
    if (kind !== 'special' && kind !== 'throw' && rng.chance(dodgeChance(att, def))) {
      events.push({ t: 'dodge', actor: att.idx, target: def.idx, kind });
      if (kind !== 'counter' && def.skills.has('counter') && canPay(def, STAMINA_COST.counter) && rng.chance(50)) {
        pay(def, STAMINA_COST.counter);
        attack(def, att, 'counter');
      }
      return true;
    }
    const roll = rng.int(80, 121);
    // Pets, spirits and quick extra hits (double strikes, counters) are many small hits,
    // so armor only counts half against them.
    const quickHit = kind === 'double' || kind === 'counter';
    const fullArmor = Math.max(0, def.armor - (att.weapon && kind !== 'throw' ? att.armorPierce : 0));
    const armor = att.isMain && !quickHit ? fullArmor : Math.floor(fullArmor / 2);
    let damage = Math.max(1, Math.floor((baseDamage(att, kind, quality, specialBonus) * roll) / 100) - armor);
    if (!def.isMain) damage = Math.max(1, Math.floor((damage * TARGETS[att.plan.target].petDamagePct) / 100));
    const blocked = def.skills.has('shield') && rng.chance(SHIELD_BLOCK);
    if (blocked) damage = Math.max(1, Math.floor(damage / 4));
    const survived = land(att, def, kind, damage, blocked);
    if (survived && att.skills.has('disarm') && def.weapon && rng.chance(15)) {
      events.push({ t: 'disarm', actor: att.idx, target: def.idx, weapon: def.weapon });
      def.weapon = null;
    }
    return survived;
  };

  /** Magic damage: dodgeable, ignores armor and shields, reduced by magic resistance. */
  const magicAttack = (att: Unit, def: Unit, base: number): { survived: boolean; dealt: number } => {
    if (missesBlind(att, def)) return { survived: true, dealt: 0 };
    if (rng.chance(dodgeChance(att, def, true))) {
      events.push({ t: 'dodge', actor: att.idx, target: def.idx, kind: 'spell' });
      return { survived: true, dealt: 0 };
    }
    const roll = rng.int(85, 116);
    const raw = Math.floor((base * roll * att.damagePct) / 10000);
    const damage = Math.max(1, Math.floor((raw * (100 - def.magicResist)) / 100));
    const before = def.hp;
    const survived = land(att, def, 'spell', damage, false);
    return { survived, dealt: before - def.hp };
  };

  /** Casts a spell if the fighter knows one worth casting now and has the mana. */
  const trySpell = (u: Unit): boolean => {
    if (u.spells.length === 0) return false;
    const has = (id: string) => u.spells.includes(id) && u.mana >= SPELLS[id]!.mana;
    const foe = enemyMainOf(u);
    const hpPct = (u.hp * 100) / u.maxHp;
    const spirit = units.find((s) => s.owner === u.idx && roster[s.idx]!.summoned);
    let spell: string | null = null;
    if (has('mend') && hpPct < 40) spell = 'mend';
    else if (has('ward') && u.ward === 0 && hpPct < 75) spell = 'ward';
    else if (has('spirit') && spirit && !alive(spirit) && !u.summonedThisRound && rng.chance(60)) spell = 'spirit';
    else if (has('drain') && hpPct < 60) spell = 'drain';
    else if (has('flash') && !foe.blinded && rng.chance(30)) spell = 'flash';
    else if (has('spark') && rng.chance(70)) spell = 'spark';
    if (!spell) return false;

    u.mana -= SPELLS[spell]!.mana;
    const offensive = spell === 'spark' || spell === 'drain' || spell === 'flash';
    events.push({ t: 'cast', actor: u.idx, spell, target: offensive ? foe.idx : null });
    switch (spell) {
      case 'spark':
        magicAttack(u, foe, 4 + u.magic);
        break;
      case 'drain': {
        const { dealt } = magicAttack(u, foe, 3 + u.magic);
        if (dealt > 0 && alive(u)) {
          const amount = Math.max(1, Math.floor(dealt / 2));
          u.hp = Math.min(u.maxHp, u.hp + amount);
          events.push({ t: 'heal', actor: u.idx, amount, hp: u.hp });
        }
        break;
      }
      case 'ward':
        u.ward = 10 + u.magic;
        events.push({ t: 'ward', actor: u.idx, absorbed: 0, left: u.ward });
        break;
      case 'spirit':
        spirit!.hp = spirit!.maxHp;
        spirit!.gauge = 50;
        u.summonedThisRound = true;
        events.push({ t: 'summon', actor: spirit!.idx, owner: u.idx, hp: spirit!.hp });
        break;
      case 'flash':
        foe.blinded = true;
        break;
      case 'mend': {
        const amount = Math.floor((u.maxHp * 15) / 100) + u.magic;
        u.hp = Math.min(u.maxHp, u.hp + amount);
        events.push({ t: 'heal', actor: u.idx, amount, hp: u.hp });
        break;
      }
    }
    return true;
  };

  /** Returns true if the turn was used by a special strike waiting from the Special Strike card. */
  const trySpecial = (u: Unit): boolean => {
    const s = u.pendingSpecial;
    if (!s) return false;
    u.pendingSpecial = null;
    events.push({ t: 'special', actor: u.idx, quality: s.quality });
    if (s.quality < SPECIAL_MIN_QUALITY || !canPay(u, STAMINA_COST.special)) return false;
    pay(u, STAMINA_COST.special);
    attack(u, enemyMainOf(u), 'special', s.quality, s.bonus);
    return true;
  };

  const emitEnergy = () => {
    for (const m of mains) {
      if (m.energy !== m.lastEnergy) {
        m.lastEnergy = m.energy;
        events.push({ t: 'energy', actor: m.idx, energy: m.energy });
      }
    }
  };

  /** The last card each team played, for the bot's reactions. */
  const lastCard: [{ card: string; tick: number } | null, { card: string; tick: number } | null] = [null, null];

  /** Plays a card for a main fighter. Returns false (and does nothing) if it can't be played now. */
  const playCard = (u: Unit, id: string, tick: number, quality?: number): boolean => {
    const level = u.deck[id];
    const def = CARDS[id];
    if (!def || level === undefined || u.energy < def.cost || !alive(u) || winner !== null) return false;
    u.energy -= def.cost;
    events.push({ t: 'card', actor: u.idx, card: id, level });
    lastCard[u.team] = { card: id, tick };
    applyCard(u, id, level, quality ?? 0);
    emitEnergy();
    return true;
  };

  /** What each card does. Task 3 only has the Special Strike; Tasks 5 and 6 add the rest. */
  const applyCard = (u: Unit, id: string, level: number, quality: number): void => {
    switch (id) {
      case 'special':
        u.pendingSpecial = { quality: Math.max(0, Math.min(100, Math.round(quality))), bonus: scaled(SPECIAL_MAX_BONUS, level) };
        break;
    }
  };

  /** A bot's choice for this tick: a card id and, for the special strike, its quality. */
  const botChoice = (u: Unit, _tick: number): { card: string; quality?: number } | null => {
    const affordable = Object.keys(u.deck).filter((id) => CARDS[id] && u.energy >= CARDS[id]!.cost);
    if (affordable.length === 0) return null;
    if (u.energy >= BOT_SPEND_AT) {
      const card = affordable.sort((x, y) => CARDS[y]!.cost - CARDS[x]!.cost || x.localeCompare(y))[0]!;
      return card === 'special' ? { card, quality: u.specialQuality ?? rng.int(40, 91) } : { card };
    }
    return null;
  };

  /** Start of each tick: energy, then the player's plays for this tick or the bots' choices. */
  const startTick = (n: number) => {
    events.push({ t: 'tick', n });
    for (const m of mains) {
      if (n > 0 && n % ENERGY_EVERY === 0) m.energy = Math.min(MAX_ENERGY, m.energy + 1);
    }
    emitEnergy();
    for (const m of mains) {
      if (m.interactive) {
        for (const p of m.plays) if (p.tick === n) playCard(m, p.card, n, p.quality);
      } else {
        const choice = botChoice(m, n);
        if (choice) playCard(m, choice.card, n, choice.quality);
      }
    }
  };

  const takeTurn = (u: Unit) => {
    u.roundTurns++;
    if (u.isMain) {
      u.stamina = Math.min(u.maxStamina, u.stamina + u.staminaRegen);
      if (u.maxMana > 0) u.mana = Math.min(u.maxMana, u.mana + MANA_REGEN);
    }
    if (trySpecial(u)) return;
    if (u.isMain && trySpell(u)) return;

    const target = pickTarget(u);
    if (u.isMain && u.undrawn.length > 0 && rng.chance(u.weapon === null ? u.drawChance : 15)) {
      const [weapon] = u.undrawn.splice(rng.int(0, u.undrawn.length), 1);
      u.weapon = weapon!;
      events.push({ t: 'draw', actor: u.idx, weapon: u.weapon });
    }
    const heavy = !!(u.weapon && WEAPONS[u.weapon]?.heavy);
    const swing = heavy ? STAMINA_COST.heavy : STAMINA_COST.melee;
    if (u.isMain && !canPay(u, Math.min(swing, STAMINA_COST.throw))) {
      u.stamina = Math.min(u.maxStamina, u.stamina + REST_STAMINA);
      events.push({ t: 'rest', actor: u.idx });
      return;
    }
    if (u.isMain && u.weapon && canPay(u, STAMINA_COST.throw) && rng.chance(u.throwChance)) {
      pay(u, STAMINA_COST.throw);
      u.thrown.add(u.weapon);
      attack(u, target, 'throw');
      u.weapon = null;
      return;
    }
    if (u.isMain && !pay(u, swing)) {
      u.stamina = Math.min(u.maxStamina, u.stamina + REST_STAMINA);
      events.push({ t: 'rest', actor: u.idx });
      return;
    }

    if (!attack(u, target, 'melee') || winner !== null || !alive(u)) return;
    if (u.isMain) {
      const doubleChance = Math.min(40, u.agility * 3 + (u.skills.has('double_strike') ? 15 : 0));
      if (rng.chance(doubleChance) && pay(u, STAMINA_COST.extra) && !attack(u, target, 'double')) return;
      if (winner !== null || !alive(u)) return;
      if (u.skills.has('combo')) {
        for (let extra = 0; extra < 2 && rng.chance(30); extra++) {
          if (!pay(u, STAMINA_COST.extra)) break;
          if (!attack(u, target, 'combo') || winner !== null || !alive(u)) return;
        }
      }
    }
  };

  const applyBreak = (u: Unit, choice: BreakChoice, c: Character) => {
    applyPlan(u, choice);
    const loadout = loadoutFor(c, choice.weapons).filter((w) => !u.thrown.has(w));
    if (u.weapon && !loadout.includes(u.weapon)) u.weapon = null;
    u.undrawn = loadout.filter((w) => w !== u.weapon);
    u.stamina = Math.min(u.maxStamina, u.stamina + (choice.recover ? RECOVER_STAMINA : BREAK_STAMINA));
    if (u.maxMana > 0) u.mana = Math.min(u.maxMana, u.mana + (choice.recover ? RECOVER_MANA : BREAK_MANA));
  };

  emitEnergy();
  let globalTick = 0;
  rounds: for (let round = 1; round <= ROUNDS; round++) {
    events.push({ t: 'round', round });
    for (const u of units) u.roundTurns = 0;
    for (let tick = 0; tick < ROUND_TICKS; tick++) {
      startTick(globalTick);
      for (const u of units) if (alive(u)) u.gauge += gaugeGain(u.speed, u.isMain);
      const ready = units.filter((u) => alive(u) && u.gauge >= GAUGE_FULL).sort((x, y) => y.gauge - x.gauge || x.tieBreak - y.tieBreak);
      for (const u of ready) {
        if (winner !== null || waiting) break;
        if (!alive(u)) continue;
        u.gauge -= GAUGE_FULL;
        takeTurn(u);
        // Nothing may follow an input request (the replay resumes right after it) or a knockout.
        if (!waiting && winner === null) emitRes();
      }
      globalTick++;
      if (winner !== null || waiting) break rounds;
    }

    // End of round: spirits vanish.
    for (const s of units) {
      if (roster[s.idx]!.summoned && alive(s)) {
        s.hp = 0;
        events.push({ t: 'unsummon', actor: s.idx });
      }
    }
    for (const m of mains) m.summonedThisRound = false;
    if (round === ROUNDS) break;

    // Break: automatic sides decide first, so a player can see their choice (async fights).
    const index = round - 1;
    const choices: [BreakChoice | null, BreakChoice | null] = [null, null];
    for (const team of [0, 1] as const) {
      const m = mains[team];
      choices[team] = m.interactive ? (m.breaks?.[index] ?? null) : autoBreak(m, mains[team === 0 ? 1 : 0]);
    }
    events.push({ t: 'break', round, choices });
    if (choices[0] === null || choices[1] === null) {
      waiting = true;
      break;
    }
    for (const team of [0, 1] as const) {
      const m = mains[team];
      applyBreak(m, choices[team]!, characters[team]);
      for (const u of units) if (u.team === team) u.gauge = u.isMain ? m.startGauge + (choices[team]!.recover ? RECOVER_GAUGE : 0) : 0;
      for (const u of units) if (u.team === team && !u.isMain) applyPlan(u, m.plan);
    }
    emitRes();
  }

  if (waiting) return { seed: seed >>> 0, roster, events, winner: null };
  if (winner === null) {
    // After the last round: higher health percentage wins; an exact tie goes to the defender.
    const [m0, m1] = mains;
    winner = m0.hp * m1.maxHp > m1.hp * m0.maxHp ? 0 : 1;
  }
  return { seed: seed >>> 0, roster, events, winner };
}
