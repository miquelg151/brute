// The Fight tab: your fighter on the street, the cards you will bring, and the big button.
import { CARDS, DECK_SIZE, buildBoss, gatedBoss, preferredDeck, rankOf, xpToNext, type BossDef, type SaveData } from '../../core';
import { cardSticker, levelOf } from '../cardView';
import { h, pixelArt } from '../dom';
import { icon } from '../icons';
import { drawFighter } from '../sprites';
import { HOME_STREET_SEED, streetCanvas } from '../street';
import type { TabActions } from '../shell';

/** The card for the boss that gates the fighter: who it is, its trick, and the Challenge button. */
function bossCard(boss: BossDef, save: SaveData, actions: TabActions): HTMLElement {
  const c = save.character;
  const full = c.xp >= xpToNext(c.level) - 1;
  const trick = icon('skill', 'Trick', 'small');
  trick.setAttribute('aria-hidden', 'true');
  return h(
    'section',
    { class: 'boss-card', 'aria-label': `Boss: ${boss.name}` },
    h(
      'div',
      { class: 'boss-card-top' },
      h('div', { class: 'spot boss-spot' }, pixelArt(drawFighter(buildBoss(boss.id)), 'small', true)),
      h(
        'div',
        { class: 'boss-card-text' },
        h('div', { class: 'boss-card-name' }, h('strong', { class: 'boss-card-title' }, boss.name), h('span', { class: 'dim' }, `Lv ${boss.level}`)),
        h('p', { class: 'boss-card-trick' }, trick, boss.trickText),
        h('p', { class: 'boss-card-hint' }, full ? 'XP full. Beat the boss to level up.' : 'Beat the boss to level up.'),
      ),
    ),
    h('button', { class: 'btn btn-primary boss-go', type: 'button', onclick: actions.onBoss }, 'Challenge'),
  );
}

export function renderFightTab(body: HTMLElement, save: SaveData, actions: TabActions): void {
  const c = save.character;
  const levelUpWaiting = save.pendingLevelUps > 0;

  // The street is a picture behind the fighter (CSS variable --street), scaled up with crisp pixels.
  const street = streetCanvas(HOME_STREET_SEED).toDataURL();
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

  // A boss gates the level: its card sits above the cards. Normal fights stay available.
  const boss = levelUpWaiting ? null : gatedBoss(c);
  body.append(h('div', { class: boss ? 'fight-tab has-boss' : 'fight-tab' }, arena, boss ? bossCard(boss, save, actions) : '', deckRow, button));
}
