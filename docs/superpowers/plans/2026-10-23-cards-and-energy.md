# Cards and Energy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fighters carry a deck of up to 4 cards and spend energy that fills during the fight to play them; cards level up by use; the daily fight limit, the warm-up and the automatic special strike go away.

**Architecture:** Card plays are inputs of the deterministic fight simulation (`runFight`), recorded as `{ tick, card, quality? }` like today's special-strike inputs. The player's side gets its plays from the UI; every other side is played by a rule-based bot inside the simulation, so the same rules later serve live fights. The replay re-simulates when the player plays a card, and events before that tick stay identical.

**Tech Stack:** TypeScript, Vite, Phaser 3.90 (replay only), Vitest, tsx (balance tool).

**Spec:** `docs/superpowers/specs/2026-10-23-cards-and-energy-design.md`

## Global Constraints

- All game text, identifiers and code comments in English (the user writes Catalan in chat only).
- Code style of the repo: 2-space indent, single quotes, semicolons, comments explaining *why* in plain words; the user is a beginner and edits the code, so prefer obvious code over clever code.
- Colours only from `PAL` (`src/ui/theme.ts`); pixel sizes only `'small' | 'normal' | 'big'`; text uses the existing CSS tokens and the sticker lettering rules in `src/style.css`.
- The save format version is currently **4** (the spec says 5→6; the real numbers are 4→5). Old saves must be migrated, never discarded.
- `ROUND_TICKS` 30 → 45. Energy 0-10, start 3, +1 every 4 ticks, carried over between rounds.
- Card level from uses: 0-2 → 1, 3-7 → 2, 8-14 → 3, 15-24 → 4, 25+ → 5. Each level above 1 adds 10% to *scaled* numbers; counts grow by 1 at level 4. Costs never change.
- Bot card level: `min(5, 1 + floor(fighterLevel / 5))`.
- Balance targets after the change: every class average 45-55% at levels 1, 5, 10, 20; matchups 35-65%; player skill (perfect card play vs a passive copy) ≤ 65%; strategy advice 0 problems.
- Verify with: `npx tsc --noEmit`, `npx vitest run`, `npm run build`, and for UI tasks a Playwright check at 390×844 and 320×640 against `http://127.0.0.1:5199` (start `npm run dev` in the background only when needed; a stale server from `C:\Dev\brute` may hold `localhost:5199`).
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push to `main` only at the end of a task when the user has asked for it (they have, for this project: tasks push as they finish).

---

### Task 1: Card catalog and card levels

**Files:**
- Create: `src/core/cards.ts`
- Modify: `src/core/index.ts` (export it)
- Test: `src/core/core.test.ts` (new `describe('cards')`)

**Interfaces:**
- Produces:
  - `type CardId = 'special' | 'rage' | 'roll' | 'wall' | 'sic_em' | 'overcharge' | 'patch_up' | 'hurl' | 'rush' | 'feint' | 'second_breath' | 'haymaker' | 'flurry' | 'body_slam' | 'stray_dog' | 'bolt'` (exported as `string` ids via `CARDS` keys; code uses `string`)
  - `interface CardDef { id: string; name: string; cost: number; pool: 'general' | ClassId; starting: boolean; describe(level: number): string }`
  - `CARDS: Record<string, CardDef>`, `CARD_IDS: string[]`
  - `MAX_CARD_LEVEL = 5`, `DECK_SIZE = 4`
  - `cardLevel(uses: number): number`, `usesForLevel(level: number): number`
  - `scaled(base: number, level: number): number`, `scaledCount(base: number, level: number): number`
  - `startingCards(classId: ClassId): string[]` → `['special', <class card>]`
  - `botCardLevel(fighterLevel: number): number`

- [ ] **Step 1: Write the failing tests**

Add to `src/core/core.test.ts` (and add `CARDS, cardLevel, scaled, scaledCount, startingCards, botCardLevel, usesForLevel` to the import list from `./index`):

```ts
describe('cards', () => {
  it('levels come from uses', () => {
    expect([0, 2, 3, 7, 8, 14, 15, 24, 25, 99].map(cardLevel)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(usesForLevel(2)).toBe(3);
    expect(usesForLevel(5)).toBe(25);
  });

  it('scaled numbers grow 10% per level, counts by one at level 4', () => {
    expect(scaled(30, 1)).toBe(30);
    expect(scaled(30, 3)).toBe(36);
    expect(scaled(30, 5)).toBe(42);
    expect(scaledCount(2, 3)).toBe(2);
    expect(scaledCount(2, 4)).toBe(3);
  });

  it('every class starts with the special strike and its own card', () => {
    expect(startingCards('brawler')).toEqual(['special', 'rage']);
    expect(startingCards('parkour')).toEqual(['special', 'roll']);
    expect(startingCards('bouncer')).toEqual(['special', 'wall']);
    expect(startingCards('tamer')).toEqual(['special', 'sic_em']);
    expect(startingCards('mystic')).toEqual(['special', 'overcharge']);
  });

  it('every card costs 2-6 energy and describes every level', () => {
    for (const card of Object.values(CARDS)) {
      expect(card.cost).toBeGreaterThanOrEqual(2);
      expect(card.cost).toBeLessThanOrEqual(6);
      for (let level = 1; level <= 5; level++) expect(card.describe(level).length).toBeGreaterThan(5);
    }
  });

  it('bot card levels follow the fighter level', () => {
    expect([1, 4, 5, 10, 19, 20, 40].map(botCardLevel)).toEqual([1, 1, 2, 3, 4, 5, 5]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run -t cards`
Expected: FAIL — `cardLevel` (and the others) are not exported.

- [ ] **Step 3: Write `src/core/cards.ts`**

```ts
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
  wall: card('wall', 'Wall', 4, 'bouncer', true, (l) => `Block the next ${scaledCount(3, l)} hits for sure.`),
  sic_em: card('sic_em', "Sic 'em", 3, 'tamer', true, (l) => `Every pet attacks right now with +${scaled(50, l)}% damage.`),
  overcharge: card('overcharge', 'Overcharge', 4, 'mystic', true, (l) => `+${scaled(30, l)} mana and your next spell does +${scaled(50, l)}%.`),
  // Won at level-ups
  patch_up: card('patch_up', 'Patch Up', 4, 'general', false, (l) => `Heal ${scaled(15, l)}% of your health.`),
  hurl: card('hurl', 'Hurl', 3, 'general', false, (l) => `Throw your weapon now for ${scaled(200, l)}% damage.`),
  rush: card('rush', 'Rush', 2, 'general', false, (l) => `Act right away${l > 1 ? `, with +${10 * (l - 1)}% damage` : ''}.`),
  feint: card('feint', 'Feint', 3, 'general', false, (l) => `Their next attack misses and your next one does +${scaled(20, l)}%.`),
  second_breath: card('second_breath', 'Second Breath', 2, 'general', false, (l) => `+${scaled(40, l)} stamina.`),
  haymaker: card('haymaker', 'Haymaker', 4, 'brawler', false, (l) => `Your next hit does +${scaled(80, l)}% and can't be dodged.`),
  flurry: card('flurry', 'Flurry', 5, 'parkour', false, (l) => `Your next turn strikes 3 times at ${scaled(70, l)}% damage each.`),
  body_slam: card('body_slam', 'Body Slam', 5, 'bouncer', false, (l) => `A heavy hit (+${scaled(40, l)}%) that pushes their next turn back.`),
  stray_dog: card('stray_dog', 'Stray Dog', 6, 'tamer', false, (l) => `A dog with ${scaled(100, l)}% health joins until the round ends.`),
  bolt: card('bolt', 'Bolt', 5, 'mystic', false, (l) => `A spell that can't be dodged and does +${scaled(50, l)}%.`),
};

export const CARD_IDS = Object.keys(CARDS);

const CLASS_CARD: Record<ClassId, string> = { brawler: 'rage', parkour: 'roll', bouncer: 'wall', tamer: 'sic_em', mystic: 'overcharge' };

export function startingCards(classId: ClassId): string[] {
  return ['special', CLASS_CARD[classId]];
}
```

Add `export * from './cards';` to `src/core/index.ts` (after `./catalog`).

- [ ] **Step 4: Run the tests**

Run: `npx tsc --noEmit && npx vitest run -t cards`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/cards.ts src/core/index.ts src/core/core.test.ts
git commit -m "Cards: catalog of 16 cards, levels from uses, scaling rules"
```

---

### Task 2: Characters own cards; cards are level-up upgrades

**Files:**
- Modify: `src/core/types.ts` (Character), `src/core/character.ts` (createCharacter), `src/core/catalog.ts` (UpgradeDef kind `card`, UPGRADES), `src/core/progression.ts` (owns, applyUpgrade), `src/ui/describe.ts` (labels and details for cards)
- Test: `src/core/core.test.ts`

**Interfaces:**
- Consumes: `CARDS`, `startingCards` (Task 1)
- Produces: `Character.cards: string[]`, `Character.cardUses: Record<string, number>`; upgrade ids `card:<id>` with `kind: 'card'`, `ref: <card id>`

- [ ] **Step 1: Failing tests**

```ts
describe('card upgrades', () => {
  it('new characters own their starting cards with no uses', () => {
    const c = createCharacter('C', look, 'mystic', 'port');
    expect(c.cards).toEqual(['special', 'overcharge']);
    expect(c.cardUses).toEqual({});
  });

  it('non-starting cards are offered in their pool and can be learned once', () => {
    const general = UPGRADES.filter((u) => u.kind === 'card' && u.pool === 'general').map((u) => u.id);
    expect(general).toEqual(expect.arrayContaining(['card:patch_up', 'card:hurl', 'card:rush', 'card:feint', 'card:second_breath']));
    expect(UPGRADES.find((u) => u.id === 'card:rage')).toBeUndefined();
    const c = createCharacter('B', look, 'brawler', 'port');
    applyUpgrade(c, 'card:haymaker');
    expect(c.cards).toContain('haymaker');
    expect(() => applyUpgrade(c, 'card:haymaker')).toThrow();
    expect(eligibleUpgrades(c, 'brawler').some((u) => u.id === 'card:haymaker')).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run -t "card upgrades"` → FAIL (`cards` undefined, no `card:` upgrades).

- [ ] **Step 3: Implement**

`src/core/types.ts` — add to `Character` after `gear`:

```ts
  /** Owned cards (ids from CARDS). Up to DECK_SIZE of them are brought into a fight. */
  cards: string[];
  /** How many times each card has been played in finished fights; sets its level. */
  cardUses: Record<string, number>;
```

`src/core/character.ts` — import `startingCards` from `./cards` and add to the returned object:

```ts
    cards: startingCards(classId),
    cardUses: {},
```

`src/core/catalog.ts`:
- Change the UpgradeDef union kind to `'weapon' | 'skill' | 'pet' | 'gear' | 'card'`.
- In `ref`, add the card table: `const table = { weapon: WEAPONS, skill: SKILLS, pet: PETS, gear: GEAR, card: CARDS }[kind];` (import `CARDS` from `./cards`; widen `ref`'s `kind` parameter to include `'card'`).
- Append to `UPGRADES` (general cards in the General block, class cards in each class block):

```ts
  ref('card', 'general', 'patch_up'),
  ref('card', 'general', 'hurl'),
  ref('card', 'general', 'rush'),
  ref('card', 'general', 'feint'),
  ref('card', 'general', 'second_breath'),
  // ... in each class block:
  ref('card', 'brawler', 'haymaker'),
  ref('card', 'parkour', 'flurry'),
  ref('card', 'bouncer', 'body_slam'),
  ref('card', 'tamer', 'stray_dog'),
  ref('card', 'mystic', 'bolt'),
```

`src/core/progression.ts` — in `owns` add `case 'card': return c.cards.includes(u.ref);` and in `applyUpgrade` add `case 'card': c.cards.push(u.ref); break;`.

`src/ui/describe.ts` — import `CARDS`; in `upgradeKindLabel` map `card: 'Card'`; in `upgradeDetail` add:

```ts
    case 'card': {
      const card = CARDS[u.ref]!;
      return `${card.cost} energy. ${card.describe(1)}`;
    }
```

- [ ] **Step 4: Run all tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (the existing offer tests still pass; `generateOpponent` characters now also carry cards).

- [ ] **Step 5: Commit**

```bash
git add src/core src/ui/describe.ts
git commit -m "Characters own cards; non-starting cards are level-up upgrades"
```

---

### Task 3: Energy, ticks and card plays in the simulation (Special Strike as a card)

**Files:**
- Modify: `src/core/fight.ts`
- Test: `src/core/core.test.ts` (replace the `skill` describe block and the `playThrough` / `playAuto` helpers)

**Interfaces:**
- Consumes: `CARDS`, `scaled`, `botCardLevel`, `DECK_SIZE` (Task 1); `Character.cards` (Task 2)
- Produces:
  - `export interface CardPlay { tick: number; card: string; quality?: number }`
  - `TeamOptions.deck?: Record<string, number>` (card → level; missing = `defaultDeck(c)`), `TeamOptions.plays?: CardPlay[]` (interactive side only), `TeamOptions.specialQuality?: number` (bots: fixed timing instead of rolled); `TeamOptions.specials` and `TeamOptions.warmup` are removed.
  - `export function defaultDeck(c: Character): Record<string, number>` (first `DECK_SIZE` cards, bot levels)
  - Events: `{ t: 'tick'; n: number }`, `{ t: 'energy'; actor: number; energy: number }`, `{ t: 'card'; actor: number; card: string; level: number }`, `{ t: 'special'; actor: number; quality: number }` (no `index`, never null)
  - Constants: `ROUND_TICKS = 45`, `MAX_ENERGY = 10`, `START_ENERGY = 3`, `ENERGY_EVERY = 4`
  - `UnitInfo` unchanged.

- [ ] **Step 1: Replace the test helpers and the `skill` block**

In `src/core/core.test.ts` replace `playAuto` and `playThrough`:

```ts
/** Plays a whole daily fight like the UI does, playing no cards; every break keeps the plan. */
function playAuto(save: SaveData, day: number) {
  if (!prepareFight(save, day)) return null;
  startFight(save, DEFAULT_PLAN, save.character.weapons);
  for (let log = simulateFight(save); log.winner === null; log = simulateFight(save)) recordBreak(save, keep(save.character.weapons));
  return finishFight(save);
}

/** Runs an interactive fight for side a to the end with the given plays, keeping the plan at breaks. */
function playThrough(a: Character, b: Character, seed: number, plays: CardPlay[] = [], recover = false) {
  const breaks: BreakChoice[] = [];
  for (;;) {
    const log = runFight(a, b, seed, { a: { interactive: true, plays, breaks } });
    if (log.winner !== null) return { log, breaks };
    breaks.push(keep(a.weapons, recover));
  }
}
```

(Task 4 removes the `day` parameter when `prepareFight` stops taking one.)

Replace the whole `describe('skill', ...)` block with:

```ts
describe('energy and cards', () => {
  const a = generateOpponent(10, new Rng(11), 'brawler');
  const b = generateOpponent(10, new Rng(12), 'bouncer');
  const energyOf = (log: FightLog, actor: number) => log.events.filter((e) => e.t === 'energy' && e.actor === actor).map((e) => (e.t === 'energy' ? e.energy : 0));

  it('energy starts at 3, fills one point every 4 ticks and never passes 10', () => {
    const { log } = playThrough(a, b, 42);
    const first = log.events.find((e) => e.t === 'energy' && e.actor === 0);
    expect(first).toEqual({ t: 'energy', actor: 0, energy: 3 });
    expect(Math.max(...energyOf(log, 0))).toBeLessThanOrEqual(10);
    const tick8 = log.events.findIndex((e) => e.t === 'tick' && e.n === 8);
    const at8 = log.events.slice(0, tick8 + 2).filter((e) => e.t === 'energy' && e.actor === 0).at(-1);
    expect(at8).toMatchObject({ energy: 5 });
  });

  it('a play is applied at its tick and leaves earlier events identical', () => {
    const before = playThrough(a, b, 42).log;
    const plays = [{ tick: 6, card: 'rage' }];
    const after = playThrough(a, b, 42, plays).log;
    const cut = before.events.findIndex((e) => e.t === 'tick' && e.n === 6);
    expect(after.events.slice(0, cut + 1)).toEqual(before.events.slice(0, cut + 1));
    // A level-10 fighter's default deck is at bot level 3.
    expect(after.events.slice(cut + 1).find((e) => e.t === 'card' && e.actor === 0)).toEqual({ t: 'card', actor: 0, card: 'rage', level: 3 });
  });

  it('a play without enough energy does nothing', () => {
    const { log } = playThrough(a, b, 42, [{ tick: 1, card: 'special', quality: 100 }]);
    expect(log.events.some((e) => e.t === 'card' && e.actor === 0)).toBe(false);
  });

  it('the special strike card makes the next attack an undodgeable special', () => {
    const { log } = playThrough(a, b, 42, [{ tick: 8, card: 'special', quality: 90 }]);
    const i = log.events.findIndex((e) => e.t === 'special' && e.actor === 0);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(log.events[i]).toEqual({ t: 'special', actor: 0, quality: 90 });
    expect(log.events[i + 1]).toMatchObject({ actor: 0, kind: 'special' });
    expect(['hit', 'block']).toContain(log.events[i + 1]!.t);
  });

  it('a failed special strike plays a normal turn', () => {
    const { log } = playThrough(a, b, 42, [{ tick: 8, card: 'special', quality: 0 }]);
    expect(log.events.some((e) => (e.t === 'hit' || e.t === 'block') && e.kind === 'special')).toBe(false);
  });

  it('bots play cards on their own', () => {
    const plays = Array.from({ length: 20 }, (_, seed) => runFight(a, b, seed)).flatMap((l) => l.events.filter((e) => e.t === 'card'));
    expect(plays.length).toBeGreaterThan(0);
  });

  it('an empty deck plays nothing', () => {
    const log = runFight(a, b, 3, { a: { deck: {} }, b: { deck: {} } });
    expect(log.events.some((e) => e.t === 'card')).toBe(false);
  });

  it('non-interactive fights never ask for input', () => {
    for (let seed = 0; seed < 50; seed++) expect(runFight(a, b, seed).winner).not.toBeNull();
  });

  it('loadout keeps only owned weapons, at most 3', () => {
    const c = createCharacter('W', look, 'bouncer', 'port');
    c.weapons.push('chain', 'umbrella', 'skateboard');
    expect(loadoutFor(c, ['chain', 'traffic_sign', 'umbrella'])).toEqual(['chain', 'umbrella']);
    expect(loadoutFor(c)).toHaveLength(3);
  });
});
```

Also: in `describe('rounds')` change the second test to `runFight(a, b, 1, { a: { interactive: true } })`, and in the third test call `playThrough(a, b, 5, [], recover)`. Remove `warmupBonus`, `recordSpecial` and `SPECIAL...` from the imports; add `type CardPlay`.

- [ ] **Step 2: Run, expect failures**

Run: `npx vitest run`
Expected: FAIL — no `tick`/`energy`/`card` events, `plays` option unknown.

- [ ] **Step 3: Implement in `src/core/fight.ts`**

1. Imports: add `import { CARDS, DECK_SIZE, botCardLevel, scaled } from './cards';`.
2. Constants: `ROUND_TICKS = 45`; remove `SPECIAL_TURN`, `WARMUP_MAX_BONUS` and `warmupBonus`; keep `SPECIAL_MIN_QUALITY` and `SPECIAL_MAX_BONUS`; add:

```ts
export const MAX_ENERGY = 10;
export const START_ENERGY = 3;
/** One energy point every this many ticks. */
export const ENERGY_EVERY = 4;
/** Bots play a card when their energy reaches this (unless a rule fires earlier). */
const BOT_SPEND_AT = 8;
```

3. Types:

```ts
/** A card played by the player: applied at the start of `tick` (ticks count across rounds from 0). */
export interface CardPlay {
  tick: number;
  card: string;
  /** Special Strike only: how well the timing bar was hit, 0-100. */
  quality?: number;
}
```

In `TeamOptions` remove `warmup` and `specials`, add:

```ts
  /** Cards brought (id → level). Missing: the first DECK_SIZE owned cards at bot level. */
  deck?: Record<string, number>;
  /** Interactive side: the cards the player played, in order. */
  plays?: CardPlay[];
  /** Bots: timing quality of their special strikes (missing: rolled 40-90). */
  specialQuality?: number;
```

In `FightEvent` replace the `special` member and add three:

```ts
  /** Start of a tick (counted across rounds), so a replay knows where it is. */
  | { t: 'tick'; n: number }
  | { t: 'energy'; actor: number; energy: number }
  | { t: 'card'; actor: number; card: string; level: number }
  /** A special strike from the Special Strike card, with its timing quality. */
  | { t: 'special'; actor: number; quality: number }
```

Add `defaultDeck`:

```ts
/** The cards a fighter brings when nobody chose: the first DECK_SIZE, at the bot level. */
export function defaultDeck(c: Character): Record<string, number> {
  const level = botCardLevel(c.level);
  return Object.fromEntries(c.cards.slice(0, DECK_SIZE).map((id) => [id, level]));
}
```

4. `Unit`: remove `specials`, `specialsUsed`; add:

```ts
  /** Card state (main fighters). */
  energy: number;
  deck: Record<string, number>;
  plays: readonly CardPlay[];
  specialQuality: number | undefined;
  /** Special Strike waiting for this unit's next turn: its quality and max bonus. */
  pendingSpecial: { quality: number; bonus: number } | null;
  lastEnergy: number;
```

In `buildUnits` set `energy: START_ENERGY, deck: opts.deck ?? defaultDeck(c), plays: opts.plays ?? [], specialQuality: opts.specialQuality, pendingSpecial: null, lastEnergy: -1,` and remove the warm-up from `base.damagePct` (`damagePct: 100`). Companions inherit by the spread; set `deck: {}, plays: []` for them.

5. Special damage: in `baseDamage` the `special` line uses a bonus passed in instead of the constant. Change the signature to `baseDamage(att, kind, quality, specialBonus = SPECIAL_MAX_BONUS)` and the line to:

```ts
    if (kind === 'special') dmg = Math.floor((dmg * (100 + (quality * specialBonus) / 100)) / 100);
```

and `attack(att, def, kind, quality = 0, specialBonus = SPECIAL_MAX_BONUS)` passes it through.

6. Replace `trySpecial` with:

```ts
  /** Returns true if the turn was used by a special strike waiting from the Special Strike card. */
  const trySpecial = (u: Unit): boolean => {
    const s = u.pendingSpecial;
    if (!s) return false;
    u.pendingSpecial = null;
    events.push({ t: 'special', actor: u.idx, quality: s.quality });
    if (s.quality < SPECIAL_MIN_QUALITY || !canPay(u, STAMINA_COST.special)) return false;
    pay(u, STAMINA_COST.special);
    attack(u, enemyMainOf(u), 'special', s.quality, s.bonus);
    return true;
  };
```

7. Card plumbing, defined after `trySpecial`:

```ts
  const emitEnergy = () => {
    for (const m of mains) {
      if (m.energy !== m.lastEnergy) {
        m.lastEnergy = m.energy;
        events.push({ t: 'energy', actor: m.idx, energy: m.energy });
      }
    }
  };

  /** The last card each team played, for the bot's reactions. */
  const lastCard: [{ card: string; tick: number } | null, { card: string; tick: number } | null] = [null, null];

  /** Plays a card for a main fighter. Returns false (and does nothing) if it can't be played now. */
  const playCard = (u: Unit, id: string, tick: number, quality?: number): boolean => {
    const level = u.deck[id];
    const def = CARDS[id];
    if (!def || level === undefined || u.energy < def.cost || !alive(u) || winner !== null) return false;
    u.energy -= def.cost;
    events.push({ t: 'card', actor: u.idx, card: id, level });
    lastCard[u.team] = { card: id, tick };
    applyCard(u, id, level, quality ?? 0);
    emitEnergy();
    return true;
  };

  /** What each card does. Task 3 only has the Special Strike; Tasks 5 and 6 add the rest. */
  const applyCard = (u: Unit, id: string, level: number, quality: number): void => {
    switch (id) {
      case 'special':
        u.pendingSpecial = { quality: Math.max(0, Math.min(100, Math.round(quality))), bonus: scaled(SPECIAL_MAX_BONUS, level) };
        break;
    }
  };

  /** A bot's choice for this tick: a card id and, for the special strike, its quality. */
  const botChoice = (u: Unit, tick: number): { card: string; quality?: number } | null => {
    const affordable = Object.keys(u.deck).filter((id) => CARDS[id] && u.energy >= CARDS[id]!.cost);
    if (affordable.length === 0) return null;
    if (u.energy >= BOT_SPEND_AT) {
      const card = affordable.sort((x, y) => CARDS[y]!.cost - CARDS[x]!.cost || x.localeCompare(y))[0]!;
      return card === 'special' ? { card, quality: u.specialQuality ?? rng.int(40, 91) } : { card };
    }
    return null;
  };

  /** Start of each tick: energy, then the player's plays for this tick or the bots' choices. */
  const startTick = (n: number) => {
    events.push({ t: 'tick', n });
    for (const m of mains) {
      if (n > 0 && n % ENERGY_EVERY === 0) m.energy = Math.min(MAX_ENERGY, m.energy + 1);
    }
    emitEnergy();
    for (const m of mains) {
      if (m.interactive) {
        for (const p of m.plays) if (p.tick === n) playCard(m, p.card, n, p.quality);
      } else {
        const choice = botChoice(m, n);
        if (choice) playCard(m, choice.card, n, choice.quality);
      }
    }
  };
```

(`botChoice` gets its rule list in Task 6; Task 3's version only spends at 8+ energy so the Special Strike is used.)

8. In the round loop, keep a global tick counter declared before `rounds:` as `let globalTick = 0;` and at the top of the tick loop body call `startTick(globalTick);` then after the `ready` loop `globalTick++;`. The rest of the loop is unchanged.

9. In `takeTurn` keep `if (trySpecial(u)) return;` (now only fires after the card).

10. `emitEnergy()` once right after `buildUnits` for both teams (before the round loop) so the first energy event is `3`.

- [ ] **Step 4: Run all tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: the new block passes; compile errors remain only in `src/core/game.ts`, `tools/balance.ts` and the UI where `specials` / `warmup` were used. Fix `game.ts` minimally in this task: `simulateFight` passes `{ ...fight.tactics, interactive: true, plays: [], breaks: fight.inputs.breaks }` (Task 4 adds real plays); delete `recordSpecial`. In `tools/balance.ts` skill section temporarily pass `a: { interactive: true, breaks }` (Task 7 rewrites it). UI compile errors are fixed in Task 8 — to keep this commit green, change `src/ui/screens/fight.ts`'s `requestSpecial` hook usage to a no-op and remove the `recordSpecial` import (the replay never asks for specials any more because the event no longer has `quality: null`).

Run again: `npx tsc --noEmit && npx vitest run && npm run build` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src tools
git commit -m "Fight: energy, ticks and card plays; Special Strike becomes a card"
```

---

### Task 4: Game layer — no daily limit, no warm-up, decks, plays, card uses, save v5

**Files:**
- Modify: `src/core/game.ts`, `src/core/progression.ts` (remove daily functions), `src/ui/storage.ts` (migrate), `src/main.ts`, `src/ui/screens/home.ts` (remove pips), `src/ui/screens/prefight.ts` (remove warm-up)
- Test: `src/core/core.test.ts`

**Interfaces:**
- Consumes: `CardPlay`, `defaultDeck` (Task 3), `cardLevel`, `DECK_SIZE` (Task 1)
- Produces:
  - `SAVE_VERSION = 5`; `migrateSave(raw: unknown): SaveData | null`
  - `Tactics` = `Plan & { weapons: string[]; gear: GearChoice; deck: string[] }`
  - `FightInputs = { plays: CardPlay[]; breaks: BreakChoice[] }`
  - `prepareFight(save: SaveData): PendingFight | null` (no `today`)
  - `startFight(save, plan, weapons, gear?, deck?)`
  - `recordPlay(save: SaveData, play: CardPlay): void`
  - `playerDeck(c: Character, chosen?: string[]): Record<string, number>` (levels from `cardUses`)
  - `FightResult` gains `cardsPlayed: Record<string, number>` and `cardLevelUps: { card: string; level: number }[]`

- [ ] **Step 1: Failing tests**

Change the helper to take no day (`function playAuto(save: SaveData)` and `prepareFight(save)`), update its call sites, and replace the daily test and the warm-up test:

```ts
  it('fights are unlimited', () => {
    const save = newGame('Me', look, 'tamer', 'metro', 9);
    for (let i = 0; i < 12; i++) {
      if (save.pendingLevelUps > 0) chooseUpgrade(save, save.offer![0]!);
      expect(playAuto(save)).not.toBeNull();
    }
  });

  it('tactics and deck are locked once the fight starts', () => {
    const save = newGame('Me', look, 'bouncer', 'port', 3);
    prepareFight(save);
    startFight(save, { stance: 'defensive', target: 'pets', weaponStyle: 'keep' }, [], undefined, ['wall']);
    const locked = startFight(save, DEFAULT_PLAN, ['bat'], undefined, ['special', 'wall']);
    expect(locked).toEqual({
      stance: 'defensive',
      target: 'pets',
      weaponStyle: 'keep',
      weapons: [],
      gear: { armor: null, accessory: null },
      deck: ['wall'],
    });
  });

  it('played cards gain uses and can level up', () => {
    const save = newGame('Me', look, 'brawler', 'port', 21);
    save.character.cardUses.rage = 2;
    prepareFight(save);
    startFight(save, DEFAULT_PLAN, []);
    recordPlay(save, { tick: 4, card: 'rage' });
    for (let log = simulateFight(save); log.winner === null; log = simulateFight(save)) recordBreak(save, keep([]));
    const result = finishFight(save);
    expect(result.cardsPlayed.rage).toBe(1);
    expect(save.character.cardUses.rage).toBe(3);
    expect(result.cardLevelUps).toEqual([{ card: 'rage', level: 2 }]);
  });

  it('a version 4 save is migrated, keeping the fighter', () => {
    const v4 = { version: 4, seed: 1, fightCount: 3, character: { ...createCharacter('Old', look, 'parkour', 'port') }, daily: { day: 5, used: 2 }, pendingLevelUps: 0, offer: null, pendingFight: null };
    delete (v4.character as Partial<Character>).cards;
    delete (v4.character as Partial<Character>).cardUses;
    const save = migrateSave(JSON.parse(JSON.stringify(v4)))!;
    expect(save.version).toBe(5);
    expect(save.character.name).toBe('Old');
    expect(save.character.cards).toEqual(['special', 'roll']);
    expect(save.character.cardUses).toEqual({});
    expect('daily' in save).toBe(false);
    expect(migrateSave({ version: 1 })).toBeNull();
  });
```

Delete the `'daily fights reset on a new day'` test and the `FIGHTS_PER_DAY`, `fightsLeft`, `useFight`, `recordWarmup` imports; add `recordPlay`, `migrateSave`.

- [ ] **Step 2: Run, expect failure** — `npx vitest run` → FAIL (signatures, missing exports).

- [ ] **Step 3: Implement**

`src/core/progression.ts`: delete `FIGHTS_PER_DAY`, `DailyFights`, `dayNumber`, `fightsLeft`, `useFight`.

`src/core/game.ts` (full replacements of the changed parts):

```ts
export const SAVE_VERSION = 5;

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
```

`PendingFight`: remove `warmup`. `SaveData`: remove `daily`. `newGame`: remove `daily`. `defaultTactics`: `{ ...DEFAULT_PLAN, weapons: loadoutFor(c), gear: gearFor(c), deck: c.cards.slice(0, DECK_SIZE) }`.

```ts
/** The player's chosen cards (owned ones only, at most DECK_SIZE) with their levels from use. */
export function playerDeck(c: Character, chosen?: string[]): Record<string, number> {
  const ids = (chosen ?? c.cards).filter((id) => c.cards.includes(id)).slice(0, DECK_SIZE);
  return Object.fromEntries(ids.map((id) => [id, cardLevel(c.cardUses[id] ?? 0)]));
}

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
  return fight.tactics;
}

export function recordPlay(save: SaveData, play: CardPlay): void {
  save.pendingFight?.inputs.plays.push({ ...play });
}

export function simulateFight(save: SaveData): FightLog {
  const fight = save.pendingFight;
  if (!fight?.tactics) throw new Error('Fight not started');
  return runFight(save.character, fight.opponent, fight.seed, {
    a: { ...fight.tactics, deck: playerDeck(save.character, fight.tactics.deck), interactive: true, plays: fight.inputs.plays, breaks: fight.inputs.breaks },
    b: { ...fight.opponentPlan },
  });
}
```

In `finishFight`, before `save.pendingFight = null`:

```ts
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
```

and return `{ ..., cardsPlayed, cardLevelUps }` (add both to `FightResult`). The actor index 0 is always the player's main fighter (team 0 is built first).

```ts
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
  return save.version === SAVE_VERSION ? (save as unknown as SaveData) : null;
}
```

`src/ui/storage.ts`: `const save = migrateSave(JSON.parse(raw)); return save;` (import `migrateSave`; drop the version comparison).

`src/main.ts`: remove `dayNumber`, `recordWarmup`, the `onWarmup` action and `today`; `prepareFight(current)`; `renderHome(root, current, { onFight, onReset })`; `onStart: (plan, weapons, gear, deck) => startFight(current, plan, weapons, gear, deck)`.

`src/ui/screens/home.ts`: drop the `today` parameter, `fightsLeft`, `FIGHTS_PER_DAY`, the pips block and the "Back tomorrow" text (`fightBtn` is always enabled, text `'Fight'`).

`src/ui/screens/prefight.ts`: remove the warm-up section, `warmupBonus`, `playWarmup`, `onWarmup`; `onStart` gains a `deck: string[]` argument (pass `defaultTactics(me).deck` for now; Task 8 adds the picker).

`src/ui/minigames.ts`: delete `playWarmup` and its constants. `src/style.css`: delete the `.overlay.warmup`, `.warmup-*` rules and the `pop` keyframes.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "Unlimited fights, no warm-up, decks and card uses, save version 5 with migration"
```

---

### Task 5: Starting cards' effects (Rage, Roll, Wall, Sic 'em, Overcharge)

**Files:**
- Modify: `src/core/fight.ts`
- Test: `src/core/core.test.ts`

**Interfaces:**
- Consumes: `applyCard`, `playCard`, `Unit` card fields (Task 3)
- Produces: `Unit` fields `rageTurns`, `ragePct`, `sureDodges`, `sureBlocks`, `nextHitPct`, `nextHitSure`, `spellBonusPct`; helper `cardPct(u)` used by `baseDamage`

- [ ] **Step 1: Failing tests**

```ts
describe('starting cards', () => {
  const brawler = generateOpponent(10, new Rng(51), 'brawler');
  const parkour = generateOpponent(10, new Rng(52), 'parkour');
  const bouncer = generateOpponent(10, new Rng(53), 'bouncer');
  const tamer = generateOpponent(10, new Rng(54), 'tamer');
  const mystic = generateOpponent(10, new Rng(55), 'mystic');
  const deckOf = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));
  const after = (log: FightLog, card: string) => log.events.slice(log.events.findIndex((e) => e.t === 'card' && e.card === card && e.actor === 0));

  it('Rage adds damage to the next 3 turns', () => {
    const hits = (plays: CardPlay[]) => {
      const log = runFight(brawler, bouncer, 7, { a: { interactive: true, deck: deckOf('rage'), plays, breaks: [] }, b: { deck: {} } });
      return log.events.filter((e) => e.t === 'hit' && e.actor === 0).slice(0, 3).map((e) => (e.t === 'hit' ? e.damage : 0));
    };
    const normal = hits([]);
    const raged = hits([{ tick: 0, card: 'rage' }]);
    expect(raged.reduce((s, d) => s + d, 0)).toBeGreaterThan(normal.reduce((s, d) => s + d, 0));
  });

  it('Roll dodges the next 2 attacks for sure', () => {
    const log = runFight(parkour, brawler, 9, { a: { interactive: true, deck: deckOf('roll'), plays: [{ tick: 0, card: 'roll' }], breaks: [] }, b: { deck: {} } });
    const aimedAtMe = after(log, 'roll').filter((e) => (e.t === 'hit' || e.t === 'dodge' || e.t === 'block') && e.actor !== 0 && 'target' in e && e.target === 0);
    expect(aimedAtMe.slice(0, 2).every((e) => e.t === 'dodge')).toBe(true);
  });

  it('Wall blocks the next 3 hits for sure', () => {
    const log = runFight(bouncer, brawler, 9, { a: { interactive: true, deck: deckOf('wall'), plays: [{ tick: 0, card: 'wall' }], breaks: [] }, b: { deck: {} } });
    const landed = after(log, 'wall').filter((e) => (e.t === 'hit' || e.t === 'block') && e.actor !== 0 && e.target === 0 && e.kind !== 'spell');
    expect(landed.slice(0, 3).every((e) => e.t === 'block')).toBe(true);
  });

  it("Sic 'em makes every pet attack at once", () => {
    const log = runFight(tamer, brawler, 4, { a: { interactive: true, deck: deckOf('sic_em'), plays: [{ tick: 0, card: 'sic_em' }], breaks: [] }, b: { deck: {} } });
    const i = log.events.findIndex((e) => e.t === 'card' && e.card === 'sic_em');
    const pets = log.roster.map((u, idx) => (u.team === 0 && !u.isMain ? idx : -1)).filter((idx) => idx >= 0);
    const next = log.events.slice(i + 1, i + 1 + pets.length);
    for (const e of next) expect(pets).toContain('actor' in e ? e.actor : -1);
  });

  it('Overcharge gives mana and boosts the next spell', () => {
    const log = runFight(mystic, brawler, 2, { a: { interactive: true, deck: deckOf('overcharge'), plays: [{ tick: 0, card: 'overcharge' }], breaks: [] }, b: { deck: {} } });
    const plain = runFight(mystic, brawler, 2, { a: { interactive: true, deck: deckOf('overcharge'), plays: [], breaks: [] }, b: { deck: {} } });
    const firstSpell = (l: FightLog) => l.events.find((e) => e.t === 'hit' && e.kind === 'spell' && e.actor === 0);
    expect((firstSpell(log) as { damage: number }).damage).toBeGreaterThan((firstSpell(plain) as { damage: number }).damage);
  });
});
```

(The interactive side has `breaks: []`, so the fight stops at the first break — enough for these checks, which all look at round 1.)

- [ ] **Step 2: Run, expect failure** — `npx vitest run -t "starting cards"` → FAIL.

- [ ] **Step 3: Implement**

Add to `Unit` and initialise in `buildUnits` (all 0 / false; companions too):

```ts
  rageTurns: number;
  ragePct: number;
  sureDodges: number;
  sureBlocks: number;
  /** Bonus damage (%) and "can't be dodged" for the unit's next hit only. */
  nextHitPct: number;
  nextHitSure: boolean;
  spellBonusPct: number;
```

Card damage bonus in `baseDamage`, before the `damagePct` line:

```ts
    const cardBonus = (att.rageTurns > 0 ? att.ragePct : 0) + att.nextHitPct;
    if (cardBonus) dmg = Math.floor((dmg * (100 + cardBonus)) / 100);
```

Pets also use `nextHitPct` (Sic 'em): in `baseDamage`, for `!att.isMain` return `Math.floor((att.power * (100 + att.nextHitPct)) / 100)`.

In `attack`, after the `missesBlind` check:

```ts
    const sure = kind === 'special' || kind === 'throw' || att.nextHitSure;
    if (!sure && def.sureDodges > 0) {
      def.sureDodges--;
      events.push({ t: 'dodge', actor: att.idx, target: def.idx, kind });
      return true;
    }
    if (!sure && rng.chance(dodgeChance(att, def))) {
```

(the rest of the dodge branch unchanged), and replace the shield line:

```ts
    let blocked = false;
    if (def.sureBlocks > 0) {
      def.sureBlocks--;
      blocked = true;
    } else blocked = def.skills.has('shield') && rng.chance(SHIELD_BLOCK);
```

After the damage is computed in `attack` (any outcome that reached the damage line): `att.nextHitPct = 0; att.nextHitSure = false;`.

In `magicAttack(att, def, base)`: multiply `raw` by `(100 + att.spellBonusPct) / 100` and then set `att.spellBonusPct = 0`.

At the end of `takeTurn` for main units, decrement rage: wrap the body so that after the turn `if (u.rageTurns > 0) u.rageTurns--;` runs (simplest: rename the current body to `takeTurnBody(u)` and make `takeTurn = (u) => { takeTurnBody(u); if (u.rageTurns > 0) u.rageTurns--; }`).

Effects in `applyCard`:

```ts
      case 'rage':
        u.rageTurns = 3;
        u.ragePct = scaled(30, level);
        break;
      case 'roll':
        u.sureDodges += scaledCount(2, level);
        break;
      case 'wall':
        u.sureBlocks += scaledCount(3, level);
        break;
      case 'sic_em':
        for (const pet of units.filter((p) => p.team === u.team && !p.isMain && alive(p))) {
          pet.nextHitPct = scaled(50, level);
          attack(pet, pickTarget(pet), 'melee');
          if (winner !== null) break;
        }
        break;
      case 'overcharge':
        u.mana = Math.min(u.maxMana, u.mana + scaled(30, level));
        u.spellBonusPct = scaled(50, level);
        break;
```

Import `scaledCount` from `./cards`.

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npx vitest run` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core
git commit -m "Cards: Rage, Roll, Wall, Sic 'em and Overcharge"
```

---

### Task 6: Level-up cards' effects and the bot's rules

**Files:**
- Modify: `src/core/fight.ts`
- Test: `src/core/core.test.ts`

**Interfaces:**
- Consumes: Task 5 fields
- Produces: `Unit.flurryHits`, `Unit.flurryPct`; stray dog units in the roster (`defId: 'dog'`, `summoned: true`, `name: 'Stray Dog'`) for decks that contain `stray_dog`; full `botChoice`

- [ ] **Step 1: Failing tests**

```ts
describe('level-up cards', () => {
  const me = generateOpponent(12, new Rng(61), 'brawler');
  const foe = generateOpponent(12, new Rng(62), 'bouncer');
  const run = (c: Character, card: string, opts: Partial<TeamOptions> = {}) =>
    runFight(c, foe, 5, { a: { interactive: true, deck: { [card]: 1 }, plays: [{ tick: 0, card }], breaks: [], ...opts }, b: { deck: {} } });
  const evAfter = (log: FightLog, card: string) => log.events.slice(log.events.findIndex((e) => e.t === 'card' && e.card === card) + 1);

  it('Patch Up heals', () => {
    const hurt = run(me, 'patch_up');
    expect(evAfter(hurt, 'patch_up')[0]).toMatchObject({ t: 'heal', actor: 0 });
  });

  it('Hurl throws the weapon in hand at once', () => {
    const armed = { ...me, weapons: ['bat'] };
    const log = runFight(armed, foe, 5, { a: { interactive: true, deck: { hurl: 1 }, plays: [{ tick: 30, card: 'hurl' }], breaks: [], weaponStyle: 'keep' }, b: { deck: {} } });
    const next = evAfter(log, 'hurl')[0];
    if (next) expect(next).toMatchObject({ actor: 0 });
  });

  it('Rush makes the fighter act on this tick', () => {
    const log = run(me, 'rush');
    const i = log.events.findIndex((e) => e.t === 'card' && e.card === 'rush');
    const nextTick = log.events.findIndex((e, k) => k > i && e.t === 'tick');
    expect(log.events.slice(i + 1, nextTick).some((e) => 'actor' in e && e.actor === 0 && e.t !== 'energy' && e.t !== 'res')).toBe(true);
  });

  it("Feint makes the enemy's next attack miss", () => {
    const log = run(me, 'feint');
    const first = evAfter(log, 'feint').find((e) => (e.t === 'hit' || e.t === 'miss' || e.t === 'dodge' || e.t === 'block') && e.actor !== 0 && 'target' in e && e.target === 0);
    expect(first?.t).toBe('miss');
  });

  it('Second Breath gives stamina', () => {
    const log = run(me, 'second_breath');
    expect(log.events.some((e) => e.t === 'res' && e.actor === 0)).toBe(true);
  });

  it("Haymaker's hit can't be dodged", () => {
    const log = run(me, 'haymaker');
    const first = evAfter(log, 'haymaker').find((e) => (e.t === 'hit' || e.t === 'dodge' || e.t === 'block') && e.actor === 0);
    expect(first?.t).not.toBe('dodge');
  });

  it('Flurry strikes 3 times on the next turn', () => {
    const p = generateOpponent(12, new Rng(63), 'parkour');
    const log = run(p, 'flurry');
    const mine = evAfter(log, 'flurry').filter((e) => (e.t === 'hit' || e.t === 'dodge' || e.t === 'block') && e.actor === 0);
    expect(mine.length).toBeGreaterThanOrEqual(3);
  });

  it('Body Slam hits and pushes the enemy turn back', () => {
    const b = generateOpponent(12, new Rng(64), 'bouncer');
    const log = run(b, 'body_slam');
    expect(evAfter(log, 'body_slam')[0]).toMatchObject({ actor: 0 });
  });

  it('Stray Dog joins until the round ends', () => {
    const t = generateOpponent(12, new Rng(65), 'tamer');
    const log = run(t, 'stray_dog');
    const dog = log.roster.findIndex((u) => u.name === 'Stray Dog');
    expect(dog).toBeGreaterThanOrEqual(0);
    expect(evAfter(log, 'stray_dog')[0]).toMatchObject({ t: 'summon', actor: dog });
  });

  it("Bolt can't be dodged", () => {
    const m = generateOpponent(12, new Rng(66), 'mystic');
    const log = run(m, 'bolt');
    expect(evAfter(log, 'bolt').find((e) => e.t === 'cast' || e.t === 'hit' || e.t === 'dodge')?.t).not.toBe('dodge');
  });

  it('bots heal when low and defend against Rage', () => {
    const bot = { ...generateOpponent(12, new Rng(67), 'bouncer'), cards: ['special', 'wall', 'patch_up'] };
    let healed = 0;
    let walled = 0;
    for (let seed = 0; seed < 40; seed++) {
      const log = runFight(me, bot, seed, { a: { interactive: true, deck: { rage: 1 }, plays: [{ tick: 12, card: 'rage' }], breaks: [] } });
      const mine = log.events.findIndex((e) => e.t === 'card' && e.actor === 0);
      if (log.events.slice(mine).some((e) => e.t === 'card' && e.actor !== 0 && e.card === 'wall')) walled++;
      if (log.events.some((e) => e.t === 'card' && e.card === 'patch_up')) healed++;
    }
    expect(walled).toBeGreaterThan(0);
    expect(healed).toBeGreaterThan(0);
  });
});
```

Add `type TeamOptions` to the test imports.

- [ ] **Step 2: Run, expect failure** — `npx vitest run -t "level-up cards"` → FAIL.

- [ ] **Step 3: Implement**

Unit fields: `flurryHits: number; flurryPct: number;` (init 0).

Stray dogs: in `buildUnits`, after the spirit block:

```ts
  if (deckHas(opts, c, 'stray_dog')) {
    const dog = PETS.dog!;
    const level = (opts.deck ?? defaultDeck(c)).stray_dog!;
    const hp = scaled(dog.maxHp, level);
    companion({ team, isMain: false, name: 'Stray Dog', defId: 'dog', maxHp: hp, maxStamina: 0, maxMana: 0, summoned: true }, hp, dog.damage, dog.agility, dog.speed);
  }
```

with `const deckHas = (opts: TeamOptions, c: Character, id: string) => (opts.deck ?? defaultDeck(c))[id] !== undefined;` defined above `buildUnits`. In `trySpell`, the spirit lookup must ignore stray dogs: `units.find((s) => s.owner === u.idx && roster[s.idx]!.summoned && roster[s.idx]!.defId === 'spirit')`.

Magic attack options: change `magicAttack(att, def, base, sure = false)`; skip the dodge roll when `sure`.

`applyCard` additions:

```ts
      case 'patch_up': {
        const amount = Math.floor((u.maxHp * scaled(15, level)) / 100);
        u.hp = Math.min(u.maxHp, u.hp + amount);
        events.push({ t: 'heal', actor: u.idx, amount, hp: u.hp });
        break;
      }
      case 'hurl': {
        const target = enemyMainOf(u);
        if (u.weapon) {
          u.nextHitPct = scaled(200, level) - 150; // a normal throw is already +50%
          u.thrown.add(u.weapon);
          attack(u, target, 'throw');
          u.weapon = null;
        } else attack(u, target, 'melee');
        break;
      }
      case 'rush':
        u.gauge = Math.max(u.gauge, GAUGE_FULL);
        u.nextHitPct += 10 * (level - 1);
        break;
      case 'feint':
        enemyMainOf(u).blinded = true;
        u.nextHitPct += scaled(20, level);
        break;
      case 'second_breath':
        u.stamina = Math.min(u.maxStamina, u.stamina + scaled(40, level));
        break;
      case 'haymaker':
        u.nextHitPct += scaled(80, level);
        u.nextHitSure = true;
        break;
      case 'flurry':
        u.flurryHits = 3;
        u.flurryPct = scaled(70, level) - 100;
        break;
      case 'body_slam': {
        const foe = enemyMainOf(u);
        u.nextHitPct += scaled(40, level);
        if (attack(u, foe, 'melee')) foe.gauge -= 50;
        break;
      }
      case 'stray_dog': {
        const dog = units.find((s) => s.owner === u.idx && roster[s.idx]!.name === 'Stray Dog');
        if (dog && !alive(dog)) {
          dog.hp = dog.maxHp;
          dog.gauge = 50;
          events.push({ t: 'summon', actor: dog.idx, owner: u.idx, hp: dog.hp });
        }
        break;
      }
      case 'bolt': {
        events.push({ t: 'cast', actor: u.idx, spell: 'bolt', target: enemyMainOf(u).idx });
        u.spellBonusPct += scaled(50, level);
        magicAttack(u, enemyMainOf(u), 4 + u.magic, true);
        break;
      }
```

`startTick` runs before units act, so `rush`'s full gauge makes the unit act in this tick's `ready` pass (the gauge gain happens first in the loop; that is fine — the gauge only grows).

Flurry in `takeTurnBody`, right after `if (u.isMain && trySpell(u)) return;`:

```ts
    if (u.flurryHits > 0) {
      const target = pickTarget(u);
      for (; u.flurryHits > 0; u.flurryHits--) {
        u.nextHitPct += u.flurryPct;
        if (!attack(u, target, 'double') || winner !== null || !alive(u)) {
          u.flurryHits = 0;
          break;
        }
      }
      return;
    }
```

The bot's rules — replace `botChoice`:

```ts
  const OFFENSIVE = new Set(['rage', 'haymaker', 'flurry', 'special']);
  const DEFENSIVE = ['wall', 'roll', 'feint'];

  /** A bot's choice for this tick, from what it can see: its own state and the enemy's last card. */
  const botChoice = (u: Unit, tick: number): { card: string; quality?: number } | null => {
    const can = (id: string) => u.deck[id] !== undefined && u.energy >= CARDS[id]!.cost;
    const pick = (id: string) => (id === 'special' ? { card: id, quality: u.specialQuality ?? rng.int(40, 91) } : { card: id });
    if (u.hp * 100 < u.maxHp * 35 && can('patch_up')) return pick('patch_up');
    const enemyLast = lastCard[u.team === 0 ? 1 : 0];
    if (enemyLast && tick - enemyLast.tick <= ENERGY_EVERY && OFFENSIVE.has(enemyLast.card)) {
      const defence = DEFENSIVE.find(can);
      if (defence) return pick(defence);
    }
    if (u.energy >= BOT_SPEND_AT) {
      const affordable = Object.keys(u.deck).filter(can);
      if (affordable.length) return pick(affordable.sort((x, y) => CARDS[y]!.cost - CARDS[x]!.cost || x.localeCompare(y))[0]!);
    }
    return null;
  };
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npx vitest run` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core
git commit -m "Cards: the ten level-up cards and the bot's card rules"
```

---

### Task 7: Balance tool and re-tuning

**Files:**
- Modify: `tools/balance.ts`, then whatever constants the measurements point to (`src/core/cards.ts` costs/numbers, `src/core/fight.ts` constants, `src/core/catalog.ts`)
- Docs: `docs/COMBAT.md`

**Interfaces:**
- Consumes: `TeamOptions.deck`, `TeamOptions.specialQuality` (Task 3), `CARDS`, `startingCards`
- Produces: balance sections `classes` (bots with default decks), `skill` (card player vs passive copy), `cards` (each card's value), `advice` (unchanged)

- [ ] **Step 1: Rewrite the skill section**

Replace `profiles` and `skillWinRate`:

```ts
// Mirror matches: team A plays its cards (with the given special-strike timing), team B
// brings no cards at all. Answers: how much does playing cards well matter?
const profiles: { name: string; quality: number }[] = [
  { name: 'bad player', quality: 10 },
  { name: 'average player', quality: 60 },
  { name: 'perfect player', quality: 100 },
];

function skillWinRate(classId: ClassId, quality: number): number {
  let wins = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const rng = new Rng(mixSeed(424242 + CLASS_IDS.indexOf(classId), i));
    const ca = generateOpponent(SKILL_LEVEL, rng, classId);
    const cb = generateOpponent(SKILL_LEVEL, rng, classId);
    const log = runFight(ca, cb, rng.next(), { a: { specialQuality: quality }, b: { deck: {} } });
    if (log.winner === 0) wins++;
  }
  return wins / FIGHTS;
}
```

and update the call to `skillWinRate(classId, p.quality)`.

- [ ] **Step 2: Add the cards section** (after the advice section):

```ts
// --- Cards ------------------------------------------------------------------
// Each card's value: fighters who bring it (on top of their starting cards) against the
// same fighters without it. A card should help a bit, not decide fights alone.
const CARD_MIN = 0.5;
const CARD_MAX = 0.62;

if (section('cards')) {
  console.log(`\nCards at level ${SKILL_LEVEL}: win rate with the card vs the same fighter without it`);
  for (const card of Object.values(CARDS)) {
    const classes = card.pool === 'general' ? CLASS_IDS : [card.pool];
    let wins = 0;
    let total = 0;
    for (const classId of classes) {
      for (let i = 0; i < FIGHTS / classes.length; i++) {
        const rng = new Rng(mixSeed(9090 + CLASS_IDS.indexOf(classId), i));
        const ca = generateOpponent(SKILL_LEVEL, rng, classId);
        const cb = generateOpponent(SKILL_LEVEL, rng, classId);
        const level = botCardLevel(SKILL_LEVEL);
        const base = Object.fromEntries(startingCards(classId).filter((id) => id !== card.id).map((id) => [id, level]));
        const log = runFight(ca, cb, rng.next(), { a: { deck: { ...base, [card.id]: level } }, b: { deck: base } });
        if (log.winner === 0) wins++;
        total++;
      }
    }
    const rate = wins / Math.max(1, total);
    const flag = rate < CARD_MIN || rate > CARD_MAX ? '!' : ' ';
    if (flag === '!') problems++;
    console.log(`${card.name.padEnd(16)} ${pct(rate)}${flag}`);
  }
  console.log(`Targets: ${CARD_MIN * 100}-${CARD_MAX * 100}%`);
}
```

Import `CARDS, botCardLevel, startingCards` from `../src/core`; update the header comment's section list with `cards`.

- [ ] **Step 3: Measure**

Run (each takes a few minutes; run them one by one with a 10-minute timeout):

```bash
npm run balance -- 700 classes
npm run balance -- 600 skill
npm run balance -- 1000 cards
npm run balance -- 2000 advice
```

Record the four outputs in the task notes.

- [ ] **Step 4: Re-tune, one lever at a time**

Targets (Global Constraints): classes 45-55% at every level, matchups 35-65%, skill ≤ 65%, cards 50-62%, advice 0 problems. Rules for tuning, learned in the previous balance pass:

- Change one number, re-measure only the affected section (`LEVELS=10,20` for late-game levers), keep it if the problem count goes down, otherwise revert.
- Card too strong → raise its cost by 1 first; too weak → lower its cost by 1 (2-6 range) or raise its base number.
- Skill > 65% → raise `ENERGY_EVERY` from 4 to 5 (fewer cards) before touching card numbers.
- Do not touch Parkour's health (very sensitive) or Mystic's health (overshoots vs Bouncer).
- If 45-tick rounds shift class balance, re-check `SPEED_SOFT_CAP` (6) first.

Stop when all targets are met, or after the problem count stops dropping; report what is left.

- [ ] **Step 5: Update docs/COMBAT.md**

Replace the special-strike and warm-up paragraphs with an "Energy and cards" section that states: 45-tick rounds; energy 0-10, start 3, +1 per 4 ticks, carried over; a card takes effect at the start of the next tick; the 16 cards with their final costs and level-1 effects (copy from `CARDS[*].describe(1)`); card levels from uses (3/8/15/25) and +10% per level, counts +1 at level 4; bots' rules. Remove "daily fights" mentions.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run build` → PASS.

```bash
git add tools src/core docs/COMBAT.md
git commit -m "Balance tool measures cards; tuned for 45-tick rounds and card play"
```

---

### Task 8: Card stickers, deck picker, home and level-up screens

**Files:**
- Create: `src/ui/cardView.ts`
- Modify: `src/ui/icons.ts` (new `rage` icon), `src/ui/plan.ts` (export a deck picker built on `stickerPicker`), `src/ui/screens/prefight.ts`, `src/ui/screens/home.ts`, `src/ui/screens/levelup.ts`, `src/style.css`

**Interfaces:**
- Consumes: `CARDS`, `cardLevel`, `usesForLevel`, `DECK_SIZE`, `MAX_CARD_LEVEL`, `CLASS_COLORS`, `icon`
- Produces:
  - `CARD_ICONS: Record<string, IconName>`
  - `cardSticker(id: string, level: number, opts?: { uses?: number; size?: 'small' | 'big' }): HTMLElement` — a `.game-card` element
  - `deckPicker(owned: string[], chosen: string[], uses: Record<string, number>): HTMLElement` in `plan.ts` (edits `chosen` in place)

- [ ] **Step 1: The `rage` icon**

In `src/ui/icons.ts` add to `ICONS` (before `fist`):

```ts
  rage: {
    rows: ['...R...', '..RR...', '..RRR.R', '.RRYRRR', 'RRYYYRR', 'RYYWYYR', '.RYYYR.'],
    colors: { R: PAL.red, Y: PAL.yellow, W: PAL.white },
  },
```

- [ ] **Step 2: `src/ui/cardView.ts`**

```ts
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

/** Level of an owned card from its uses. */
export const levelOf = (uses: Record<string, number>, id: string) => cardLevel(uses[id] ?? 0);
```

- [ ] **Step 3: CSS** — append to `src/style.css`:

```css
/* --- Cards ------------------------------------------------------------------ */
.game-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 78px;
  padding: 10px 4px 6px;
  color: var(--ink);
  background: var(--paper);
  border: 2px solid var(--ink);
  border-radius: var(--rough-2);
  box-shadow: inset 0 5px 0 var(--stripe, transparent);
  text-shadow: none;
  -webkit-user-select: none;
  user-select: none;
}

.game-card.small {
  width: 64px;
}

.card-cost {
  position: absolute;
  top: -10px;
  left: -8px;
  min-width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--yellow);
  border: 2px solid var(--ink);
  font-weight: 800;
  color: var(--sticker-fill);
  -webkit-text-stroke: var(--sticker-outline-sm) var(--sticker-ink);
  paint-order: stroke fill;
}

.card-art {
  height: 34px;
  display: grid;
  place-items: center;
}

.card-name {
  font-size: var(--t-xs);
  font-weight: 800;
  line-height: 1.1;
  text-align: center;
}

.card-stars {
  font-size: 10px;
  color: var(--orange);
  letter-spacing: -1px;
}

.card-progress {
  width: 100%;
  height: 5px;
  border-radius: 3px;
  background: var(--paper-2);
  overflow: hidden;
}

.card-progress > div {
  height: 100%;
  background: var(--teal);
}

.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 10px;
  padding-top: 10px;
}
```

- [ ] **Step 4: Deck picker in `src/ui/plan.ts`**

`stickerPicker` already does drag/tap into slots. Add an optional `art` that returns any element and export:

```ts
/** Choose up to DECK_SIZE of the owned cards. Edits `chosen` in place. */
export function deckPicker(owned: string[], chosen: string[], uses: Record<string, number>): HTMLElement {
  const items: PickItem[] = owned.map((id) => ({
    id,
    name: CARDS[id]!.name,
    detail: `${CARDS[id]!.cost}⚡`,
    art: () => cardSticker(id, levelOf(uses, id), { size: 'small' }),
  }));
  return stickerPicker(items, chosen, DECK_SIZE, () => {});
}
```

(`chosen` is the array `stickerPicker` edits in place; import `CARDS`, `DECK_SIZE` from `../core` and `cardSticker`, `levelOf` from `./cardView`.) Give `.pick-item` a modifier so card art fits: in CSS `.pick-art .game-card { transform: scale(0.8); }` and `.pick-item:has(.game-card) .pick-art { height: auto; }`.

- [ ] **Step 5: Screens**

`prefight.ts`: keep a `deck` array initialised to `defaultTactics(me).deck`; when `me.cards.length > DECK_SIZE` show `h('section', {}, h('h2', {}, 'Your deck'), h('p', { class: 'lede small' }, 'Bring 4 cards. Cards level up as you play them.'), deckPicker(me.cards, deck, me.cardUses))`; otherwise show the cards in a `.card-list` with `cardSticker(id, level, { uses })`. Pass `[...deck]` to `onStart`.

`home.ts`: after the skills list, `iconHeading('skill', 'Cards')` then `h('div', { class: 'card-list' }, ...c.cards.map((id) => cardSticker(id, levelOf(c.cardUses, id), { uses: c.cardUses[id] ?? 0 })))`.

`levelup.ts`: for `u.kind === 'card'` use `cardSticker(u.ref, 1, { size: 'small' })` as the picture.

- [ ] **Step 6: Verify in the browser**

`npx tsc --noEmit && npx vitest run && npm run build`, then start `npm run dev` (background), open `http://127.0.0.1:5199` at 390×844: create a fighter → home shows 2 cards with stars and progress; give the save a third/fourth/fifth card via `localStorage` (as in earlier sessions: edit `brute.save`, `character.cards`) → pre-fight shows the deck picker; drag a card in and out (Playwright `browser_drag`). Repeat at 320×640: no horizontal scroll (`document.documentElement.scrollWidth === clientWidth`).

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "Card stickers on home, pre-fight deck picker and level-up offers"
```

---

### Task 9: Playing cards in the fight screen

**Files:**
- Modify: `src/fight/ReplayScene.ts`, `src/ui/screens/fight.ts`, `src/ui/minigames.ts` (special strike returns quality without a turn), `src/style.css`

**Interfaces:**
- Consumes: events `tick`, `energy`, `card`, `special` (Task 3); `recordPlay`, `FightResult.cardsPlayed / cardLevelUps` (Task 4); `cardSticker` (Task 8); `playSpecialStrike(host): Promise<number>` (existing)
- Produces:
  - `ReplayHooks.requestPlay` removed in favour of `ReplayScene.queuePlay(card: string, getQuality?: () => Promise<number>): void`
  - New hooks: `onEnergy(team: 0 | 1, energy: number)`, `onCard(team: 0 | 1, card: string)`, `recordPlay(play: CardPlay): void`

- [ ] **Step 1: ReplayScene**

Add fields and hooks:

```ts
  /** A card the player tapped, applied at the next tick the replay reaches. */
  private queued: { card: string; getQuality?: () => Promise<number> } | null = null;

  queuePlay(card: string, getQuality?: () => Promise<number>): void {
    this.queued ??= { card, getQuality };
  }
```

`ReplayHooks`: remove `requestSpecial`; add

```ts
  /** Saves a card play; the scene re-simulates right after. */
  recordPlay: (play: CardPlay) => void;
  onEnergy: (team: 0 | 1, energy: number) => void;
  onCard: (team: 0 | 1, card: string) => void;
```

In `play()`, replace the `special`-input branch with the tick handling:

```ts
      if (e.t === 'tick' && this.queued) {
        const { card, getQuality } = this.queued;
        this.queued = null;
        const quality = getQuality ? await getQuality() : undefined;
        this.hooks.recordPlay({ tick: e.n, card, quality });
        this.log = this.hooks.resimulate();
        e = this.log.events[i]!;
      }
```

`handle()` cases:

```ts
      case 'tick':
        return Promise.resolve();
      case 'energy':
        this.hooks.onEnergy(this.teamOf(e.actor), e.energy);
        return Promise.resolve();
      case 'card':
        return this.onCard(e.actor, e.card);
      case 'special':
        return this.onSpecial(e.actor, e.quality);
```

with `private teamOf(idx: number): 0 | 1 { return this.views[idx]!.team; }` and

```ts
  private async onCard(actor: number, card: string): Promise<void> {
    const v = this.view(actor);
    this.hooks.onCard(v.team, card);
    this.floatText(v.sprite.x, this.headY(v) - 10, CARDS[card]?.name ?? card, PAL.yellow, 12);
    await this.wait(250);
  }
```

(import `CARDS`, `type CardPlay` from `../core`). The stray dog is a summoned unit: the existing `onSummon` handles it.

- [ ] **Step 2: Fight screen**

In `renderFight`:
- Energy bar under the arena: `const energyFill = h('div', { class: 'meter-fill' }); const energyText = h('span', { class: 'energy-text' }, '3/10'); const energyBar = h('div', { class: 'energy' }, icon('speed', 'Energy', 'normal'), h('div', { class: 'meter meter-energy' }, energyFill), energyText);`
- Card row: `const deck = save.pendingFight!.tactics!.deck;` and for each id a `button.card-button` wrapping `cardSticker(id, levelOf(save.character.cardUses, id))`; keep `energy` in a variable; `refreshCards()` toggles `disabled` on each button when `energy < CARDS[id].cost`.
- Tap: `scene.queuePlay(id, id === 'special' ? () => specialQuality() : undefined)`, add class `queued` to the button until the next `onCard` for team 0.
- `specialQuality()`: hides the card row, `await playSpecialStrike(zone)`, shows the row again, returns the quality.
- Hooks: `recordPlay: (play) => { recordPlay(save, play); store(); }`, `onEnergy: (team, value) => { if (team === 0) { energy = value; energyFill.style.width = `${value * 10}%`; energyText.textContent = `${value}/10`; refreshCards(); } }`, `onCard: (team, card) => { if (team === 1) huds[1].el.append(enemyCardSticker(card)); else clearQueued(); }` where `enemyCardSticker` makes a small `.enemy-card` element with the card name that removes itself after 1.5 s.
- Result: after the existing summary lines add, for each played card, `h('div', { class: 'small' }, `${CARDS[card].name} +${count} use${count > 1 ? 's' : ''}`)` and for each level-up a `.result` line `"${name} → level ${level}!"`.
- Order in the zone: controls (small, right-aligned), energy bar, card row, summary, continue.

CSS:

```css
.energy {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meter-energy {
  flex: 1;
  height: 16px;
}

.meter-energy .meter-fill {
  background: var(--yellow);
}

.energy-text {
  font-weight: 800;
  color: var(--sticker-fill);
  -webkit-text-stroke: var(--sticker-outline-sm) var(--sticker-ink);
  paint-order: stroke fill;
}

.card-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding-top: 12px;
}

.card-button {
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  justify-self: center;
  transition: transform var(--fast) var(--ease-out);
}

.card-button:active:not(:disabled) {
  transform: scale(0.94) rotate(-2deg);
}

.card-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.card-button.queued .game-card {
  outline: 3px solid var(--pink);
  outline-offset: 2px;
}

.enemy-card {
  align-self: flex-end;
  padding: 2px 8px;
  font-weight: 800;
  color: var(--ink);
  background: var(--yellow);
  border: 2px solid var(--ink);
  border-radius: var(--rough-2);
  text-shadow: none;
  animation: slap 280ms var(--ease-bounce);
}
```

At 320 px four 78 px cards do not fit: `@media (max-width: 359px) { .card-row .game-card { width: 64px; } }`.

- [ ] **Step 3: Verify in the browser**

`npx tsc --noEmit && npx vitest run && npm run build`; with the dev server at 390×844: start a fight, wait until energy ≥ 4, tap Rage → the card sticker shows "Rage" over the fighter and energy drops; tap Special Strike at 5+ → the timing bar appears, tap it → "SPECIAL!"/"PERFECT!" and a special hit; finish the fight → the result shows "+1 use" lines. Reload mid-fight → the same fight resumes with the same plays. Check 320×640 for overflow. Take screenshots of: card row, enemy card sticker, result.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "Fight screen: energy bar, playable cards, enemy card stickers, card uses in the result"
```

---

## After all tasks

- Push to `main` (the user asked for each finished phase to go live).
- Update `docs/VISUAL_PLAN.md`? No — this is gameplay; instead add a line to `README.md` under features if it lists them.
- Ask the user to try it on the phone and report with screenshots in `captures/`.
