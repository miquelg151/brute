import { createCharacter } from './character';
import { runFight, type FightLog } from './fight';
import { generateOpponent } from './opponents';
import { XP_LOSS, XP_WIN, addXp, applyUpgrade, rollOffer, useFight, type DailyFights } from './progression';
import { Rng, mixSeed } from './rng';
import type { Appearance, Character, ClassId } from './types';

export const SAVE_VERSION = 1;

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
  };
}

/** Offers are derived from the save seed and level, so reloading never rerolls them. */
function offerFor(save: SaveData): string[] {
  const rng = new Rng(mixSeed(save.seed, 1_000_000 + save.character.level * 31 + save.pendingLevelUps));
  return rollOffer(save.character, rng);
}

/** Plays one daily fight against a generated opponent. Returns null if not allowed right now. */
export function playFight(save: SaveData, today: number): FightResult | null {
  if (save.pendingLevelUps > 0) return null;
  if (!useFight(save.daily, today)) return null;

  const rng = new Rng(mixSeed(save.seed, save.fightCount));
  save.fightCount++;
  const level = Math.max(1, save.character.level + rng.int(-1, 2));
  const opponent = generateOpponent(level, rng);
  const log = runFight(save.character, opponent, rng.next());

  const won = log.winner === 0;
  const xpGained = won ? XP_WIN : XP_LOSS;
  const levelsGained = addXp(save.character, xpGained);
  if (levelsGained > 0) {
    save.pendingLevelUps += levelsGained;
    save.offer = offerFor(save);
  }
  return { opponent, log, won, xpGained, levelsGained };
}

export function chooseUpgrade(save: SaveData, upgradeId: string): void {
  if (!save.offer || !save.offer.includes(upgradeId)) throw new Error(`'${upgradeId}' is not on offer`);
  applyUpgrade(save.character, upgradeId);
  save.pendingLevelUps--;
  save.offer = save.pendingLevelUps > 0 ? offerFor(save) : null;
}
