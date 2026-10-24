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

export interface Character {
  name: string;
  appearance: Appearance;
  classId: ClassId;
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
}
