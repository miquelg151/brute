# Legends League Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legends play a trophy league across 5 arenas; the trophy road unlocks 5 new items for future fighters and titles.

**Architecture:** Pure rules in a new `src/core/league.ts` (arenas, road, trophies, unlocks, rival builder, prepare/finish league fight). `game.ts` routes a pending fight with `league` set to the legend's character (`fighterOf`). UI: a new `src/ui/tabs/leagueTab.ts`; pre-fight and fight screens read `fighterOf(save)`; the fight result shows trophies.

**Tech Stack:** Vite + TypeScript, Vitest, DOM screens, `npm run screens` checks.

**Spec:** `docs/superpowers/specs/2026-10-31-legends-league-design.md`

## Global Constraints

- All game text and code comments in English.
- Every new visual in one obvious place; every new item has its own 7 × 7 icon.
- Mobile-first: league screens fit 360×640 and 390×844 without page scroll.
- Legends are never changed by league fights (only their remembered deck).

---

### Task 1: New content, locked behind the road
**Files:** `src/core/cards.ts`, `src/core/catalog.ts`, `src/core/fight.ts`, `src/core/progression.ts`, `src/core/types.ts`, `src/ui/iconsCards.ts`, `src/ui/iconsGear.ts`, `src/ui/cardView.ts`, tests in `src/core/core.test.ts`.
- [ ] Tests: the three card effects (Cheap Shot ignores armor, Smoke Bomb blinds and gives a sure dodge, Crowd Favourite heals and gives 2 energy); locked items never in `eligibleUpgrades` unless in `c.unlocked`.
- [ ] Add cards `cheap_shot`, `smoke_bomb`, `crowd_favourite` (general), gear `bike_helmet`, `neon_jacket` (armor slot), their upgrades in the general pool, `LOCKED_CONTENT` (upgrade refs), `Character.unlocked?`, the filter in `eligibleUpgrades`, `nextHitIgnoresArmor` in fight.ts, bot use (Smoke Bomb defensive, Crowd Favourite as a heal).
- [ ] Icons for all five; commit.

### Task 2: League rules
**Files:** create `src/core/league.ts`; modify `src/core/game.ts`, `src/core/index.ts`; tests.
- [ ] Tests: `arenaOf`, floors, `applyTrophies` (+30/-20, floor), road rewards claimed once and unlocks added, rival strength per arena, `prepareLeagueFight` / `finishFight` leaves the legend unchanged and moves trophies, migration 8→9, `newGame` copies unlocked into the character.
- [ ] `ARENAS`, `ROAD`, `LeagueState`, `newLeague`, `arenaOf`, `leagueFloor`, `buildRival`, `prepareLeagueFight`, `fighterOf`; `finishFight` branches on `fight.league`; save version 9.
- [ ] Commit.

### Task 3: Storage and creation keep the league
**Files:** `src/ui/storage.ts`, `src/main.ts`, `src/ui/screens/create.ts`.
- [ ] League kept with the legends across delete/graduate; `newGame` gets it. Commit.

### Task 4: League tab and match screens
**Files:** create `src/ui/tabs/leagueTab.ts`; modify `src/ui/shell.ts`, `src/ui/screens/prefight.ts`, `src/ui/screens/fight.ts`, `src/ui/icons.ts` (trophy icon), `src/style.css`, `src/main.ts`.
- [ ] Tab shown only with legends; picker, Play match, road. Pre-fight/fight use `fighterOf`. Result panel shows trophies, arena, rewards. Commit.

### Task 5: Checks, balance, docs
**Files:** `tools/screens.json`, `docs/GUIA-PER-A-MIQUEL.md`.
- [ ] Screens scenarios `league-tab`, `league-prefight`, `league-fight-result`; no-legends check; balance run; guide note; full tests, build, screens; merge, push.
