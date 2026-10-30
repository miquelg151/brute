# Path to Graduation — Design

Sub-project 1 of the progression redesign (2026-10-30). Owner's problem: the grind to level 20
(~200 fights) feels repetitive. Goal: keep the ~200 fights but give the path milestones (bosses)
and a story per fighter (feats), and give finished fighters a lasting place (Legends hall,
graduation). Later sub-projects: (2) Legends League + trophy road unlocking content and
cosmetics, (3) cosmetics and customisation, then a full balance pass.

## Decisions (owner-approved)

- Prestige = **graduate**: at level 20, after beating the final boss, a **Graduate** button moves
  the fighter into the **Legends hall**. Optional and not automatic: the player may keep playing
  the level-20 fighter (e.g. for missing feats) and graduate whenever they like.
- **One fighter in progress at a time.** After graduating, the player creates a new fighter.
- **No power carries over** between fighters. Graduated fighters are frozen (skills, items, cards,
  medals, stats). In sub-project 2 they fight in the League, where only plan/deck/gear choice
  are editable.
- Graduated fighters can never be deleted.
- XP curve unchanged (`xpToNext(level) = 2 + 2*level`, XP_WIN 3, XP_LOSS 1 → ~200 fights to L20).
- All game text in English.

## Player flow

1. Fight normally and earn XP.
2. **Boss gate**: at levels 5, 10, 15 and 19→20, XP stops at the maximum of the level (stays one
   short of levelling) until that level's boss is beaten. Normal fights still give XP that is
   lost while capped (no banking). The Fight tab shows the boss card; the player can challenge
   the boss any time and retry without limit. Losing to a boss gives XP_LOSS as usual (lost while
   capped) and counts as a fight for feats/stats.
   - Gate levels: boss at level L (5, 10, 15) blocks going from L to L+1; the Champion (20)
     blocks going from 19 to 20. Constant `BOSS_LEVELS = [5, 10, 15, 20]`; for boss level B the
     fighter must be at level `B === 20 ? 19 : B` to challenge it.
3. **Beating a boss**: medal for that boss (medal id `boss_<id>`, stored with feat medals), the held level-up happens at once (the capped XP
   overflows normally: XP becomes `xpToNext(level)` → level up), and that level-up's offer has
   **4 options instead of 3, at least one of them rare**. Rare = the branch's signature skill,
   card or item (from the content expansion), or, if none left, a weapon/pet/gear the fighter
   does not own. Beating the Champion also enables Graduate.
4. **Graduate** (level 20, Champion beaten): confirm dialog → the fighter becomes a Legend →
   creation screen for a new fighter.

### Existing saves

Migration from save v7 keeps the fighter. Bosses with gate level below the fighter's current level
are marked **skipped**: they never block, give no medal and no special offer. The next boss at or
above the current level works normally. The Champion is never skipped: a fighter already at level
20 or more takes the exam like everyone else (it holds no level back for them) and graduates when
they beat it. Legends list starts empty.

## The four bosses

Each boss is a fixed fighter of its level with well-chosen upgrades, a fixed appearance, name,
intro line and one boss-only **trick** (a skill only bosses have). Target: an average fighter of
that level wins ~45-55% on the first try (tuned with the balance tool; numbers below are first
proposals).

| Level | Id | Name | Build | Trick |
|---|---|---|---|---|
| 5 | `rusty` | Rusty | Scrapyard Bouncer, heavy armor | **Spare Parts**: once per fight, when first at or below 50% health after taking damage, heals 25% of max health and gains +1 armor for the rest of the fight (tuned down from +2 by the balance tool). Event `repair`. |
| 10 | `alley_cat` | Alley Cat | Rooftops Parkour (Acrobat), high dodge | **Nine Lives**: the first time a hit would knock her out, she survives with 1 health and surely dodges the next attack aimed at her. Event `ninelives`. |
| 15 | `sewer_king` | Sewer King | Sewers Tamer (Pack) with rats, poison | **Rat Tide**: at the start of each round, a new rat pet joins him, up to 3 extra rats in total. Event `summon` (existing pattern if one exists, else new). |
| 20 | `champion` | The Champion | Port Brawler (Boxer), balanced and strong | **Read the Fight**: at each break, he switches his plan (stance, target, weapon use) to the counter of the player's plan for the next round (the player's new pick at that break), using the existing advice/counter logic. Event `read`, only when his plan changes. |

Bosses are data in `src/core/bosses.ts`; their tricks are skill ids (`boss_spare_parts`,
`boss_nine_lives`, `boss_rat_tide`, `boss_read_the_fight`) implemented in `src/core/fight.ts`
like other skills, never offered in upgrade pools. Bosses play cards with the normal bot logic.
Deterministic: tricks use no randomness (or only the fight rng behind the trick check).

## Feats

Feats are data in `src/core/feats.ts`. Each has `id`, `name`, `description`, optional `secret`,
optional `branch`, optional `title` (a title the fighter may wear), an optional `target` number
(for progress display), and a pure `check` that reads the finished fight (the `FightLog`, which
side the player was, the result, and the fighter's running stats) and returns the new progress.
Feats never touch the simulation. Feats are per fighter; completed feats become **medals** on the
fighter. Secret feats show as "???" until completed. Completed feats show a small notice on the
result panel.

Fighter running stats (`FighterStats`): `fights`, `wins`, `kos` (wins by knockout), `streak`
(current win streak), `bestStreak`, `bossLosses` (per boss id).

### General feats (15)

★ = gives a title, ? = secret

| Id | Name | Condition |
|---|---|---|
| `first_blood` | First Blood | Win a fight. |
| `hot_streak` | Hot Streak | Win 5 fights in a row. |
| `unstoppable` ★ | Unstoppable | Win 15 fights in a row. |
| `close_call` ? | Close Call | Win with less than 10% health left. |
| `untouchable` ★ | Untouchable | Win losing less than 10% of your max health. |
| `comeback` | Comeback | Win a fight in which you were below 25% health at a break. |
| `junk_thrower` | Junk Thrower | Knock out a foe with a thrown weapon. |
| `full_hand` | Full Hand | Play 5 cards in one fight. |
| `bare_hands` | Bare Hands | Win without using any weapon. |
| `on_points` | On Points | Win at the end of round 3 without a knockout. |
| `veteran` | Veteran | Fight 100 fights. |
| `knockout_artist` ★ | Knockout Artist | Win 50 fights by knockout. |
| `stubborn` ? | Stubborn | Beat a boss after losing to it 3 times. |
| `prodigy` ? ★ | Prodigy | Beat all four bosses on the first try. |
| `graduate` | Graduate | Beat The Champion. |

### Branch feats (3 per branch, 30)

| Branch | Feats |
|---|---|
| Boxer | reach 5 Rhythm stacks · knock out with Jab Flurry · ★ win 3 fights in a row without your rhythm being reset |
| Brute | knock out with bleed · deal 20 bleed damage in one fight · ★ play Street Bite 3 times in one fight |
| Acrobat | dodge 5 attacks in a row · gain 6 energy from Momentum in one fight · ★ win without taking a melee hit |
| Thief | steal 30 stamina in one fight · play Heist twice in one fight · ★ leave the foe at 0 stamina |
| Wall | knock out with thorns · reflect 30 damage with thorns in one fight · ★ have 3 enemy pets attack you at once under Taunt |
| Wrecker | strip all the foe's armor · knock out with Sledge Swing · ★ break 10 armor in one fight |
| Pack | win with 3 pets alive · knock out with Gang Up · ★ your pets deal more damage than you in one fight |
| Bond | win with all your pets alive · Guardian saves you from a hit that would knock you out · ★ heal 30 with Together in one fight |
| Witch | knock out with burn · burn the foe 3 times in one fight · ★ knock out with Fireball |
| Warden | have a ward of 20 at once · overheal 50 in one fight · ★ win without dropping below 50% health |

Branch feats are only listed (and only progress) for fighters of that branch. Ids:
`<branch>_<short>` (e.g. `boxer_rhythm5`). Titles are short English names chosen at
implementation (e.g. "Iron Fist", "The Untouchable"). If a condition needs information the log
does not carry, the implementation adds the minimal event field needed, without changing what
happens in the fight. Where a condition is ambiguous, the implementer picks the reading that is
checkable from the log and documents it in the feat description.

A fighter wears at most one title: the player picks among earned titles (Fighter tab); default
none.

## Legends hall

`Legend` = a frozen copy of the `Character` at graduation plus `graduatedAt` (ISO date),
`medals`, `title`, `stats`, `bossesBeaten`. Stored in `save.legends` (oldest first).
New bottom tab **Legends** (4th tab): a grid of legend cards (fighter sprite, name, title,
class + branch, origin, number of medals); tapping opens a detail sheet (medals list with names,
bosses beaten/skipped, stats). View only in this sub-project. Empty state: a short line saying
fighters you graduate appear here.

## Architecture

- `src/core/bosses.ts`: `BOSSES` data, `BOSS_LEVELS`, `bossFor(level)`, `gatedBoss(character)`
  (the boss blocking this fighter now, or null), `buildBoss(id)` → opponent `Character`.
- `src/core/feats.ts`: `FEATS` data, `featsFor(character)`, `evaluateFeats(character, fight)` →
  ids newly completed (also updates progress and stats).
- `src/core/legends.ts`: `canGraduate(save)`, `graduate(save)` → moves the character into
  `save.legends`, clears the current fighter so the UI goes to creation.
- `src/core/progression.ts`: `addXp` respects the boss gate; offer size 4 with a rare option
  after a boss win.
- `src/core/game.ts`: `prepareFight` can prepare a boss fight (`PendingFight.bossId`);
  `finishFight` records boss results, evaluates feats, updates stats, returns new medals in
  `FightResult`.
- `src/core/fight.ts`: the four boss tricks.
- `src/core/types.ts`: `Character` gains `bosses?: Record<string, 'beaten' | 'skipped'>`,
  `featProgress?: Record<string, number>`, `medals?: string[]`, `title?: string`,
  `stats?: FighterStats`; `SaveData` gains `legends: Legend[]`; save version 8 with migration.
  Optional fields keep the old shapes readable.
- UI: Fight tab boss card + boss intro screen (name, art, intro line, trick shown as an icon +
  one line) → prefight → fight; Fighter tab feats section (progress, secret "???", title
  picker) and Graduate button with confirm; new `src/ui/tabs/legendsTab.ts`; result panel lists
  new medals; shell gets the 4th tab.

## Testing

- Unit tests per feat with crafted or seeded fight logs (positive and negative case).
- Boss gate: XP stops at each gate level; beating the boss levels up with a 4-option offer
  including a rare option.
- Each boss trick: same seed with and without the trick; fights without bosses unchanged (the
  old-content regression hash test must stay green).
- Migration v7 → v8: fighter kept, lower bosses skipped, legends empty.
- Graduation: only when allowed; legend frozen; new fighter flow.
- `npm run screens` scenarios: Fight tab with a boss, boss intro, Fighter tab feats (incl. a
  secret), Legends tab empty and with legends, result panel with a new medal.
- Balance tool: a `bosses` section reporting first-try win rate of generated fighters of each
  boss level vs that boss; tune boss builds toward 45-55%.

## Out of scope

League, trophies, arenas, trophy road, content locks, cosmetics catalog (sub-projects 2 and 3);
multiple fighters in progress; accounts.
