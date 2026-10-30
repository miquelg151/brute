# Path to Graduation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bosses at levels 5/10/15/20 that gate levelling, per-fighter feats (medals, titles), graduation at level 20 and a Legends hall tab.

**Architecture:** New pure-rule modules `src/core/bosses.ts`, `src/core/feats.ts`, `src/core/legends.ts`; boss tricks as boss-only skills in `src/core/fight.ts`; save v8 in `src/core/game.ts`/`types.ts`; UI in the Fight and Fighter tabs plus a new Legends tab.

**Tech Stack:** Vite + TypeScript, Vitest, Phaser replay, `npm run balance`, `npm run screens`.

**Spec:** `docs/superpowers/specs/2026-10-30-path-to-graduation-design.md` (binding: all ids, names, numbers, feat conditions and the boss table come from it verbatim).

## Global Constraints

- All game text and code comments in English; 2-space indent, single quotes, semicolons; plain-words comments; beginner-readable (the owner edits this code).
- Deterministic simulation: randomness only through the fight rng. Fights without a boss must stay identical: the existing "old content regression guard" hash test in `src/core/core.test.ts` must stay green unchanged.
- Feats never change the simulation; they only read the finished `FightLog` (adding a field to an event is allowed if a feat needs it and it changes nothing that happens).
- No power carries over between fighters. Legends are frozen copies.
- **Legends must survive everything**: creating a new fighter, deleting the current fighter, and migration. `save.legends` is never dropped.
- XP curve unchanged (`xpToNext`, `XP_WIN`, `XP_LOSS`).
- Existing PNGs and existing entries in `src/ui/icons.ts` are never modified (owner hand-edits them); new icons only appended.
- Before every commit: `npx tsc --noEmit && npx vitest run && npm run build` green; UI tasks also run the relevant `npm run screens` scenarios (dev server `npx vite --host 127.0.0.1 --port 5199 --strictPort`; stop only that server afterwards). Machine is low on memory: run screens scenarios selectively, never in parallel with the balance tool.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push, never touch `main`, never commit `captures/` or `screens/`.

---

### Task 1: Save v8, fighter stats and legends storage

**Files:** `src/core/types.ts`, `src/core/game.ts`, `src/core/core.test.ts`, the UI code that creates a new game or deletes the fighter (`src/ui/screens/create.ts`, `src/ui/shell.ts`, `src/ui/storage.ts` — find the `newGame` and delete call sites).

**Interfaces — Produces:**
- `types.ts`: `interface FighterStats { fights: number; wins: number; kos: number; streak: number; bestStreak: number; bossLosses: Record<string, number> }`; `Character` gains optional `bosses?: Record<string, 'beaten' | 'skipped'>`, `featProgress?: Record<string, number>`, `medals?: string[]`, `title?: string`, `stats?: FighterStats`; `interface Legend { character: Character; graduatedAt: string }` (medals/title/stats/bosses live on the frozen character); `SaveData` gains `legends: Legend[]`.
- `game.ts`: `SAVE_VERSION = 8`; `fighterStats(c): FighterStats` (returns `c.stats`, creating zeros if missing); `newGame(...)` gains an optional last parameter `legends: Legend[] = []` kept in the new save; `finishFight` updates stats (fights, wins, kos = wins by knockout, streak/bestStreak); migration v7→v8 adds `legends: []` and marks bosses below the current level as `'skipped'` using the gate rule (boss level B gates level `B === 20 ? 19 : B`; skipped when `character.level > gate`). Use a local `[5, 10, 15, 20]` constant with a comment pointing to Task 2's `BOSS_LEVELS` — Task 2 replaces it with the import.

- [ ] Tests first: migration v7 → v8 (fighter kept, `legends` empty, bosses skipped exactly below the level, e.g. level 12 → gates 5 and 10 are below 12 → `rusty` and `alley_cat` skipped; level 10 → only `rusty` skipped, Alley Cat still gates); `SAVE_VERSION` is 8 (update the existing assertion); stats after a win by KO, a win on points and a loss (streak resets, bestStreak kept); `newGame` with legends keeps them.
- [ ] Implement. In the UI, every path that creates a new save (new fighter after delete, creation screen) passes the old save's `legends` through, so legends survive deleting the fighter.
- [ ] tsc/vitest/build; commit `Graduation: save v8, fighter stats, legends storage`.

### Task 2: Bosses as data, the boss gate and boss fights

**Files:** create `src/core/bosses.ts`; modify `src/core/progression.ts`, `src/core/game.ts`, `src/core/types.ts`, `src/core/index.ts` (exports), `src/core/core.test.ts`.

**Interfaces:**
- Consumes (Task 1): `Character.bosses`, `fighterStats`, `FighterStats.bossLosses`.
- Produces:
  - `bosses.ts`: `type BossId = 'rusty' | 'alley_cat' | 'sewer_king' | 'champion'`; `interface BossDef { id: BossId; level: number; name: string; intro: string; trick: string; trickText: string; build: () => Character }`; `BOSSES: Record<BossId, BossDef>`; `BOSS_LEVELS = [5, 10, 15, 20]`; `gateLevel(boss: BossDef): number` (19 for the Champion, else its level); `gatedBoss(c: Character): BossDef | null` (the boss whose gate level equals `c.level`, not beaten/skipped); `buildBoss(id: BossId): Character`.
  - Trick skill ids (data only here, behaviour in Task 3): `boss_spare_parts`, `boss_nine_lives`, `boss_rat_tide`, `boss_read_the_fight` — each boss's `build()` includes its trick id in `skills`; these ids are never in any upgrade pool.
  - `progression.ts`: `addXp(c, amount)` never lets XP reach `xpToNext(c.level)` while `gatedBoss(c)` is non-null (XP clamps at `xpToNext(level) - 1`; the rest is lost). `rollOffer` gains an option for a boss reward: `rollBossOffer(c, rng): string[]` → 4 ids, at least one rare (rare = the branch signature skill/card/item from the content expansion not owned; else any weapon/pet/gear not owned).
  - `types.ts`: `PendingFight.bossId?: BossId`; `FightResult.bossId?: BossId` and `FightResult.bossBeaten?: boolean`.
  - `game.ts`: `prepareBossFight(save): PendingFight | null` (only when `gatedBoss` is non-null; opponent = `buildBoss`); `finishFight` for a boss fight: on win marks `bosses[id] = 'beaten'`, sets XP to `xpToNext(level)` and runs the normal level-up with `rollBossOffer` for that level-up; on loss increments `stats.bossLosses[id]`.
- Boss builds: each a fixed `Character` at its level following the spec table (class, origin, branch, sensible upgrades, fixed appearance, plan). Numbers are first proposals; Task 3 tunes them.

- [ ] Tests first: XP clamps at each gate level and normal fights there give no level; `prepareBossFight` null when not gated; boss win → level up, offer of 4 with a rare option, boss marked beaten, next gate works; boss loss → `bossLosses` +1; skipped bosses never gate; trick ids absent from all pools; non-boss fights unchanged (regression hash test still green).
- [ ] Implement; replace Task 1's local level constant with `BOSS_LEVELS`.
- [ ] tsc/vitest/build; commit `Graduation: bosses, boss gate and boss rewards`.

### Task 3: Boss tricks, replay feedback and boss balance

**Files:** `src/core/fight.ts`, `src/fight/ReplayScene.ts`, `src/core/bosses.ts` (tuning), `tools/balance.ts`, `src/core/core.test.ts`, `docs/COMBAT.md`.

**Interfaces:** Consumes Task 2's boss ids/builds and trick skill ids. Produces fight events `repair`, `ninelives` and the Rat Tide summon (reuse an existing summon/pet-join event if one exists, else `summon`), and the Champion's plan switch at breaks.

- [ ] Tests first, one per trick, same seed with and without the trick skill: Spare Parts heals 25% max hp + 2 armor once, the first time at/below 50% after damage; Nine Lives survives the first lethal hit at 1 hp and the next attack aimed at her is surely dodged, once per fight; Rat Tide adds one rat per round start, max 3 extra; Read the Fight changes the Champion's plan at each break to the counter of the player's plan (use the existing advice/counter logic in `src/core/tactics.ts`), deterministic. Fights without trick skills unchanged (regression hash test green).
- [ ] Implement tricks and replay texts (short coloured words like the existing ones: `REPAIR`, `NINE LIVES`, `+RAT`, `READ`).
- [ ] Balance: add a `bosses` section to `tools/balance.ts` — for each boss, generated fighters of its gate level (all classes, random origins/branches, normal bots) vs the boss, report win rate per class and average. Tune only boss builds/trick numbers until each boss's average is 45-55%; no class below 30% vs any boss. Run `npm run balance -- 600 bosses`. Report the tables.
- [ ] COMBAT.md: a Bosses section (builds, tricks, numbers, gate rule).
- [ ] tsc/vitest/build; commit `Graduation: boss tricks and boss balance`.

### Task 4: Feats, medals and titles (core)

**Files:** create `src/core/feats.ts`; modify `src/core/game.ts`, `src/core/types.ts` (`FightResult.newMedals: string[]`), `src/core/index.ts`, `src/core/core.test.ts`; `src/core/fight.ts` only if a feat needs an extra event field.

**Interfaces:**
- Consumes: Task 1 stats/fields; Task 2 `FightResult.bossId`/`bossBeaten`, `BOSSES`.
- Produces: `interface FeatDef { id: string; name: string; description: string; secret?: boolean; branch?: BranchId; title?: string; target?: number; check: (ctx: FeatContext) => number }` where `FeatContext = { character: Character; result: FightResult; side: 0 | 1 /* the player's side in log events */; progress: number }` and `check` returns the new progress (a feat is complete when progress ≥ `target ?? 1`); `FEATS: FeatDef[]`; `featsFor(c): FeatDef[]` (general + own branch); `evaluateFeats(c, result): string[]` (updates `featProgress`, pushes completed ids into `medals`, returns newly completed ids). Boss medals use ids `boss_<id>` and are pushed by `finishFight` on a boss win (not FeatDefs). `availableTitles(c): string[]`; `setTitle(c, title | undefined)`.
- All 15 general and 30 branch feats from the spec tables; titles on the ★ feats (short English names chosen here); `secret` on the ? feats. Where a condition is ambiguous, pick the reading checkable from the log and say it in the description. Streak feats read `stats` (updated before feats are evaluated in `finishFight`).

- [ ] Tests first: for every feat a positive and a negative case (crafted `FightLog`s or seeded fights); medals not duplicated; branch feats only for that branch; `finishFight` returns `newMedals`; boss win adds `boss_<id>`; Prodigy only when all four bosses beaten with `bossLosses` 0 (skipped bosses make it impossible); titles available only from completed ★ feats.
- [ ] Implement.
- [ ] tsc/vitest/build; commit `Graduation: feats, medals and titles`.

### Task 5: Graduation and the Legends tab

**Files:** create `src/core/legends.ts`, `src/ui/tabs/legendsTab.ts`; modify `src/core/index.ts`, `src/ui/shell.ts` (4th tab), `src/ui/tabs/fighterTab.ts` (Graduate button + confirm), the creation flow (start a new fighter after graduating, legends kept), `src/style.css`, `tools/screens.json`, `src/core/core.test.ts`.

**Interfaces:** Consumes Tasks 1-4. Produces `canGraduate(save): boolean` (level 20 and `bosses.champion === 'beaten'`, no pending fight or level-up); `graduate(save, now: Date): Legend` (deep-copies the character into `save.legends`, returns it; the UI then goes to creation, which passes `save.legends` into `newGame`).

- [ ] Tests first: `canGraduate` false before the Champion, with a pending level-up, or with a pending fight; `graduate` freezes a deep copy (later changes to the save don't alter it) and keeps older legends; the next `newGame` keeps all legends.
- [ ] UI: Graduate button on the Fighter tab only when allowed, confirm sheet, then creation. Legends tab: grid of legend cards (sprite, name, title, class + branch, origin, medal count) and a detail sheet (medals with names, bosses beaten/skipped, stats); empty state line. Follow the existing tab, card and sheet patterns and the sticker lettering styles.
- [ ] Screens scenarios: Legends tab empty, Legends tab with 3 legends, legend detail, Fighter tab with the Graduate button. Check them with the Read tool at 360 and 390 width.
- [ ] tsc/vitest/build + those scenarios; commit `Graduation: graduate button and Legends tab`.

### Task 6: Boss and feats UI

**Files:** `src/ui/tabs/fightTab.ts` (boss card), a boss intro screen (new `src/ui/screens/bossIntro.ts`), `src/ui/tabs/fighterTab.ts` (feats section + title picker), the result panel in `src/ui/screens/fight.ts` (new medals, boss beaten line), `src/ui/screens/levelup.ts` (4 options, rare one marked), `src/style.css`, `tools/screens.json`.

**Interfaces:** Consumes `gatedBoss`, `BOSSES`, `prepareBossFight`, `featsFor`, `availableTitles`, `setTitle`, `FightResult.newMedals/bossId/bossBeaten`, `rollBossOffer` results.

- [ ] Fight tab: when gated, a boss card (boss sprite, name, level, trick icon + one line, "XP full — beat the boss to level up") with a Challenge button → boss intro (name, art, intro line, trick) → the normal prefight with the boss as foe → fight. Normal fights stay available.
- [ ] Fighter tab: feats section listing `featsFor(c)` with progress (`3/5`), completed ones as medals, secret ones as `???` until done; title picker among `availableTitles`; the chosen title shows under the name in the top bar.
- [ ] Result panel: "New medal" lines for `newMedals`; boss win line. Level-up screen: 4 options when it is a boss reward, the rare one marked with a small star.
- [ ] Screens scenarios: Fight tab gated by Rusty, boss intro, Fighter tab feats with a secret, result panel with a new medal, 4-option level-up. Check at 360 and 390 width with the Read tool.
- [ ] tsc/vitest/build + those scenarios; update `README.md`/`docs/GUIA-PER-A-MIQUEL.md` only if they describe the levelling flow; commit `Graduation: boss and feats screens`.
