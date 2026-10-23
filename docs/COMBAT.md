# Combat rules

Fights are simulated by `src/core/fight.ts`. The simulation is deterministic: the same
fighters, seed and player inputs always give the same fight. Player inputs are the
timing of special strikes and the choices made at each break.

## Rounds

- A fight has **3 rounds** of `ROUND_TICKS` ticks each (about 10–15 seconds at x1).
- On every tick each unit's initiative gauge grows by `10 + 2 × speed`; at 100 it acts.
  A fighter's speed above 6 counts half (`10 + 2 × speed − (speed − 6)`), so very fast
  fighters don't get endless turns at high levels. Pets are not capped.
- A fight ends when a main fighter is knocked out. If both are standing after round 3,
  the higher health percentage wins (an exact tie goes to the defender).
- Summoned spirits vanish at the end of each round.

## Breaks

Between rounds each side can:

- change **stance**, **target** and **weapon use**;
- change which weapons it brings (thrown weapons are gone for the rest of the fight);
- choose to **recover**: gains much more stamina and mana, but starts the round late.

In asynchronous fights (against another player's fighter, who is not online) the
opponent decides with simple rules (defend when losing, attack when winning, recover
when tired), and you see its choice before making yours. In live fights between two
connected players, both choose at the same time and neither sees the other's plan.

## Stamina (body)

- Everyone has 100 stamina (gear can change it). It regenerates a little every turn
  and a lot at breaks.
- Physical actions cost stamina: attacks, extra combo/double hits, throws, counters and
  special strikes. Heavy weapons cost more.
- Stance multiplies the cost: Aggressive ×1.5, Defensive ×0.7.
- Below 25 stamina the fighter is **tired**: −25% damage, −10% dodge.
- If it can't pay for an attack, the fighter spends the turn catching its breath.

## Mana and magic

- Only fighters who know spells have mana. It regenerates slowly and at breaks.
- The Mystic's mana grows with level (60 + 1 per level); other fighters who learn a
  spell get a fixed 40.
- Spells cost mana, not stamina.
- Magic damage **ignores armor and shields** and is reduced by **magic resistance**
  (percent, capped at 60%). It can be dodged, but only at 60% of the usual chance.

## Equipment

Each fighter wears one **armor** and one **accessory**, chosen before the fight from the
ones it owns. Equipment is earned through level-up upgrades, like weapons and pets.
Every piece has an upside and often a downside (a riot vest is great armor but slow).

## Small rules worth knowing

- Armor is subtracted from every physical hit. It only counts **half** against pets,
  spirits and quick extra hits (double strikes and counters), because those are many
  small hits.
- **Shield** blocks 25% of physical hits (the hit does a quarter of its damage).
- **Pets first** makes your fighter and your pets attack enemy pets, with +20% damage
  against them.
- At each level-up, at least one of the three choices is a weapon, skill, pet or gear
  piece, as long as there is any left to get.
- **Keep** weapons: hits with a weapon in hand ignore 2 armor (good against tough foes).
- **Throw** weapons: 40% chance per turn to throw; throws can't be dodged or countered.
- **Agile** stance: spells are dodged as easily as hits (normally only 60% as easily).
