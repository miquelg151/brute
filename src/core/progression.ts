import { UPGRADES, UPGRADES_BY_ID, type UpgradeDef, type UpgradePool } from './catalog';
import type { Rng } from './rng';
import { addStats, type Character } from './types';

export const XP_WIN = 3;
export const XP_LOSS = 1;
export const OFFER_SIZE = 3;
/** Chance, per offer slot, that the upgrade comes from the character's class pool. */
export const CLASS_POOL_CHANCE = 60;

export function xpToNext(level: number): number {
  return 2 + level * 2;
}

/** Adds XP and returns how many levels were gained. */
export function addXp(c: Character, amount: number): number {
  c.xp += amount;
  let gained = 0;
  while (c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level++;
    gained++;
  }
  return gained;
}

function owns(c: Character, u: UpgradeDef): boolean {
  switch (u.kind) {
    case 'stat':
      return false;
    case 'weapon':
      return c.weapons.includes(u.ref);
    case 'skill':
      return c.skills.includes(u.ref);
    case 'pet':
      return c.pets.includes(u.ref);
    case 'gear':
      return c.gear.includes(u.ref);
    case 'card':
      return c.cards.includes(u.ref);
  }
}

export function eligibleUpgrades(c: Character, pool: UpgradePool): UpgradeDef[] {
  return UPGRADES.filter((u) => u.pool === pool && !owns(c, u));
}

/**
 * Rolls distinct upgrade choices for a level-up, biased towards the character's class.
 * While any weapon, skill, pet or gear is still left to get, at least one choice is one
 * of those (stat boosts never run out, so otherwise they crowd out everything else).
 */
export function rollOffer(c: Character, rng: Rng, size = OFFER_SIZE): string[] {
  const offer: string[] = [];
  const pickFrom = (filter: (u: UpgradeDef) => boolean): string | null => {
    const first: UpgradePool = rng.chance(CLASS_POOL_CHANCE) ? c.classId : 'general';
    const second: UpgradePool = first === 'general' ? c.classId : 'general';
    for (const pool of [first, second]) {
      const candidates = eligibleUpgrades(c, pool).filter((u) => !offer.includes(u.id) && filter(u));
      if (candidates.length > 0) return rng.pick(candidates).id;
    }
    return null;
  };
  for (let i = 0; i < size; i++) {
    const id = pickFrom(() => true);
    if (id) offer.push(id);
  }
  const isStat = (id: string) => UPGRADES_BY_ID[id]!.kind === 'stat';
  if (offer.length > 0 && offer.every(isStat)) {
    const other = pickFrom((u) => u.kind !== 'stat');
    if (other) offer[rng.int(0, offer.length)] = other;
  }
  return offer;
}

export function applyUpgrade(c: Character, upgradeId: string): void {
  const u = UPGRADES_BY_ID[upgradeId];
  if (!u) throw new Error(`Unknown upgrade '${upgradeId}'`);
  if (owns(c, u)) throw new Error(`Already owns '${upgradeId}'`);
  switch (u.kind) {
    case 'stat':
      c.bonusStats = addStats(c.bonusStats, u.stats);
      break;
    case 'weapon':
      c.weapons.push(u.ref);
      break;
    case 'skill':
      c.skills.push(u.ref);
      break;
    case 'pet':
      c.pets.push(u.ref);
      break;
    case 'gear':
      c.gear.push(u.ref);
      break;
    case 'card':
      c.cards.push(u.ref);
      break;
  }
}
