import { BRANCHES, CLASS_IDS, ORIGIN_IDS } from './catalog';
import { createCharacter } from './character';
import { OFFER_SIZE, applyUpgrade, chooseBranch, needsBranch, rollOffer } from './progression';
import type { Rng } from './rng';
import { APPEARANCE_OPTIONS, type Appearance, type BranchId, type Character, type ClassId } from './types';

const NAMES = [
  'Rusty', 'Neon', 'Tank', 'Pixel', 'Viper', 'Bolt', 'Mango', 'Shade', 'Rocco', 'Juno',
  'Dash', 'Brick', 'Kiki', 'Ozzy', 'Nova', 'Grit', 'Lulu', 'Moss', 'Spike', 'Echo',
];

export function randomAppearance(rng: Rng): Appearance {
  return {
    skinTone: rng.int(0, APPEARANCE_OPTIONS.skinTone),
    hairStyle: rng.int(0, APPEARANCE_OPTIONS.hairStyle),
    hairColor: rng.int(0, APPEARANCE_OPTIONS.hairColor),
    outfitColor: rng.int(0, APPEARANCE_OPTIONS.outfitColor),
  };
}

/**
 * Builds a bot opponent by levelling a fresh character with the same offer
 * system players use, picking randomly at each level-up (and a random branch at level 5).
 * Pass `branchId` (a branch of `classId`) to force the branch instead of picking one.
 */
export function generateOpponent(level: number, rng: Rng, classId?: ClassId, originId?: string, branchId?: BranchId): Character {
  const c = createCharacter(
    rng.pick(NAMES),
    randomAppearance(rng),
    classId ?? rng.pick(CLASS_IDS),
    originId ?? rng.pick(ORIGIN_IDS),
  );
  while (c.level < level) {
    c.level++;
    if (needsBranch(c)) chooseBranch(c, branchId ?? rng.pick(BRANCHES[c.classId]).id);
    applyUpgrade(c, rng.pick(rollOffer(c, rng, OFFER_SIZE, c.level)));
  }
  return c;
}
