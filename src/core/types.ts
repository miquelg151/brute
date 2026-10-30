export interface Stats {
  health: number;
  strength: number;
  agility: number;
  speed: number;
  /** Spell power. Only the Mystic starts with any. */
  magic: number;
}

export const ZERO_STATS: Stats = { health: 0, strength: 0, agility: 0, speed: 0, magic: 0 };

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  return {
    health: a.health + (b.health ?? 0),
    strength: a.strength + (b.strength ?? 0),
    agility: a.agility + (b.agility ?? 0),
    speed: a.speed + (b.speed ?? 0),
    magic: a.magic + (b.magic ?? 0),
  };
}

/** Purely cosmetic. Indices into palettes/sprite sets owned by the UI. Never affects combat. */
export interface Appearance {
  skinTone: number;
  hairStyle: number;
  hairColor: number;
  outfitColor: number;
}

export const APPEARANCE_OPTIONS: Record<keyof Appearance, number> = {
  skinTone: 6,
  hairStyle: 4,
  hairColor: 6,
  outfitColor: 8,
};

export type ClassId = 'brawler' | 'parkour' | 'bouncer' | 'tamer' | 'mystic';

/** Each class splits into two branches; a fighter picks one for good at level 5. */
export type BranchId = 'boxer' | 'brute' | 'acrobat' | 'thief' | 'wall' | 'wrecker' | 'pack' | 'bond' | 'witch' | 'warden';

export interface Character {
  name: string;
  appearance: Appearance;
  classId: ClassId;
  /** The class branch chosen at level 5 (undefined before that, or until the player picks). */
  branch?: BranchId;
  originId: string;
  level: number;
  /** XP accumulated towards the next level. */
  xp: number;
  /** Stats gained from upgrades, on top of the class base stats. */
  bonusStats: Stats;
  weapons: string[];
  skills: string[];
  pets: string[];
  /** Owned armor and accessories; one of each is worn in a fight. */
  gear: string[];
  /** Owned cards (ids from CARDS). Up to DECK_SIZE of them are brought into a fight. */
  cards: string[];
  /** How many times each card has been played in finished fights; sets its level. */
  cardUses: Record<string, number>;
  /** The cards the player likes to bring (optional; see preferredDeck). */
  deck?: string[];
  /** Boss id -> 'beaten' or 'skipped' (a boss below the level the fighter had when bosses came in). */
  bosses?: Record<string, 'beaten' | 'skipped'>;
  /** Feat id -> progress so far (a number, for feats that count things). */
  featProgress?: Record<string, number>;
  /** Ids of the feats this fighter has completed. */
  medals?: string[];
  /** The title this fighter wears (from a feat), if any. */
  title?: string;
  /** Running fight record. Use fighterStats() to read it. */
  stats?: FighterStats;
}

/** A fighter's running record, kept for feats. */
export interface FighterStats {
  fights: number;
  wins: number;
  /** Wins by knockout (not on points after round 3). */
  kos: number;
  /** Wins in a row right now. */
  streak: number;
  bestStreak: number;
  /** Losses against each boss, by boss id. */
  bossLosses: Record<string, number>;
}

/** A fighter who graduated at level 20. The character is frozen as it was (medals, title and stats included). */
export interface Legend {
  character: Character;
  /** When the fighter graduated (an ISO date string). */
  graduatedAt: string;
}
