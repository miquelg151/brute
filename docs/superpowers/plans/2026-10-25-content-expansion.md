# Content Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~40 pieces of content: 3 per branch (signature skill, card, item), 4 general weapons, 4 general gear, 2 pets, with fight rules, replay feedback and art.

**Architecture:** Data in `src/core/catalog.ts` and `src/core/cards.ts`; rules in `src/core/fight.ts`; arena feedback in `src/fight/ReplayScene.ts`; art in `public/art` + manifest.

**Tech Stack:** Vite + TypeScript, Vitest, Phaser replay, balance tool, `npm run screens`.

**Spec:** `docs/superpowers/specs/2026-10-25-content-expansion-design.md`

## Global Constraints

- English text and comments; 2-space indent, single quotes, semicolons; plain-words comments; beginner-readable.
- Deterministic simulation: randomness only through the fight rng; a card play at tick n leaves earlier events identical.
- Existing PNGs are never modified; new art only in new files, in the existing pixel style.
- Card costs 2-6. Spec numbers are first proposals (full tuning is a later sub-project); only a sanity pass here.
- Owned items never removed. No save version change needed unless an existing id changes (none do).
- Before every commit: `npx tsc --noEmit && npx vitest run && npm run build` green; UI/art tasks also run `npm run screens` (dev server `npx vite --host 127.0.0.1 --port 5199 --strictPort`).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push, never touch `main`, never commit `captures/` or `screens/`.

---

### Task 1: Data for all new content

**Files:** `src/core/catalog.ts`, `src/core/cards.ts`, `src/core/core.test.ts`

- [ ] Tests first: every id in the spec exists with its pool/branch and kind; each branch has 6-7 own (branch-tagged) upgrades; the general pool has 8 weapons and 7 gear; new card costs match the spec; `describe(1)` texts exist.
- [ ] Add the skills, cards (with `describe` using `scaled`/`scaledCount`), weapons, gear and pets exactly as in the spec tables, with upgrade entries in the right pool/branch. `GearDef` gains optional `thorns` (%), `magic`, `startRhythm`; `WeaponDef` gains optional `breaks` (boolean) and `throwBonusPct`. Apply gear `magic`/new fields where gear stats are summed (no behaviour for thorns/startRhythm yet). `gearEffects` in `src/ui/describe.ts` lists the new fields.
- [ ] tsc/vitest/build; commit `Content: data for new skills, cards, weapons, gear and pets`.

### Task 2: Signature mechanics, part 1 (Boxer, Brute, Acrobat, Thief, Wall)

**Files:** `src/core/fight.ts`, `src/fight/ReplayScene.ts`, `src/core/core.test.ts`, `src/ui/cardView.ts` (CARD_ICONS)

- [ ] Tests first, one per mechanic and card (same seed with/without; earlier events identical for cards): Rhythm stacks and reset, Boxing Wraps start stacks, Jab Flurry 3 hits at 60%; Bone Breaker bleed, Street Bite bleed 5, bleed refresh rule, Brass Knuckles stats; Momentum energy on dodge, Backflip dodges + energy; Quick Hands stamina steal, Heist energy + stamina, Switchblade; Thorns reflect (min 1), Taunt forces enemy pets onto you with double thorns, Dumpster Lid thorns stacking.
- [ ] Implement as unit state + events (`bleed` tick event like `poison`, `rhythm`, `momentum`, `steal`, `thorns`), replay handlers with short coloured texts, card icons. Backflip and Taunt join the bots' DEFENSIVE list.
- [ ] tsc/vitest/build; commit `Content: Rhythm, Bleed, Momentum, Steal, Thorns`.

### Task 3: Signature mechanics, part 2 (Wrecker, Pack, Bond, Witch, Warden) and general items

**Files:** same as Task 2

- [ ] Tests first: Demolition armor −1 per landed hit (not below 0), Sledge Swing −4, Sledgehammer; Pack Call +15% per extra pet, Gang Up (all pets + you attack), Rat/Pigeon stats; Guardian 30% redirect while the pet lives, Together heals, Key Collar; Flame burns on damaging spells, burn halves heals, Fireball sure burn, Neon Spray magic; Overflow overheal → ward capped at 20%, Rune Circle, Rune Amulet; Bottle breaks after first landed hit, Brick thrown +50%, Pool Cue/Crowbar stats; general gear fields.
- [ ] Implement with events (`burn` tick, `armor_break`, `overheal`) and replay texts; card icons.
- [ ] tsc/vitest/build; commit `Content: Armor break, Pack, Guardian, Burn, Overheal, general items`.

### Task 4: Art for new weapons and pets

**Files:** new PNGs in `public/art/weapons/` and `public/art/pets/` (match existing file layout and sizes), `public/art/manifest.json`, `docs/ART.md`

- [ ] Draw `brick`, `bottle`, `pool_cue`, `crowbar`, `knuckles`, `switchblade`, `sledgehammer` weapons and `rat`, `pigeon` pets in the existing style with a one-off generator in the session scratchpad (not in the repo); check enlarged previews with the Read tool; never touch existing PNGs.
- [ ] Manifest entries; `?gallery` shows them; ART.md lists them.
- [ ] Screens: gallery, a Fighter tab with new items, card-names checks pass; tsc/vitest/build; commit `Art: new weapons and pets`.

### Task 5: Sanity balance and docs

**Files:** `tools/balance.ts` (only if a section needs the new content), tuning only if a class average is outside 35-65%, `docs/COMBAT.md`

- [ ] Run classes (700), branches (600), cards (1000) one at a time. If any class or branch average is outside 35-65% at any level, adjust the new content's numbers (only new content) until inside; report all tables.
- [ ] COMBAT.md: a section per signature mechanic, new cards, weapons, gear and pets with their numbers.
- [ ] tsc/vitest/build; commit `Content: sanity balance and docs`.
