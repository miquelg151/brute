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
  5 ticks. It is carried over from round to round.
- Each fighter brings a deck of up to 4 cards. Playing a card spends its energy cost.
  A card played on a tick takes effect at the start of the next tick (the play is
  recorded at "current tick + 1"), before anyone acts on that tick.
- Plays only go forward in time: a player's plays are applied in the order they were
  made, and a play with an earlier tick than one already made is ignored (when saving
  and in the simulation). One play per tick.
- Stray Dog can't be played while its dog is still fighting.
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
- Every fighter starts with the Special Strike, its own class card and the card of its
  origin (see Origins below); the others are won at level-ups.
- **Card levels** come from use: level 2 after 3 uses, level 3 after 8, level 4 after 15,
  level 5 after 25. Each level above 1 adds 10% to the card's numbers; counts (hits,
  dodges, blocks) go up by one at level 4. The cost never changes.
- **Bots** bring their first 4 cards at level `1 + fighter level / 5` (max 5). Each
  tick they play at most one card, with these rules in order:
  1. Health below 35% and Patch Up in the deck: Patch Up.
  2. The enemy played Rage, Haymaker, Flurry or a Special Strike in the last 5 ticks
     (a bot sees a card from the next tick on, never in the tick it was played): a
     defence (Wall, Roll, Feint, Weather the Wave, Leap or Scrap Shield) if they have
     one. Roll and Leap are not used against a Special Strike, which can't be dodged.
  3. Energy 8 or more: the card they have played least this fight; among those, the
     most expensive they can afford. Second Breath only counts while their stamina is
     below 50. A bot's Special Strike timing is rolled (40–90%).
  4. Otherwise they wait.

## Origins

Every fighter comes from one of six parts of the city. The origin gives a passive bonus
in every fight and a starting card (the passives are in `ORIGINS` in `catalog.ts`, the
cards in `cards.ts`, their fight rules in `fight.ts`). Card numbers grow with card
level like any other card: +10% per level above 1, counts +1 at level 4.

| Origin | Passive | Card (cost) | At card level 1 | Grows with level |
|---|---|---|---|---|
| The Port | +8% health | Weather the Wave (3) | The next 2 hits you take do 50% less damage. | 5% more softening per level, up to 70%; 3 hits at level 4 |
| The Rooftops | +9% dodge | Leap (3) | Dodge the next attack for sure and strike back with +20%. | the strike-back bonus |
| The Metro | Starts every round with a full turn gauge: acts right away | Last Train (3) | Your next 2 turns come sooner (each one adds 40 to the turn gauge). | the gauge added; 3 turns at level 4 |
| Industrial Zone | +1 armor | Scrap Shield (4) | A barrier that stops 12 physical damage this round. | the damage it stops |
| The Sewers | Heals 1 health at the start of each of its turns | Toxic Spit (4) | Poison: they lose 4 health on each of their next 3 turns. Armor doesn't help. | the poison damage |
| The Scrapyard | +15% magic resistance | Power Surge (6) | A normal hit; if it lands (even blocked), they lose their next turn. | +10% damage per level above 1 |

- Poison changes health directly: it ignores armor, shields and Scrap Shield, and it does
  not trigger Second Wind.
- A stunned fighter (Power Surge) loses that turn entirely: no attack and no stamina,
  mana or health regeneration that turn.
- Leap and Last Train carry over to the next round if they are not used up; Scrap Shield
  ends with the round.
- Leap can be used up by an enemy pet's attack, like Roll.
- Pets and spirits don't get their owner's origin passive.
- **Ranks** (rookie, regular, veteran, champion, legend) only change how a fighter looks
  and is named; they have no effect in fights.

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

- Everyone has up to 100 stamina and starts each fight with 80. It regenerates 2 every turn,
  30 at a break and 70 when the fighter chooses to recover.
- Physical actions cost stamina: attacks, extra combo/double hits, throws, counters and
  special strikes. Heavy weapons cost more.
- Stance multiplies the cost: Aggressive ×1.2, Defensive ×0.7 (Agile ×1).
- Below 40 stamina the fighter is **tired**: −25% damage, −10% dodge.
- If it can't pay for an attack, the fighter spends the turn catching its breath.

## Mana and magic

- Only fighters who know spells have mana. It regenerates 2 every turn, 25 at a
  break and 50 when the fighter chooses to recover.
- The Mystic's mana grows with level (50 + 1 per level); other fighters who learn a
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
