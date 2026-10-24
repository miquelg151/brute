// The Fight tab: your fighter on the street, the cards you will bring, and the big button.
import { CARDS, DECK_SIZE, preferredDeck, rankOf, type SaveData } from '../../core';
import { cardSticker, levelOf } from '../cardView';
import { h, pixelArt } from '../dom';
import { drawFighter } from '../sprites';
import { streetCanvas } from '../street';
import type { TabActions } from '../shell';

/** Seed of the city skyline drawn behind the fighter (when there is no background picture). */
const STREET_SEED = 7;

export function renderFightTab(body: HTMLElement, save: SaveData, actions: TabActions): void {
  const c = save.character;
  const levelUpWaiting = save.pendingLevelUps > 0;

  // The street is a picture behind the fighter (CSS variable --street), scaled up with crisp pixels.
  const street = streetCanvas(STREET_SEED).toDataURL();
  const arena = h(
    'div',
    { class: 'fight-arena', style: `--street:url(${street})` },
    h('div', { class: rankOf(c.level).id === 'legend' ? 'spot legend' : 'spot' }, pixelArt(drawFighter(c), 'big')),
  );

  // The cards that come along by default. Each one is its own button that opens the Cards tab.
  const deck = preferredDeck(c);
  const deckRow = h(
    'div',
    { class: 'fight-deck' },
    ...Array.from({ length: DECK_SIZE }, (_, i) => {
      const id = deck[i];
      if (!id) return h('button', { class: 'game-card small card-empty', type: 'button', 'aria-label': 'Empty slot (open the Cards tab)', onclick: () => actions.openTab('cards') });
      const card = cardSticker(id, levelOf(c.cardUses, id), { size: 'small', tag: 'button' });
      card.setAttribute('aria-label', `${CARDS[id]!.name} (open the Cards tab)`);
      card.addEventListener('click', () => actions.openTab('cards'));
      return card;
    }),
  );

  const button = levelUpWaiting
    ? h('button', { class: 'btn btn-primary fight-go level-up', type: 'button', onclick: actions.onLevelUp }, 'Level up!')
    : h('button', { class: 'btn btn-primary fight-go', type: 'button', onclick: actions.onFight }, 'Fight');

  body.append(h('div', { class: 'fight-tab' }, arena, deckRow, button));
}
