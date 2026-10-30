# Visual pass A: screens and readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Icons instead of words on the plan buttons, tap-to-read stats, a compact Fighter tab, big thumb-zone cards in fights, fuller level-up / create screens and a few readability fixes.

**Architecture:** DOM + CSS only (`src/ui/**`, `src/style.css`); no rule changes in `src/core`. Each UI change is guarded by a screenshot scenario in `tools/screens.json` whose `eval` step throws when the layout is wrong (the "test" for UI work).

**Tech Stack:** Vite + TypeScript, plain DOM via `h()` in `src/ui/dom.ts`, `npm run screens` (headless Chrome).

**Spec:** `docs/superpowers/specs/2026-10-30-screens-and-readability-design.md`

## Global Constraints

- All game text and code comments in English.
- One font family (Shantell Sans); existing "posters on a wall" style; no new visual styles.
- Must fit 360x640 and 390x844 with no page scroll where it has none today.
- Every icon choice in one map in `src/ui/icons.ts`; every note text in `src/ui/describe.ts`.
- `npm test` stays green; `npm run build` type-checks.

## How to run the checks

1. `npx vite --host 127.0.0.1 --port 5199 --strictPort` (background).
2. `npm run screens -- <scenario names>`; an `eval` error prints next to the picture and is a failure.
3. Look at the PNGs in `screens/` at both sizes.

---

### Task 1: Plan buttons with icon on top, word below

**Files:**
- Modify: `src/ui/icons.ts` (add `OPTION_ICONS` after `TRAIT_ICONS`)
- Modify: `src/ui/plan.ts:73` (`optionGroup` button content)
- Modify: `src/style.css` (`.segment` block ~1551)
- Modify: `tools/screens.json` (helper `plan-buttons-fit`, used by `prefight-plan` and the break sheet)

**Interfaces:** Produces `OPTION_ICONS: Record<string, IconName>` keyed by option id.

- [ ] **Step 1: Failing check.** Add helper `plan-buttons-fit` and include it in `prefight-plan` right after `prefight-plan-fits`:

```json
{ "name": "plan-buttons-fit", "helper": true, "steps": [
  { "eval": "const btns = [...document.querySelectorAll('.option-segments .segment')]; if (btns.length < 10) throw new Error('expected icon option buttons, found ' + btns.length); for (const b of btns) { if (!b.querySelector('.icon')) throw new Error('no icon in ' + b.textContent); const w = b.querySelector('.segment-word'); if (w.scrollWidth > w.clientWidth + 1 || w.getClientRects().length > 1 || w.offsetHeight > 22) throw new Error('word wraps or overflows: ' + w.textContent); }" }
] }
```

- [ ] **Step 2:** `npm run screens -- prefight-plan` → FAIL "expected icon option buttons".
- [ ] **Step 3: Implement.** In `icons.ts`:

```ts
/** The picture on each plan button (stance, target, weapon use), by option id. */
export const OPTION_ICONS: Record<string, IconName> = {
  balanced: 'stance',
  aggressive: 'rage',
  defensive: 'armor',
  agile: 'dodge',
  mixed: 'target',
  fighter: 'fist',
  pets: 'pet',
  normal: 'weapon',
  throw: 'fast',
  keep: 'lock',
};
```

In `optionGroup`, build each button as icon + word, the tick in a corner, and the word fitted with the same `--name-fit` idea as cards (shrink long words):

```ts
const art = icon(OPTION_ICONS[id] ?? 'skill', defs[id].name, 'normal');
art.setAttribute('aria-hidden', 'true');
const word = defs[id].name;
const btn = h(
  'button',
  { class: 'segment option-segment', 'aria-pressed': id === selected ? 'true' : 'false', 'aria-label': matches(id) ? `${word}, strong vs this foe` : word },
  art,
  h('span', { class: 'segment-word', style: `--word-fit:${Math.min(1, 9 / Math.max(9, word.length)).toFixed(2)}` }, word),
  matches(id) ? h('span', { class: 'segment-tick', 'aria-hidden': 'true' }, '✓') : '',
);
```

Give the row wrapper the extra class `option-segments` (find where `optionGroup` builds `h('div', { class: 'segments' ...` and add it). CSS:

```css
/* Plan buttons: the option's icon on top, its word under it on one line. */
.option-segment {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px 2px 5px;
}

.segment-word {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  font-size: calc(var(--t-xs) * var(--word-fit, 1));
}

.option-segment .segment-tick {
  position: absolute;
  top: -6px;
  right: -4px;
  font-size: var(--t-m);
}
```

- [ ] **Step 4:** `npm run screens -- prefight-plan` → no errors; also `prefight-plan-fits` still passes at 360x640. Look at both PNGs. If 360x640 fails `prefight-plan-fits`, use icon size `'small'`.
- [ ] **Step 5:** Commit `Plan buttons: icon on top, word below`.

### Task 2: Tap a stat to read what it is

**Files:**
- Modify: `src/ui/describe.ts` (add `STAT_NOTES`)
- Modify: `src/ui/tabs/fighterTab.ts` (`stat()` becomes a button; a note under the strip)
- Modify: `src/style.css` (`.stats` area)
- Modify: `tools/screens.json` (`tab-fighter`)

**Interfaces:** Produces `STAT_NOTES: Record<'health' | 'strength' | 'agility' | 'speed' | 'magic' | 'mana', string>`.

- [ ] **Step 1: Failing check.** In `tab-fighter`, after the first shot add:

```json
{ "click": ".stats .stat:nth-child(2)" },
{ "eval": "const n = document.querySelector('.stat-note'); if (!n || !n.textContent.startsWith('Strength')) throw new Error('no strength note: ' + (n && n.textContent));" },
{ "shot": "tab-fighter-stat" }
```

- [ ] **Step 2:** `npm run screens -- tab-fighter` → FAIL "no strength note".
- [ ] **Step 3: Implement.** `describe.ts`:

```ts
/** What each stat means, shown when the player taps it. */
export const STAT_NOTES = {
  health: 'Health: how much damage you take before you drop.',
  strength: 'Strength: more damage per hit.',
  agility: 'Agility: dodge more, and hit more often with combos.',
  speed: 'Speed: act more often.',
  magic: 'Magic: stronger spells.',
  mana: 'Mana: what your spells spend.',
} as const;
```

In `renderFighterTab`, replace `stat` with a button that toggles one shared note:

```ts
const statNote = h('p', { class: 'stat-note hidden', 'aria-live': 'polite' });
const statButtons: HTMLButtonElement[] = [];
const stat = (name: keyof typeof STAT_NOTES, value: number, label: string) => {
  const btn = h('button', { class: 'stat', type: 'button', 'aria-pressed': 'false', 'aria-label': `${label} ${value}` }, icon(name, label, 'normal'), h('span', { class: 'stat-value' }, String(value))) as HTMLButtonElement;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-pressed') !== 'true';
    for (const b of statButtons) b.setAttribute('aria-pressed', String(open && b === btn));
    statNote.textContent = STAT_NOTES[name];
    statNote.classList.toggle('hidden', !open);
  });
  statButtons.push(btn);
  return btn;
};
```

and append `statNote` right after the `.stats` strip. CSS: `.stats .stat` gets `font: inherit; background: none; border: none; padding: 0; cursor: pointer; color: inherit;`, `.stat[aria-pressed='true'] .icon { transform: translateY(-2px) scale(1.1); }`, `.stat-note` uses the `.option-detail` look (paper, ink, padding 8px 12px, `font-size: var(--t-s)`, `margin: 6px 0 0`).
- [ ] **Step 4:** `npm run screens -- tab-fighter` → passes; look at `tab-fighter-stat`.
- [ ] **Step 5:** Commit `Fighter tab: tap a stat to read it`.

### Task 3: Fighter tab as one 4-column grid

**Files:**
- Modify: `src/ui/tabs/fighterTab.ts` (`SQUARE`, groups → one grid with headers, armor+accessory become one Gear group)
- Modify: `src/style.css` (`.inventory`, `.inv-row`, `.inv-heading`, `.inv-items`)
- Modify: `tools/screens.json` (`tab-fighter`)

- [ ] **Step 1: Failing check.** In `tab-fighter`, before the first shot:

```json
{ "eval": "const items = [...document.querySelectorAll('.inv-item')]; const tops = new Set(items.slice(0, 4).map((i) => Math.round(i.getBoundingClientRect().top))); if (document.querySelectorAll('.inv-heading').length !== 4) throw new Error('expected 4 groups (weapons, pets, gear, skills)'); const notes = document.querySelector('.inv-note').getBoundingClientRect(); if (innerHeight >= 800 && notes.top > innerHeight) throw new Error('the inventory does not fit at ' + innerHeight + ': note at ' + Math.round(notes.top));" }
```

- [ ] **Step 2:** `npm run screens -- tab-fighter` → FAIL "expected 4 groups".
- [ ] **Step 3: Implement.** `SQUARE = 52`. Merge armor and accessory into one group `{ icon: 'armor', label: 'Gear', items: [...gearItems('armor'), ...gearItems('accessory')] }`, keeping each piece's slot icon as its art. Each group renders as a `section.inv-row` with a header line `h('h3', { class: 'inv-heading' }, icon(group.icon, '', 'small'), group.label)` above `div.inv-items`. CSS:

```css
.inv-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
}

.inv-heading {
  height: auto;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  margin: 0;
  font-size: var(--t-s);
}

.inv-items {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 6px;
}

.inv-item {
  width: auto;
}
```

Remove the now-unused `.inv-row:has(.locked-slot) .inv-heading` rule; a locked slot spans the row (`.inv-items > .locked-slot { grid-column: 1 / -1; }`).
- [ ] **Step 4:** `npm run screens -- tab-fighter tab-fighter-new tab-fighter-branch` → passes; look at both sizes.
- [ ] **Step 5:** Commit `Fighter tab: one compact grid`.

### Task 4: Fight screen: big cards at the bottom

**Files:**
- Modify: `src/style.css` (`.fight-zone`, `.card-row`, fight `.game-card`)
- Modify: `tools/screens.json` (`fight`)

- [ ] **Step 1: Failing check.** In `fight`, before the shot:

```json
{ "eval": "const row = document.querySelector('.card-row').getBoundingClientRect(); const main = document.querySelector('.screen.fight').getBoundingClientRect(); if (main.bottom - row.bottom > 24) throw new Error('cards float ' + Math.round(main.bottom - row.bottom) + 'px above the bottom'); const card = document.querySelector('.card-row .game-card').getBoundingClientRect(); if (card.width < 80) throw new Error('cards too small: ' + card.width); const arena = document.querySelector('.arena').getBoundingClientRect(); if (document.querySelector('.fight-top-row').getBoundingClientRect().top < arena.bottom) throw new Error('controls overlap the arena');" }
```

- [ ] **Step 2:** `npm run screens -- fight` → FAIL "cards float".
- [ ] **Step 3: Implement.** CSS:

```css
/* The controls and the hand sit at the bottom, in reach of the thumb. */
.fight-zone {
  justify-content: flex-end;
}

.card-row .game-card {
  width: min(84px, calc((100vw - 64px) / 4));
}
```

Keep `summary` / `continueBtn` order unchanged (they replace the cards at the end).
- [ ] **Step 4:** `npm run screens -- fight fight-win fight-loss` → passes at both sizes; check that the 360x640 picture still has no scroll.
- [ ] **Step 5:** Commit `Fight: cards big at the bottom`.

### Task 5: Level-up and create-class spacing

**Files:**
- Modify: `src/style.css` (`.levelup`, `.create-centred`)
- Modify: `tools/screens.json` (`levelup`, `create-class`)

- [ ] **Step 1: Failing checks.** `levelup`, before shot:

```json
{ "eval": "const list = document.querySelector('.levelup .choice-list').getBoundingClientRect(); if (innerHeight >= 800 && innerHeight - list.bottom > 120) throw new Error('empty space under the offers: ' + Math.round(innerHeight - list.bottom));" }
```

`create-class`, before shot:

```json
{ "eval": "const stage = document.querySelector('.create-stage').getBoundingClientRect(); const card = document.querySelector('.carousel').getBoundingClientRect(); if (card.top - stage.bottom > 60) throw new Error('gap between fighter and class card: ' + Math.round(card.top - stage.bottom));" }
```

- [ ] **Step 2:** `npm run screens -- levelup create-class` → both FAIL on 390x844.
- [ ] **Step 3: Implement.**

```css
/* On tall phones the offers spread over the free height, closer to the thumb. */
.screen.levelup {
  min-height: calc(100dvh - var(--step) * 4);
}

.levelup .choice-list {
  flex: 1;
  justify-content: space-evenly;
}

@media (min-height: 760px) {
  .levelup .upgrade {
    padding: 14px 14px;
  }
}
```

(check `.choice-list` is `display: flex; flex-direction: column`; if not, add it in the `.levelup .choice-list` rule). For create: change `.create-centred` to `justify-content: flex-start` and give the Class panel's hint (`.create-panel .lede`) `margin-top: 4px`. Keep the Name step centred by adding `.create-name { justify-content: center; }`.
- [ ] **Step 4:** `npm run screens -- levelup levelup-boss create-class create-name` → passes; look at all.
- [ ] **Step 5:** Commit `Level-up and create: use the free height`.

### Task 6: Readability: kind tag, boss card, Bouncer title

**Files:**
- Modify: `src/style.css` (`.tag` ~474, `.boss-card-trick`, `.boss-card-hint`)
- Modify: `src/ui/tabs/fightTab.ts` (trick toggles open on tap; hint becomes `.tag.boss-tag`)
- Modify: `src/ui/palette.ts` (add `CLASS_TEXT_COLORS`), `src/ui/screens/create.ts:115` (use it)
- Modify: `tools/screens.json` (`boss-card`, `levelup`)

**Interfaces:** Produces `CLASS_TEXT_COLORS: Record<ClassId, string>` (class colours readable on paper).

- [ ] **Step 1: Failing checks.** `boss-card`, extend its eval:

```js
const t = document.querySelector('.boss-card-trick'); if (t && getComputedStyle(t).webkitLineClamp !== '2') throw new Error('trick not clamped to 2 lines'); const go = document.querySelector('.boss-go').getBoundingClientRect(); if (go.bottom > innerHeight) throw new Error('Challenge needs scrolling');
```

`levelup`: `{ "eval": "const t = document.querySelector('.upgrade .tag'); if (getComputedStyle(t).webkitTextStrokeWidth !== '0px') throw new Error('tag still drawn as a sticker');" }`
- [ ] **Step 2:** `npm run screens -- boss-card levelup` → FAIL.
- [ ] **Step 3: Implement.**

Tag pill (drop `.tag` from the sticker selector list at ~1355 and restyle):

```css
.tag {
  align-self: flex-start;
  padding: 1px 8px;
  font-size: var(--t-xs);
  font-weight: 700;
  color: var(--ink);
  background: color-mix(in srgb, var(--tag, var(--ink-soft)) 28%, var(--paper));
  border-radius: 999px;
}
```

Boss card: `-webkit-line-clamp: 2; line-clamp: 2;` and `.boss-card-trick.open { -webkit-line-clamp: unset; line-clamp: unset; }`; in `fightTab.ts` the trick `<p>` gets `onclick: (e) => (e.currentTarget as HTMLElement).classList.toggle('open')` and the hint becomes `h('span', { class: 'tag boss-tag' }, hint)`.

Bouncer: in `palette.ts`

```ts
/** Class colours for text on paper: the light ones get a darker shade so they stay readable. */
export const CLASS_TEXT_COLORS: Record<ClassId, string> = {
  ...CLASS_COLORS,
  bouncer: shade(PAL.mist, -0.45),
};
```

(define it after `shade`); `create.ts:115` uses `CLASS_TEXT_COLORS[id]`.
- [ ] **Step 4:** `npm run screens -- boss-card boss-card-veteran levelup create-class` → passes; look at the Bouncer card and the tags.
- [ ] **Step 5:** Commit `Readability: tag pill, shorter boss card, readable Bouncer title`.

### Task 7: Docs, full run, push

- [ ] Add to `docs/GUIA-PER-A-MIQUEL.md` a short line: plan button icons are in `OPTION_ICONS` (`src/ui/icons.ts`), stat notes in `STAT_NOTES` (`src/ui/describe.ts`), text class colours in `CLASS_TEXT_COLORS` (`src/ui/palette.ts`).
- [ ] `npm test` and `npm run build` → green.
- [ ] `npm run screens` (all scenarios) → no `eval` errors; look at changed screens.
- [ ] Commit `Docs: where the new icons and notes live`, then `git push` (deploys to GitHub Pages).
