# Combat rules

Fights are simulated by `src/core/fight.ts`. The simulation is deterministic: the same
fighters, seed and player inputs always give the same fight. Player inputs are the
cards played (with the tick each one was played on and the Special Strike's timing) and
the choices made at each break.

## Rounds

- A fight has **3 rounds** of 45 ticks each (`ROUND_TICKS`).
- On every tick each unit's initiative gauge grows by `10 + 2 × speed`; at 100 it acts.
  A fighter's speed above 8 counts half (`10 + 2 × speed − (speed − 8)`), so very fast
  fighters don't get endless turns at high levels. Pets are not capped.
- A fight ends when a main fighter is knocked out. If both are standing after round 3,
  the higher health percentage wins (an exact tie goes to the defender).
- Summoned spirits vanish at the end of each round.

## Energy and cards

- Each fighter has **energy**, from 0 to 10. It starts at 3 and fills one point every
  7 ticks. It is carried over from round to round.
- Each fighter brings a deck of up to 4 cards. Playing a card spends its energy cost.
  A card played on a tick takes effect at the start of the next tick (the play is
  recorded at "current tick + 1"), before anyone acts on that tick.
- Effects that wait for "your next attack / next turn / next hits" last until used, even
  across rounds.

| Card | Cost | Who gets it | At card level 1 |
|---|---|---|---|
| Special Strike | 5 | everyone (starting) | Time it well: your next attack does up to +60% and can't be dodged. |
| Rage | 4 | Brawler (starting) | +30% damage on your next 3 turns. |
| Roll | 3 | Parkour (starting) | Dodge the next 2 attacks for sure. |
| Wall | 5 | Bouncer (starting) | Block the next hit for sure. |
| Sic 'em | 3 | Tamer (starting) | Every pet attacks right now with +100% damage. |
| Overcharge | 4 | Mystic (starting) | +10 mana and your next spell does +30%. |
| Patch Up | 4 | any class | Heal 10% of your health. |
| Hurl | 3 | any class | Throw your weapon now for 200% damage. |
| Rush | 2 | any class | Act right away. |
| Feint | 3 | any class | Their next attack misses and your next one does +20%. |
| Second Breath | 2 | any class | +40 stamina. |
| Haymaker | 4 | Brawler | Your next hit does +80% and can't be dodged. |
| Flurry | 5 | Parkour | Your next turn strikes 3 times at 90% damage each. |
| Body Slam | 5 | Bouncer | A heavy hit (+40%) that pushes their next turn back. |
| Stray Dog | 6 | Tamer | A dog with 100% health joins until the round ends. |
| Bolt | 5 | Mystic | A spell that can't be dodged and does +30%. |

- The Special Strike shows a timing bar: the better the timing, the bigger the bonus.
  Below 25% timing it fails and the turn plays normally. It costs 20 stamina.
- Every class starts with the Special Strike and its own class card; the others are won
  at level-ups.
- **Card levels** come from use: level 2 after 3 uses, level 3 after 8, level 4 after 15,
  level 5 after 25. Each level above 1 adds 10% to the card's numbers; counts (hits,
  dodges, blocks) go up by one at level 4. The cost never changes.
- **Bots** bring their first 4 cards at level `1 + fighter level / 5` (max 5). Each
  tick they play at most one card, with these rules in order:
  1. Health below 35% and Patch Up in the deck: Patch Up.
  2. The enemy played Rage, Haymaker, Flurry or a Special Strike in the last 5 ticks: a
     defence (Wall, Roll or Feint) if they have one. Roll is not used against a Special
     Strike, which can't be dodged.
  3. Energy 8 or more: the card they have played least this fight; among those, the
     most expensive they can afford. A bot's Special Strike timing is rolled (40–90%).
  4. Otherwise they wait.

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
- Stance multiplies the cost: Aggressive ×1.3, Defensive ×0.7.
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
- **Throw** weapons: 50% chance per turn to throw; throws can't be dodged or countered.
- **Agile** stance: spells are dodged as easily as hits (normally only 60% as easily).
