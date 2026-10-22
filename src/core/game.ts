import { createCharacter } from './character';
import { loadoutFor, runFight, type FightLog } from './fight';
import { generateOpponent } from './opponents';
import { XP_LOSS, XP_WIN, addXp, applyUpgrade, rollOffer, useFight, type DailyFights } from './progression';
import { Rng, mixSeed } from './rng';
import { DEFAULT_PLAN, STANCE_IDS, TARGET_IDS, WEAPON_STYLE_IDS, type Plan } from './tactics';
import type { Appearance, Character, ClassId } from './types';

export const SAVE_VERSION = 3;

/** What the player decides before a fight. Locked once the fight starts. */
export interface Tactics extends Plan {
  weapons: string[];
  /** Warm-up minigame score, 0-100 (0 if skipped). */
  warmup: number;
}

/** The fight the player is about to play. Stored so reloading never rerolls the opponent. */
export interface PendingFight {
  opponent: Character;
  /** The opponent's own plan, visible to the player before choosing theirs. */
  opponentPlan: Plan;
  seed: number;
  /** Warm-up score, set once the minigame is played (it can only be played once). */
  warmup: number | null;
  /** Set when the fight starts; from then on the choices cannot change. */
  tactics: Tactics | null;
}

/** Everything the game persists. Plain JSON, designed to be synced to a server later. */
export interface SaveData {
  version: number;
  seed: number;
  fightCount: number;
  character: Character;
  daily: DailyFights;
  /** Level-ups not yet chosen. While > 0 the player must pick from `offer` before fighting. */
  pendingLevelUps: number;
  offer: string[] | null;
  pendingFight: PendingFight | null;
}

export interface FightResult {
  opponent: Character;
  log: FightLog;
  won: boolean;
  xpGained: number;
  levelsGained: number;
}

export function newGame(name: string, appearance: Appearance, classId: ClassId, originId: string, seed: number): SaveData {
  return {
    version: SAVE_VERSION,
    seed: seed >>> 0,
    fightCount: 0,
    character: createCharacter(name, appearance, classId, originId),
    daily: { day: -1, used: 0 },
    pendingLevelUps: 0,
    offer: null,
    pendingFight: null,
  };
}

export function defaultTactics(c: Character): Tactics {
  return { ...DEFAULT_PLAN, weapons: loadoutFor(c), warmup: 0 };
}

/** Offers are derived from the save seed and level, so reloading never rerolls them. */
function offerFor(save: SaveData): string[] {
  const rng = new Rng(mixSeed(save.seed, 1_000_000 + save.character.level * 31 + save.pendingLevelUps));
  return rollOffer(save.character, rng);
}

/**
 * Uses one daily fight and picks the opponent, so the player can study it and
 * choose tactics. Returns the existing pending fight if there is one, or null
 * if fighting is not allowed right now.
 */
export function prepareFight(save: SaveData, today: number): PendingFight | null {
  if (save.pendingFight) return save.pendingFight;
  if (save.pendingLevelUps > 0) return null;
  if (!useFight(save.daily, today)) return null;

  const rng = new Rng(mixSeed(save.seed, save.fightCount));
  save.fightCount++;
  const level = Math.max(1, save.character.level + rng.int(-1, 2));
  const opponent = generateOpponent(level, rng);
  const opponentPlan: Plan = { stance: rng.pick(STANCE_IDS), target: rng.pick(TARGET_IDS), weaponStyle: rng.pick(WEAPON_STYLE_IDS) };
  save.pendingFight = { opponent, opponentPlan, seed: rng.next(), warmup: null, tactics: null };
  return save.pendingFight;
}

export function recordWarmup(save: SaveData, score: number): void {
  const fight = save.pendingFight;
  if (!fight || fight.warmup !== null || fight.tactics) return;
  fight.warmup = Math.max(0, Math.min(100, Math.round(score)));
}

/** Locks the player's choices. Later calls keep the first choice. */
export function startFight(save: SaveData, plan: Plan, weapons: string[]): Tactics {
  const fight = save.pendingFight;
  if (!fight) throw new Error('No pending fight');
  fight.tactics ??= {
    stance: plan.stance,
    target: plan.target,
    weaponStyle: plan.weaponStyle,
    weapons: loadoutFor(save.character, weapons),
    warmup: fight.warmup ?? 0,
  };
  return fight.tactics;
}

/** Simulates the started fight with the special-strike inputs given so far. */
export function simulateFight(save: SaveData, specials: number[]): FightLog {
  const fight = save.pendingFight;
  if (!fight?.tactics) throw new Error('Fight not started');
  return runFight(save.character, fight.opponent, fight.seed, {
    a: { ...fight.tactics, interactive: true, specials },
    b: { ...fight.opponentPlan },
  });
}

/** Resolves the started fight with all inputs, awards XP and clears it. */
export function finishFight(save: SaveData, specials: number[]): FightResult {
  const fight = save.pendingFight!;
  const log = simulateFight(save, specials);
  if (log.winner === null) throw new Error('Fight still waiting for input');

  const won = log.winner === 0;
  const xpGained = won ? XP_WIN : XP_LOSS;
  const levelsGained = addXp(save.character, xpGained);
  if (levelsGained > 0) {
    save.pendingLevelUps += levelsGained;
    save.offer = offerFor(save);
  }
  save.pendingFight = null;
  return { opponent: fight.opponent, log, won, xpGained, levelsGained };
}

export function chooseUpgrade(save: SaveData, upgradeId: string): void {
  if (!save.offer || !save.offer.includes(upgradeId)) throw new Error(`'${upgradeId}' is not on offer`);
  applyUpgrade(save.character, upgradeId);
  save.pendingLevelUps--;
  save.offer = save.pendingLevelUps > 0 ? offerFor(save) : null;
}
