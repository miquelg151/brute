# Visual pass A: screens, icons instead of text, readability

Date: 2026-10-30. Owner approved every decision below in the brainstorming session.

## Context

The owner chose a visual design pass before the Legends League. It is split in two:

- **A (this spec)**: screens, icons instead of words, use of space and readability. Code
  only, using the icons that already exist.
- **B (later spec)**: a unique icon for every skill, spell, gear piece and card (~70 new
  icons; a card shares the icon of the skill or item it comes from). B comes after A so
  the icon slots already have their final size.

Findings from screenshots at 360x640 and 390x844 that A fixes:

- Stance / Target / Weapon use buttons are words only, and long names wrap
  ("Aggressive ✓" takes two lines).
- The stat row (heart, grey diamond, feather, banana, blue diamond) has no labels and
  no way to learn what each icon means.
- The Fighter tab is a tall list: one row per kind, each with a big category icon.
- The fight screen, the level-up screen and the create-class step leave big empty
  areas on a 390x844 phone.
- The "New card" / "New skill" sticker (dark lettering on paper) is hard to read.
- The boss card's text pushes the Challenge button far down.
- The Bouncer class title (mist colour) is unreadable on paper.

Out of scope: new icon art (B), the Cards tab layout (its empty space fills as the
collection grows), game rules.

## 1. Option buttons with icons

`optionGroup` in `src/ui/plan.ts` (used by the pre-fight Plan tab and by the break
sheet in the fight) draws each option as **icon on top, short word below**. The ✓ for
"strong vs this foe" sits in the button's top-right corner. The word never wraps: a
CSS fit (like the card names' `--name-fit`) shrinks a long word to fit one line at
360 px. The detail strip under the row stays as it is.

Each option gets an existing icon, in one map next to `TRAIT_ICONS` in `icons.ts` so
the owner can change it in one place:

| Group | Option | Icon |
|---|---|---|
| Stance | Balanced | `stance` |
| | Aggressive | `rage` |
| | Defensive | `armor` |
| | Agile | `dodge` |
| Target | Mixed | `target` |
| | Fighter first | `fist` |
| | Pets first | `pet` |
| Weapon use | Normal | `weapon` |
| | Throw | `fast` |
| | Keep | `lock` |


## 2. Stats you can tap

`statRow` in `icons.ts` keeps its icons and numbers with no labels. Each cell becomes a
button: tapping it shows a short note under the row (same style as the option detail
strip), for example "Strength: more damage per hit". Tapping it again, or another cell,
changes or hides the note. One note text per stat, in one map in `describe.ts`.
Redrawing the strength icon (a fist or arm instead of a grey diamond) belongs to B.

## 3. Fighter tab as one grid

`src/ui/tabs/fighterTab.ts` shows all owned pieces in **one 4-column grid**, grouped by
kind (Weapons, Pets, Gear, Skills). Each group starts with a small header made of its
icon and name, instead of the big icon in the left column. Tiles are smaller than now
and keep a small name under them (until B gives skills unique icons, names are the only
way to tell them apart). Tapping a tile keeps its current behaviour (read the detail).
Groups with nothing owned are hidden, as now.

## 4. Fight screen: big cards at the bottom

In `src/ui/screens/fight.ts` and its CSS, the hand of cards moves down to the bottom
edge (thumb zone) and the cards grow to fill the width (up to 4 per row). The energy bar
and the speed / pause buttons sit right above the cards. The arena keeps its size and
position. On 360x640 everything still fits with no page scroll.

## 5. Level-up and create-class spacing

- **Level-up** (`src/ui/screens/levelup.ts`): on tall screens, the fighter and the three
  offer cards grow and spread over the full height, with the offers in the lower half.
  On 360x640 it stays as now (it already fills the screen).
- **Create, Class step** (`src/ui/screens/create.ts`): the class card sits right under
  the fighter, with no empty gap between them. Next stays at the bottom.

## 6. Readability details

- **Kind tag** ("New card", "Skill", "Weapon"… from `describe.ts`): a coloured pill
  (light coloured background, dark plain text) instead of dark sticker lettering.
- **Boss card** (`src/ui/tabs/fightTab.ts`): the boss trick is clamped to 2 lines
  (tapping the text shows it whole); "Beat the boss to level up" becomes a small tag.
  The Challenge button moves up as a result.
- **Bouncer title**: the class colour used for text on paper gets a darker shade so it
  is readable (`src/ui/palette.ts`; the light mist colour stays for non-text uses).

## Testing

- Existing tests (`npm test`) stay green; no rule changes.
- New scenarios in `tools/screens.json`, run at 360x640 and 390x844, each with an
  automatic check that throws if something is wrong:
  - pre-fight Plan and the break sheet: no option word wraps or overflows its button;
  - Fighter tab with many pieces (`rich`): no page scroll at 390x844 for a level 10
    fighter, tiles in 4 columns;
  - stat tap: the note appears and names the stat;
  - fight: cards are at the bottom, nothing scrolls, cards don't overlap the arena;
  - level-up and create-class at both sizes: no scroll, no overflow;
  - boss card: Challenge button is visible without scroll at 360x640.
- Before reporting done: look at every new screenshot at both sizes.

## Owner's editing

Every new icon choice lives in one map in `icons.ts`, every note text in `describe.ts`,
and colours stay in `theme.ts` / `palette.ts`, so the owner can change them in one place.
`docs/GUIA-PER-A-MIQUEL.md` gets a short line about where the option icons and stat
notes live.
