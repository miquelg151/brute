import { CLASSES, PETS, SKILLS, UPGRADES_BY_ID, WEAPONS, addStats, maxHpFor, ORIGINS, type Character, type Stats } from '../core';

export function totalStats(c: Character): Stats {
  return addStats(CLASSES[c.classId].baseStats, c.bonusStats);
}

export function maxHpOf(c: Character): number {
  return maxHpFor(totalStats(c).health, ORIGINS[c.originId]?.hpPercent ?? 0);
}

export function upgradeKindLabel(upgradeId: string): string {
  const u = UPGRADES_BY_ID[upgradeId];
  return u ? { stat: 'Stats', weapon: 'Weapon', skill: 'Skill', pet: 'Pet' }[u.kind] : '';
}

export function upgradeDetail(upgradeId: string): string {
  const u = UPGRADES_BY_ID[upgradeId];
  if (!u) return '';
  switch (u.kind) {
    case 'stat':
      return 'Permanent stat boost.';
    case 'weapon': {
      const w = WEAPONS[u.ref]!;
      const acc = w.accuracy === 0 ? '' : `, accuracy ${w.accuracy > 0 ? '+' : ''}${w.accuracy}%`;
      return `Damage ${w.damage}${acc}${w.heavy ? ', heavy' : ''}. Drawn at random during fights.`;
    }
    case 'skill':
      return SKILLS[u.ref]!.description;
    case 'pet': {
      const p = PETS[u.ref]!;
      return `Fights by your side. Health ${p.maxHp}, damage ${p.damage}, speed ${p.speed}.`;
    }
  }
}
