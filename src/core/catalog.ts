import { CARDS } from './cards';
import type { BranchId, ClassId, Stats } from './types';

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

export type SpellEffect = 'bolt' | 'drain' | 'ward' | 'summon' | 'blind' | 'heal';

/** A spell is a skill that costs mana. Its id is also listed in SKILLS. */
export interface SpellDef {
  id: string;
  effect: SpellEffect;
  mana: number;
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
  /** Health healed at the start of each of the fighter's turns. */
  hpRegen: number;
  /** Percent of magic damage ignored, added to the class's. */
  magicResist: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  baseStats: Stats;
  startSkill: string;
  startWeapon?: string;
  startPet?: string;
  /** Base mana. Fighters without it get some when they learn their first spell. */
  mana: number;
  /** Percent of magic damage ignored. */
  magicResist: number;
}

export type GearSlot = 'armor' | 'accessory';

export interface GearDef {
  id: string;
  name: string;
  slot: GearSlot;
  armor?: number;
  dodge?: number;
  speed?: number;
  strength?: number;
  magicResist?: number;
  mana?: number;
  /** Extra stamina regained every turn. */
  staminaRegen?: number;
  /** Percent added to the stamina cost of every action. */
  staminaCost?: number;
  /** Percent added to pet health. */
  petHealth?: number;
}

export type UpgradePool = ClassId | 'general';

/** `branch` is set on class items that belong to one branch; class-common and general items have none. */
export type UpgradeDef =
  | { id: string; kind: 'stat'; pool: UpgradePool; branch?: BranchId; name: string; stats: Partial<Stats> }
  | { id: string; kind: 'weapon' | 'skill' | 'pet' | 'gear' | 'card'; pool: UpgradePool; branch?: BranchId; name: string; ref: string };

export interface BranchDef {
  id: BranchId;
  classId: ClassId;
  name: string;
  description: string;
  /** Three icon names (from the UI icon set) that hint at what is inside. */
  icons: [string, string, string];
}

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
  shield: { id: 'shield', name: 'Shield', description: '25% chance to block a hit, taking only a quarter of the damage. Useless against magic.' },
  pack_leader: { id: 'pack_leader', name: 'Pack Leader', description: 'Your pets get +25% health and +35% damage.' },
  iron_fists: { id: 'iron_fists', name: 'Iron Fists', description: '+4 damage when fighting unarmed.' },
  fury: { id: 'fury', name: 'Fury', description: '+30% damage while below 30% health.' },
  second_wind: { id: 'second_wind', name: 'Second Wind', description: 'Once per fight, heal 25% when dropping below 25% health.' },
  double_strike: { id: 'double_strike', name: 'Double Strike', description: '+15% chance to attack twice.' },
  quick_start: { id: 'quick_start', name: 'Quick Start', description: 'Start every round with a head start on initiative.' },
  disarm: { id: 'disarm', name: 'Disarm', description: '15% chance on hit to knock the enemy weapon away.' },
  heavy_hands: { id: 'heavy_hands', name: 'Heavy Hands', description: 'Heavy weapons deal +25% damage and never miss more.' },
  iron_skin: { id: 'iron_skin', name: 'Iron Skin', description: '+3 armor.' },
  whistle: { id: 'whistle', name: 'Whistle', description: 'Your pets act much faster.' },
  thrower: { id: 'thrower', name: 'Thrower', description: 'Throw weapons more often, for double damage.' },
  sixth_sense: { id: 'sixth_sense', name: 'Sixth Sense', description: '+6% dodge.' },
  jab: { id: 'jab', name: 'Jab', description: 'The first attack of each of your turns does +25% damage.' },
  thick_skull: { id: 'thick_skull', name: 'Thick Skull', description: '+10% max health. Below half health you take 15% less damage.' },
  wall_run: { id: 'wall_run', name: 'Wall Run', description: 'Your counters do +50% damage.' },
  bulwark: { id: 'bulwark', name: 'Bulwark', description: 'Your Shield blocks 40% of the time instead of 25%.' },
  bond: { id: 'bond', name: 'Bond', description: 'When one of your pets deals damage, you heal 25% of it.' },
  feral: { id: 'feral', name: 'Feral', description: "Your pets' hits have a 20% chance to do double damage." },
  arcane_flow: { id: 'arcane_flow', name: 'Arcane Flow', description: 'Your spells cost 25% less mana.' },
  // Spells
  spark: { id: 'spark', name: 'Spark', description: 'Magic bolt: 4 + magic damage. 12 mana.' },
  ward: { id: 'ward', name: 'Ward', description: 'A rune barrier that absorbs 10 + magic damage. 20 mana.' },
  drain: { id: 'drain', name: 'Drain', description: 'Magic hit of 3 + magic that heals you for half. 18 mana.' },
  spirit: { id: 'spirit', name: 'Spirit', description: 'Summons a spirit that fights for you until the round ends. 30 mana.' },
  flash: { id: 'flash', name: 'Flash', description: 'Blinds the enemy: their next attack misses. 15 mana.' },
  mend: { id: 'mend', name: 'Mend', description: 'Heals 15% of your health + magic. 20 mana.' },
};

export const SPELLS: Record<string, SpellDef> = {
  spark: { id: 'spark', effect: 'bolt', mana: 12 },
  ward: { id: 'ward', effect: 'ward', mana: 20 },
  drain: { id: 'drain', effect: 'drain', mana: 18 },
  spirit: { id: 'spirit', effect: 'summon', mana: 30 },
  flash: { id: 'flash', effect: 'blind', mana: 15 },
  mend: { id: 'mend', effect: 'heal', mana: 20 },
};

/** Mana granted to a fighter with no base mana when it knows at least one spell. */
export const LEARNED_MANA = 40;

export const GEAR: Record<string, GearDef> = {
  leather_jacket: { id: 'leather_jacket', name: 'Leather Jacket', slot: 'armor', armor: 1 },
  riot_vest: { id: 'riot_vest', name: 'Riot Vest', slot: 'armor', armor: 3, speed: -2, staminaCost: 20 },
  tracksuit: { id: 'tracksuit', name: 'Tracksuit', slot: 'armor', dodge: 6, staminaRegen: 2 },
  rune_hoodie: { id: 'rune_hoodie', name: 'Rune Hoodie', slot: 'armor', magicResist: 25, mana: 20 },
  sneakers: { id: 'sneakers', name: 'Sneakers', slot: 'accessory', speed: 1 },
  charm: { id: 'charm', name: 'Lucky Charm', slot: 'accessory', magicResist: 20 },
  gloves: { id: 'gloves', name: 'Fight Gloves', slot: 'accessory', strength: 1 },
  treat_bag: { id: 'treat_bag', name: 'Treat Bag', slot: 'accessory', petHealth: 30 },
};

export const PETS: Record<string, PetDef> = {
  dog: { id: 'dog', name: 'Dog', maxHp: 13, damage: 3, agility: 4, speed: 5 },
  crow: { id: 'crow', name: 'Crow', maxHp: 9, damage: 2, agility: 10, speed: 7 },
  raccoon: { id: 'raccoon', name: 'Raccoon', maxHp: 12, damage: 2, agility: 7, speed: 5 },
};

// Where a fighter grew up: a passive bonus in every fight, a look (art layer `fighter.origin`)
// and a starting card of its own (see ORIGIN_CARD in cards.ts).
const origin = (id: string, name: string, description: string, bonus: Partial<Omit<OriginDef, 'id' | 'name' | 'description'>>): OriginDef => ({
  id,
  name,
  description,
  hpPercent: 0,
  dodge: 0,
  initiative: 0,
  armor: 0,
  hpRegen: 0,
  magicResist: 0,
  ...bonus,
});

export const ORIGINS: Record<string, OriginDef> = {
  port: origin('port', 'The Port', '+8% health.', { hpPercent: 8 }),
  rooftops: origin('rooftops', 'The Rooftops', '+9% dodge.', { dodge: 9 }),
  metro: origin('metro', 'The Metro', 'Acts right away at the start of every round.', { initiative: 100 }),
  industrial: origin('industrial', 'Industrial Zone', '+1 armor.', { armor: 1 }),
  // The two strange ones: mutants from under the city and half-robots from the scrapyard.
  sewers: origin('sewers', 'The Sewers', 'Heals 1 health every turn.', { hpRegen: 1 }),
  scrapyard: origin('scrapyard', 'The Scrapyard', '+15% magic resistance.', { magicResist: 15 }),
};

export const CLASSES: Record<ClassId, ClassDef> = {
  brawler: {
    id: 'brawler',
    name: 'Brawler',
    description: 'Tough street fighter. Chains punches into combos.',
    baseStats: { health: 7, strength: 5, agility: 3, speed: 3, magic: 0 },
    startSkill: 'combo',
    mana: 0,
    magicResist: 0,
  },
  parkour: {
    id: 'parkour',
    name: 'Parkour',
    description: 'Fast and slippery. Dodges and strikes back.',
    baseStats: { health: 4, strength: 3, agility: 7, speed: 7, magic: 0 },
    startSkill: 'counter',
    mana: 0,
    magicResist: 0,
  },
  bouncer: {
    id: 'bouncer',
    name: 'Bouncer',
    description: 'Slow wall of muscle. Blocks hits, shrugs off some magic, loves heavy weapons.',
    baseStats: { health: 7, strength: 4, agility: 2, speed: 2, magic: 0 },
    startSkill: 'shield',
    startWeapon: 'bat',
    mana: 0,
    magicResist: 20,
  },
  tamer: {
    id: 'tamer',
    name: 'Tamer',
    description: 'Fights alongside animals. Starts with a dog.',
    baseStats: { health: 5, strength: 3, agility: 4, speed: 3, magic: 0 },
    startSkill: 'pack_leader',
    startPet: 'dog',
    mana: 0,
    magicResist: 0,
  },
  mystic: {
    id: 'mystic',
    name: 'Mystic',
    description: 'Street magic: neon runes and spirits. Weak punches, strong spells.',
    baseStats: { health: 5, strength: 2, agility: 5, speed: 4, magic: 6 },
    startSkill: 'spark',
    /** Plus 1 per level. */
    mana: 50,
    magicResist: 10,
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

const branch = (id: BranchId, classId: ClassId, name: string, description: string, icons: [string, string, string]): BranchDef => ({
  id,
  classId,
  name,
  description,
  icons,
});

/** The two branches of each class. The items of each branch are tagged in UPGRADES below. */
export const BRANCHES: Record<ClassId, [BranchDef, BranchDef]> = {
  brawler: [
    branch('boxer', 'brawler', 'Boxer', 'Quick chained punches.', ['fist', 'manyHits', 'damage']),
    branch('brute', 'brawler', 'Brute', 'Endure and come back.', ['rage', 'health', 'heavy']),
  ],
  parkour: [
    branch('acrobat', 'parkour', 'Acrobat', 'Dodge everything.', ['dodge', 'counter', 'agility']),
    branch('thief', 'parkour', 'Thief', 'Steal and annoy.', ['weapon', 'fast', 'stamina']),
  ],
  bouncer: [
    branch('wall', 'bouncer', 'Wall', 'Nothing gets through.', ['armor', 'stance', 'health']),
    branch('wrecker', 'bouncer', 'Wrecker', 'Heavy weapons, heavy hits.', ['heavy', 'weapon', 'damage']),
  ],
  tamer: [
    branch('pack', 'tamer', 'Pack', 'Many pets.', ['pet', 'manyHits', 'speed']),
    branch('bond', 'tamer', 'Bond', 'Few pets, but strong ones.', ['pet', 'health', 'rage']),
  ],
  mystic: [
    branch('witch', 'mystic', 'Witch', 'Damage magic.', ['magic', 'mana', 'damage']),
    branch('warden', 'mystic', 'Warden', 'Protect and heal.', ['armor', 'health', 'magic']),
  ],
};

export const BRANCHES_BY_ID = Object.fromEntries(
  Object.values(BRANCHES).flatMap((pair) => pair.map((b) => [b.id, b])),
) as Record<BranchId, BranchDef>;
export const ORIGIN_IDS = Object.keys(ORIGINS);

// Class stats never belong to a branch: every fighter of the class can get them.
const stat = (id: string, pool: UpgradePool, name: string, stats: Partial<Stats>): UpgradeDef => ({
  id,
  kind: 'stat',
  pool,
  name,
  stats,
});

// A weapon, skill, pet, gear or card. Pass a branch for items only that branch gets.
const ref = (kind: 'weapon' | 'skill' | 'pet' | 'gear' | 'card', pool: UpgradePool, refId: string, branchId?: BranchId): UpgradeDef => {
  const table = { weapon: WEAPONS, skill: SKILLS, pet: PETS, gear: GEAR, card: CARDS }[kind];
  const name = table[refId]?.name;
  if (!name) throw new Error(`Unknown ${kind} '${refId}'`);
  const u: UpgradeDef = { id: `${kind}:${refId}`, kind, pool, name, ref: refId };
  if (branchId) u.branch = branchId;
  return u;
};

/**
 * Every upgrade belongs to exactly one pool: a class pool or the general pool.
 * Class items are either class-common (no branch) or belong to one of the class's two branches.
 * Starting skills, pets and cards (Pack Leader, the dog, Spark...) are never offered.
 */
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
  ref('gear', 'general', 'leather_jacket'),
  ref('gear', 'general', 'sneakers'),
  ref('gear', 'general', 'charm'),
  ref('card', 'general', 'patch_up'),
  ref('card', 'general', 'hurl'),
  ref('card', 'general', 'rush'),
  ref('card', 'general', 'feint'),
  ref('card', 'general', 'second_breath'),
  // Brawler: common
  stat('brawler_strength', 'brawler', '+1 Strength, +1 Health', { strength: 1, health: 1 }),
  stat('brawler_health', 'brawler', '+3 Health', { health: 3 }),
  ref('gear', 'brawler', 'gloves'),
  // Brawler: Boxer
  ref('skill', 'brawler', 'iron_fists', 'boxer'),
  ref('skill', 'brawler', 'double_strike', 'boxer'),
  ref('skill', 'brawler', 'jab', 'boxer'),
  ref('card', 'brawler', 'haymaker', 'boxer'),
  // Brawler: Brute
  ref('skill', 'brawler', 'fury', 'brute'),
  ref('skill', 'brawler', 'second_wind', 'brute'),
  ref('skill', 'brawler', 'thick_skull', 'brute'),
  ref('card', 'brawler', 'headbutt', 'brute'),
  // Parkour: common
  stat('parkour_agility', 'parkour', '+2 Agility', { agility: 2 }),
  stat('parkour_speed', 'parkour', '+2 Speed, +2 Strength', { speed: 2, strength: 2 }),
  ref('gear', 'parkour', 'tracksuit'),
  // Parkour: Acrobat
  ref('skill', 'parkour', 'sixth_sense', 'acrobat'),
  ref('skill', 'parkour', 'wall_run', 'acrobat'),
  ref('card', 'parkour', 'flurry', 'acrobat'),
  // Parkour: Thief
  ref('skill', 'parkour', 'disarm', 'thief'),
  ref('skill', 'parkour', 'quick_start', 'thief'),
  ref('skill', 'parkour', 'thrower', 'thief'),
  ref('card', 'parkour', 'pickpocket', 'thief'),
  // Bouncer: common
  stat('bouncer_health', 'bouncer', '+4 Health', { health: 4 }),
  stat('bouncer_strength', 'bouncer', '+2 Strength, +1 Health', { strength: 2, health: 1 }),
  // Bouncer: Wall
  ref('skill', 'bouncer', 'iron_skin', 'wall'),
  ref('skill', 'bouncer', 'bulwark', 'wall'),
  ref('gear', 'bouncer', 'riot_vest', 'wall'),
  ref('card', 'bouncer', 'body_slam', 'wall'),
  // Bouncer: Wrecker
  ref('skill', 'bouncer', 'heavy_hands', 'wrecker'),
  ref('weapon', 'bouncer', 'traffic_sign', 'wrecker'),
  ref('weapon', 'bouncer', 'extinguisher', 'wrecker'),
  ref('card', 'bouncer', 'ground_pound', 'wrecker'),
  // Tamer: common
  stat('tamer_agility', 'tamer', '+2 Agility', { agility: 2 }),
  stat('tamer_health', 'tamer', '+2 Health, +1 Speed', { health: 2, speed: 1 }),
  ref('gear', 'tamer', 'treat_bag'),
  // Tamer: Pack
  ref('skill', 'tamer', 'whistle', 'pack'),
  ref('pet', 'tamer', 'raccoon', 'pack'),
  ref('card', 'tamer', 'stray_dog', 'pack'),
  // Tamer: Bond
  ref('pet', 'tamer', 'crow', 'bond'),
  ref('skill', 'tamer', 'bond', 'bond'),
  ref('skill', 'tamer', 'feral', 'bond'),
  // Mystic: common
  stat('mystic_magic', 'mystic', '+3 Magic', { magic: 3 }),
  stat('mystic_health', 'mystic', '+2 Health, +1 Agility', { health: 2, agility: 1 }),
  ref('gear', 'mystic', 'rune_hoodie'),
  // Mystic: Witch
  ref('skill', 'mystic', 'drain', 'witch'),
  ref('card', 'mystic', 'bolt', 'witch'),
  ref('skill', 'mystic', 'arcane_flow', 'witch'),
  // Mystic: Warden
  ref('skill', 'mystic', 'ward', 'warden'),
  ref('skill', 'mystic', 'mend', 'warden'),
  ref('skill', 'mystic', 'flash', 'warden'),
  ref('skill', 'mystic', 'spirit', 'warden'),
];

export const UPGRADES_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
