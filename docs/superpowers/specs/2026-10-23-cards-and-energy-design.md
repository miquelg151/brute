# Cards and energy in fights — design

Date: 2026-10-23. Status: approved in conversation, waiting for review of this document.

## Why

Fights are watched more than played: the only inputs today are the special strike once
per round and the choices at breaks. We want Clash Royale-style moments where the player
decides: an energy bar fills during the fight and the player taps cards from a small deck.
Progression should come from the cards you own and how much you have used them, and the
daily fight limit goes away.

This is sub-project 1 of 3:

1. **Cards and energy** (this document): against bot-controlled opponents, no daily limit.
2. Accounts and friends (Supabase): fight your friends' fighters, played by the computer.
3. Live fights and a league: real-time fights against friends, trophies, cards unlocked by
   league rank.

Sub-project 1 must be built so 3 fits without rework: every card play is stored with the
exact tick it happens on, both sides play cards the same way, and nothing random is
decided outside the deterministic simulation.

## Decisions taken

| Question | Choice |
|---|---|
| Where cards come from | Every class starts with 2 cards (the shared Special Strike and one class card); more cards are won at level-ups |
| Fight limit | None. Players who play more progress faster; accepted |
| How cards get stronger | By use: each play gives the card 1 use; levels at 3, 8, 15, 25 uses |
| Hand | A deck of 4 chosen before the fight, all 4 always visible |
| Existing special strike | Becomes the Special Strike card; the warm-up is removed |
| Pace | About 2-3 cards per round; rounds get longer (~20 s at x1) |
| Existing skills and items | Stay automatic (combo, counter, shield, weapons, pets, gear); cards are added on top |
| Architecture | Card plays are inputs of the deterministic simulation (like the special strike today) |

## Cards

Cost in energy (⚡). Effects are given at card level 1. Each level above 1 adds 10% to the
numbers marked *scaled* (rounded down), and counts (hits blocked, dodges) grow by 1 at
level 4. Cost never changes. Every card has something that improves with level.

### Starting cards

| Card | Class | Cost | Effect |
|---|---|---|---|
| Special Strike | all | 5 | The timing bar appears; the fighter's next attack is a special strike with up to +60% damage (*scaled*) depending on timing. Cannot be dodged. |
| Rage | Brawler | 4 | +30% damage (*scaled*) on the fighter's next 3 turns |
| Roll | Parkour | 3 | The next 2 attacks (*count*) against the fighter are dodged for sure |
| Wall | Bouncer | 4 | The next 3 hits (*count*) on the fighter are blocked for sure (quarter damage) |
| Sic 'em | Tamer | 3 | Every pet acts immediately with +50% damage (*scaled*) on that attack |
| Overcharge | Mystic | 4 | +30 mana (*scaled*) and the next spell does +50% (*scaled*) |

### Cards won at level-ups

They join the upgrade pools as a new upgrade kind, `card`: class cards go into the class
pool, general cards into the general pool (the 60/40 split and the "at least one non-stat
choice" rule apply as today).

| Card | Pool | Cost | Effect |
|---|---|---|---|
| Patch Up | general | 4 | Heal 15% of max health (*scaled*) |
| Hurl | general | 3 | Throw the weapon in hand now for double damage (*scaled*); unarmed: a shove for normal damage |
| Rush | general | 2 | The fighter's turn gauge fills: they act on the next tick, with +0% damage (*scaled*: +10% per level above 1) |
| Feint | general | 3 | The enemy fighter's next attack misses, and the fighter's next attack does +20% (*scaled*) |
| Second Breath | general | 2 | +40 stamina (*scaled*) |
| Haymaker | Brawler | 4 | Next hit +80% damage (*scaled*) and cannot be dodged |
| Flurry | Parkour | 5 | Next turn strikes 3 times, each hit at 70% damage (*scaled*) |
| Body Slam | Bouncer | 5 | A heavy hit (+40% *scaled*) that pushes the enemy's turn gauge back by 50 |
| Stray Dog | Tamer | 6 | A dog (base dog stats, *scaled* health) joins until the end of the round |
| Bolt | Mystic | 5 | A spell of 4 + magic that cannot be dodged and does +50% (*scaled*) |

Planned extension, not part of this sub-project: 2-3 more class cards per class once these
are tested.

### Card levels

- `uses` per card is stored on the character. A play counts when its card event happens in
  a finished fight (playing it and losing still counts).
- Level from uses: 0-2 → 1, 3-7 → 2, 8-14 → 3, 15-24 → 4, 25+ → 5 (max).
- Bot opponents: every card at level `min(5, 1 + floor(fighterLevel / 5))`.

## Energy and rhythm

- `ROUND_TICKS` goes from 30 to 45 (rounds of about 20 seconds at x1). Still 3 rounds and
  the breaks as today.
- Each main fighter has energy 0-10. A fight starts with 3; +1 every 4 ticks; the unspent
  energy carries over to the next round.
- A card can be played when energy ≥ cost. It takes effect at the start of the next tick.
- Effects that wait for "next attack / next turn / next hits" are stored as small
  counters on the unit and consumed when the event happens. They last until used, across
  rounds.
- Speed x1/x2/x4 and Skip stay. Skip runs to the next break; energy is kept.

## Bot opponents

The bot plays the same cards with the same energy. It only reacts to what has already
happened (it never sees the player's hand or future plays), so the same rules work in live
fights for a disconnected player. A first rule set, evaluated each tick in order, playing
at most one card per tick:

1. Health < 35% and has Patch Up → Patch Up.
2. The enemy just played Rage, Haymaker or Flurry, and it has Wall / Roll / Feint → that
   defence.
3. Energy ≥ 8 → the most expensive card it can afford (Special Strike counts with a
   timing quality rolled from the simulation's random numbers, 40-90).
4. Otherwise wait.

The rules live in one function so they can be tuned from the balance tool.

## Screens

- **Fight**: health bars; arena (an enemy card play shows as a small sticker above the
  enemy health bar with the card's name); the energy bar (⚡, "6/10", sticker edge); the 4
  cards in a row as paper stickers: pixel icon, name, cost bubble, level stars, a stripe
  in the class colour (grey for general cards), dimmed when not affordable, a sticker slap
  on tap. Speed and Skip become small, in a corner. Playing Special Strike hides the cards
  and turns the zone into the timing bar, as today.
- **Pre-fight**: a "Your deck" section with 4 slots, using the existing sticker picker
  (drag or tap). Each card shows its level and progress. With 4 cards or fewer, all are
  brought.
- **Home**: a "Cards" section: every owned card, level and progress bar. The daily fights
  pips go away.
- **Level-up**: card offers show the card art and "New card".
- **Fight result**: "+1 use" under each card played; a celebration when a card levels up.
- Card icons: 7×7 pixel icons in the existing icon family (`src/ui/icons.ts`), overridable
  by PNG like any icon.

## How it is built

- `src/core/cards.ts` (new): `CardDef` (id, name, cost, pool, numbers per effect and how
  they scale), `CARDS`, `cardLevel(uses)`, effect descriptions per level for the UI.
- `Character`: `cards: string[]` (owned) and `cardUses: Record<string, number>`.
- Progression: upgrade kind `card`; `applyUpgrade` adds the card to `cards`.
- Fight simulation (`src/core/fight.ts`):
  - `TeamOptions.deck` (up to 4 card ids with their levels) and
    `TeamOptions.plays: { tick: number; card: string; quality?: number }[]`.
  - Units get `energy` and status counters (rage turns, guaranteed dodges, guaranteed
    blocks, feint, next-hit bonus, flurry, ...).
  - Each tick: energy gain, then plays scheduled for this tick (interactive side) or the
    bot's choice (other side), then units act as today.
  - New events: `{ t: 'tick', n }` (so the replay knows the current tick), `{ t: 'card',
    actor, card, level }`, `{ t: 'energy', actor, energy }`.
  - The automatic special strike (`SPECIAL_TURN`) and the warm-up are removed; the special
    strike is resolved by the Special Strike card.
- Replay (`src/fight/ReplayScene.ts`): a play is recorded at "current tick + 1", saved with
  the pending fight inputs, and the log is re-simulated; events up to the current tick are
  identical, so the replay continues seamlessly (the same mechanism as today's special).
- Save format version 5 → 6: add `cards` (Special Strike + class card), `cardUses: {}`;
  drop the daily counter and the warm-up score.
- The daily limit (`FIGHTS_PER_DAY`, `fightsLeft`, `useFight`) is removed.

## Balance and tests

- The balance tool gives both sides decks and lets both bots play cards; it re-measures the
  classes with 45-tick rounds, adds a `cards` section (how often each card is played and its
  win-rate impact; no card should be useless or dominant), and the skill section checks that
  a perfect card player wins at most 65% against a passive copy.
- Unit tests: each card's effect, energy gain and spending, card levels from uses, the same
  plays give the same fight, a play recorded mid-fight re-simulates identical earlier
  events, save migration 5 → 6, level-up offers can contain cards.

## Out of scope here

Accounts, friends, live fights, league and trophies (sub-projects 2 and 3); more class
cards; card art as PNGs beyond the icon set; sounds.
