// Cards: played during a fight by spending energy. Every class starts with the Special
// Strike and one class card; the rest are won at level-ups. Cards get stronger the more
// they are played (see cardLevel). The fight rules for each card live in fight.ts.
import type { ClassId } from './types';

export interface CardDef {
  id: string;
  name: string;
  /** Energy needed to play it. Never changes with level. */
  cost: number;
  /** 'general' cards can be won by any class; class cards only by that class. */
  pool: 'general' | ClassId;
  /** Starting cards are given at creation and never offered at level-ups. */
  starting: boolean;
  /** What it does at a card level, in plain words for the cards on screen. */
  describe(level: number): string;
}

export const DECK_SIZE = 4;
export const MAX_CARD_LEVEL = 5;
/** Uses needed to reach each level: level 2 at 3 uses, level 3 at 8... */
const LEVEL_USES = [0, 0, 3, 8, 15, 25];

export function cardLevel(uses: number): number {
  let level = 1;
  while (level < MAX_CARD_LEVEL && uses >= LEVEL_USES[level + 1]!) level++;
  return level;
}

export function usesForLevel(level: number): number {
  return LEVEL_USES[Math.min(MAX_CARD_LEVEL, Math.max(1, level))]!;
}

/** A number that grows 10% per card level above 1. */
export function scaled(base: number, level: number): number {
  return Math.floor((base * (100 + 10 * (level - 1))) / 100);
}

/** A count (hits, dodges) that grows by one at card level 4. */
export function scaledCount(base: number, level: number): number {
  return base + (level >= 4 ? 1 : 0);
}

/** Bots' cards keep up with their fighter level. */
export function botCardLevel(fighterLevel: number): number {
  return Math.min(MAX_CARD_LEVEL, 1 + Math.floor(fighterLevel / 5));
}

const card = (id: string, name: string, cost: number, pool: CardDef['pool'], starting: boolean, describe: (level: number) => string): CardDef => ({
  id,
  name,
  cost,
  pool,
  starting,
  describe,
});

export const CARDS: Record<string, CardDef> = {
  // Starting cards
  special: card('special', 'Special Strike', 5, 'general', true, (l) => `Time it well: your next attack does up to +${scaled(60, l)}% and can't be dodged.`),
  rage: card('rage', 'Rage', 4, 'brawler', true, (l) => `+${scaled(30, l)}% damage on your next 3 turns.`),
  roll: card('roll', 'Roll', 3, 'parkour', true, (l) => `Dodge the next ${scaledCount(2, l)} attacks for sure.`),
  wall: card('wall', 'Wall', 5, 'bouncer', true, (l) => `Block the next ${scaledCount(2, l)} hits for sure.`),
  sic_em: card('sic_em', "Sic 'em", 3, 'tamer', true, (l) => `Every pet attacks right now with +${scaled(100, l)}% damage.`),
  overcharge: card('overcharge', 'Overcharge', 4, 'mystic', true, (l) => `+${scaled(15, l)} mana and your next spell does +${scaled(50, l)}%.`),
  // Won at level-ups
  patch_up: card('patch_up', 'Patch Up', 4, 'general', false, (l) => `Heal ${scaled(10, l)}% of your health.`),
  hurl: card('hurl', 'Hurl', 3, 'general', false, (l) => `Throw your weapon now for ${scaled(200, l)}% damage.`),
  rush: card('rush', 'Rush', 2, 'general', false, (l) => `Act right away${l > 1 ? `, with +${10 * (l - 1)}% damage` : ''}.`),
  feint: card('feint', 'Feint', 3, 'general', false, (l) => `Their next attack misses and your next one does +${scaled(20, l)}%.`),
  second_breath: card('second_breath', 'Second Breath', 2, 'general', false, (l) => `+${scaled(40, l)} stamina.`),
  haymaker: card('haymaker', 'Haymaker', 4, 'brawler', false, (l) => `Your next hit does +${scaled(80, l)}% and can't be dodged.`),
  flurry: card('flurry', 'Flurry', 5, 'parkour', false, (l) => `Your next turn strikes 3 times at ${scaled(90, l)}% damage each.`),
  body_slam: card('body_slam', 'Body Slam', 5, 'bouncer', false, (l) => `A heavy hit (+${scaled(40, l)}%) that pushes their next turn back.`),
  stray_dog: card('stray_dog', 'Stray Dog', 6, 'tamer', false, (l) => `A dog with ${scaled(100, l)}% health joins until the round ends.`),
  bolt: card('bolt', 'Bolt', 5, 'mystic', false, (l) => `A spell that can't be dodged and does +${scaled(50, l)}%.`),
};

export const CARD_IDS = Object.keys(CARDS);

const CLASS_CARD: Record<ClassId, string> = { brawler: 'rage', parkour: 'roll', bouncer: 'wall', tamer: 'sic_em', mystic: 'overcharge' };

export function startingCards(classId: ClassId): string[] {
  return ['special', CLASS_CARD[classId]];
}
