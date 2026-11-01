// Cosmetics: hats, extra hair styles and colours, and victory celebrations. They never
// change a fight. They belong to the whole save (like the league), are earned on the trophy
// road and with medals, and any fighter in progress can wear the ones owned.
import { ROAD } from './league';
import { APPEARANCE_OPTIONS, type Appearance, type Character, type Legend } from './types';

export type CosmeticKind = 'hat' | 'hairStyle' | 'hairColor' | 'outfitColor' | 'celebration';

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  name: string;
  /** Owned from the start. */
  free?: boolean;
  /** For hair styles and colours: the index in the appearance (after the base options). */
  index?: number;
  /** How to get it, for a locked item. */
  how?: string;
}

const hat = (id: string, name: string, how?: string): CosmeticDef => ({ id, kind: 'hat', name, ...(how ? { how } : { free: true }) });

export const COSMETICS: Record<string, CosmeticDef> = {
  // Hats
  cap: hat('cap', 'Cap'),
  bandana: hat('bandana', 'Bandana'),
  sweatband: hat('sweatband', 'Sweatband'),
  hard_hat: hat('hard_hat', 'Hard Hat', 'Beat Rusty.'),
  cat_ears: hat('cat_ears', 'Cat Ears', 'Beat Alley Cat.'),
  rat_crown: hat('rat_crown', 'Rat Crown', 'Beat the Sewer King.'),
  champion_band: hat('champion_band', 'Champion Band', 'Beat The Champion.'),
  shades: hat('shades', 'Shades', 'Reach 450 trophies in the League.'),
  ninja_mask: hat('ninja_mask', 'Ninja Mask', 'Reach 1050 trophies in the League.'),
  crown: hat('crown', 'Crown', 'Reach 1500 trophies in the League.'),
  // Hair styles and colours, after the base ones (see APPEARANCE_OPTIONS).
  spiky: { id: 'spiky', kind: 'hairStyle', name: 'Spiky', index: 4, how: 'Earn the Hot Streak medal.' },
  bun: { id: 'bun', kind: 'hairStyle', name: 'Bun', index: 5, how: 'Reach 750 trophies in the League.' },
  neon_pink: { id: 'neon_pink', kind: 'hairColor', name: 'Neon Pink', index: 6, how: 'Reach 150 trophies in the League.' },
  ice: { id: 'ice', kind: 'hairColor', name: 'Ice', index: 7, how: 'Earn the Untouchable medal.' },
  gold: { id: 'gold', kind: 'outfitColor', name: 'Gold', index: 8, how: 'Earn the Veteran medal.' },
  black: { id: 'black', kind: 'outfitColor', name: 'Black', index: 9, how: 'Earn the Knockout Artist medal.' },
  // Victory celebrations
  confetti: { id: 'confetti', kind: 'celebration', name: 'Confetti', free: true },
  fireworks: { id: 'fireworks', kind: 'celebration', name: 'Fireworks', how: 'Reach 1200 trophies in the League.' },
  gold_rain: { id: 'gold_rain', kind: 'celebration', name: 'Gold Rain', how: 'Beat The Champion.' },
  hearts: { id: 'hearts', kind: 'celebration', name: 'Hearts', how: 'Earn the Comeback medal.' },
};

/** Cosmetics won with medals (feat ids, or `boss_<id>`). Road ones are listed in ROAD. */
export const MEDAL_COSMETICS: Record<string, string[]> = {
  boss_rusty: ['hard_hat'],
  boss_alley_cat: ['cat_ears'],
  boss_sewer_king: ['rat_crown'],
  boss_champion: ['champion_band', 'gold_rain'],
  hot_streak: ['spiky'],
  untouchable: ['ice'],
  comeback: ['hearts'],
  knockout_artist: ['black'],
  veteran: ['gold'],
};

/** What the save owns and the celebration it plays when a fight is won. */
export interface CosmeticState {
  owned: string[];
  celebration: string;
}

export function newCosmetics(): CosmeticState {
  return { owned: [], celebration: 'confetti' };
}

export function ownsCosmetic(state: CosmeticState, id: string): boolean {
  return !!COSMETICS[id]?.free || state.owned.includes(id);
}

/** Every cosmetic of one kind, free ones first, in list order. */
export function cosmeticsOf(kind: CosmeticKind): CosmeticDef[] {
  return Object.values(COSMETICS).filter((c) => c.kind === kind);
}

/** The cosmetic behind an extra hair style or colour index (undefined for a base option). */
function byIndex(kind: CosmeticKind, index: number): CosmeticDef | undefined {
  return cosmeticsOf(kind).find((c) => c.index === index);
}

/** The ways to get cosmetics a save qualifies for: road stops reached and medals held. */
interface Sources {
  roadStops: string[];
  fighters: (Character | undefined)[];
  legends: Legend[];
}

/**
 * Adds every cosmetic the save has earned and does not own yet: road stops already claimed,
 * and medals of the fighter and of every legend. Safe to call any time. Returns the new ones.
 */
export function grantCosmetics(state: CosmeticState, sources: Sources): string[] {
  const earned: string[] = [];
  for (const stop of ROAD) {
    if (!sources.roadStops.includes(stop.id)) continue;
    for (const r of stop.rewards) if (r.kind === 'cosmetic') earned.push(r.id);
  }
  const medals = [...sources.fighters.map((c) => c?.medals ?? []), ...sources.legends.map((l) => l.character.medals ?? [])].flat();
  for (const medal of medals) earned.push(...(MEDAL_COSMETICS[medal] ?? []));
  const fresh: string[] = [];
  for (const id of earned) {
    if (!state.owned.includes(id) && !COSMETICS[id]?.free) {
      state.owned.push(id);
      fresh.push(id);
    }
  }
  return fresh;
}

/** True when every part of the look is a base option or an owned cosmetic. */
export function canWear(state: CosmeticState, look: Appearance): boolean {
  if (look.hat !== undefined && !(COSMETICS[look.hat]?.kind === 'hat' && ownsCosmetic(state, look.hat))) return false;
  const extra = (kind: CosmeticKind, index: number, base: number) => {
    if (index < base) return index >= 0;
    const def = byIndex(kind, index);
    return !!def && ownsCosmetic(state, def.id);
  };
  return (
    look.skinTone >= 0 &&
    look.skinTone < APPEARANCE_OPTIONS.skinTone &&
    extra('hairStyle', look.hairStyle, APPEARANCE_OPTIONS.hairStyle) &&
    extra('hairColor', look.hairColor, APPEARANCE_OPTIONS.hairColor) &&
    extra('outfitColor', look.outfitColor, APPEARANCE_OPTIONS.outfitColor)
  );
}

/** Changes the fighter's look. Throws if any part of it is locked. */
export function setLook(state: CosmeticState, c: Character, look: Appearance): void {
  if (!canWear(state, look)) throw new Error('That look uses a locked cosmetic');
  c.appearance = { ...look };
  if (look.hat === undefined) delete c.appearance.hat;
}

/** Picks the celebration played on a win. Throws if it is locked. */
export function setCelebration(state: CosmeticState, id: string): void {
  if (COSMETICS[id]?.kind !== 'celebration' || !ownsCosmetic(state, id)) throw new Error(`Celebration '${id}' is locked`);
  state.celebration = id;
}
