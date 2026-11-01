import { startingCards } from './cards';
import { CLASSES, ORIGINS } from './catalog';
import { ZERO_STATS, type Appearance, type Character, type ClassId } from './types';

export function createCharacter(name: string, appearance: Appearance, classId: ClassId, originId: string): Character {
  const cls = CLASSES[classId];
  if (!cls) throw new Error(`Unknown class '${classId}'`);
  if (!ORIGINS[originId]) throw new Error(`Unknown origin '${originId}'`);
  return {
    name,
    appearance: { ...appearance },
    classId,
    originId,
    level: 1,
    xp: 0,
    bonusStats: { ...ZERO_STATS },
    weapons: cls.startWeapon ? [cls.startWeapon] : [],
    skills: [cls.startSkill],
    pets: cls.startPet ? [cls.startPet] : [],
    gear: [],
    cards: startingCards(classId, originId),
    cardUses: {},
  };
}

/**
 * Health of everyone in a fight (fighters, pets, spirits), in % of the base formulas. It sets
 * how long fights last: at 100 most fights ended inside round 1; the aim is fights that often
 * reach round 3.
 */
export const HP_SCALE = 260;

/** Max health from the health stat and the origin bonus (%). The Thick Skull skill adds 10% more. */
export function maxHpFor(health: number, hpPercent: number, thickSkull = false): number {
  return Math.floor((((30 + 5 * health) * (100 + hpPercent) * (thickSkull ? 110 : 100)) / 10000) * HP_SCALE / 100);
}

/** Pets and summons get less of the extra health than fighters, or long fights belong to whoever has pets. */
export const PET_HP_SCALE = 200;

/** A pet's (or summon's) health with PET_HP_SCALE applied. */
export function scaledHp(hp: number): number {
  return Math.max(1, Math.floor((hp * PET_HP_SCALE) / 100));
}
