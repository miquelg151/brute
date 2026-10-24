import { DECK_SIZE, cardLevel, originCard, startingCards } from './cards';
import { createCharacter } from './character';
import { gearFor, loadoutFor, runFight, type BreakChoice, type CardPlay, type FightLog, type GearChoice } from './fight';
import { generateOpponent } from './opponents';
import { XP_LOSS, XP_WIN, addXp, applyUpgrade, rollOffer } from './progression';
import { Rng, mixSeed } from './rng';
import { DEFAULT_PLAN, STANCE_IDS, TARGET_IDS, WEAPON_STYLE_IDS, type Plan } from './tactics';
import type { Appearance, Character, ClassId } from './types';

export const SAVE_VERSION = 6;

/** What the player decides before a fight. Locked once the fight starts. */
export interface Tactics extends Plan {
  weapons: string[];
  gear: GearChoice;
  /** Cards brought into this fight (up to DECK_SIZE owned ones). */
  deck: string[];
}

/** Player inputs made during the fight, saved as they happen so a reload resumes the same fight. */
export interface FightInputs {
  plays: CardPlay[];
  breaks: BreakChoice[];
}

/** The fight the player is about to play. Stored so reloading never rerolls the opponent. */
export interface PendingFight {
  opponent: Character;
  /** The opponent's own plan for the first round. */
  opponentPlan: Plan;
  /**
   * Live fights are against a connected player who chooses at the same time, so their plan
   * stays hidden. Asynchronous fights (the only kind for now) reveal it.
   */
  live: boolean;
  seed: number;
  /** Set when the fight starts; from then on the choices cannot change. */
  tactics: Tactics | null;
  inputs: FightInputs;
}

/** Everything the game persists. Plain JSON, designed to be synced to a server later. */
export interface SaveData {
  version: number;
  seed: number;
  fightCount: number;
  character: Character;
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
  /** How many times each card was played by the player. */
  cardsPlayed: Record<string, number>;
  /** Cards that reached a new level from these plays. */
  cardLevelUps: { card: string; level: number }[];
}

export function newGame(name: string, appearance: Appearance, classId: ClassId, originId: string, seed: number): SaveData {
  return {
    version: SAVE_VERSION,
    seed: seed >>> 0,
    fightCount: 0,
    character: createCharacter(name, appearance, classId, originId),
    pendingLevelUps: 0,
    offer: null,
    pendingFight: null,
  };
}

export function defaultTactics(c: Character): Tactics {
  return { ...DEFAULT_PLAN, weapons: loadoutFor(c), gear: gearFor(c), deck: preferredDeck(c) };
}

/** Offers are derived from the save seed and level, so reloading never rerolls them. */
function offerFor(save: SaveData): string[] {
  const rng = new Rng(mixSeed(save.seed, 1_000_000 + save.character.level * 31 + save.pendingLevelUps));
  return rollOffer(save.character, rng);
}

/** The deck brought by default: the saved one (owned cards only), topped up in card order. */
export function preferredDeck(c: Character): string[] {
  const deck: string[] = [];
  for (const id of [...(c.deck ?? []), ...c.cards]) {
    if (deck.length >= DECK_SIZE) break;
    if (c.cards.includes(id) && !deck.includes(id)) deck.push(id);
  }
  return deck;
}

/** Remembers the player's deck (owned cards only, no repeats, at most DECK_SIZE). */
export function setPreferredDeck(c: Character, ids: string[]): void {
  c.deck = ids.filter((id, i) => c.cards.includes(id) && ids.indexOf(id) === i).slice(0, DECK_SIZE);
}

/** The player's chosen cards (owned ones only, at most DECK_SIZE) with their levels from use. */
export function playerDeck(c: Character, chosen?: string[]): Record<string, number> {
  const ids = (chosen ?? c.cards).filter((id) => c.cards.includes(id)).slice(0, DECK_SIZE);
  return Object.fromEntries(ids.map((id) => [id, cardLevel(c.cardUses[id] ?? 0)]));
}

/**
 * Picks the opponent, so the player can study it and choose tactics. Returns
 * the existing pending fight if there is one, or null if the player must
 * choose a level-up first.
 */
export function prepareFight(save: SaveData): PendingFight | null {
  if (save.pendingFight) return save.pendingFight;
  if (save.pendingLevelUps > 0) return null;

  const rng = new Rng(mixSeed(save.seed, save.fightCount));
  save.fightCount++;
  const level = Math.max(1, save.character.level + rng.int(-1, 2));
  const opponent = generateOpponent(level, rng);
  const opponentPlan: Plan = { stance: rng.pick(STANCE_IDS), target: rng.pick(TARGET_IDS), weaponStyle: rng.pick(WEAPON_STYLE_IDS) };
  save.pendingFight = { opponent, opponentPlan, live: false, seed: rng.next(), tactics: null, inputs: { plays: [], breaks: [] } };
  return save.pendingFight;
}

/** Locks the player's choices. Later calls keep the first choice. */
export function startFight(save: SaveData, plan: Plan, weapons: string[], gear?: GearChoice, deck?: string[]): Tactics {
  const fight = save.pendingFight;
  if (!fight) throw new Error('No pending fight');
  fight.tactics ??= {
    stance: plan.stance,
    target: plan.target,
    weaponStyle: plan.weaponStyle,
    weapons: loadoutFor(save.character, weapons),
    gear: gearFor(save.character, gear),
    deck: Object.keys(playerDeck(save.character, deck)),
  };
  // Remember the deck that was brought, so the next fight starts with it.
  setPreferredDeck(save.character, fight.tactics.deck);
  return fight.tactics;
}

/**
 * Saves a card play. Plays only go forward in time: a play at or before the tick of the
 * last saved play is ignored (after a reload the fight is watched again from the start,
 * and a play made then would change what the player has already seen).
 * Returns true if the play was saved.
 */
export function recordPlay(save: SaveData, play: CardPlay): boolean {
  const plays = save.pendingFight?.inputs.plays;
  if (!plays) return false;
  if (play.tick <= lastPlayTick(save)) return false;
  plays.push({ ...play });
  return true;
}

/** The largest tick of the saved card plays, or -1 if there is none. */
export function lastPlayTick(save: SaveData): number {
  let last = -1;
  for (const p of save.pendingFight?.inputs.plays ?? []) last = Math.max(last, p.tick);
  return last;
}

export function recordBreak(save: SaveData, choice: BreakChoice): void {
  save.pendingFight?.inputs.breaks.push({ ...choice, weapons: loadoutFor(save.character, choice.weapons) });
}

/** Simulates the started fight with the inputs recorded so far. Stops at the next missing input. */
export function simulateFight(save: SaveData): FightLog {
  const fight = save.pendingFight;
  if (!fight?.tactics) throw new Error('Fight not started');
  return runFight(save.character, fight.opponent, fight.seed, {
    a: { ...fight.tactics, deck: playerDeck(save.character, fight.tactics.deck), interactive: true, plays: fight.inputs.plays, breaks: fight.inputs.breaks },
    b: { ...fight.opponentPlan },
  });
}

/** Resolves the started fight with all inputs, awards XP and clears it. */
export function finishFight(save: SaveData): FightResult {
  const fight = save.pendingFight!;
  const log = simulateFight(save);
  if (log.winner === null) throw new Error('Fight still waiting for input');

  const won = log.winner === 0;
  const xpGained = won ? XP_WIN : XP_LOSS;
  const levelsGained = addXp(save.character, xpGained);
  if (levelsGained > 0) {
    save.pendingLevelUps += levelsGained;
    save.offer = offerFor(save);
  }
  // Every card the player played counts as one use; enough uses level it up.
  const cardsPlayed: Record<string, number> = {};
  for (const e of log.events) if (e.t === 'card' && e.actor === 0) cardsPlayed[e.card] = (cardsPlayed[e.card] ?? 0) + 1;
  const cardLevelUps: { card: string; level: number }[] = [];
  for (const [card, count] of Object.entries(cardsPlayed)) {
    const before = cardLevel(save.character.cardUses[card] ?? 0);
    save.character.cardUses[card] = (save.character.cardUses[card] ?? 0) + count;
    const after = cardLevel(save.character.cardUses[card]!);
    if (after > before) cardLevelUps.push({ card, level: after });
  }
  save.pendingFight = null;
  return { opponent: fight.opponent, log, won, xpGained, levelsGained, cardsPlayed, cardLevelUps };
}

export function chooseUpgrade(save: SaveData, upgradeId: string): void {
  if (!save.offer || !save.offer.includes(upgradeId)) throw new Error(`'${upgradeId}' is not on offer`);
  applyUpgrade(save.character, upgradeId);
  save.pendingLevelUps--;
  save.offer = save.pendingLevelUps > 0 ? offerFor(save) : null;
}

/** Brings an older save up to date. Returns null if it is too old to keep. */
export function migrateSave(raw: unknown): SaveData | null {
  const save = raw as Record<string, unknown> & { version?: number };
  if (!save || typeof save !== 'object') return null;
  if (save.version === 4) {
    const c = save.character as Character;
    c.cards ??= startingCards(c.classId);
    c.cardUses ??= {};
    delete save.daily;
    // A fight started under the old rules can't continue under the new ones.
    save.pendingFight = null;
    save.version = 5;
  }
  if (save.version === 5) {
    const c = save.character as Character;
    // Every fighter now starts with its origin card: put it after the class card.
    const own = originCard(c.originId);
    if (own && !c.cards.includes(own)) c.cards.splice(Math.min(2, c.cards.length), 0, own);
    // A fight started under the old rules can't continue under the new ones.
    save.pendingFight = null;
    save.version = 6;
  }
  return save.version === SAVE_VERSION ? (save as unknown as SaveData) : null;
}
