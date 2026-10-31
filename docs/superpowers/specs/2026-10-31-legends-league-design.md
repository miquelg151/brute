# Sub-project 2: Legends League and trophy road

Date: 2026-10-31. Owner approved every decision below in chat.

Graduated fighters (legends) keep playing in a league. Wins earn trophies; trophies move
the player through 5 district arenas along a trophy road. The road unlocks new content
for future fighters (sideways, not stronger) and titles. No power carries over.

## 1. League tab

A fifth tab, **League** (trophy icon), shown in the tab bar only when the save has at
least one legend. From top to bottom:

- trophies, the current arena name and the league title (highest road title earned);
- the legend picker: one legend at a time with ◀ ▶, its portrait, name, class line;
- **Play match**;
- the trophy road: every stop with its trophies and reward, reached stops ticked, the
  next one highlighted.

## 2. A match

- `prepareLeagueFight(save, legendIndex)` makes a pending fight with
  `league: { legend: legendIndex }`. Same flow as a normal fight: pre-fight screen (plan,
  weapons, gear, deck, all from the legend's own items), then the fight replay with
  cards and breaks.
- The fighter in a league fight is the legend's character (`fighterOf(save)`). The
  legend never changes: no XP, no card uses, no record, no feats. Only the remembered
  deck is saved on it.
- Win: +30 trophies. Loss: -20, never below the floor of the arena the player is in
  (the highest arena reached by trophies stays as the floor).
- The main fighter in progress is untouched. League fights use their own seed counter.
- League fights can start only when nothing else is pending (no fight, no level-up).

## 3. Rivals

Level 20 bots of a random class, branch and origin (`generateOpponent`), built with the
content unlocked up to the arena. Per arena they get +0 / +4 / +8 / +12 / +16 % of their
stats (rounded) as extra bonus stats. From arena 3 on, their plan is
`counterPlan(legend, DEFAULT_PLAN, random plan)`, like the Champion.

## 4. Arenas and the road (a stop every 150 trophies)

| Trophies | Arena / stop | Reward |
|---|---|---|
| 0 | 1. Back Alley | start |
| 150 | | title "Alley Cat" |
| 300 | 2. The Docks | card Cheap Shot |
| 450 | | title "Dock Boss" |
| 600 | 3. Subway | gear Bike Helmet |
| 750 | | title "Tunnel Rat" |
| 900 | 4. Rooftops | card Smoke Bomb |
| 1050 | | title "Skyline Runner" |
| 1200 | 5. Neon Strip | gear Neon Jacket |
| 1500 | final | card Crowd Favourite + title "King of the Strip" |

Rewards are claimed automatically the first time the trophies reach the stop (best
trophies ever). The fight result shows trophies won or lost, a new arena and new rewards.

## 5. New content (general pool, any class)

- **Cheap Shot** (card, 3 energy): your next hit ignores armor and does +10% damage
  (scaled).
- **Bike Helmet** (gear, armor slot): +1 armor, +3% dodge.
- **Smoke Bomb** (card, 4 energy): the enemy is blinded (next attack misses) and you
  dodge the next attack for sure (2 at card level 4).
- **Neon Jacket** (gear, armor slot): +2 magic, +15 magic resistance.
- **Crowd Favourite** (card, 4 energy): heal 8% of max health (scaled) and gain 2 energy.

Locked content is never offered at level-ups and bots outside the league never get it.
A fighter created after an unlock copies the save's unlocked list into
`character.unlocked`; level-up offers include unlocked content. The fighter already in
progress does not get it. Every item gets its own icon.

## 6. Save

Save version 9 adds `league: { trophies, best, fights, rewards: string[], unlocked:
string[] }`. Migration from 8 starts at 0. `newGame` takes the unlocked list (kept with
the legends when the fighter graduates or is deleted).

## 7. Tests

Core: trophies, arena floors, road rewards claimed once, unlocked content offered only
when unlocked, league fight leaves the legend unchanged, bot strength per arena, the
three card effects, save migration 8→9. UI checks: League tab hidden without legends,
League tab and a league match fit at 360×640 and 390×844. Balance run with the new
cards.
