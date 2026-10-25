# Class Branches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each class two branches chosen at level 5, keep class items out of the general pool, and allow one cross-class upgrade at level 15.

**Architecture:** Branch data lives in `src/core/catalog.ts` next to classes and upgrades; offer rules in `src/core/progression.ts`; new skill/card rules in `src/core/fight.ts` / `src/core/cards.ts`; a branch choice screen in `src/ui/screens/branch.ts` routed from `src/main.ts`.

**Tech Stack:** Vite + TypeScript, Vitest, DOM via `h()`, balance tool `tools/balance.ts`, screenshot tool `npm run screens`.

**Spec:** `docs/superpowers/specs/2026-10-25-class-branches-design.md`

## Global Constraints

- English text and comments; 2-space indent, single quotes, semicolons; plain-words comments; beginner-readable code.
- Simulation deterministic: all randomness through the fight `rng`; offers through the seeded offer rng.
- Existing PNGs never modified. Paper/sticker UI look, one font, no AI-looking UI, mobile-first (360×640 and 390×844, tap targets ≥ 44 px, no page scroll on full-screen moments).
- Items fighters already own are never removed.
- Card costs 2-6. Numbers in the spec are first proposals; only Task 4 (balance) changes them, updating `describe` texts, tests and `docs/COMBAT.md`.
- Before every commit: `npx tsc --noEmit && npx vitest run && npm run build` green; UI tasks also run `npm run screens` (dev server `npx vite --host 127.0.0.1 --port 5199 --strictPort`).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push, never touch `main`, never commit `captures/` or `screens/`.

---

### Task 1: Branches, pools and offer rules (core)

**Files:** `src/core/catalog.ts`, `src/core/types.ts`, `src/core/progression.ts`, `src/core/opponents.ts`, `src/core/game.ts`, `src/core/core.test.ts`

**Interfaces — produces:**
- `export type BranchId = 'boxer' | 'brute' | 'acrobat' | 'thief' | 'wall' | 'wrecker' | 'pack' | 'bond' | 'witch' | 'warden';`
- `export interface BranchDef { id: BranchId; classId: ClassId; name: string; description: string; icons: [string, string, string] }` (icon names from `src/ui/icons.ts`' set, as plain strings so core stays UI-free).
- `export const BRANCHES: Record<ClassId, [BranchDef, BranchDef]>`, `export const BRANCHES_BY_ID: Record<BranchId, BranchDef>`.
- `UpgradeDef` gains `branch?: BranchId` (undefined = class common or general).
- `Character.branch?: BranchId`.
- `BRANCH_LEVEL = 5`, `CROSS_CLASS_LEVEL = 15`, `OTHER_BRANCH_CHANCE = 15`.
- `needsBranch(c): boolean` (level ≥ 5 and no branch), `chooseBranch(c, id): void` (throws if the branch is not the fighter's class's or one is already chosen).
- `rollOffer(c, rng, size?, forLevel?)` where `forLevel` is the level the offer is for (defaults to `c.level`); `isCrossClass(c, upgradeId): boolean`.
- `SAVE_VERSION = 7`.

- [ ] **Step 1: Failing tests** (add to `core.test.ts`):
  - every non-stat class upgrade has `branch` matching the spec table (check a few: `skill:double_strike` → pool `brawler`, branch `boxer`; `skill:sixth_sense` → `parkour`/`acrobat`; `skill:mend` → `mystic`/`warden`; `pet:crow` → `tamer`/`bond`; `gear:riot_vest` → `bouncer`/`wall`; `gear:gloves` → `brawler`, no branch);
  - the general pool has no pet, no spell (`SPELLS[ref]`), no class skill;
  - a Brawler levelled to 30 by `generateOpponent` many times (e.g. 200 seeds) never owns a pet or a spell;
  - before level 5 offers contain no branch items; `needsBranch` true at level 5 without a branch;
  - `chooseBranch` rejects another class's branch and a second choice;
  - with branch `brute`, over 2000 rolled class-slot picks the share from `boxer` is between 8% and 22%;
  - the offer for level 15 contains exactly one upgrade from another class (`isCrossClass` true) and offers for levels 14 and 16 contain none;
  - bots at level ≥ 5 have a branch of their class;
  - `migrateSave` turns a version 6 save into 7, keeps `pendingFight`, leaves `branch` undefined.

- [ ] **Step 2:** run, see them fail.

- [ ] **Step 3: Implement**
  - `BRANCHES` with names/descriptions from the spec (descriptions are the "Theme" column as a short sentence) and three icons each (pick existing icon names that fit, e.g. Boxer `fist`, `manyHits`, `damage`; Warden `armor`, `health`, `magic`).
  - Move pools: `skill:thrower` → parkour/thief; `skill:sixth_sense` → parkour/acrobat; `skill:flash`, `skill:mend` → mystic/warden; remove `pet:dog` from upgrades (Tamer starts with it); `skill:double_strike` → brawler/boxer. Tag every class item with its branch per the spec; class stats and class gear (except Riot Vest → wall) have no branch.
  - Add upgrades for the new skills/cards in their branch (`skill:jab` boxer, `skill:thick_skull` brute, `skill:wall_run` acrobat, `skill:bulwark` wall, `skill:bond` bond, `skill:feral` bond, `skill:arcane_flow` witch, `card:headbutt` brute, `card:pickpocket` thief, `card:ground_pound` wrecker). Their `SKILLS`/`CARDS` definitions with descriptions are added here too (rules come in Task 2; until then the skills do nothing in fights and the cards' `applyCard` case may be absent — tsc must still pass).
  - `rollOffer`: a class slot draws from class items where `u.branch === undefined || u.branch === c.branch`, except with `OTHER_BRANCH_CHANCE`% it draws from the other branch; before a branch is chosen only class-common items; if the chosen sub-pool is empty, fall back to the other sub-pool, then general (keep today's fallback shape). When `forLevel === CROSS_CLASS_LEVEL`, replace one slot (a random index) with a random non-stat upgrade from another class's pool that the fighter doesn't own.
  - `offerFor` in `game.ts` passes the level the offer is for (`save.character.level - save.pendingLevelUps + 1`); `prepareLevelUp`, `finishFight`, `chooseUpgrade` use the same.
  - `generateOpponent`: when the bot reaches level 5, `chooseBranch(c, rng.pick(BRANCHES[c.classId]).id)` before rolling; pass `forLevel` = the new level.
  - `migrateSave`: version 6 → 7 with no data change.

- [ ] **Step 4:** tests pass (re-seed seed-based tests that flip, keeping their assertions; list them in the report).

- [ ] **Step 5:** tsc/vitest/build, commit `Class branches: data, pools and offer rules`.

---

### Task 2: New skills and cards in fights

**Files:** `src/core/fight.ts`, `src/core/cards.ts`, `src/ui/cardView.ts` (CARD_ICONS), `src/core/core.test.ts`

- [ ] **Step 1: Failing tests** — one per skill/card, comparing a run with and without it on the same seed (the pattern used by the origin card tests): Jab (first attack of a turn hits harder), Thick Skull (higher max health; less damage below 50%), Wall Run (counter damage higher), Bulwark (more `block` events over many fights), Bond (a `heal` on the owner right after a pet hit), Feral (some pet hits double), Arcane Flow (more spells cast in a fight / lower mana spent), Headbutt (`stunned` on the foe when it lands), Pickpocket (foe energy −2, own +2), Ground Pound (a hit on every enemy unit, never `dodge`).

- [ ] **Step 2:** run, see them fail.

- [ ] **Step 3: Implement** the spec's effects in `fight.ts` (reuse existing mechanics: stun from Power Surge, `nextHitPct`, pet hits through `attack`), card `describe` texts with `scaled`/`scaledCount`, and icons in `CARD_ICONS` (`headbutt: 'heavy'`, `pickpocket: 'skip'` or another fitting existing icon, `ground_pound: 'manyHits'` — pick clear ones). Bots: Pickpocket and Ground Pound are spent like any card; none are defensive.

- [ ] **Step 4:** tests pass; tsc/vitest/build; commit `Class branches: new skills and cards`.

---

### Task 3: Branch choice screen and labels (UI)

**Files:** create `src/ui/screens/branch.ts`; modify `src/main.ts`, `src/ui/tabs/fighterTab.ts`, `src/ui/screens/prefight.ts`, `src/ui/screens/levelup.ts`, `src/style.css`, `tools/screens.json`

- [ ] **Step 1: Branch screen** — full-screen moment: the fighter on the street strip (reuse the creation stage/`paintStreet`), title "Choose your path", the two branches as big paper choices (name in class colour, one line, three icons from `BRANCHES[...].icons`), a short note "This choice is for good.", and a confirm button (pick, then confirm). Calls `chooseBranch`, saves, shows next screen.
- [ ] **Step 2: Routing** in `main.ts`: after the locked-fight check and before the level-up offer: if `needsBranch(save.character)` → branch screen.
- [ ] **Step 3: Labels** — Fighter tab header "Brawler · Brute" (branch name in a softer colour), pre-fight foe sheet shows the foe's branch, level-up card tag "From another class" (with that class's colour) when `isCrossClass`.
- [ ] **Step 4: Screens** — scenarios `branch-choice` (level-5 save without branch), `branch-picked`, `levelup-cross` (offer for level 15), `tab-fighter-branch`; full `npm run screens` passes; Read the shots at both sizes.
- [ ] **Step 5:** tsc/vitest/build; commit `Class branches: choose your path screen and labels`.

---

### Task 4: Balance

**Files:** `tools/balance.ts`, tuning in `src/core/catalog.ts` / `cards.ts` / `fight.ts`, `docs/COMBAT.md`, tests pinning numbers

- [ ] **Step 1:** `branches` section: for each class and branch, the branch's win rate vs random fighters of random classes at levels 5, 10, 20 (bots forced to that branch; opponents random), target 45-55%; and each class's two branches in mirror, target 40-60%. `generateOpponent` gains an optional `branchId` parameter for this.
- [ ] **Step 2:** measure classes (700), cards (1000, new cards included), origins (600), branches (600), advice (2000), one at a time.
- [ ] **Step 3:** tune with the usual rules (one lever at a time; keep only if the total problem count drops; costs 2-6; don't touch stamina/mana/energy constants or Parkour/Mystic base health). Stop when targets are met or the count stops dropping.
- [ ] **Step 4:** `docs/COMBAT.md`: a Branches section (table of branches, new skills and cards with final numbers, the 85/15 and level-15 rules).
- [ ] **Step 5:** tsc/vitest/build; commit `Balance: class branches`.
