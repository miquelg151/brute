import {
  CARDS,
  CLASSES,
  GEAR,
  ORIGINS,
  PETS,
  SKILLS,
  SPELLS,
  UPGRADES_BY_ID,
  WEAPONS,
  addStats,
  maxHpFor,
  maxManaFor,
  type Character,
  type GearDef,
  type Stats,
} from '../core';

export function totalStats(c: Character): Stats {
  return addStats(CLASSES[c.classId].baseStats, c.bonusStats);
}

export function maxHpOf(c: Character): number {
  return maxHpFor(totalStats(c).health, ORIGINS[c.originId]?.hpPercent ?? 0, c.skills.includes('thick_skull'));
}

/** Max mana counting the gear the fighter would wear by default. */
export function maxManaOf(c: Character): number {
  const worn = c.gear.map((g) => GEAR[g]).filter((g): g is GearDef => !!g);
  return maxManaFor(c, worn);
}

export function upgradeKindLabel(upgradeId: string): string {
  const u = UPGRADES_BY_ID[upgradeId];
  if (!u) return '';
  if (u.kind === 'gear') return GEAR[u.ref]?.slot === 'armor' ? 'Armor' : 'Accessory';
  if (u.kind === 'skill' && SPELLS[u.ref]) return 'Spell';
  return { stat: 'Stats', weapon: 'Weapon', skill: 'Skill', pet: 'Pet', card: 'New card' }[u.kind];
}

/** Plain-words list of what a piece of gear changes, e.g. "+3 armor, -2 speed". */
export function gearEffects(g: GearDef): string {
  const parts: string[] = [];
  const add = (value: number | undefined, label: string, unit = '') => {
    if (value) parts.push(`${value > 0 ? '+' : ''}${value}${unit} ${label}`);
  };
  add(g.armor, 'armor');
  add(g.dodge, 'dodge', '%');
  add(g.speed, 'speed');
  add(g.strength, 'strength');
  add(g.magicResist, 'magic resistance', '%');
  add(g.mana, 'mana');
  add(g.staminaRegen, 'stamina per turn');
  add(g.staminaCost, 'stamina use', '%');
  add(g.petHealth, 'pet health', '%');
  return parts.join(', ');
}

/** What a weapon does, e.g. "Damage 6, accuracy +5%. Drawn at random during fights." */
export function weaponDetail(weaponId: string): string {
  const w = WEAPONS[weaponId];
  if (!w) return '';
  const acc = w.accuracy === 0 ? '' : `, accuracy ${w.accuracy > 0 ? '+' : ''}${w.accuracy}%`;
  return `Damage ${w.damage}${acc}${w.heavy ? ', heavy' : ''}. Drawn at random during fights.`;
}

/** What a pet brings, e.g. "Fights by your side. Health 13, damage 3, speed 5." */
export function petDetail(petId: string): string {
  const p = PETS[petId];
  if (!p) return '';
  return `Fights by your side. Health ${p.maxHp}, damage ${p.damage}, speed ${p.speed}.`;
}

export function upgradeDetail(upgradeId: string): string {
  const u = UPGRADES_BY_ID[upgradeId];
  if (!u) return '';
  switch (u.kind) {
    case 'stat':
      return 'Permanent stat boost.';
    case 'weapon':
      return weaponDetail(u.ref);
    case 'skill':
      return SKILLS[u.ref]!.description;
    case 'pet':
      return petDetail(u.ref);
    case 'gear':
      return `${gearEffects(GEAR[u.ref]!)}. Choose what to wear before each fight.`;
    case 'card': {
      const card = CARDS[u.ref]!;
      return `${card.cost} energy. ${card.describe(1)}`;
    }
  }
}
