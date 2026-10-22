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
  };
}
