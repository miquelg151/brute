# Content expansion — design

Date: 2026-10-25. Status: approved in conversation. Sub-project 1 of 3 (then: design pass, then balance).

## Why

Each branch has only 3-4 own upgrades, so by level ~12 a fighter owns them all and later
level-ups are stats only. There are 6 weapons, 3 pets and 8 gear. Goal: each branch gets 6-7
own upgrades and a signature mechanic, plus more general weapons and gear.

## Decisions

| Question | Choice |
|---|---|
| How much | Medium: ~40 new pieces (+3 per branch, +4 weapons, +2 pets, +4 gear) |
| New mechanics | One signature mechanic per branch; the rest are variations of existing ones |

## Per branch (all numbers are first proposals; the balance sub-project tunes them)

| Branch | Signature mechanic | Skill (gives the mechanic) | Card | Item |
|---|---|---|---|---|
| Boxer | **Rhythm**: each landed hit in a row (without taking damage) adds +5% damage, up to 5 stacks (+25%); taking damage resets it | Rhythm (`rhythm`) | Jab Flurry (`jab_flurry`, 4): 3 quick hits at 60% damage each, each adds rhythm (needs no skill) | Boxing Wraps (`boxing_wraps`, accessory): start every round with 2 rhythm stacks |
| Brute | **Bleed**: the target loses N health at the start of each of its next 3 turns (a new bleed refreshes the turns and keeps the higher N); ignores armor | Bone Breaker (`bone_breaker`): landed melee hits have 25% chance to bleed 3 | Street Bite (`street_bite`, 4): a hit; if it lands, bleed 5 (scaled) | Brass Knuckles (`knuckles`, weapon): damage 5, accuracy 10 |
| Acrobat | **Momentum**: each dodge gives +1 card energy (max as usual) | Momentum (`momentum`) | Backflip (`backflip`, 4): the next 2 attacks are dodged for sure (+1 at card level 4) and +2 energy | Spring Sneakers (`spring_sneakers`, accessory): +6% dodge |
| Thief | **Steal**: landed hits have 30% chance to steal 5 stamina from the target | Quick Hands (`quick_hands`) | Heist (`heist`, 4): steal 2 energy (+1 at card level 4) and 15 stamina (scaled) | Switchblade (`switchblade`, weapon): damage 4, accuracy 15 |
| Wall | **Thorns**: an attacker that lands a melee hit on you takes 20% of the damage dealt (at least 1) | Thorns (`thorns`) | Taunt (`taunt`, 3): for your next 2 turns enemy pets must attack you, and your thorns against them are doubled | Dumpster Lid (`dumpster_lid`, armor): +2 armor and 10% thorns (stacks with the skill) |
| Wrecker | **Armor break**: each landed hit removes 1 armor from the target for the rest of the fight (not below 0) | Demolition (`demolition`) | Sledge Swing (`sledge_swing`, 5): a hit (+20%, scaled) that removes 4 armor if it lands | Sledgehammer (`sledgehammer`, weapon): damage 12, accuracy -15, heavy |
| Pack | **Pack bonus**: each pet beyond the first gives all your pets +10% damage | Pack Call (`pack_call`) | Gang Up (`gang_up`, 5): every pet attacks at once and you attack too | Pets Rat (`rat`: health 5, damage 1, agility 8, speed 8) and Pigeon (`pigeon`: health 4, damage 1, agility 12, speed 9) |
| Bond | **Guardian**: while your pet with the most health is alive, it takes 15% of the damage aimed at you | Guardian (`guardian`) | Together (`together`, 4): you and your pets heal 30% (scaled) | Key Collar (`key_collar`, accessory): +80% pet health |
| Witch | **Burn**: the target loses N health at the start of each of its next 3 turns and its heals are halved while burning | Flame (`flame`): your damaging spells burn 3 | Fireball (`fireball`, 5): a spell (5 + magic) that burns 3 (scaled) for sure | Neon Spray (`neon_spray`, accessory): +2 magic |
| Warden | **Overheal**: healing above your max health becomes a ward (absorbs damage), up to 20% of max health | Overflow (`overflow`) | Rune Circle (`rune_circle`, 4): heal 10% (scaled) and raise a ward of 8 + magic | Rune Amulet (`rune_amulet`, accessory): +30% magic resistance |

- The signature mechanic comes from the branch skill; cards and items work on their own (Jab
  Flurry adds rhythm stacks even without the skill, but stacks only give damage with the skill
  or the wraps; Taunt's double thorns needs some thorns).
- Bleed and burn stack with Toxic Spit's poison as separate effects.

## General (everyone)

- Weapons: Brick (`brick`: damage 5, accuracy 0, thrown for +50% extra), Bottle (`bottle`:
  damage 8, accuracy 0, breaks after its first landed hit), Pool Cue (`pool_cue`: damage 4,
  accuracy 20), Crowbar (`crowbar`: damage 8, accuracy -5, heavy).
- Gear: Cap (`cap`, accessory: +4% dodge), Patched Coat (`patched_coat`, armor: +2 armor,
  -1 speed), Backpack (`backpack`, accessory: +1 stamina per turn), Headphones (`headphones`,
  accessory: +1 speed, +2% dodge).

## Build

- Data in `catalog.ts` / `cards.ts` with pools and branches; `GearDef` gains `thorns`,
  `magic`, `startRhythm`; `WeaponDef` gains optional `breaks` and `throwBonusPct`.
- Rules in `fight.ts`; arena feedback in `ReplayScene.ts` (short coloured texts: RHYTHM x3,
  BLEED, +1 ENERGY, STOLEN, THORNS, ARMOR -1, BURN, OVERHEAL), events for the replay.
- Art: PNGs for the 7 new weapons and 2 pets in the existing style (owner can retouch), manifest
  entries, card icons (existing icon names) for the 10 cards; gallery shows them.
- Bots: new cards spent like any card; Backflip and Taunt are defences.

## Checks

- Each branch has 6-7 own upgrades; the general pool has 8 weapons and 7 gear.
- A test per mechanic (with/without on the same seed) and per card, weapon behaviour (bottle,
  brick) and gear field.
- Sanity: no class average outside 35-65% at levels 1/5/10/20 (full tuning is sub-project 3).
- Screens: gallery and card names fit at 360x640 / 390x844.

## Out of scope

Unique icons for every skill/card (design pass), full balance tuning, drawing gear on fighters.
