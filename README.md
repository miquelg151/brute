# Brute

Mobile-first pixel-art auto-battler inspired by El Bruto: build a fighter, read your
opponent, pick a stance and land special strikes in daily fights.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the game at http://localhost:5199 (add `?gallery` for the art gallery) |
| `npm test` | Runs the game-logic tests |
| `npm run balance` | Simulates thousands of fights and reports class, skill and stance balance |
| `npm run build` | Type-checks and builds the production version into `dist/` |

## Where things are

| Folder | Contents |
|---|---|
| `src/core/` | All game rules: fight simulation, progression, opponents, save data. No UI code, so the same code can run on a server later. |
| `src/ui/` | Screens (`screens/`), sprites, minigames, styles helpers |
| `src/fight/` | The Phaser scene that plays a fight replay |
| `public/art/` | Your custom pixel art (see `docs/ART.md`) |
| `tools/` | The balance tool |

Fights are deterministic: the same fighters, seed and player inputs always give the
same result, which is what will let a server verify fights later.
