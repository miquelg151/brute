import { CLASS_IDS, ORIGIN_IDS } from './catalog';
import { createCharacter } from './character';
import { applyUpgrade, rollOffer } from './progression';
import type { Rng } from './rng';
import { APPEARANCE_OPTIONS, type Appearance, type Character, type ClassId } from './types';

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
 * system players use, picking randomly at each level-up.
 */
export function generateOpponent(level: number, rng: Rng, classId?: ClassId, originId?: string): Character {
  const c = createCharacter(
    rng.pick(NAMES),
    randomAppearance(rng),
    classId ?? rng.pick(CLASS_IDS),
    originId ?? rng.pick(ORIGIN_IDS),
  );
  while (c.level < level) {
    c.level++;
    applyUpgrade(c, rng.pick(rollOffer(c, rng)));
  }
  return c;
}
