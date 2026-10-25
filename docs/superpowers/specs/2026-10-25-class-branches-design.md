# Class branches — design

Date: 2026-10-25. Status: approved in conversation section by section.

## Why

After a few levels every class ends up with nearly the same kit (a Brawler with a dog and
spells). Causes: the general pool holds class-flavoured items (the dog, Flash, Mend, Sixth
Sense, Thrower), each class has only 6-7 own upgrades so they run out around level 10-12, and
40% of offer slots are always general.

## Decisions

| Question | Choice |
|---|---|
| How strict | Strict class identity, with one exception: at level 15 one offer may come from another class (once) |
| How to fill classes | Two branches per class (like MMO specialisations) |
| How a branch is chosen | A one-time choice when reaching level 5 (Regular) |

## Branches

`(new)` = to create; `(from general)` / `(from parkour)` = moved out of another pool.

| Class | Branch (id) | Theme | Items |
|---|---|---|---|
| Brawler | Boxer (`boxer`) | quick chained punches | Iron Fists, Double Strike (from parkour), Jab (new skill), card Haymaker |
| Brawler | Brute (`brute`) | endure and come back | Fury, Second Wind, Thick Skull (new skill), card Headbutt (new) |
| Parkour | Acrobat (`acrobat`) | dodging | Sixth Sense (from general), Wall Run (new skill), card Flurry |
| Parkour | Thief (`thief`) | steal and annoy | Disarm, Quick Start, Thrower (from general), card Pickpocket (new) |
| Bouncer | Wall (`wall`) | defence | Iron Skin, Bulwark (new skill), gear Riot Vest, card Body Slam |
| Bouncer | Wrecker (`wrecker`) | heavy weapons | Heavy Hands, weapons Traffic Sign and Extinguisher, card Ground Pound (new) |
| Tamer | Pack (`pack`) | many pets | Whistle, pet Raccoon, card Stray Dog (Pack Leader and the dog are the Tamer's starting skill/pet) |
| Tamer | Bond (`bond`) | few strong pets | pet Crow, Bond (new skill), Feral (new skill) |
| Mystic | Witch (`witch`) | damage magic | Drain, card Bolt, Arcane Flow (new skill) (Spark is the starting spell) |
| Mystic | Warden (`warden`) | protect and heal | Ward, Mend (from general), Flash (from general), Spirit |

- **Class common** (both branches): the class stat upgrades, the class gear (Fight Gloves,
  Tracksuit, Treat Bag, Rune Hoodie — Riot Vest belongs to Wall), and the starting card.
- **General** (everyone): general stats, normal weapons (bat, chain, skateboard, umbrella),
  Leather Jacket, Sneakers, Lucky Charm, cards Patch Up, Hurl, Rush, Feint, Second Breath.
  No pets, spells or class skills stay general.
- The dog leaves the general pool (only the Tamer has it, from the start).

### New skills (first proposal; balance may tune)

| Skill | Effect |
|---|---|
| Jab (`jab`) | The first attack of each of your turns does +25% damage |
| Thick Skull (`thick_skull`) | +10% max health; below 50% health you take 15% less damage |
| Wall Run (`wall_run`) | Your counters do +50% damage |
| Bulwark (`bulwark`) | Your Shield blocks 40% of the time instead of 25% |
| Bond (`bond`) | When a pet of yours deals damage, you heal 25% of it |
| Feral (`feral`) | Your pets' hits have a 20% chance to do double damage |
| Arcane Flow (`arcane_flow`) | Your spells cost 25% less mana (rounded down) |

### New cards (class cards won at level-ups, in the branch)

| Card | Cost | Effect at level 1 |
|---|---|---|
| Headbutt (`headbutt`, Brute) | 6 | Your next hit does +10% (scaled) and, if it lands, the enemy fighter loses their next turn |
| Pickpocket (`pickpocket`, Thief) | 3 | Steal 2 energy from the enemy fighter (+1 at card level 4) |
| Ground Pound (`ground_pound`, Wrecker) | 5 | Hit every enemy unit (fighter and pets) for 60% (scaled) damage; can't be dodged |

Note: the tuned numbers live in docs/COMBAT.md; this table shows the original design.

## How it plays

- **Levels 1-4:** offers mix class-common and general upgrades; no branch items yet.
- **Level 5:** before the level-up choice, a branch screen shows the class's two branches
  (name, one line, three icons of what's inside). The choice is final. The branch shows next
  to the class ("Brawler · Brute") on the Fighter tab and the pre-fight poster/foe sheet.
- **Level 5 and up:** a class offer slot comes from the fighter's branch or class-common
  items 85% of the time, and from the other branch 15% of the time. The class/general slot
  split (60/40) stays.
- **Level 15:** the offer made for reaching level 15 has one slot from another class
  (any other class's skill, spell, pet, weapon, gear or card the fighter doesn't own),
  labelled "From another class". Once only.
- **Existing fighters** at level 5+ without a branch see the branch screen next time they
  open the game (after any fight in progress). Items they already own stay, even if their
  class could not get them now.
- **Bots** pick a random branch at level 5 and follow the same offer rules (including the
  level-15 cross-class slot).
- Save format 6 → 7: no data loss; `branch` is filled by the player's choice.

## Build

- Data: `BRANCHES` per class (id, name, one-line description, three icon names); each
  `UpgradeDef` gains optional `branch`; pools moved as above.
- Character: `branch?: string`. Core: `needsBranch(c)`, `chooseBranch(c, id)`, offer rules.
- Fight: the 7 skills and 3 cards (rules + `describe` + card icons).
- UI: branch choice screen (full-screen moment, routed after a locked fight and before
  level-up offers), branch label on Fighter tab / pre-fight, "From another class" tag on the
  level-up card. Checked with `npm run screens` at 360×640 and 390×844.

## Balance and tests

- Balance: a `branches` section (each branch's average vs random classes at levels 5, 10, 20,
  target 45-55%; Boxer vs Brute etc. mirrors 40-60%); classes, cards and origins sections
  re-measured; new cards 50-62%.
- Tests: no pets/spells for non-Tamer/non-Mystic classes from offers; branch gating before
  level 5; 85/15 rule (statistically over many rolls); level-15 cross-class slot once; bots
  get branches; save 6 → 7; each new skill and card.

## Out of scope

New pets, new art beyond card icons, re-choosing a branch.
