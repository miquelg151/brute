// The Cards tab: the deck you bring to fights on top, every card you own below.
// Tap a card to read it. To change the deck, tap a card, press the swap button, then tap
// the card to swap it with. The deck is saved on the fighter (see preferredDeck).
import { CARDS, DECK_SIZE, MAX_CARD_LEVEL, preferredDeck, setPreferredDeck, usesForLevel, type SaveData } from '../../core';
import { cardSticker, levelOf } from '../cardView';
import { h } from '../dom';
import { reducedMotion } from '../motion';
import type { TabActions } from '../shell';

export function renderCardsTab(body: HTMLElement, save: SaveData, actions: TabActions): void {
  const c = save.character;
  /** The card being read, or null. */
  let picked: string | null = null;
  /** True after pressing the swap button, while waiting for the card to swap with. */
  let swapping = false;
  /** The card that just came into the deck, so it can do a little bounce. */
  let justIn: string | null = null;

  const page = h('div', { class: 'tab-page cards-tab' });
  body.append(page);

  /** Every owned card is in the deck when there are DECK_SIZE or fewer, so nothing to swap. */
  const canSwap = () => c.cards.length > DECK_SIZE;

  /** Puts `incoming` in the deck where `outgoing` was, saves, and draws again. */
  function swap(outgoing: string, incoming: string): void {
    const deck = preferredDeck(c);
    deck[deck.indexOf(outgoing)] = incoming;
    setPreferredDeck(c, deck);
    actions.onSave();
    picked = incoming;
    justIn = incoming;
    swapping = false;
    draw();
  }

  function setSwapping(on: boolean): void {
    swapping = on;
    justIn = null;
    draw();
  }

  /** Reads a card: it gets picked and the note explains it. */
  function read(id: string): void {
    swapping = false;
    picked = id;
    justIn = null;
    draw();
    page.querySelector('.cards-note')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  /**
   * One card as a button. While swapping, the cards that can finish the swap are marked:
   * deck cards when the picked card is outside the deck, and the other way round.
   */
  function cardButton(id: string, place: 'deck' | 'collection'): HTMLElement {
    const deck = preferredDeck(c);
    const card = cardSticker(id, levelOf(c.cardUses, id), { uses: c.cardUses[id] ?? 0, tag: 'button' });
    if (id === picked) card.classList.add('picked');
    if (id === justIn && place === 'deck') card.classList.add('just-in');
    if (place === 'collection' && deck.includes(id)) card.classList.add('in-deck');

    let target = false;
    if (swapping && picked) {
      target = deck.includes(picked) ? place === 'collection' && !deck.includes(id) : place === 'deck';
      card.classList.add(target ? 'swap-target' : 'swap-off');
    }
    card.addEventListener('click', () => {
      if (target && picked) {
        // The deck card goes out, the other one comes in.
        if (place === 'deck') swap(id, picked);
        else swap(picked, id);
      } else {
        read(id);
      }
    });
    return card;
  }

  /** The paper note explaining the picked card, with the swap button. */
  function note(): HTMLElement {
    if (!picked) return h('p', { class: 'cards-note cards-hint' }, 'Tap a card to read it.');
    const id = picked;
    const def = CARDS[id]!;
    const level = levelOf(c.cardUses, id);
    const inDeck = preferredDeck(c).includes(id);
    const uses = c.cardUses[id] ?? 0;
    const progress = level >= MAX_CARD_LEVEL ? 'Max level' : `${usesForLevel(level + 1) - uses} more uses to level ${level + 1}`;

    let action: HTMLElement | string = '';
    if (swapping) {
      action = h(
        'div',
        { class: 'cards-note-action' },
        h('span', { class: 'cards-note-hint' }, inDeck ? 'Now tap a card below to bring instead' : 'Now tap the deck card it replaces'),
        h('button', { class: 'btn btn-ghost btn-small', type: 'button', onclick: () => setSwapping(false) }, 'Cancel'),
      );
    } else if (canSwap()) {
      action = h(
        'div',
        { class: 'cards-note-action' },
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => setSwapping(true) }, inDeck ? 'Swap out' : 'Put in deck'),
        inDeck ? h('span', { class: 'cards-note-tag' }, 'In your deck') : '',
      );
    } else if (inDeck) {
      action = h('div', { class: 'cards-note-action' }, h('span', { class: 'cards-note-tag' }, 'In your deck'));
    }

    return h(
      'div',
      { class: 'paper-note cards-note filled', 'aria-live': 'polite' },
      h(
        'div',
        { class: 'cards-note-top' },
        h('strong', { class: 'note-name' }, def.name),
        h('span', { class: 'cards-note-level' }, `Level ${level}`, h('span', { class: 'dim' }, ` · ${progress}`)),
      ),
      h('p', { class: 'note-text' }, def.describe(level)),
      action,
    );
  }

  function draw(): void {
    const deck = preferredDeck(c);
    // Every card you own; the ones outside the deck come first, as they are the ones to swap in.
    const collection = [...c.cards.filter((id) => !deck.includes(id)), ...deck];
    const deckSlots = Array.from({ length: DECK_SIZE }, (_, i) => {
      const id = deck[i];
      return id ? cardButton(id, 'deck') : h('span', { class: 'game-card card-empty', 'aria-label': 'Empty slot' });
    });
    page.replaceChildren(
      h('h2', { class: 'cards-label' }, 'Deck'),
      h('div', { class: 'deck-tray' }, ...deckSlots),
      note(),
      h('h2', { class: 'cards-label' }, 'Collection', h('span', { class: 'cards-count' }, String(c.cards.length))),
      h('div', { class: 'card-grid' }, ...collection.map((id) => cardButton(id, 'collection'))),
    );
  }

  draw();
}
