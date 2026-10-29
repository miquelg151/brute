// A card drawn as a paper sticker: class stripe, pixel icon, name, cost bubble, level stars.
import { CARDS, MAX_CARD_LEVEL, cardLevel, cardOrigin, usesForLevel } from '../core';
import { h } from './dom';
import { icon, type IconName } from './icons';
import { CLASS_COLORS, ORIGIN_COLORS } from './palette';

/** Which interface icon each card shows (any icon can be replaced by a PNG, see docs/ART.md). */
export const CARD_ICONS: Record<string, IconName> = {
  special: 'damage',
  rage: 'rage',
  roll: 'dodge',
  wall: 'armor',
  sic_em: 'pet',
  overcharge: 'mana',
  patch_up: 'health',
  hurl: 'weapon',
  rush: 'speed',
  feint: 'target',
  second_breath: 'stamina',
  haymaker: 'fights',
  flurry: 'manyHits',
  body_slam: 'heavy',
  stray_dog: 'pet',
  bolt: 'magic',
  weather_wave: 'stance',
  leap: 'counter',
  last_train: 'fast',
  scrap_shield: 'armor',
  toxic_spit: 'fragile',
  power_surge: 'skip',
  headbutt: 'heavy',
  pickpocket: 'accessory',
  ground_pound: 'manyHits',
  jab_flurry: 'manyHits',
  street_bite: 'fragile',
  backflip: 'dodge',
  heist: 'accessory',
  taunt: 'armor',
};

/**
 * A card sticker. `tag: 'button'` makes the card itself the tap target (everything inside
 * is a span, so it is valid inside a button).
 */
/** The widest word, in letter widths (see wordWidth), that fits a card at the normal name size. */
const NAME_FIT_WIDTH = 4.0;

/** A rough width of a word in the game font, in ems: thin letters count less, M and W more. */
function wordWidth(word: string): number {
  let width = 0;
  for (const ch of word) {
    if ('iljtfrI'.includes(ch)) width += 0.35;
    else if ('mwMW'.includes(ch)) width += 0.9;
    else if (ch >= 'A' && ch <= 'Z') width += 0.7;
    else width += 0.55;
  }
  return width;
}

/**
 * How much to shrink a card's name so its widest word fits on one line (1 = no shrinking).
 * Names only wrap between words, never inside one.
 */
export function nameFit(name: string): number {
  const widest = Math.max(...name.split(' ').map(wordWidth));
  return Math.min(1, NAME_FIT_WIDTH / widest);
}

export function cardSticker(id: string, level: number, opts: { uses?: number; size?: 'small' | 'big'; tag?: 'div' | 'button' } = {}): HTMLElement {
  const card = CARDS[id]!;
  const stripe =
    card.pool === 'general' ? 'var(--wall-dim)' : card.pool === 'origin' ? (ORIGIN_COLORS[cardOrigin(id) ?? ''] ?? 'var(--wall-dim)') : CLASS_COLORS[card.pool];
  const stars = h('span', { class: 'card-stars', 'aria-label': `Level ${level}` }, '★'.repeat(level) + '☆'.repeat(MAX_CARD_LEVEL - level));
  const el = h(
    opts.tag ?? 'div',
    { class: `game-card ${opts.size ?? 'big'}`, style: `--stripe:${stripe}`, title: card.describe(level), type: opts.tag === 'button' ? 'button' : undefined },
    h('span', { class: 'card-cost' }, String(card.cost)),
    h('span', { class: 'card-art' }, icon(CARD_ICONS[id] ?? 'skill', card.name, 'normal')),
    h('span', { class: 'card-name', style: `--name-fit:${nameFit(card.name).toFixed(2)}` }, card.name),
    stars,
  );
  if (opts.uses !== undefined && level < MAX_CARD_LEVEL) {
    const from = usesForLevel(level);
    const to = usesForLevel(level + 1);
    el.append(h('span', { class: 'card-progress', role: 'img', 'aria-label': `${opts.uses - from} of ${to - from} uses to level ${level + 1}` }, h('span', { style: `width:${(100 * (opts.uses - from)) / (to - from)}%` })));
  }
  return el;
}

/**
 * Cards in a row, with one line under them: tap a card to read what it does
 * (a `title` tooltip never shows on a phone).
 */
export function cardList(ids: string[], uses: Record<string, number>): HTMLElement {
  const info = h('p', { class: 'trait-info small' }, 'Tap a card to see what it does.');
  const stickers = ids.map((id) => {
    const level = levelOf(uses, id);
    const el = cardSticker(id, level, { uses: uses[id] ?? 0, tag: 'button' });
    el.classList.add('tappable');
    el.addEventListener('click', () => {
      stickers.forEach((s) => s.classList.toggle('picked', s === el));
      info.textContent = `${CARDS[id]!.name}: ${CARDS[id]!.describe(level)}`;
    });
    return el;
  });
  return h('div', { class: 'card-box' }, h('div', { class: 'card-list' }, ...stickers), info);
}

/** Level of an owned card from its uses. */
export const levelOf = (uses: Record<string, number>, id: string) => cardLevel(uses[id] ?? 0);
