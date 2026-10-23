// Pre-fight strategy: the choices a player makes after reading the opponent, and the
// opponent traits that tell them which choice is good. Each option names the trait it
// is strong against; `npm run balance` checks that this advice is actually true.
import { CLASSES, ORIGINS, SPELLS, WEAPONS } from './catalog';
import { maxHpFor } from './character';
import { addStats, type Character } from './types';

export type Trait = 'tough' | 'fragile' | 'many_hits' | 'heavy_hitter' | 'has_pets' | 'counters' | 'magic_user';

export interface TraitDef {
  id: Trait;
  name: string;
  description: string;
}

export const TRAITS: Record<Trait, TraitDef> = {
  tough: { id: 'tough', name: 'Tough', description: 'Lots of health, armor or a shield.' },
  fragile: { id: 'fragile', name: 'Fragile', description: 'Low health. Goes down fast if you reach them.' },
  many_hits: { id: 'many_hits', name: 'Many small hits', description: 'Pets, combos or double strikes.' },
  heavy_hitter: { id: 'heavy_hitter', name: 'Heavy hitter', description: 'Few hits, but they hurt.' },
  has_pets: { id: 'has_pets', name: 'Has pets', description: 'Animals fight on their side.' },
  counters: { id: 'counters', name: 'Counters', description: 'Strikes back after dodging a melee hit.' },
  magic_user: { id: 'magic_user', name: 'Uses magic', description: 'Spells ignore armor and shields, but can be dodged.' },
};

/** What a player can read about an opponent before the fight. */
export function traitsOf(c: Character): Trait[] {
  const stats = addStats(CLASSES[c.classId].baseStats, c.bonusStats);
  const origin = ORIGINS[c.originId]!;
  const hp = maxHpFor(stats.health, origin.hpPercent);
  const armor = origin.armor + (c.skills.includes('iron_skin') ? 3 : 0);
  const traits: Trait[] = [];
  if (hp >= 80 || armor >= 3 || c.skills.includes('shield')) traits.push('tough');
  if (hp <= 55) traits.push('fragile');
  if (c.pets.length > 0 || c.skills.includes('combo') || c.skills.includes('double_strike')) traits.push('many_hits');
  if (c.weapons.some((w) => WEAPONS[w]?.heavy) || stats.strength >= 8) traits.push('heavy_hitter');
  if (c.pets.length > 0) traits.push('has_pets');
  if (c.skills.includes('counter')) traits.push('counters');
  if (c.skills.some((s) => SPELLS[s])) traits.push('magic_user');
  return traits;
}

/** One line of an option's effect, shown with an up or down arrow. */
export interface Effect {
  text: string;
  good: boolean;
  /** Set when the effect changes a single number, so the UI can show it as icon + value. */
  stat?: { name: 'damage' | 'armor' | 'dodge' | 'stamina'; value: string };
}

export interface TacticOption<Id extends string> {
  id: Id;
  name: string;
  effects: Effect[];
  /** The opponent trait this option is best against, if any. */
  strongVs: Trait | null;
}

// --- Stance -----------------------------------------------------------------

export type Stance = 'balanced' | 'aggressive' | 'defensive' | 'agile';

export interface StanceDef extends TacticOption<Stance> {
  /** Percent added to damage. */
  damage: number;
  armor: number;
  /** Percent added to dodge chance. A positive value also raises the dodge cap by as much. */
  dodge: number;
  /** Percent multiplier on the stamina cost of actions. */
  stamina: number;
}

const stance = (id: Stance, name: string, damage: number, armor: number, dodge: number, stamina: number, strongVs: Trait | null): StanceDef => {
  const effects: Effect[] = [];
  const add = (value: number, name: 'damage' | 'armor' | 'dodge' | 'stamina', label: string, unit: string, good: boolean) => {
    if (value === 0) return;
    const shown = `${value > 0 ? '+' : ''}${value}${unit}`;
    effects.push({ text: `${label} ${shown}`, good, stat: { name, value: shown } });
  };
  add(damage, 'damage', 'Damage', '%', damage > 0);
  add(armor, 'armor', 'Armor', '', armor > 0);
  add(dodge, 'dodge', 'Dodge', '%', dodge > 0);
  add(stamina - 100, 'stamina', 'Stamina use', '%', stamina < 100);
  return { id, name, damage, armor, dodge, stamina, effects, strongVs };
};

export const STANCES: Record<Stance, StanceDef> = {
  balanced: stance('balanced', 'Balanced', 0, 0, 0, 100, null),
  aggressive: stance('aggressive', 'Aggressive', 20, 0, -5, 150, 'tough'),
  defensive: stance('defensive', 'Defensive', -15, 2, 0, 70, 'many_hits'),
  agile: stance('agile', 'Agile', -5, 0, 15, 110, 'magic_user'),
};

// --- Target -----------------------------------------------------------------

export type TargetMode = 'mixed' | 'fighter' | 'pets';

export interface TargetDef extends TacticOption<TargetMode> {
  /** Chance to aim at the enemy fighter while their pets are alive. */
  fighterChance: number;
  /** Damage against enemy pets and spirits, in percent. */
  petDamagePct: number;
}

/** Who your fighter and your pets attack while the enemy still has pets. */
export const TARGETS: Record<TargetMode, TargetDef> = {
  mixed: { id: 'mixed', name: 'Mixed', fighterChance: 65, petDamagePct: 100, effects: [], strongVs: null },
  fighter: {
    id: 'fighter',
    name: 'Fighter first',
    fighterChance: 95,
    petDamagePct: 100,
    effects: [
      { text: 'Focus the fighter', good: true },
      { text: 'Pets keep biting', good: false },
    ],
    strongVs: 'fragile',
  },
  pets: {
    id: 'pets',
    name: 'Pets first',
    fighterChance: 0,
    // Focusing them also hits them harder.
    petDamagePct: 120,
    effects: [
      { text: 'Pets go down early, +20% damage to them', good: true },
      { text: 'Fighter left for last', good: false },
    ],
    strongVs: 'has_pets',
  },
};

// --- Weapon style -----------------------------------------------------------

export type WeaponStyle = 'normal' | 'throw' | 'keep';

export interface WeaponStyleDef extends TacticOption<WeaponStyle> {
  /** Chance per turn to throw the weapon in hand. */
  throwChance: number;
  /** Chance per turn to draw a weapon while unarmed. */
  drawChance: number;
}

export const WEAPON_STYLES: Record<WeaponStyle, WeaponStyleDef> = {
  normal: { id: 'normal', name: 'Normal', throwChance: 8, drawChance: 50, effects: [], strongVs: null },
  throw: {
    id: 'throw',
    name: 'Throw',
    throwChance: 30,
    drawChance: 50,
    effects: [
      { text: 'Big throws, never countered', good: true },
      { text: 'Runs out of weapons', good: false },
    ],
    strongVs: 'counters',
  },
  keep: {
    id: 'keep',
    name: 'Keep',
    throwChance: 0,
    drawChance: 80,
    effects: [
      { text: 'Draws weapons sooner', good: true },
      { text: 'Never throws', good: false },
    ],
    strongVs: 'tough',
  },
};

export const STANCE_IDS = Object.keys(STANCES) as Stance[];
export const TARGET_IDS = Object.keys(TARGETS) as TargetMode[];
export const WEAPON_STYLE_IDS = Object.keys(WEAPON_STYLES) as WeaponStyle[];

/** The three choices together. */
export interface Plan {
  stance: Stance;
  target: TargetMode;
  weaponStyle: WeaponStyle;
}

export const DEFAULT_PLAN: Plan = { stance: 'balanced', target: 'mixed', weaponStyle: 'normal' };
