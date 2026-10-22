import type { ClassId, Stats } from './types';

export interface WeaponDef {
  id: string;
  name: string;
  damage: number;
  /** Added to hit chance (reduces the target's dodge), in percent. Can be negative. */
  accuracy: number;
  heavy: boolean;
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
}

export interface PetDef {
  id: string;
  name: string;
  maxHp: number;
  damage: number;
  agility: number;
  speed: number;
}

export interface OriginDef {
  id: string;
  name: string;
  description: string;
  hpPercent: number;
  dodge: number;
  initiative: number;
  armor: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  baseStats: Stats;
  startSkill: string;
  startWeapon?: string;
  startPet?: string;
}

export type UpgradePool = ClassId | 'general';

export type UpgradeDef =
  | { id: string; kind: 'stat'; pool: UpgradePool; name: string; stats: Partial<Stats> }
  | { id: string; kind: 'weapon' | 'skill' | 'pet'; pool: UpgradePool; name: string; ref: string };

export type Stance = 'balanced' | 'aggressive' | 'defensive' | 'agile';

export interface StanceDef {
  id: Stance;
  name: string;
  description: string;
  /** Percent added to damage. */
  damage: number;
  armor: number;
  dodge: number;
}

/** Chosen before each fight after seeing the opponent: the tactical part of the game. */
export const STANCES: Record<Stance, StanceDef> = {
  balanced: { id: 'balanced', name: 'Balanced', description: 'No changes.', damage: 0, armor: 0, dodge: 0 },
  aggressive: { id: 'aggressive', name: 'Aggressive', description: '+18% damage, -8% dodge. Good against sturdy fighters.', damage: 18, armor: 0, dodge: -8 },
  defensive: { id: 'defensive', name: 'Defensive', description: '+2 armor, -15% damage. Good against many small hits.', damage: -15, armor: 2, dodge: 0 },
  agile: { id: 'agile', name: 'Agile', description: '+15% dodge (can go over the usual cap), -12% damage. Good against big slow hits.', damage: -12, armor: 0, dodge: 15 },
};

export const STANCE_IDS = Object.keys(STANCES) as Stance[];

/** Max weapons a fighter brings into one fight. */
export const LOADOUT_SIZE = 3;

/** Damage of an unarmed main fighter, before strength. */
export const FISTS_DAMAGE = 3;

export const WEAPONS: Record<string, WeaponDef> = {
  bat: { id: 'bat', name: 'Baseball Bat', damage: 6, accuracy: 0, heavy: false },
  chain: { id: 'chain', name: 'Bike Chain', damage: 5, accuracy: 5, heavy: false },
  skateboard: { id: 'skateboard', name: 'Skateboard', damage: 5, accuracy: 0, heavy: false },
  umbrella: { id: 'umbrella', name: 'Umbrella', damage: 3, accuracy: 15, heavy: false },
  traffic_sign: { id: 'traffic_sign', name: 'Traffic Sign', damage: 10, accuracy: -10, heavy: true },
  extinguisher: { id: 'extinguisher', name: 'Fire Extinguisher', damage: 9, accuracy: -5, heavy: true },
};

export const SKILLS: Record<string, SkillDef> = {
  combo: { id: 'combo', name: 'Combo', description: 'Each hit has a 30% chance to chain another (max 2 extra).' },
  counter: { id: 'counter', name: 'Counter', description: 'After dodging a melee attack, 50% chance to strike back.' },
  shield: { id: 'shield', name: 'Shield', description: '30% chance to block a hit, taking only a quarter of the damage.' },
  pack_leader: { id: 'pack_leader', name: 'Pack Leader', description: 'Your pets get +25% health and damage.' },
  iron_fists: { id: 'iron_fists', name: 'Iron Fists', description: '+4 damage when fighting unarmed.' },
  fury: { id: 'fury', name: 'Fury', description: '+30% damage while below 30% health.' },
  second_wind: { id: 'second_wind', name: 'Second Wind', description: 'Once per fight, heal 25% when dropping below 25% health.' },
  double_strike: { id: 'double_strike', name: 'Double Strike', description: '+15% chance to attack twice.' },
  quick_start: { id: 'quick_start', name: 'Quick Start', description: 'Start the fight with a head start on initiative.' },
  disarm: { id: 'disarm', name: 'Disarm', description: '15% chance on hit to knock the enemy weapon away.' },
  heavy_hands: { id: 'heavy_hands', name: 'Heavy Hands', description: 'Heavy weapons deal +25% damage and never miss more.' },
  iron_skin: { id: 'iron_skin', name: 'Iron Skin', description: '+3 armor.' },
  whistle: { id: 'whistle', name: 'Whistle', description: 'Your pets act much faster.' },
  thrower: { id: 'thrower', name: 'Thrower', description: 'Throw weapons more often, for double damage.' },
  sixth_sense: { id: 'sixth_sense', name: 'Sixth Sense', description: '+6% dodge.' },
};

export const PETS: Record<string, PetDef> = {
  dog: { id: 'dog', name: 'Dog', maxHp: 20, damage: 3, agility: 4, speed: 5 },
  crow: { id: 'crow', name: 'Crow', maxHp: 12, damage: 3, agility: 10, speed: 7 },
  raccoon: { id: 'raccoon', name: 'Raccoon', maxHp: 16, damage: 3, agility: 7, speed: 5 },
};

export const ORIGINS: Record<string, OriginDef> = {
  port: { id: 'port', name: 'The Port', description: '+6% health.', hpPercent: 6, dodge: 0, initiative: 0, armor: 0 },
  rooftops: { id: 'rooftops', name: 'The Rooftops', description: '+4% dodge.', hpPercent: 0, dodge: 4, initiative: 0, armor: 0 },
  metro: { id: 'metro', name: 'The Metro', description: 'Acts sooner at the start of a fight.', hpPercent: 0, dodge: 0, initiative: 30, armor: 0 },
  industrial: { id: 'industrial', name: 'Industrial Zone', description: '+1 armor.', hpPercent: 0, dodge: 0, initiative: 0, armor: 1 },
};

export const CLASSES: Record<ClassId, ClassDef> = {
  brawler: {
    id: 'brawler',
    name: 'Brawler',
    description: 'Tough street fighter. Chains punches into combos.',
    baseStats: { health: 6, strength: 5, agility: 3, speed: 3 },
    startSkill: 'combo',
  },
  parkour: {
    id: 'parkour',
    name: 'Parkour',
    description: 'Fast and slippery. Dodges and strikes back.',
    baseStats: { health: 4, strength: 3, agility: 7, speed: 6 },
    startSkill: 'counter',
  },
  bouncer: {
    id: 'bouncer',
    name: 'Bouncer',
    description: 'Slow wall of muscle. Blocks hits, loves heavy weapons.',
    baseStats: { health: 7, strength: 4, agility: 2, speed: 2 },
    startSkill: 'shield',
    startWeapon: 'bat',
  },
  tamer: {
    id: 'tamer',
    name: 'Tamer',
    description: 'Fights alongside animals. Starts with a dog.',
    baseStats: { health: 4, strength: 3, agility: 4, speed: 3 },
    startSkill: 'pack_leader',
    startPet: 'dog',
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export const ORIGIN_IDS = Object.keys(ORIGINS);

const stat = (id: string, pool: UpgradePool, name: string, stats: Partial<Stats>): UpgradeDef => ({
  id,
  kind: 'stat',
  pool,
  name,
  stats,
});

const ref = (kind: 'weapon' | 'skill' | 'pet', pool: UpgradePool, refId: string): UpgradeDef => {
  const name = kind === 'weapon' ? WEAPONS[refId]?.name : kind === 'skill' ? SKILLS[refId]?.name : PETS[refId]?.name;
  if (!name) throw new Error(`Unknown ${kind} '${refId}'`);
  return { id: `${kind}:${refId}`, kind, pool, name, ref: refId };
};

/** Every upgrade belongs to exactly one pool: a class pool or the general pool. */
export const UPGRADES: UpgradeDef[] = [
  // General
  stat('gen_health', 'general', '+2 Health', { health: 2 }),
  stat('gen_strength', 'general', '+1 Strength', { strength: 1 }),
  stat('gen_agility', 'general', '+1 Agility', { agility: 1 }),
  stat('gen_speed', 'general', '+1 Speed', { speed: 1 }),
  ref('weapon', 'general', 'bat'),
  ref('weapon', 'general', 'chain'),
  ref('weapon', 'general', 'skateboard'),
  ref('weapon', 'general', 'umbrella'),
  ref('skill', 'general', 'thrower'),
  ref('skill', 'general', 'sixth_sense'),
  ref('pet', 'general', 'dog'),
  // Brawler
  stat('brawler_strength', 'brawler', '+1 Strength, +1 Health', { strength: 1, health: 1 }),
  stat('brawler_health', 'brawler', '+3 Health', { health: 3 }),
  ref('skill', 'brawler', 'iron_fists'),
  ref('skill', 'brawler', 'fury'),
  ref('skill', 'brawler', 'second_wind'),
  // Parkour
  stat('parkour_agility', 'parkour', '+2 Agility', { agility: 2 }),
  stat('parkour_speed', 'parkour', '+2 Speed, +1 Strength', { speed: 2, strength: 1 }),
  ref('skill', 'parkour', 'double_strike'),
  ref('skill', 'parkour', 'quick_start'),
  ref('skill', 'parkour', 'disarm'),
  // Bouncer
  stat('bouncer_health', 'bouncer', '+4 Health', { health: 4 }),
  stat('bouncer_strength', 'bouncer', '+2 Strength', { strength: 2 }),
  ref('skill', 'bouncer', 'heavy_hands'),
  ref('skill', 'bouncer', 'iron_skin'),
  ref('weapon', 'bouncer', 'traffic_sign'),
  ref('weapon', 'bouncer', 'extinguisher'),
  // Tamer
  stat('tamer_agility', 'tamer', '+2 Agility', { agility: 2 }),
  stat('tamer_health', 'tamer', '+2 Health, +1 Speed', { health: 2, speed: 1 }),
  ref('skill', 'tamer', 'whistle'),
  ref('pet', 'tamer', 'crow'),
  ref('pet', 'tamer', 'raccoon'),
];

export const UPGRADES_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
