import { gatedBoss } from './bosses';
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

/**
 * Adds XP and returns how many levels were gained. While a boss gates the fighter's level,
 * XP stops one short of levelling and the rest is lost.
 */
export function addXp(c: Character, amount: number): number {
  c.xp += amount;
  let gained = 0;
  for (;;) {
    if (gatedBoss(c)) {
      c.xp = Math.min(c.xp, xpToNext(c.level) - 1);
      break;
    }
    if (c.xp < xpToNext(c.level)) break;
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

/**
 * The rare options of the fighter's branch: its signature skill, card and item from the
 * content expansion. Fighters without a branch have none.
 */
const SIGNATURE_IDS: Partial<Record<BranchId, string[]>> = {
  boxer: ['skill:rhythm', 'card:jab_flurry', 'gear:boxing_wraps'],
  brute: ['skill:bone_breaker', 'card:street_bite', 'weapon:knuckles'],
  acrobat: ['skill:momentum', 'card:backflip', 'gear:spring_sneakers'],
  thief: ['skill:quick_hands', 'card:heist', 'weapon:switchblade'],
  wall: ['skill:thorns', 'card:taunt', 'gear:dumpster_lid'],
  wrecker: ['skill:demolition', 'card:sledge_swing', 'weapon:sledgehammer'],
  pack: ['skill:pack_call', 'card:gang_up', 'pet:pigeon'],
  bond: ['skill:guardian', 'card:together', 'gear:key_collar'],
  witch: ['skill:flame', 'card:fireball', 'gear:neon_spray'],
  warden: ['skill:overflow', 'card:rune_circle', 'gear:rune_amulet'],
};

/** Signature items the fighter does not own yet. */
function signatureLeft(c: Character): UpgradeDef[] {
  const ids = (c.branch && SIGNATURE_IDS[c.branch]) || [];
  return ids.map((id) => UPGRADES_BY_ID[id]!).filter((u) => !owns(c, u));
}

/** Weapons, pets and gear the fighter could get from its own pools and does not own (the fallback rare options). */
function fallbackRare(c: Character): UpgradeDef[] {
  return UPGRADES.filter(
    (u) =>
      (u.kind === 'weapon' || u.kind === 'pet' || u.kind === 'gear') &&
      (u.pool === 'general' || u.pool === c.classId) &&
      (u.branch === undefined || u.branch === c.branch) &&
      !owns(c, u),
  );
}

/** True if the upgrade is a rare option for this fighter (see rollBossOffer). */
export function isRareUpgrade(c: Character, upgradeId: string): boolean {
  const u = UPGRADES_BY_ID[upgradeId];
  if (!u || owns(c, u)) return false;
  const left = signatureLeft(c);
  if (left.length > 0) return left.some((s) => s.id === upgradeId);
  return fallbackRare(c).some((f) => f.id === upgradeId);
}

/** How many choices the level-up after a boss has. */
export const BOSS_OFFER_SIZE = 4;

/**
 * The offer for the level-up after beating a boss: 4 choices, at least one of them rare
 * (a signature item of the fighter's branch, or else any weapon, pet or gear it does not own).
 * The rare one sits in a random slot.
 */
export function rollBossOffer(c: Character, rng: Rng, forLevel = c.level): string[] {
  const left = signatureLeft(c);
  const rarePool = left.length > 0 ? left : fallbackRare(c);
  const rare = rarePool.length > 0 ? rng.pick(rarePool).id : null;
  // Roll extra choices so there are still enough once the rare one is taken out.
  const rest = rollOffer(c, rng, BOSS_OFFER_SIZE + 1, forLevel).filter((id) => id !== rare);
  const offer = rest.slice(0, rare ? BOSS_OFFER_SIZE - 1 : BOSS_OFFER_SIZE);
  if (rare) offer.splice(rng.int(0, offer.length + 1), 0, rare);
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
