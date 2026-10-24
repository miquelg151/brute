# Mobile game UI — design

Date: 2026-10-24. Status: approved in conversation section by section (the owner approved the
spec and the plan in advance).

## Why

The game works, but it reads as long web pages: home and creation scroll a lot, empty dashed
boxes look unfinished, the pre-fight screen is very long, and while choosing a class or origin
the fighter is out of view. The owner wants it to feel like a current mobile game.

## Decisions

| Question | Choice |
|---|---|
| Organisation | Bottom tab bar, screens that fit without scrolling (like Clash Royale / Brawl Stars) |
| Tabs | Three: **Fighter · Fight · Cards** (Fight in the middle, bigger). No locked "coming soon" tabs |
| Look | Keep the paper and sticker style; add game feel (chunky press buttons, top bar, tab transitions, celebration) |
| Creation | Four steps with the fighter fixed on top: Look → Class → Origin → Name |
| Pre-fight | One screen: compact poster on top, foe traits, mini tabs Plan · Gear · Cards, Start button |

## Structure

- **Shell** (once a fighter exists): a fixed **top bar** (small fighter, name, level, rank badge,
  XP bar), the tab content in the middle, a fixed **tab bar** at the bottom (Fighter · Fight ·
  Cards; Fight is the default and the biggest). The middle must fit a 360 × 640 viewport above
  the phone's safe area (`env(safe-area-inset-bottom)`); only the Fighter and Cards tabs may
  scroll inside their own area if they overflow.
- **Full-screen moments** cover the shell: creation, pre-fight, fight, level-up. When they end,
  the game returns to the Fight tab.
- `main.ts` still picks the screen from the save (no fighter → creation, offer → level-up,
  pending fight → pre-fight/fight). Only the open tab is new UI state, remembered in
  `localStorage` (guarded; falls back to Fight). The save format does not change, except the
  optional preferred deck below.
- Title screen and `?gallery` stay as they are.

## Screens

- **Fight tab:** the fighter big in the middle on a strip of arena (night wall and pavement like
  the fight background), idle animation; under it a huge **FIGHT** button; above the button a
  small row with the 4 cards that will be brought. When a level-up is waiting, the button
  becomes **Level up!** with a gentle pulse.
- **Fighter tab:** a row of stat icons (health, strength, agility, speed, plus magic/mana when
  present), then an inventory-like grid of slots: weapons, pets, armor, accessory, skills. Each
  item is a sticker; tap to read what it does. Empty slots show a padlock and "Level up to get
  one" — no loose dashed boxes. "Delete fighter" small at the very bottom (two taps, as now).
- **Cards tab:** the deck as 4 slots on top, the collection as a grid below; tap a card to see
  what it does, its level and the uses left to the next level; tap to add/remove from the deck.
  This is the **preferred deck** used by default before each fight.
- **Creation:** fighter fixed on top half; bottom half changes per step (Look arrows + Random;
  Class carousel; Origin grid with cards; Name + Create). Four dots, Back and Next. The preview
  updates instantly on every choice.
- **Pre-fight:** compact poster (you VS foe; name, then level and rank on a second short line,
  so nothing wraps badly), foe trait stickers in one row, mini tabs **Plan · Gear · Cards**,
  **Start fight** at the bottom. One screen, no page scroll (a mini tab's content may scroll
  inside itself).
- **Fight and level-up:** unchanged, except the fight result: paper confetti on a win, a
  bigger result banner, rewards appearing one by one.
- **Legend aura:** the gold edge becomes 1 px and the halo softer.

## Game feel

- Chunky buttons: darker bottom edge like a sticker on card; on press they move down 3 px;
  a short vibration where supported (`navigator.vibrate`, guarded; iPhone browsers have none).
- Active tab lifts and takes colour; tab content enters with a ~150 ms animation.
- XP bar fills gradually when coming back from a fight, with a small jump on level-up.
- `prefers-reduced-motion`: animations become simple fades or none.

## Preferred deck

- `Character.deck?: string[]` — optional. `preferredDeck(c)`: the saved ids still owned, in
  order, topped up from `c.cards` in order to `DECK_SIZE`; without a saved deck it is the first
  `DECK_SIZE` cards (today's behaviour). Changing the deck in the Cards tab or before a fight
  saves it. No save version change; old saves work as they are.

## Build

- New: shell (top bar + tab bar), one module per tab, creation steps, pre-fight mini tabs.
  Reuse existing pickers, stickers, cards and motion helpers; colours and sizes stay in
  `theme.ts` / `style.css` so the owner can edit them.

## Testing

- Unit tests for the preferred deck (saved, default, top-up, cards no longer owned).
- Screenshots at 360 × 640 and 390 × 844 of every screen with headless Chrome (a small
  DevTools script), checking no page scroll where none is allowed, nothing cut off or
  overlapping, and no console errors.

## Out of scope

Friends and league tabs, a shop, sounds, new art beyond what the screens need.
