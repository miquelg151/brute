import { BRANCHES, UPGRADES, UPGRADES_BY_ID, type UpgradeDef, type UpgradePool } from './catalog';
import type { Rng } from './rng';
import { addStats, type BranchId, type Character } from './types';

export const XP_WIN = 3;
export const XP_LOSS = 1;
export const OFFER_SIZE = 3;
/** Chance, per offer slot, that the upgrade comes from the character's class pool. */
export const CLASS_POOL_CHANCE = 60;
/** The level at which a fighter picks one of its class's two branches. */
export const BRANCH_LEVEL = 5;
/** The offer for reaching this level has one slot from another class (once per fighter). */
export const CROSS_CLASS_LEVEL = 15;
/** Chance, per class slot, that the upgrade comes from the other branch of the class. */
export const OTHER_BRANCH_CHANCE = 15;

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

/** True once the fighter has reached the branch level without picking a branch. */
export function needsBranch(c: Character): boolean {
  return c.level >= BRANCH_LEVEL && !c.branch;
}

/** Picks the fighter's branch for good. It must be one of its class's two branches. */
export function chooseBranch(c: Character, id: BranchId): void {
  if (c.branch) throw new Error(`Branch already chosen: '${c.branch}'`);
  if (!BRANCHES[c.classId].some((b) => b.id === id)) throw new Error(`'${id}' is not a ${c.classId} branch`);
  c.branch = id;
}

/** True if the upgrade comes from another class's pool (only offered at CROSS_CLASS_LEVEL). */
export function isCrossClass(c: Character, upgradeId: string): boolean {
  const u = UPGRADES_BY_ID[upgradeId];
  return !!u && u.pool !== 'general' && u.pool !== c.classId;
}

/** Class items from the fighter's own side: class-common ones plus its branch (common only before choosing). */
function ownSideUpgrades(c: Character): UpgradeDef[] {
  return eligibleUpgrades(c, c.classId).filter((u) => u.branch === undefined || u.branch === c.branch);
}

/** Class items from the branch the fighter did not choose (none before choosing). */
function otherBranchUpgrades(c: Character): UpgradeDef[] {
  if (!c.branch) return [];
  return eligibleUpgrades(c, c.classId).filter((u) => u.branch !== undefined && u.branch !== c.branch);
}

/**
 * Rolls distinct upgrade choices for a level-up, biased towards the character's class.
 * A class slot comes from the fighter's branch and class-common items, or now and then
 * from the other branch. While any weapon, skill, pet or gear is still left to get, at
 * least one choice is one of those (stat boosts never run out, so otherwise they crowd
 * out everything else). `forLevel` is the level the offer is for: the offer for reaching
 * CROSS_CLASS_LEVEL has one slot from another class.
 */
export function rollOffer(c: Character, rng: Rng, size = OFFER_SIZE, forLevel = c.level): string[] {
  const offer: string[] = [];
  const pickFrom = (filter: (u: UpgradeDef) => boolean): string | null => {
    let groups: (() => UpgradeDef[])[];
    const general = () => eligibleUpgrades(c, 'general');
    const own = () => ownSideUpgrades(c);
    const other = () => otherBranchUpgrades(c);
    if (rng.chance(CLASS_POOL_CHANCE)) {
      // A class slot: the other branch first only now and then (and only once a branch is chosen).
      const otherFirst = c.branch !== undefined && rng.chance(OTHER_BRANCH_CHANCE);
      groups = otherFirst ? [other, own, general] : [own, other, general];
    } else {
      groups = [general, own, other];
    }
    for (const group of groups) {
      const candidates = group().filter((u) => !offer.includes(u.id) && filter(u));
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
  if (forLevel === CROSS_CLASS_LEVEL && offer.length > 0) {
    // One slot becomes something from another class: any skill, spell, pet, weapon, gear or card.
    const foreign = UPGRADES.filter((u) => u.kind !== 'stat' && isCrossClass(c, u.id) && !owns(c, u));
    if (foreign.length > 0) offer[rng.int(0, offer.length)] = rng.pick(foreign).id;
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
