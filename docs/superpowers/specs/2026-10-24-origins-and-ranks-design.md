# Origins and ranks — design

Date: 2026-10-24. Status: approved in conversation section by section.

## Why

Origins today are four neighbourhoods with a tiny passive bonus and no effect on looks.
The owner wants them to matter like races in an MMO (without copying one): a distinct
look and a real effect on fights. The owner also wants fighters to look different as they
level up.

## Decisions

| Question | Choice |
|---|---|
| What origins are | Mostly human neighbourhoods with a strong street style, plus two "strange" ones |
| How much they weigh in fights | A slightly bigger passive bonus plus one exclusive origin card |
| How levelling shows | Ranks at levels 1, 5, 10, 15, 20 that add visual details; purely cosmetic |

## Origins

Six origins: the four existing ones keep their ids, two are new. Existing characters keep
their origin.

| Id | Name | Look (origin layer) | Passive | Card (id, cost) | Card effect at level 1 |
|---|---|---|---|---|---|
| `port` | The Port | Anchor tattoos on the arms, wool beanie | +8% health | Weather the Wave (`weather_wave`, 3) | The next 2 hits taken (*count*) do 50% less damage; the reduction grows 5 points per card level above 1 (55%, 60%...), capped at 70% |
| `rooftops` | The Rooftops | Hood, scarf over the mouth, climbing gloves | +6% dodge | Leap (`leap`, 3) | Dodge the next attack for sure and strike back at once with +20% (*scaled*) |
| `metro` | The Metro | Headphones round the neck, graffiti patches | +30 starting initiative each round | Last Train (`last_train`, 3) | The next 2 turns (*count*) come sooner: the turn gauge gains +40 (*scaled*) after each of them |
| `industrial` | Industrial Zone | Welding goggles on the forehead, oil stains, apron | +2 armor | Scrap Shield (`scrap_shield`, 4) | A barrier absorbing 15 (*scaled*) physical damage (not magic) until the end of the round |
| `sewers` | The Sewers (strange) | Mutants: greenish skin patches, glowing eyes, pointed ears | Heal 1 health per turn | Toxic Spit (`toxic_spit`, 4) | Poison: the enemy fighter loses 4 (*scaled*) health at the start of each of their next 3 turns; ignores armor |
| `scrapyard` | The Scrapyard (strange) | Half-robots: metal plate on the jaw or arm, an LED eye | +1 armor and +10% magic resistance | Power Surge (`power_surge`, 5) | An electric hit (normal damage) that makes the enemy fighter skip their next turn |

Numbers above are the first proposal; the tuned values live in docs/COMBAT.md (Origins section).

Rules:

- Origin cards are starting cards: every fighter starts with three cards — Special Strike,
  the class card and the origin card. The deck stays at 4 (one free slot for a won card).
- Origin cards level up by use like every card (+10% per level to *scaled* numbers, counts
  +1 at level 4) and are never offered at level-ups.
- All numbers are a first proposal; the balance pass may change them (the owner accepted
  tuned values for cards).
- Bots use origin cards with the existing rules: Weather the Wave, Leap and Scrap Shield
  count as defences (answering an enemy's offensive card); the others are spent like any
  card.

## Ranks

| Rank | Levels | What the rank layer adds |
|---|---|---|
| Rookie | 1-4 | Nothing |
| Regular | 5-9 | Wrist wraps and patches sewn on the clothes |
| Veteran | 10-14 | A chain necklace, knee pads and a scar |
| Champion | 15-19 | Bandaged arms, a medal and shoulder pads |
| Legend | 20+ | A gold champion belt and a soft gold aura around the fighter |

- Ranks are cosmetic: no effect on fights.
- A rank badge (the rank name with a small icon) sits next to the fighter's name on the home
  screen and on the pre-fight poster for both fighters.
- Reaching a new rank shows a celebration on the level-up screen ("You are now a Veteran!").
- The Legend aura: a gold glow behind the sprite on DOM screens and in the arena.

## Art

- Two new fighter layers, drawn after the class `extra` layer, full colour, 5-frame strips
  like every layer: `fighter.origin` (one file per origin id) and `fighter.rank` (one file
  per rank 2-5; rank 1 has none). Manifest entries are added the same way as the others.
- Starting art is generated only for these new layers. Existing PNGs (including the owner's
  retouched `body.png`, `crow.png`, `dog.png`, `bat.png`) are never overwritten.
- `docs/ART.md` documents the two layers, their order and the rank levels.

## How it is built

- `ORIGINS` in `src/core/catalog.ts` gains `sewers` and `scrapyard`, and fields `hpRegen`,
  `magicResist` and `card` (the origin card id). Existing fields keep their meaning;
  `port` hpPercent 6 → 8, `industrial` armor 1 → 2, `metro` initiative 30 stays.
- `src/core/cards.ts`: six origin cards with `pool: 'origin'` (never offered at level-ups)
  and `startingCards(classId, originId)` returning three ids.
- `src/core/fight.ts`: new unit state for the origin cards (damage halving count and percent,
  leap, extra-gauge turns, physical barrier, poison turns and damage, skip-next-turn) and
  the origin passives (heal per turn, magic resistance).
- `rankOf(level)` in core (pure), names and level thresholds in one table.
- Save format 5 → 6: characters gain their origin card in `cards`.
- UI: origin choice with live preview and the origin card shown on the creation screen; rank
  badge on home and the pre-fight poster; level-up rank celebration; Legend aura.

## Balance and tests

- Re-measure classes, cards (origin cards included) and advice; add an `origins` section
  (each origin's average win rate across classes, target 45-55%).
- Unit tests: each origin card, the two new passives, `rankOf`, save migration 5 → 6, the
  creation screen keeps working with six origins.

## Out of scope

Visible gear (armor and accessories drawn on the fighter), more strange origins, origin
voice lines or sounds.
