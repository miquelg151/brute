// A card drawn as a paper sticker: class stripe, pixel icon, name, cost bubble, level stars.
import { CARDS, MAX_CARD_LEVEL, cardLevel, usesForLevel } from '../core';
import { h } from './dom';
import { icon, type IconName } from './icons';
import { CLASS_COLORS } from './palette';

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
};

export function cardSticker(id: string, level: number, opts: { uses?: number; size?: 'small' | 'big' } = {}): HTMLElement {
  const card = CARDS[id]!;
  const stripe = card.pool === 'general' ? 'var(--wall-dim)' : CLASS_COLORS[card.pool];
  const stars = h('span', { class: 'card-stars', 'aria-label': `Level ${level}` }, '★'.repeat(level) + '☆'.repeat(MAX_CARD_LEVEL - level));
  const el = h(
    'div',
    { class: `game-card ${opts.size ?? 'big'}`, style: `--stripe:${stripe}`, title: card.describe(level) },
    h('span', { class: 'card-cost' }, String(card.cost)),
    h('div', { class: 'card-art' }, icon(CARD_ICONS[id] ?? 'skill', card.name, 'normal')),
    h('span', { class: 'card-name' }, card.name),
    stars,
  );
  if (opts.uses !== undefined && level < MAX_CARD_LEVEL) {
    const from = usesForLevel(level);
    const to = usesForLevel(level + 1);
    el.append(h('div', { class: 'card-progress', role: 'img', 'aria-label': `${opts.uses - from} of ${to - from} uses to level ${level + 1}` }, h('div', { style: `width:${(100 * (opts.uses - from)) / (to - from)}%` })));
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
    const el = cardSticker(id, level, { uses: uses[id] ?? 0 });
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
