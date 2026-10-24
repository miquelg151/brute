# Origins and Ranks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six origins with a bigger passive and an exclusive starting card each, plus cosmetic ranks (levels 1/5/10/15/20) that change how the fighter looks.

**Architecture:** Origins stay data in `src/core/catalog.ts`; origin cards join `CARDS` with `pool: 'origin'` and their rules live in `runFight` (`src/core/fight.ts`) like every card. Ranks are a pure table in a new `src/core/ranks.ts`. Looks come from two new fighter art layers (`origin`, `rank`) drawn by `src/ui/sprites.ts` after the class `extra` layer.

**Tech Stack:** Vite + TypeScript, Phaser 3.90 (arena replay), DOM screens, Vitest, tsx balance tool.

**Spec:** `docs/superpowers/specs/2026-10-24-origins-and-ranks-design.md`

## Global Constraints

- All game text and code comments in English; 2-space indent, single quotes, semicolons; plain-words comments; obvious code (the owner is a beginner and edits it).
- The simulation stays deterministic: all randomness through the fight `rng`; new card effects use no randomness of their own.
- Existing PNGs in `public/art` (including the owner's retouched `body.png`, `crow.png`, `dog.png`, `bat.png`) are never overwritten. New art only in new files.
- Ranks are cosmetic: no effect on fights.
- Origin cards are starting cards and are never offered at level-ups. The deck stays at 4 (`DECK_SIZE`).
- Card costs stay between 2 and 6. Numbers in the spec are a first proposal; only Task 3 (balance) may change them, and must update every `describe()` text and doc it touches.
- Before every commit: `npx tsc --noEmit && npx vitest run && npm run build` green.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push, never touch `main`.
- Do not commit the owner's `captures/` folder.

---

### Task 1: Origins, origin cards and ranks as data (core)

**Files:**
- Modify: `src/core/catalog.ts` (OriginDef, ORIGINS)
- Modify: `src/core/cards.ts` (pool type, six cards, `startingCards`, `originCard`, `cardOrigin`, `weatherWavePct`)
- Create: `src/core/ranks.ts`
- Modify: `src/core/index.ts` (export ranks)
- Modify: `src/core/character.ts` (starting cards with origin)
- Modify: `src/core/opponents.ts` (optional origin)
- Modify: `src/core/game.ts` (SAVE_VERSION 6, migration 5 → 6)
- Modify: `src/ui/palette.ts` (ORIGIN_COLORS), `src/ui/cardView.ts` (stripe for origin cards), `tools/balance.ts` (one line, so the build stays green)
- Test: `src/core/core.test.ts`

**Interfaces:**
- Produces:
  - `OriginDef` gains `hpRegen: number` and `magicResist: number`.
  - `CardDef['pool']` is `'general' | 'origin' | ClassId`.
  - `startingCards(classId: ClassId, originId?: string): string[]` — `['special', classCard, originCard]` (origin card left out when the origin is unknown or missing).
  - `originCard(originId: string): string | undefined`, `cardOrigin(cardId: string): string | undefined`, `weatherWavePct(level: number): number`.
  - `RANKS`, `RankDef { id: RankId; name: string; from: number }`, `RankId = 'rookie' | 'regular' | 'veteran' | 'champion' | 'legend'`, `rankOf(level: number): RankDef`.
  - `generateOpponent(level, rng, classId?, originId?)`.
  - `SAVE_VERSION = 6`.
  - `ORIGIN_COLORS: Record<string, string>` in `src/ui/palette.ts`.

- [ ] **Step 1: Write the failing tests**

In `src/core/core.test.ts`, add `RANKS`, `rankOf`, `originCard`, `cardOrigin`, `weatherWavePct`, `ORIGIN_IDS`, `ORIGINS` to the import list from `'.'`/`'../core'` (whichever the file uses), replace the test `'every class starts with the special strike and its own card'` with the version below, and add the new tests:

```ts
  it('every fighter starts with the special strike, its class card and its origin card', () => {
    expect(startingCards('brawler', 'port')).toEqual(['special', 'rage', 'weather_wave']);
    expect(startingCards('parkour', 'rooftops')).toEqual(['special', 'roll', 'leap']);
    expect(startingCards('bouncer', 'industrial')).toEqual(['special', 'wall', 'scrap_shield']);
    expect(startingCards('tamer', 'metro')).toEqual(['special', 'sic_em', 'last_train']);
    expect(startingCards('mystic', 'sewers')).toEqual(['special', 'overcharge', 'toxic_spit']);
    expect(startingCards('brawler', 'scrapyard')).toEqual(['special', 'rage', 'power_surge']);
    expect(startingCards('brawler')).toEqual(['special', 'rage']);
  });
```

```ts
describe('origins', () => {
  it('there are six origins, each with its own starting card', () => {
    expect(ORIGIN_IDS).toEqual(['port', 'rooftops', 'metro', 'industrial', 'sewers', 'scrapyard']);
    for (const id of ORIGIN_IDS) {
      const card = originCard(id)!;
      expect(CARDS[card]!.pool).toBe('origin');
      expect(CARDS[card]!.starting).toBe(true);
      expect(cardOrigin(card)).toBe(id);
    }
  });

  it('origin cards are never offered at level-ups', () => {
    const origin = new Set(ORIGIN_IDS.map((id) => originCard(id)));
    expect(UPGRADES.some((u) => u.kind === 'card' && origin.has(u.ref))).toBe(false);
  });

  it('origin passives match the design', () => {
    expect(ORIGINS.port!.hpPercent).toBe(8);
    expect(ORIGINS.rooftops!.dodge).toBe(6);
    expect(ORIGINS.metro!.initiative).toBe(30);
    expect(ORIGINS.industrial!.armor).toBe(2);
    expect(ORIGINS.sewers!.hpRegen).toBe(1);
    expect(ORIGINS.scrapyard!.armor).toBe(1);
    expect(ORIGINS.scrapyard!.magicResist).toBe(10);
  });

  it('a new fighter gets its origin card', () => {
    const c = createCharacter('S', look, 'mystic', 'sewers');
    expect(c.cards).toEqual(['special', 'overcharge', 'toxic_spit']);
  });

  it('a generated opponent can be given an origin', () => {
    const c = generateOpponent(5, new Rng(3), 'bouncer', 'scrapyard');
    expect(c.originId).toBe('scrapyard');
    expect(c.cards).toContain('power_surge');
  });

  it('Weather the Wave softens more with card level, up to 70%', () => {
    expect(weatherWavePct(1)).toBe(50);
    expect(weatherWavePct(2)).toBe(55);
    expect(weatherWavePct(5)).toBe(70);
    expect(weatherWavePct(9)).toBe(70);
  });
});

describe('ranks', () => {
  it('ranks come at levels 1, 5, 10, 15 and 20', () => {
    expect(RANKS.map((r) => [r.id, r.from])).toEqual([
      ['rookie', 1],
      ['regular', 5],
      ['veteran', 10],
      ['champion', 15],
      ['legend', 20],
    ]);
    expect(rankOf(1).id).toBe('rookie');
    expect(rankOf(4).id).toBe('rookie');
    expect(rankOf(5).id).toBe('regular');
    expect(rankOf(14).id).toBe('veteran');
    expect(rankOf(15).id).toBe('champion');
    expect(rankOf(20).id).toBe('legend');
    expect(rankOf(37).id).toBe('legend');
  });
});
```

Add to the existing save-migration tests (find the test that migrates a version 4 save and mirror its setup):

```ts
  it('a version 5 save gets its origin card and drops a fight in progress', () => {
    const save = newGame('M', look, 'bouncer', 'industrial', 7) as unknown as Record<string, unknown>;
    const c = save.character as { cards: string[] };
    c.cards = ['special', 'wall', 'patch_up', 'hurl', 'rush'];
    save.version = 5;
    save.pendingFight = { anything: true };
    const migrated = migrateSave(save)!;
    expect(migrated.version).toBe(6);
    expect(migrated.character.cards).toEqual(['special', 'wall', 'scrap_shield', 'patch_up', 'hurl', 'rush']);
    expect(migrated.pendingFight).toBeNull();
  });
```

(`look` is the appearance fixture the test file already uses for `createCharacter`; reuse it. If the existing v4 migration test now expects version 5 as the result, change it to expect 6 and the origin card after the class card — the v4 step runs, then the v5 step.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run`
Expected: FAIL — `originCard`, `rankOf`, etc. are not exported; starting cards have 2 entries.

- [ ] **Step 3: Origins in the catalog**

In `src/core/catalog.ts`, extend `OriginDef` and replace `ORIGINS`:

```ts
export interface OriginDef {
  id: string;
  name: string;
  description: string;
  hpPercent: number;
  dodge: number;
  initiative: number;
  armor: number;
  /** Health healed at the start of each of the fighter's turns. */
  hpRegen: number;
  /** Percent of magic damage ignored, added to the class's. */
  magicResist: number;
}
```

```ts
// Where a fighter grew up: a passive bonus in every fight, a look (art layer `fighter.origin`)
// and a starting card of its own (see ORIGIN_CARD in cards.ts).
const origin = (id: string, name: string, description: string, bonus: Partial<Omit<OriginDef, 'id' | 'name' | 'description'>>): OriginDef => ({
  id,
  name,
  description,
  hpPercent: 0,
  dodge: 0,
  initiative: 0,
  armor: 0,
  hpRegen: 0,
  magicResist: 0,
  ...bonus,
});

export const ORIGINS: Record<string, OriginDef> = {
  port: origin('port', 'The Port', '+8% health.', { hpPercent: 8 }),
  rooftops: origin('rooftops', 'The Rooftops', '+6% dodge.', { dodge: 6 }),
  metro: origin('metro', 'The Metro', 'Acts sooner at the start of every round.', { initiative: 30 }),
  industrial: origin('industrial', 'Industrial Zone', '+2 armor.', { armor: 2 }),
  // The two strange ones: mutants from under the city and half-robots from the scrapyard.
  sewers: origin('sewers', 'The Sewers', 'Heals 1 health every turn.', { hpRegen: 1 }),
  scrapyard: origin('scrapyard', 'The Scrapyard', '+1 armor and +10% magic resistance.', { armor: 1, magicResist: 10 }),
};
```

- [ ] **Step 4: Origin cards**

In `src/core/cards.ts`:

1. Change the pool type and its comment:

```ts
  /** 'general' cards can be won by any class; class cards only by that class; 'origin' cards are given by where the fighter grew up. */
  pool: 'general' | 'origin' | ClassId;
```

2. Add, above `const card = ...`:

```ts
/** Weather the Wave: how much less damage (%) a softened hit does. */
export function weatherWavePct(level: number): number {
  return Math.min(70, 50 + 5 * (level - 1));
}
```

3. Add these entries at the end of `CARDS` (after `bolt`):

```ts
  // Origin cards: every fighter starts with the one from where they grew up.
  weather_wave: card('weather_wave', 'Weather the Wave', 3, 'origin', true, (l) => `The next ${scaledCount(2, l)} hits you take do ${weatherWavePct(l)}% less damage.`),
  leap: card('leap', 'Leap', 3, 'origin', true, (l) => `Dodge the next attack for sure and strike back with +${scaled(20, l)}%.`),
  last_train: card('last_train', 'Last Train', 3, 'origin', true, (l) => `Your next ${scaledCount(2, l)} turns come sooner.`),
  scrap_shield: card('scrap_shield', 'Scrap Shield', 4, 'origin', true, (l) => `A barrier that stops ${scaled(15, l)} physical damage this round.`),
  toxic_spit: card('toxic_spit', 'Toxic Spit', 4, 'origin', true, (l) => `Poison: they lose ${scaled(4, l)} health on each of their next 3 turns. Armor doesn't help.`),
  power_surge: card('power_surge', 'Power Surge', 5, 'origin', true, (l) => `A shocking hit${l > 1 ? ` (+${10 * (l - 1)}%)` : ''}: if it lands, they lose their next turn.`),
```

4. Replace `startingCards` and add the origin lookups:

```ts
const ORIGIN_CARD: Record<string, string> = {
  port: 'weather_wave',
  rooftops: 'leap',
  metro: 'last_train',
  industrial: 'scrap_shield',
  sewers: 'toxic_spit',
  scrapyard: 'power_surge',
};

/** The starting card of an origin. */
export function originCard(originId: string): string | undefined {
  return ORIGIN_CARD[originId];
}

/** The origin an origin card belongs to (undefined for other cards). */
export function cardOrigin(cardId: string): string | undefined {
  return Object.keys(ORIGIN_CARD).find((id) => ORIGIN_CARD[id] === cardId);
}

export function startingCards(classId: ClassId, originId?: string): string[] {
  const own = originId ? ORIGIN_CARD[originId] : undefined;
  return own ? ['special', CLASS_CARD[classId], own] : ['special', CLASS_CARD[classId]];
}
```

(The map lives here, not in `ORIGINS`, because `catalog.ts` already imports `cards.ts`; importing back would be a circular import.)

Also update the file's top comment: "Every fighter starts with the Special Strike, one class card and one origin card; the rest are won at level-ups."

- [ ] **Step 5: Ranks**

Create `src/core/ranks.ts`:

```ts
// Ranks: how seasoned a fighter looks. They change only the look (art layer `fighter.rank`)
// and a badge next to the name; they never change a fight.
export type RankId = 'rookie' | 'regular' | 'veteran' | 'champion' | 'legend';

export interface RankDef {
  id: RankId;
  name: string;
  /** The fighter level where this rank starts. */
  from: number;
}

export const RANKS: readonly RankDef[] = [
  { id: 'rookie', name: 'Rookie', from: 1 },
  { id: 'regular', name: 'Regular', from: 5 },
  { id: 'veteran', name: 'Veteran', from: 10 },
  { id: 'champion', name: 'Champion', from: 15 },
  { id: 'legend', name: 'Legend', from: 20 },
];

export function rankOf(level: number): RankDef {
  let rank = RANKS[0]!;
  for (const r of RANKS) if (level >= r.from) rank = r;
  return rank;
}
```

Add `export * from './ranks';` to `src/core/index.ts`.

- [ ] **Step 6: Characters, opponents and saves**

`src/core/character.ts`: `cards: startingCards(classId, originId),`

`src/core/opponents.ts`: add an optional last parameter `originId?: string` to `generateOpponent` and replace the `rng.pick(ORIGIN_IDS)` argument with `originId ?? rng.pick(ORIGIN_IDS)` (no rng draw when an origin is given; the same draws as before when it is not).

`src/core/game.ts`: `export const SAVE_VERSION = 6;`, import `originCard` from `./cards`, and add after the `version === 4` block in `migrateSave`:

```ts
  if (save.version === 5) {
    const c = save.character as Character;
    // Every fighter now starts with its origin card: put it after the class card.
    const own = originCard(c.originId);
    if (own && !c.cards.includes(own)) c.cards.splice(Math.min(2, c.cards.length), 0, own);
    // A fight started under the old rules can't continue under the new ones.
    save.pendingFight = null;
    save.version = 6;
  }
```

- [ ] **Step 7: Keep the UI and the balance tool compiling**

`src/ui/palette.ts` — add:

```ts
/** The colour of each origin (its cards' stripe). */
export const ORIGIN_COLORS: Record<string, string> = {
  port: PAL.blue,
  rooftops: PAL.amber,
  metro: PAL.magenta,
  industrial: PAL.orange,
  sewers: PAL.moss,
  scrapyard: PAL.cyan,
};
```

`src/ui/cardView.ts` — import `cardOrigin` from `'../core'` and `ORIGIN_COLORS` from `'./palette'`, then:

```ts
  const stripe =
    card.pool === 'general' ? 'var(--wall-dim)' : card.pool === 'origin' ? (ORIGIN_COLORS[cardOrigin(id) ?? ''] ?? 'var(--wall-dim)') : CLASS_COLORS[card.pool];
```

`tools/balance.ts`, cards section: `const classes = card.pool === 'general' || card.pool === 'origin' ? CLASS_IDS : [card.pool];` (Task 3 makes origin cards use fighters of their origin.)

Any other place that indexes `CLASS_COLORS[card.pool]` or treats `pool` as a class: search with `grep -rn "\.pool" src tools` and handle `'origin'` the same way.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run`
Expected: the new tests PASS. Adding two origins changes which origin `generateOpponent` picks for a given seed, and the bigger Port/Industrial bonuses change fights, so a few seed-based fight tests may flip. For each one that fails: keep its assertion and its meaning, and pick another seed (or fix the origin explicitly with the new `originId` parameter) so the scenario it describes happens again. Say which tests you re-seeded in the report.

- [ ] **Step 9: Check and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green.

```bash
git add src/core src/ui/palette.ts src/ui/cardView.ts tools/balance.ts
git commit -m "Origins: six origins, origin starting cards, ranks table, save version 6"
```

---

### Task 2: Origin card rules and passives in fights

**Files:**
- Modify: `src/core/fight.ts` (Unit state, events, passives, `applyCard`, `attack`, `land`, `takeTurn`, end of round, bots, roster info)
- Modify: `src/fight/ReplayScene.ts` (show the three new events)
- Test: `src/core/core.test.ts`

**Interfaces:**
- Consumes: Task 1's `ORIGINS[...].hpRegen/magicResist`, `weatherWavePct`, the six card ids, `generateOpponent(level, rng, classId, originId)`.
- Produces:
  - New `FightEvent`s: `{ t: 'scrap'; actor: number; absorbed: number; left: number }`, `{ t: 'poison'; actor: number; damage: number; hp: number }`, `{ t: 'stunned'; actor: number }`.
  - `UnitInfo` gains `originId?: string` and `level?: number` (set for main fighters) — Task 4 uses them to draw origin and rank layers in the arena.

- [ ] **Step 1: Write the failing tests**

Add to `src/core/core.test.ts` a new `describe('origin cards', ...)` block. Fixtures (adjust seeds if needed so each scenario really happens; keep the assertions):

```ts
describe('origin cards', () => {
  const deckOf = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));
  const brawler = generateOpponent(10, new Rng(71), 'brawler', 'port');
  const parkour = generateOpponent(10, new Rng(72), 'parkour', 'rooftops');
  const tamer = generateOpponent(10, new Rng(73), 'tamer', 'metro');
  const bouncer = generateOpponent(10, new Rng(74), 'bouncer', 'industrial');
  const mystic = generateOpponent(10, new Rng(75), 'mystic', 'sewers');
  const robot = generateOpponent(10, new Rng(76), 'brawler', 'scrapyard');
  const foe = generateOpponent(10, new Rng(77), 'brawler', 'metro');
  const play = (me: Character, card: string, tick: number, seed: number, other: Character = foe) =>
    runFight(me, other, seed, { a: { interactive: true, deck: deckOf(card), plays: [{ tick, card }], breaks: [] }, b: { deck: {} } });
  const noPlay = (me: Character, card: string, seed: number, other: Character = foe) =>
    runFight(me, other, seed, { a: { interactive: true, deck: deckOf(card), plays: [], breaks: [] }, b: { deck: {} } });
  const cardIndex = (log: FightLog, card: string) => log.events.findIndex((e) => e.t === 'card' && e.card === card && e.actor === 0);
  const tickIndex = (log: FightLog, n: number) => log.events.findIndex((e) => e.t === 'tick' && e.n === n);
  const damageTo0 = (log: FightLog, from: number, count: number) =>
    log.events
      .slice(from)
      .filter((e) => (e.t === 'hit' || e.t === 'block') && e.target === 0 && e.damage > 0)
      .slice(0, count)
      .map((e) => (e.t === 'hit' || e.t === 'block' ? e.damage : 0));

  it('Weather the Wave makes the next 2 hits taken weaker', () => {
    // Costs 3: playable at tick 0. The card uses no randomness, so both runs roll the same hits.
    const soft = damageTo0(play(brawler, 'weather_wave', 0, 5), 0, 2);
    const plain = damageTo0(noPlay(brawler, 'weather_wave', 5), 0, 2);
    expect(soft).toHaveLength(2);
    expect(soft.reduce((s, d) => s + d, 0)).toBeLessThan(plain.reduce((s, d) => s + d, 0));
  });

  it('Leap dodges the next attack and strikes back at once', () => {
    const log = play(parkour, 'leap', 0, 9);
    const from = cardIndex(log, 'leap');
    const i = log.events.findIndex((e, k) => k > from && (e.t === 'hit' || e.t === 'block' || e.t === 'dodge') && e.target === 0);
    expect(log.events[i]!.t).toBe('dodge');
    const next = log.events.slice(i + 1).find((e) => e.t === 'hit' || e.t === 'block' || e.t === 'dodge');
    expect(next).toMatchObject({ actor: 0, kind: 'counter' });
  });

  it('Last Train gives more turns early in the round', () => {
    // A turn starts with exactly one of these from the fighter (extra double/combo hits are not counted).
    const turns = (log: FightLog) =>
      log.events
        .slice(0, tickIndex(log, 20))
        .filter((e) => (e.t === 'rest' && e.actor === 0) || ((e.t === 'hit' || e.t === 'block' || e.t === 'dodge') && e.actor === 0 && (e.kind === 'melee' || e.kind === 'throw'))).length;
    expect(turns(play(tamer, 'last_train', 0, 3))).toBeGreaterThan(turns(noPlay(tamer, 'last_train', 3)));
  });

  it('Scrap Shield stops physical damage until the round ends', () => {
    // Costs 4: playable at tick 5.
    const log = play(bouncer, 'scrap_shield', 5, 4);
    const from = cardIndex(log, 'scrap_shield');
    const scraps = log.events.slice(from).filter((e) => e.t === 'scrap' && e.actor === 0);
    expect(scraps[0]).toMatchObject({ absorbed: 0, left: 15 });
    expect(scraps.some((e) => e.t === 'scrap' && e.absorbed > 0)).toBe(true);
    const round2 = log.events.findIndex((e) => e.t === 'round' && e.round === 2);
    if (round2 >= 0) expect(log.events.slice(round2).some((e) => e.t === 'scrap')).toBe(false);
  });

  it('Toxic Spit poisons the enemy for 3 turns, ignoring armor', () => {
    const log = play(mystic, 'toxic_spit', 5, 6, bouncer);
    const poison = log.events.filter((e) => e.t === 'poison');
    expect(poison).toHaveLength(3);
    for (const e of poison) expect(e).toMatchObject({ actor: 1, damage: 4 });
  });

  it('Power Surge makes the enemy lose their next turn when it lands', () => {
    // Costs 5: playable at tick 10.
    const log = play(robot, 'power_surge', 10, 2, bouncer);
    const from = cardIndex(log, 'power_surge');
    const strike = log.events.slice(from).find((e) => (e.t === 'hit' || e.t === 'block' || e.t === 'dodge') && e.actor === 0)!;
    expect(strike.t).not.toBe('dodge');
    const after = log.events.slice(log.events.indexOf(strike) + 1);
    const stunned = after.findIndex((e) => e.t === 'stunned' && e.actor === 1);
    expect(stunned).toBeGreaterThanOrEqual(0);
    // Before losing that turn, the enemy did not act.
    expect(after.slice(0, stunned).some((e) => (e.t === 'hit' || e.t === 'block' || e.t === 'dodge' || e.t === 'rest') && e.actor === 1)).toBe(false);
  });

  it('Sewers fighters heal 1 health at the start of their turns', () => {
    const log = noPlay(mystic, 'toxic_spit', 8, brawler);
    expect(log.events.some((e) => e.t === 'heal' && e.actor === 0 && e.amount === 1)).toBe(true);
  });

  it('Scrapyard fighters take less magic damage', () => {
    // The same bouncer from two origins; spells ignore armor, so only magic resistance differs.
    const caster = generateOpponent(10, new Rng(78), 'mystic', 'port');
    const base = generateOpponent(10, new Rng(79), 'bouncer', 'industrial');
    const spellDamage = (originId: string) => {
      const log = runFight(caster, { ...base, originId }, 12, { a: { deck: {} }, b: { deck: {} } });
      return log.events.filter((e) => e.t === 'hit' && e.kind === 'spell' && e.actor === 0).slice(0, 5).reduce((s, e) => s + (e.t === 'hit' ? e.damage : 0), 0);
    };
    expect(spellDamage('scrapyard')).toBeLessThan(spellDamage('industrial'));
  });
});
```

(`FightLog`, `Character`, `runFight` are already imported by the file; add any that are not.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run`
Expected: FAIL — the new cards do nothing yet (no `scrap`/`poison`/`stunned` events, no heals).

- [ ] **Step 3: New events and unit state**

In `src/core/fight.ts`:

Add to the `FightEvent` union (before `death`):

```ts
  /** Scrap Shield stopped physical damage (or was raised, when absorbed is 0). */
  | { t: 'scrap'; actor: number; absorbed: number; left: number }
  /** Poison from Toxic Spit hurt a fighter at the start of their turn. */
  | { t: 'poison'; actor: number; damage: number; hp: number }
  /** A fighter lost a turn to Power Surge. */
  | { t: 'stunned'; actor: number }
```

Add to `UnitInfo`:

```ts
  /** Main fighters: where they grew up and their level (for their look). */
  originId?: string;
  level?: number;
```

and set them where main fighters are pushed into `roster` (`originId: c.originId, level: c.level`).

Add to `interface Unit` (after `flurryPct`):

```ts
  /** Origin passive (Sewers): health healed at the start of each turn. */
  hpRegen: number;
  /** Weather the Wave: hits left that are softened, and by how much (%). */
  waveHits: number;
  wavePct: number;
  /** Leap: ready while above 0; the counter's damage bonus (%). */
  leapPct: number;
  /** Last Train: turns left that come sooner, and the gauge each one gives back. */
  trainTurns: number;
  trainGauge: number;
  /** Scrap Shield: physical damage it can still stop this round. */
  scrap: number;
  /** Toxic Spit on this unit: turns left, damage per turn, and who spat. */
  poisonTurns: number;
  poisonDamage: number;
  poisonBy: number;
  /** Power Surge: this unit loses its next turn. */
  stunned: boolean;
```

Initialise them in every place a `Unit` is built (main fighters, pets, spirits, the stray dog — TypeScript lists any you miss): all `0`/`false`, except for main fighters `hpRegen: origin.hpRegen`, and the main fighter's magic resistance becomes `Math.min(MAGIC_RESIST_CAP, cls.magicResist + origin.magicResist + sum('magicResist'))`.

- [ ] **Step 4: The passives**

In `takeTurnBody`, inside `if (u.isMain) { ... }` after stamina and mana regen:

```ts
      if (u.hpRegen > 0 && u.hp < u.maxHp) {
        const before = u.hp;
        u.hp = Math.min(u.maxHp, u.hp + u.hpRegen);
        events.push({ t: 'heal', actor: u.idx, amount: u.hp - before, hp: u.hp });
      }
```

- [ ] **Step 5: Card effects**

Add these cases to `applyCard`:

```ts
      case 'weather_wave':
        u.waveHits = scaledCount(2, level);
        u.wavePct = weatherWavePct(level);
        break;
      case 'leap':
        u.leapPct = Math.max(u.leapPct, scaled(20, level));
        break;
      case 'last_train':
        u.trainTurns = scaledCount(2, level);
        u.trainGauge = scaled(40, level);
        break;
      case 'scrap_shield':
        u.scrap += scaled(15, level);
        events.push({ t: 'scrap', actor: u.idx, absorbed: 0, left: u.scrap });
        break;
      case 'toxic_spit': {
        const foe = enemyMainOf(u);
        // A new spit restarts the 3 turns; a stronger one replaces a weaker poison.
        foe.poisonDamage = foe.poisonTurns > 0 ? Math.max(foe.poisonDamage, scaled(4, level)) : scaled(4, level);
        foe.poisonTurns = 3;
        foe.poisonBy = u.idx;
        break;
      }
      case 'power_surge': {
        const foe = enemyMainOf(u);
        u.nextHitPct += 10 * (level - 1);
        const seen = events.length;
        attack(u, foe, 'melee');
        // Only a hit that landed (even blocked) stuns; a dodge or a blinded miss doesn't.
        const landed = events.slice(seen).some((e) => (e.t === 'hit' || e.t === 'block') && e.actor === u.idx && e.target === foe.idx);
        if (landed && alive(foe)) foe.stunned = true;
        break;
      }
```

Import `weatherWavePct` from `./cards`.

- [ ] **Step 6: Where hits land**

In `attack`, right after `const sure = ...;` and before the `sureDodges` check:

```ts
    // Leap: this attack is dodged for sure, then the defender strikes back at once.
    if (!sure && def.leapPct > 0) {
      const bonus = def.leapPct;
      def.leapPct = 0;
      events.push({ t: 'dodge', actor: att.idx, target: def.idx, kind });
      def.nextHitPct += bonus;
      attack(def, att, 'counter');
      return true;
    }
```

In `attack`, after the block (`if (blocked) damage = ...`) and before `land(...)`:

```ts
    // Scrap Shield soaks up physical damage first.
    if (def.scrap > 0) {
      const absorbed = Math.min(def.scrap, damage);
      def.scrap -= absorbed;
      damage -= absorbed;
      events.push({ t: 'scrap', actor: def.idx, absorbed, left: def.scrap });
    }
```

At the very top of `land` (it handles physical and magic damage):

```ts
    // Weather the Wave: the next hits taken do less damage.
    if (def.waveHits > 0 && damage > 0) {
      def.waveHits--;
      damage = Math.floor((damage * (100 - def.wavePct)) / 100);
    }
```

- [ ] **Step 7: Turns: poison, stun, Last Train; end of round**

Replace `takeTurn`:

```ts
  const takeTurn = (u: Unit) => {
    // Toxic Spit hurts at the start of the turn, before anything else.
    if (u.poisonTurns > 0) {
      u.poisonTurns--;
      u.hp = Math.max(0, u.hp - u.poisonDamage);
      events.push({ t: 'poison', actor: u.idx, damage: u.poisonDamage, hp: u.hp });
      if (u.hp === 0) {
        kill(u, units[u.poisonBy]!);
        return;
      }
    }
    // Power Surge: this turn is lost.
    if (u.stunned) {
      u.stunned = false;
      events.push({ t: 'stunned', actor: u.idx });
      return;
    }
    takeTurnBody(u);
    if (u.rageTurns > 0) u.rageTurns--;
    if (u.trainTurns > 0) {
      u.trainTurns--;
      u.gauge += u.trainGauge;
    }
  };
```

(Check `kill`'s parameter order in the file — it is `kill(def, att)` where `att` gets the credit — and use it the same way.)

In the end-of-round block, next to `for (const m of mains) m.summonedThisRound = false;`, add `for (const m of mains) m.scrap = 0;` with the comment `// Scrap Shield lasts until the end of the round.`

- [ ] **Step 8: Bots**

Bots answer an enemy's offensive card with a defence. Update:

```ts
  const DEFENSIVE = ['wall', 'roll', 'feint', 'weather_wave', 'leap', 'scrap_shield'];
```

and in `botChoice`, the comment and filter become:

```ts
      // A Special Strike can't be dodged, so Roll and Leap do not answer it.
      const defence = DEFENSIVE.find((id) => can(id) && (enemyLast.card !== 'special' || (id !== 'roll' && id !== 'leap')));
```

- [ ] **Step 9: Show the new events in the arena**

In `src/fight/ReplayScene.ts`, add cases to `handle` and three small handlers, following the existing `onWard`, `onHeal` and `onMiss` handlers (same structure, same timing style):

- `'scrap'` → `onScrap(actor, absorbed, left)`: when `absorbed === 0` float `'SCRAP SHIELD'` above the fighter in `PAL.orange`; otherwise float `-${absorbed}` in `PAL.orange` at the same offset `onWard` uses for absorbed damage.
- `'poison'` → `onPoison(actor, damage, hp)`: update the unit's health exactly like `onHeal` does (bar and HUD), and float `-${damage}` in `PAL.lime`.
- `'stunned'` → `onStunned(actor)`: float `'STUNNED'` in `PAL.yellow` and give the moment a short wait like `onMiss`.

- [ ] **Step 10: Run the tests and fix seeds**

Run: `npx vitest run`
Expected: PASS. If a new test's scenario does not happen with its seed (e.g. the Power Surge strike was dodged, or the fight ended before 3 poison turns), pick another seed so it does; never weaken the assertion. Earlier seed-based tests may flip again because heals, counters and stuns change fights; re-seed them the same way and list them in the report.

- [ ] **Step 11: Check and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run build`

```bash
git add src/core src/fight/ReplayScene.ts
git commit -m "Origin cards and passives in fights: Weather the Wave, Leap, Last Train, Scrap Shield, Toxic Spit, Power Surge"
```

---

### Task 3: Balance with origins

**Files:**
- Modify: `tools/balance.ts` (origin cards use fighters of their origin; new `origins` section)
- Modify (tuning only, if needed): `src/core/catalog.ts` (origin passives), `src/core/cards.ts` (origin card costs/numbers and their `describe` texts), `src/core/fight.ts` (origin card numbers)
- Modify: `docs/COMBAT.md` (an Origins section with passives and cards; final numbers)
- Test: `src/core/core.test.ts` (update expected numbers only if tuning changed them)

**Interfaces:**
- Consumes: `generateOpponent(level, rng, classId, originId)`, `startingCards(classId, originId)`, `cardOrigin(id)`, `ORIGIN_IDS`.

- [ ] **Step 1: Origin cards in the cards section**

In the cards section of `tools/balance.ts`, for a card with `pool === 'origin'`, both fighters must come from that origin, and the base deck must be their real starting cards:

```ts
    const originId = card.pool === 'origin' ? cardOrigin(card.id) : undefined;
    // ...inside the loops:
        const ca = generateOpponent(SKILL_LEVEL, rng, classId, originId);
        const cb = generateOpponent(SKILL_LEVEL, rng, classId, originId);
        const base = Object.fromEntries(startingCards(classId, ca.originId).filter((id) => id !== card.id).map((id) => [id, level]));
```

Import `cardOrigin` and `ORIGIN_IDS`. Update the file's top comment with the new section.

- [ ] **Step 2: The origins section**

Add, after the classes section:

```ts
// --- Origins ---------------------------------------------------------------
// Each origin against the same class from a random origin, so only the origin differs.
const ORIGIN_MIN = 0.45;
const ORIGIN_MAX = 0.55;

if (section('origins')) {
  console.log(`\nOrigins: win rate against the same class from a random origin`);
  console.log(`${'level'.padEnd(8)}${ORIGIN_IDS.map((id) => id.padEnd(12)).join('')}`);
  for (const level of LEVELS) {
    const cells: string[] = [];
    for (const originId of ORIGIN_IDS) {
      let wins = 0;
      for (let i = 0; i < FIGHTS; i++) {
        const rng = new Rng(mixSeed(level * 4241 + ORIGIN_IDS.indexOf(originId) * 17, i));
        const classId = CLASS_IDS[i % CLASS_IDS.length]!;
        const ca = generateOpponent(level, rng, classId, originId);
        const cb = generateOpponent(level, rng, classId);
        const aFirst = i % 2 === 0;
        const log = aFirst ? runFight(ca, cb, rng.next()) : runFight(cb, ca, rng.next());
        if (log.winner === (aFirst ? 0 : 1)) wins++;
      }
      const rate = wins / FIGHTS;
      const flag = rate < ORIGIN_MIN || rate > ORIGIN_MAX ? '!' : ' ';
      if (flag === '!') problems++;
      cells.push(`${pct(rate)}${flag}`.padEnd(12));
    }
    console.log(`${String(level).padEnd(8)}${cells.join('')}`);
  }
  console.log(`Targets: ${ORIGIN_MIN * 100}-${ORIGIN_MAX * 100}%`);
}
```

(Place `ORIGIN_MIN`/`ORIGIN_MAX` next to the other target constants if that reads better; `problems` is the file's existing counter.)

- [ ] **Step 2b: Run the new section once**

Run: `npm run balance -- 300 origins`
Expected: a table of 4 levels × 6 origins; it may report problems (that is what Step 3 tunes).

- [ ] **Step 3: Measure, then tune**

Run each section one at a time (each takes minutes; never two balance processes at once; 10-minute timeout): `npm run balance -- 700 classes`, `npm run balance -- 1000 cards`, `npm run balance -- 600 origins`, `npm run balance -- 2000 advice`. Write down the problem counts.

Targets: class averages 45-55% at levels 1, 5, 10, 20; matchups 35-65%; cards 50-62%; origins 45-55%; advice 0 problems. The `skill` section is reported only — do not chase it.

Tuning rules: one lever at a time; keep a change only if the total problem count (all sections above) drops; first levers are the origin passives and the origin cards' numbers and costs (costs stay 2-6); do not touch the stamina/mana values (`STAMINA_REGEN`, `MANA_REGEN`, `BREAK_STAMINA`, `TIRED_BELOW`, `START_STAMINA`), `ENERGY_EVERY`, Parkour's or Mystic's base health. Stop when the targets are met or the count stops dropping, and report what is left.

Whenever a number changes, update the card's `describe` text, the origin `description`, the Task 1/Task 2 tests that pin that number, and `docs/COMBAT.md`.

- [ ] **Step 4: Document**

Add an "Origins" section to `docs/COMBAT.md`: a table with each origin's passive and card (cost, effect at level 1, what grows with level), and one line saying ranks are cosmetic.

- [ ] **Step 5: Check and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run build`

```bash
git add tools/balance.ts src/core docs/COMBAT.md
git commit -m "Balance: origins section, origin cards measured with their own origin, tuned"
```

---

### Task 4: Origin and rank art layers

**Files:**
- Create: `public/art/fighter/origin-port.png`, `origin-rooftops.png`, `origin-metro.png`, `origin-industrial.png`, `origin-sewers.png`, `origin-scrapyard.png`
- Create: `public/art/fighter/rank-regular.png`, `rank-veteran.png`, `rank-champion.png`, `rank-legend.png`
- Modify: `public/art/manifest.json` (fighter.origin, fighter.rank)
- Modify: `src/ui/art.ts` (manifest type)
- Modify: `src/ui/sprites.ts` (`FighterLook`, layer order)
- Modify: every caller of `drawFighter`/`fighterFrames`: `src/ui/screens/create.ts`, `home.ts`, `prefight.ts`, `title.ts`, `gallery.ts`, `src/fight/ReplayScene.ts`
- Modify: `docs/ART.md`

**Interfaces:**
- Consumes: `rankOf`, `RankId` (Task 1); `UnitInfo.originId/level` (Task 2).
- Produces: `export interface FighterLook { appearance: Appearance; classId: ClassId; originId?: string; level?: number }`; `drawFighter(f: FighterLook): HTMLCanvasElement`; `fighterFrames(f: FighterLook): HTMLCanvasElement[]`. A `Character` can be passed directly as a `FighterLook`.

- [ ] **Step 1: Layering code**

`src/ui/art.ts`, inside the `fighter` manifest type, after `extra`:

```ts
    /** One full-colour layer per origin id, drawn after `extra` (tattoos, hood, goggles, metal plates...). */
    origin?: Record<string, string>;
    /** One full-colour layer per rank (no file for 'rookie'), drawn last (wraps, chain, medal, belt...). */
    rank?: Partial<Record<RankId, string>>;
```

`src/ui/sprites.ts`:

```ts
/** Everything that decides how a fighter looks. A Character has all of it. */
export interface FighterLook {
  appearance: Appearance;
  classId: ClassId;
  /** Where they grew up: adds the origin layer. */
  originId?: string;
  /** Their level: adds the rank layer. */
  level?: number;
}
```

Change `customFighter(look, classId)` to `customFighter(f: FighterLook)` and, after the `extra` layer, add:

```ts
  const origin = f.originId ? artImage(m.origin?.[f.originId]) : null;
  if (origin) imageToCanvas(origin, undefined, canvas);
  const rank = artImage(m.rank?.[rankOf(f.level ?? 1).id]);
  if (rank) imageToCanvas(rank, undefined, canvas);
```

(`m` is the `fighter` part of the manifest the function already reads; keep the existing names.) Change `fighterFrames` and `drawFighter` to take a `FighterLook`; `placeholderFighter` keeps using `f.appearance` and `f.classId`. If `fighterFrames` caches results, include origin and rank in the cache key.

Callers:
- `home.ts`: `drawFighter(c)`; `prefight.ts`: `drawFighter(me)` and `drawFighter(foe)`.
- `create.ts`: `drawFighter({ appearance: look, classId, originId, level: 1 })`.
- `title.ts`: `drawFighter({ appearance: LOOK, classId: 'brawler' })`.
- `ReplayScene.ts`: `fighterFrames({ appearance: info.appearance, classId: info.defId as ClassId, originId: info.originId, level: info.level })`.
- `gallery.ts`: keep the class tiles (pass `{ appearance: look, classId }`), and add one tile per origin (`{ appearance: look, classId: 'brawler', originId }`, labelled with the origin name and file `origin-<id>.png`) and one per rank 2-5 (`{ appearance: look, classId: 'brawler', level: rank.from }`, file `rank-<id>.png`).

- [ ] **Step 2: Check the code before drawing**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: green (no art yet, so fighters look as before).

- [ ] **Step 3: Draw the layers**

Write a one-off generator in the session scratchpad (NOT in the repo; the PNGs are the source from now on, the owner retouches them). It writes 90 × 26 RGBA PNGs (5 frames of 18 × 26: idle0, idle1, windup, punch, hurt), transparent except the drawn details. Use `node:zlib` (`deflateSync`, `crc32`) the way `tools/make-icons.ts` does to write PNGs.

To line details up with the fighter, first decode the existing layers (read-only!) — `public/art/fighter/body.png`, `outfit-brawler.png`, `hair-short.png`, `extra-brawler.png` — with `inflateSync`, undoing PNG row filters 0-4 (handle colour types 6 RGBA, 2 RGB and 3 palette; 8-bit, not interlaced). From them, find per frame where the head, eyes, neck, torso, arms, wrists, waist, knees and feet are. Draw each detail per frame so it follows the body in every pose.

What each layer shows (use colours from `PAL` in `src/ui/theme.ts`, a dark outline like the existing layers):

| File | Details |
|---|---|
| `origin-port.png` | Navy anchor tattoo on each forearm; a wool beanie (blue/navy) over the top of the head |
| `origin-rooftops.png` | A hood up over the head (amber/brown), a scarf over the mouth, dark climbing gloves |
| `origin-metro.png` | Headphones around the neck (black with a magenta band); two small graffiti patches on the top (magenta, lime) |
| `origin-industrial.png` | Welding goggles pushed up on the forehead (dark lenses, orange strap), two oil stains, an apron front (brown) |
| `origin-sewers.png` | Mutant: moss-green skin patches on face and arms, glowing lime eyes (over the eye pixels), pointed ears sticking out of the sides of the head |
| `origin-scrapyard.png` | Half-robot: a grey metal plate on the jaw and one forearm with rivet pixels, one eye replaced by a cyan LED |
| `rank-regular.png` | White wrist wraps; two small sewn patches on the clothes |
| `rank-veteran.png` | A chain necklace (stone/white), knee pads (dark), a small scar on the cheek |
| `rank-champion.png` | Bandaged forearms, a medal on the chest (amber/yellow), shoulder pads |
| `rank-legend.png` | A gold champion belt (yellow, amber, with a plate in the middle) and a tiny crown of three gold pixels on the head |

To see what you drew, write an enlarged preview (each pixel 8 × 8, all layers combined over `body.png` with a skin tint, plus the new layer alone) to the scratchpad and open it with the Read tool. Check each frame lines up; fix and regenerate until it does.

- [ ] **Step 4: Manifest and docs**

`public/art/manifest.json`, inside `fighter` after `extra`:

```json
    "origin": {
      "port": "fighter/origin-port.png",
      "rooftops": "fighter/origin-rooftops.png",
      "metro": "fighter/origin-metro.png",
      "industrial": "fighter/origin-industrial.png",
      "sewers": "fighter/origin-sewers.png",
      "scrapyard": "fighter/origin-scrapyard.png"
    },
    "rank": {
      "regular": "fighter/rank-regular.png",
      "veteran": "fighter/rank-veteran.png",
      "champion": "fighter/rank-champion.png",
      "legend": "fighter/rank-legend.png"
    },
```

`docs/ART.md`: add the two layers to the layer table (`origin`: one per origin, not coloured, drawn after `extra`; `rank`: one per rank, not coloured, drawn last), the rank levels (Regular 5, Veteran 10, Champion 15, Legend 20; Rookie has no file), the new manifest keys, and that `?gallery` shows every origin and rank.

- [ ] **Step 5: Check and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run build`, and `git status` to confirm no existing PNG changed (`git diff --stat -- public/art` must list only `manifest.json`; new files show as untracked).

```bash
git add public/art/fighter/origin-*.png public/art/fighter/rank-*.png public/art/manifest.json src/ui src/fight/ReplayScene.ts docs/ART.md
git commit -m "Art: origin and rank layers for fighters"
```

---

### Task 5: Origins and ranks on screen

**Files:**
- Modify: `src/ui/screens/create.ts` (origin choice: 6 origins, card shown, live preview)
- Modify: `src/ui/cardView.ts` (`CARD_ICONS` for origin cards)
- Create or modify: `src/ui/widgets.ts` (`rankBadge`)
- Modify: `src/ui/screens/home.ts`, `src/ui/screens/prefight.ts` (rank badge, Legend class)
- Modify: `src/ui/screens/levelup.ts` (new-rank celebration)
- Modify: `src/fight/ReplayScene.ts` (Legend aura in the arena)
- Modify: `src/style.css` (badge, Legend aura, celebration)
- Modify: `README.md` (one line: six origins with their own card, ranks)

**Interfaces:**
- Consumes: `ORIGINS`, `ORIGIN_IDS`, `originCard`, `rankOf`, `RANKS` (Task 1); `cardSticker` (existing); `drawFighter(f: FighterLook)` (Task 4); `ORIGIN_COLORS` (Task 1).
- Produces: `rankBadge(level: number): HTMLElement` in `src/ui/widgets.ts`.

- [ ] **Step 1: Card icons**

In `CARD_ICONS` (`src/ui/cardView.ts`) add:

```ts
  weather_wave: 'stance',
  leap: 'counter',
  last_train: 'fast',
  scrap_shield: 'armor',
  toxic_spit: 'fragile',
  power_surge: 'skip',
```

- [ ] **Step 2: Creation screen**

In `create.ts`:
- `originCard(id)` shows the origin name (in its `ORIGIN_COLORS` colour), its description, and its card: `cardSticker(originCard(id)!, 1, { size: 'small' })` plus the card's `describe(1)` text in `choice-desc` style (on phones a tooltip never shows, so the text must be visible).
- Choosing an origin refreshes the preview: the `choiceGrid` callback becomes `(id) => { originId = id; refreshPreview(); }`, and `refreshPreview` draws `{ appearance: look, classId, originId, level: 1 }`.
- The lede under "Origin" becomes `'A bonus in every fight, a look and a card of its own.'`
- The grid must fit six choices at phone width (360 px) without horizontal scroll: if `choiceGrid` lays out in two columns already, keep it; otherwise give `.create` origin grid two columns in `style.css`.

- [ ] **Step 3: Rank badge**

In `src/ui/widgets.ts`:

```ts
/** A small sticker with the fighter's rank, e.g. "Veteran". Its colour grows with the rank. */
export function rankBadge(level: number): HTMLElement {
  const rank = rankOf(level);
  return h('span', { class: `rank-badge rank-${rank.id}` }, rank.name);
}
```

`style.css`: `.rank-badge` uses the small sticker lettering tier (same look as `.sticker-sm`), with a colour per rank via `--rank` custom property: rookie `var(--paper)`, regular `PAL.sky`, veteran `PAL.lime`, champion `PAL.amber`, legend `PAL.yellow` (use the CSS variables `applyTheme()` creates for these palette names — check `src/ui/theme.ts` for their exact names).

Place it:
- `home.ts`: in the `Level N Class` line, after the class sticker.
- `prefight.ts`: in both poster sides, after the `Level N` text.

- [ ] **Step 4: The Legend aura**

The fighter's die-cut sticker edge turns gold and gets a soft gold halo (no glow on any other rank).

`style.css`, next to `.spot canvas`:

```css
/* Legend rank: the sticker edge turns gold, with a soft gold halo. */
.spot.legend canvas {
  filter: drop-shadow(var(--sticker-edge) 0 0 var(--gold-edge)) drop-shadow(calc(var(--sticker-edge) * -1) 0 0 var(--gold-edge))
    drop-shadow(0 var(--sticker-edge) 0 var(--gold-edge)) drop-shadow(0 calc(var(--sticker-edge) * -1) 0 var(--gold-edge))
    drop-shadow(0 0 6px var(--gold-halo)) drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.3));
}
```

Define `--gold-edge` (the palette yellow) and `--gold-halo` (the palette amber at about 60% opacity) where the other sticker variables live. Add the class `legend` to the `.spot` element on home, pre-fight (each side by its own fighter's level) and the level-up celebration when `rankOf(level).id === 'legend'`.

Arena (`ReplayScene.ts`, `createUnits`): for main fighters whose `rankOf(info.level ?? 1).id === 'legend'`, add a soft gold glow with Phaser's FX when available (WebGL only):

```ts
      // Legend rank: a soft gold aura (WebGL only; the canvas renderer has no FX).
      if (info.isMain && rankOf(info.level ?? 1).id === 'legend') sprite.preFX?.addGlow(num(PAL.yellow), 2, 0, false, 0.1, 6);
```

- [ ] **Step 5: New rank celebration**

In `levelup.ts`, the level being reached is `const reached = c.level - save.pendingLevelUps + 1;`. When `rankOf(reached).id !== rankOf(reached - 1).id`, put above the upgrade choices a celebration block: the fighter drawn big at the new rank (`drawFighter({ ...c, level: reached })` in a `.spot` with `legend` when it is Legend), a heading `You are now a ${rankOf(reached).name}!` in the full sticker lettering, and the same entrance animation other screens use from `src/ui/motion.ts` (`animateIn`). Use the existing `h1` for the level as it is.

- [ ] **Step 6: Check at phone width**

Run: `npx tsc --noEmit && npx vitest run && npm run build`. If a browser tool is available, open `npm run dev` at `http://127.0.0.1:5199` at 360 × 740 and screenshot: the creation screen (origin grid with cards), home (badge), `?gallery` (origin and rank tiles). If no browser tool is available, say so in the report and check the CSS sizes by arithmetic (six origin choices at 360 px minus 16 px gutters).

- [ ] **Step 7: Commit**

```bash
git add src/ui src/fight/ReplayScene.ts src/style.css README.md
git commit -m "Origins and ranks on screen: origin cards at creation, rank badges, rank-up celebration, Legend aura"
```
