import { describe, expect, it } from 'vitest';
import {
  CARDS,
  CLASS_IDS,
  DEFAULT_PLAN,
  Rng,
  UPGRADES,
  UPGRADES_BY_ID,
  eligibleUpgrades,
  addXp,
  applyUpgrade,
  botCardLevel,
  cardLevel,
  chooseUpgrade,
  createCharacter,
  generateOpponent,
  mixSeed,
  finishFight,
  loadoutFor,
  newGame,
  prepareFight,
  recordPlay,
  migrateSave,
  recordBreak,
  rollOffer,
  scaled,
  scaledCount,
  startingCards,
  traitsOf,
  usesForLevel,
  simulateFight,
  gearFor,
  type BreakChoice,
  type CardPlay,
  type Character,
  startFight,
  runFight,
  xpToNext,
  type Appearance,
  type FightLog,
  type SaveData,
} from './index';

const look: Appearance = { skinTone: 0, hairStyle: 0, hairColor: 0, outfitColor: 0 };

const keep = (weapons: string[], recover = false): BreakChoice => ({ ...DEFAULT_PLAN, weapons, recover });

/** Plays a whole fight like the UI does, playing no cards; every break keeps the plan. */
function playAuto(save: SaveData) {
  if (!prepareFight(save)) return null;
  startFight(save, DEFAULT_PLAN, save.character.weapons);
  for (let log = simulateFight(save); log.winner === null; log = simulateFight(save)) recordBreak(save, keep(save.character.weapons));
  return finishFight(save);
}

/** Runs an interactive fight for side a to the end with the given plays, keeping the plan at breaks. */
function playThrough(a: Character, b: Character, seed: number, plays: CardPlay[] = [], recover = false) {
  const breaks: BreakChoice[] = [];
  for (;;) {
    const log = runFight(a, b, seed, { a: { interactive: true, plays, breaks } });
    if (log.winner !== null) return { log, breaks };
    breaks.push(keep(a.weapons, recover));
  }
}

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('int stays in range', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(-3, 4);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(4);
    }
  });

  it('mixSeed differs for different inputs', () => {
    expect(mixSeed(1, 1)).not.toBe(mixSeed(1, 2));
    expect(mixSeed(1, 1)).toBe(mixSeed(1, 1));
  });
});

describe('runFight', () => {
  const a = generateOpponent(8, new Rng(1), 'brawler');
  const b = generateOpponent(8, new Rng(2), 'tamer');

  it('same characters and seed give the same log', () => {
    expect(runFight(a, b, 123)).toEqual(runFight(a, b, 123));
  });

  it('does not mutate the characters', () => {
    const before = JSON.stringify([a, b]);
    runFight(a, b, 5);
    expect(JSON.stringify([a, b])).toBe(before);
  });

  it('a fight that ends by death kills the loser main fighter', () => {
    for (let seed = 0; seed < 200; seed++) {
      const log = runFight(a, b, seed);
      const loserMain = log.roster.findIndex((u) => u.isMain && u.team !== log.winner);
      const died = log.events.some((e) => e.t === 'death' && e.actor === loserMain);
      const winnerMain = log.roster.findIndex((u) => u.isMain && u.team === log.winner);
      expect(log.events.some((e) => e.t === 'death' && e.actor === winnerMain)).toBe(false);
      if (died) expect(log.events.at(-1)).toEqual({ t: 'death', actor: loserMain });
    }
  });

  it('hp in events never goes below zero or above max', () => {
    for (let seed = 0; seed < 100; seed++) {
      const log: FightLog = runFight(a, b, seed);
      for (const e of log.events) {
        if (e.t === 'hit' || e.t === 'block' || e.t === 'heal') {
          const unit = log.roster[e.t === 'heal' ? e.actor : e.target]!;
          expect(e.hp).toBeGreaterThanOrEqual(0);
          expect(e.hp).toBeLessThanOrEqual(unit.maxHp);
        }
      }
    }
  });

  it('tamer brings its pet into the roster', () => {
    const log = runFight(a, createCharacter('T', look, 'tamer', 'port'), 1);
    expect(log.roster.filter((u) => u.team === 1).map((u) => u.defId)).toEqual(['tamer', 'dog']);
  });
});

describe('progression', () => {
  it('addXp levels up and keeps the remainder', () => {
    const c = createCharacter('A', look, 'parkour', 'metro');
    const gained = addXp(c, xpToNext(1) + 1);
    expect(gained).toBe(1);
    expect(c.level).toBe(2);
    expect(c.xp).toBe(1);
  });

  it('offers are distinct and never include owned items', () => {
    const rng = new Rng(9);
    for (const classId of CLASS_IDS) {
      const c = generateOpponent(15, rng, classId);
      for (let i = 0; i < 50; i++) {
        const offer = rollOffer(c, rng);
        expect(offer).toHaveLength(3);
        expect(new Set(offer).size).toBe(3);
        for (const id of offer) {
          const u = UPGRADES_BY_ID[id]!;
          if (u.kind === 'skill') expect(c.skills).not.toContain(u.ref);
          if (u.kind === 'weapon') expect(c.weapons).not.toContain(u.ref);
          if (u.kind === 'pet') expect(c.pets).not.toContain(u.ref);
        }
      }
    }
  });

  it('offers are biased towards the class pool', () => {
    const rng = new Rng(3);
    const c = createCharacter('B', look, 'bouncer', 'port');
    let classSlots = 0;
    let total = 0;
    for (let i = 0; i < 2000; i++) {
      const offer = rollOffer(c, rng);
      classSlots += offer.filter((id) => UPGRADES_BY_ID[id]!.pool === 'bouncer').length;
      total += offer.length;
    }
    const share = classSlots / total;
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.7);
  });

  it('offers include a weapon, skill, pet or gear while any are left', () => {
    const rng = new Rng(5);
    for (const classId of CLASS_IDS) {
      for (const level of [5, 20, 40]) {
        const c = generateOpponent(level, rng, classId);
        const left = UPGRADES.some((u) => u.kind !== 'stat' && (u.pool === classId || u.pool === 'general') && eligibleUpgrades(c, u.pool).includes(u));
        for (let i = 0; i < 30; i++) {
          const offer = rollOffer(c, rng);
          const hasOther = offer.some((id) => UPGRADES_BY_ID[id]!.kind !== 'stat');
          expect(hasOther).toBe(left);
        }
      }
    }
  });

  it('applyUpgrade rejects duplicates', () => {
    const c = createCharacter('C', look, 'tamer', 'port');
    expect(() => applyUpgrade(c, 'pet:dog')).toThrow();
  });
});

describe('game', () => {
  it('plays fights, levels up and requires choosing an upgrade', () => {
    const save = newGame('Me', look, 'brawler', 'port', 77);
    while (save.pendingLevelUps === 0) playAuto(save);
    expect(prepareFight(save)).toBeNull();
    const offer = save.offer!;
    expect(offer).toHaveLength(3);
    chooseUpgrade(save, offer[0]!);
    expect(save.offer).toBeNull();
    expect(save.pendingLevelUps).toBe(0);
  });

  it('a save survives a JSON round trip and stays deterministic', () => {
    const save = newGame('Me', look, 'parkour', 'rooftops', 5);
    const copy = JSON.parse(JSON.stringify(save));
    expect(playAuto(save)).toEqual(playAuto(copy));
  });

  it('cannot choose an upgrade that is not offered', () => {
    const save = newGame('Me', look, 'parkour', 'rooftops', 5);
    expect(() => chooseUpgrade(save, 'gen_health')).toThrow();
  });

  it('a prepared fight is reused, so the opponent cannot be rerolled', () => {
    const save = newGame('Me', look, 'tamer', 'metro', 9);
    const first = prepareFight(save);
    expect(prepareFight(save)).toBe(first);
  });

  it('fights are unlimited', () => {
    const save = newGame('Me', look, 'tamer', 'metro', 9);
    for (let i = 0; i < 12; i++) {
      if (save.pendingLevelUps > 0) chooseUpgrade(save, save.offer![0]!);
      expect(playAuto(save)).not.toBeNull();
    }
  });

  it('tactics and deck are locked once the fight starts', () => {
    const save = newGame('Me', look, 'bouncer', 'port', 3);
    prepareFight(save);
    startFight(save, { stance: 'defensive', target: 'pets', weaponStyle: 'keep' }, [], undefined, ['wall']);
    const locked = startFight(save, DEFAULT_PLAN, ['bat'], undefined, ['special', 'wall']);
    expect(locked).toEqual({
      stance: 'defensive',
      target: 'pets',
      weaponStyle: 'keep',
      weapons: [],
      gear: { armor: null, accessory: null },
      deck: ['wall'],
    });
  });

  it('played cards gain uses and can level up', () => {
    const save = newGame('Me', look, 'brawler', 'port', 21);
    save.character.cardUses.rage = 2;
    prepareFight(save);
    startFight(save, DEFAULT_PLAN, []);
    recordPlay(save, { tick: 4, card: 'rage' });
    for (let log = simulateFight(save); log.winner === null; log = simulateFight(save)) recordBreak(save, keep([]));
    const result = finishFight(save);
    expect(result.cardsPlayed.rage).toBe(1);
    expect(save.character.cardUses.rage).toBe(3);
    expect(result.cardLevelUps).toEqual([{ card: 'rage', level: 2 }]);
  });

  it('a version 4 save is migrated, keeping the fighter', () => {
    const v4 = { version: 4, seed: 1, fightCount: 3, character: { ...createCharacter('Old', look, 'parkour', 'port') }, daily: { day: 5, used: 2 }, pendingLevelUps: 0, offer: null, pendingFight: null };
    delete (v4.character as Partial<Character>).cards;
    delete (v4.character as Partial<Character>).cardUses;
    const save = migrateSave(JSON.parse(JSON.stringify(v4)))!;
    expect(save.version).toBe(5);
    expect(save.character.name).toBe('Old');
    expect(save.character.cards).toEqual(['special', 'roll']);
    expect(save.character.cardUses).toEqual({});
    expect('daily' in save).toBe(false);
    expect(migrateSave({ version: 1 })).toBeNull();
  });
});

describe('energy and cards', () => {
  const a = generateOpponent(10, new Rng(11), 'brawler');
  const b = generateOpponent(10, new Rng(12), 'bouncer');
  const energyOf = (log: FightLog, actor: number) => log.events.filter((e) => e.t === 'energy' && e.actor === actor).map((e) => (e.t === 'energy' ? e.energy : 0));

  it('energy starts at 3, fills one point every 4 ticks and never passes 10', () => {
    const { log } = playThrough(a, b, 42);
    const first = log.events.find((e) => e.t === 'energy' && e.actor === 0);
    expect(first).toEqual({ t: 'energy', actor: 0, energy: 3 });
    expect(Math.max(...energyOf(log, 0))).toBeLessThanOrEqual(10);
    const tick8 = log.events.findIndex((e) => e.t === 'tick' && e.n === 8);
    const at8 = log.events.slice(0, tick8 + 2).filter((e) => e.t === 'energy' && e.actor === 0).at(-1);
    expect(at8).toMatchObject({ energy: 5 });
  });

  it('a play is applied at its tick and leaves earlier events identical', () => {
    const before = playThrough(a, b, 42).log;
    const plays = [{ tick: 6, card: 'rage' }];
    const after = playThrough(a, b, 42, plays).log;
    const cut = before.events.findIndex((e) => e.t === 'tick' && e.n === 6);
    expect(after.events.slice(0, cut + 1)).toEqual(before.events.slice(0, cut + 1));
    // A level-10 fighter's default deck is at bot level 3.
    expect(after.events.slice(cut + 1).find((e) => e.t === 'card' && e.actor === 0)).toEqual({ t: 'card', actor: 0, card: 'rage', level: 3 });
  });

  it('a play without enough energy does nothing', () => {
    const { log } = playThrough(a, b, 42, [{ tick: 1, card: 'special', quality: 100 }]);
    expect(log.events.some((e) => e.t === 'card' && e.actor === 0)).toBe(false);
  });

  it('the special strike card makes the next attack an undodgeable special', () => {
    const { log } = playThrough(a, b, 42, [{ tick: 8, card: 'special', quality: 90 }]);
    const i = log.events.findIndex((e) => e.t === 'special' && e.actor === 0);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(log.events[i]).toEqual({ t: 'special', actor: 0, quality: 90 });
    expect(log.events[i + 1]).toMatchObject({ actor: 0, kind: 'special' });
    expect(['hit', 'block']).toContain(log.events[i + 1]!.t);
  });

  it('a failed special strike plays a normal turn', () => {
    const { log } = playThrough(a, b, 42, [{ tick: 8, card: 'special', quality: 0 }]);
    expect(log.events.some((e) => (e.t === 'hit' || e.t === 'block') && e.kind === 'special' && e.actor === 0)).toBe(false);
  });

  it('bots play cards on their own', () => {
    const plays = Array.from({ length: 20 }, (_, seed) => runFight(a, b, seed)).flatMap((l) => l.events.filter((e) => e.t === 'card'));
    expect(plays.length).toBeGreaterThan(0);
  });

  it('an empty deck plays nothing', () => {
    const log = runFight(a, b, 3, { a: { deck: {} }, b: { deck: {} } });
    expect(log.events.some((e) => e.t === 'card')).toBe(false);
  });

  it('non-interactive fights never ask for input', () => {
    for (let seed = 0; seed < 50; seed++) expect(runFight(a, b, seed).winner).not.toBeNull();
  });

  it('loadout keeps only owned weapons, at most 3', () => {
    const c = createCharacter('W', look, 'bouncer', 'port');
    c.weapons.push('chain', 'umbrella', 'skateboard');
    expect(loadoutFor(c, ['chain', 'traffic_sign', 'umbrella'])).toEqual(['chain', 'umbrella']);
    expect(loadoutFor(c)).toHaveLength(3);
  });
});

describe('rounds', () => {
  const a = generateOpponent(8, new Rng(31), 'bouncer');
  const b = generateOpponent(8, new Rng(32), 'bouncer');

  it('fights have at most 3 rounds with a break between them', () => {
    for (let seed = 0; seed < 40; seed++) {
      const log = runFight(a, b, seed);
      const rounds = log.events.filter((e) => e.t === 'round').length;
      const breaks = log.events.filter((e) => e.t === 'break').length;
      expect(rounds).toBeGreaterThanOrEqual(1);
      expect(rounds).toBeLessThanOrEqual(3);
      expect(breaks).toBeLessThanOrEqual(rounds - 1 + (log.events.at(-1)?.t === 'death' ? 0 : 1));
    }
  });

  it('at a break the automatic side has already chosen, the player has not', () => {
    const log = runFight(a, b, 1, { a: { interactive: true } });
    const last = log.events.at(-1)!;
    if (last.t !== 'break') return; // the fight ended in round 1
    expect(last.choices[0]).toBeNull();
    expect(last.choices[1]).not.toBeNull();
  });

  it('recovering at a break gives more stamina', () => {
    const staminaAfterBreak = (recover: boolean) => {
      const { log } = playThrough(a, b, 5, [], recover);
      const br = log.events.findIndex((e) => e.t === 'break');
      if (br < 0) return null;
      const res = log.events.slice(br).find((e) => e.t === 'res' && e.actor === 0);
      return res && res.t === 'res' ? res.stamina : null;
    };
    const rested = staminaAfterBreak(true);
    const normal = staminaAfterBreak(false);
    if (rested !== null && normal !== null) expect(rested).toBeGreaterThanOrEqual(normal);
  });

  it('an aggressive stance burns more stamina', () => {
    // Stamina left after the first action, which costs the same base amount in both fights.
    const afterFirst = (stance: 'aggressive' | 'defensive') => {
      const log = runFight(a, b, 9, { a: { stance } });
      const res = log.events.find((e) => e.t === 'res' && e.actor === 0 && e.stamina < 100);
      return res && res.t === 'res' ? res.stamina : 100;
    };
    expect(afterFirst('aggressive')).toBeLessThan(afterFirst('defensive'));
  });
});

describe('magic and gear', () => {
  const mystic = generateOpponent(6, new Rng(41), 'mystic');

  it('mystics cast spells', () => {
    const foe = generateOpponent(6, new Rng(42), 'brawler');
    const casts = Array.from({ length: 20 }, (_, seed) => runFight(mystic, foe, seed)).flatMap((l) => l.events.filter((e) => e.t === 'cast'));
    expect(casts.length).toBeGreaterThan(0);
  });

  it('magic ignores armor but not magic resistance', () => {
    const spellDamage = (target: Character) => {
      const log = runFight(mystic, target, 3);
      return log.events.filter((e) => e.t === 'hit' && e.kind === 'spell' && e.actor === 0).map((e) => (e.t === 'hit' ? e.damage : 0));
    };
    const plain = createCharacter('P', look, 'brawler', 'port');
    const armored = { ...plain, skills: [...plain.skills, 'iron_skin'] };
    const charmed = { ...plain, gear: ['charm'] };
    const base = spellDamage(plain);
    expect(base.length).toBeGreaterThan(0);
    // Armor changes how long the fight lasts, so compare the spells both fights share.
    const withArmor = spellDamage(armored);
    const shared = Math.min(base.length, withArmor.length);
    expect(withArmor.slice(0, shared)).toEqual(base.slice(0, shared));
    expect(spellDamage(charmed).reduce((x, y) => x + y, 0)).toBeLessThan(base.reduce((x, y) => x + y, 0));
  });

  it('spirits vanish at the end of a round', () => {
    const caster = { ...mystic, skills: [...mystic.skills, 'spirit'] };
    for (let seed = 0; seed < 40; seed++) {
      const log = runFight(caster, generateOpponent(6, new Rng(seed), 'bouncer'), seed);
      const spirit = log.roster.findIndex((u) => u.summoned);
      let out = false;
      for (const e of log.events) {
        if (e.t === 'summon' && e.actor === spirit) out = true;
        if ((e.t === 'unsummon' || e.t === 'death') && e.actor === spirit) out = false;
        if (e.t === 'break') expect(out).toBe(false);
      }
    }
  });

  it('only owned gear can be worn, one piece per slot', () => {
    const c = createCharacter('G', look, 'bouncer', 'port');
    c.gear.push('leather_jacket', 'riot_vest', 'charm');
    expect(gearFor(c)).toEqual({ armor: 'leather_jacket', accessory: 'charm' });
    expect(gearFor(c, { armor: 'riot_vest', accessory: 'sneakers' })).toEqual({ armor: 'riot_vest', accessory: null });
  });
});

describe('tactics', () => {
  it('pets first aims only at pets while they live', () => {
    const me = generateOpponent(6, new Rng(21), 'brawler');
    const tamer = createCharacter('T', look, 'tamer', 'port');
    const log = runFight(me, tamer, 8, { a: { target: 'pets' } });
    const dogIdx = log.roster.findIndex((u) => u.defId === 'dog');
    const dogDeath = log.events.findIndex((e) => e.t === 'death' && e.actor === dogIdx);
    const before = dogDeath === -1 ? log.events : log.events.slice(0, dogDeath);
    for (const e of before) if ((e.t === 'hit' || e.t === 'dodge' || e.t === 'block') && e.actor === 0 && e.kind !== 'special') expect(e.target).toBe(dogIdx);
  });

  it('keep style never throws', () => {
    const c = generateOpponent(12, new Rng(4), 'bouncer');
    for (let seed = 0; seed < 50; seed++) {
      const log = runFight(c, generateOpponent(12, new Rng(seed), 'brawler'), seed, { a: { weaponStyle: 'keep' } });
      expect(log.events.some((e) => (e.t === 'hit' || e.t === 'dodge' || e.t === 'block') && e.actor === 0 && e.kind === 'throw')).toBe(false);
    }
  });

  it('traits describe the opponent', () => {
    expect(traitsOf(createCharacter('T', look, 'tamer', 'port'))).toEqual(expect.arrayContaining(['has_pets', 'many_hits']));
    expect(traitsOf(createCharacter('B', look, 'bouncer', 'port'))).toContain('tough');
    expect(traitsOf(createCharacter('P', look, 'parkour', 'port'))).toContain('counters');
  });
});

describe('cards', () => {
  it('levels come from uses', () => {
    expect([0, 2, 3, 7, 8, 14, 15, 24, 25, 99].map(cardLevel)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(usesForLevel(2)).toBe(3);
    expect(usesForLevel(5)).toBe(25);
  });

  it('scaled numbers grow 10% per level, counts by one at level 4', () => {
    expect(scaled(30, 1)).toBe(30);
    expect(scaled(30, 3)).toBe(36);
    expect(scaled(30, 5)).toBe(42);
    expect(scaledCount(2, 3)).toBe(2);
    expect(scaledCount(2, 4)).toBe(3);
  });

  it('every class starts with the special strike and its own card', () => {
    expect(startingCards('brawler')).toEqual(['special', 'rage']);
    expect(startingCards('parkour')).toEqual(['special', 'roll']);
    expect(startingCards('bouncer')).toEqual(['special', 'wall']);
    expect(startingCards('tamer')).toEqual(['special', 'sic_em']);
    expect(startingCards('mystic')).toEqual(['special', 'overcharge']);
  });

  it('every card costs 2-6 energy and describes every level', () => {
    for (const card of Object.values(CARDS)) {
      expect(card.cost).toBeGreaterThanOrEqual(2);
      expect(card.cost).toBeLessThanOrEqual(6);
      for (let level = 1; level <= 5; level++) expect(card.describe(level).length).toBeGreaterThan(5);
    }
  });

  it('bot card levels follow the fighter level', () => {
    expect([1, 4, 5, 10, 19, 20, 40].map(botCardLevel)).toEqual([1, 1, 2, 3, 4, 5, 5]);
  });
});

describe('card upgrades', () => {
  it('new characters own their starting cards with no uses', () => {
    const c = createCharacter('C', look, 'mystic', 'port');
    expect(c.cards).toEqual(['special', 'overcharge']);
    expect(c.cardUses).toEqual({});
  });

  it('non-starting cards are offered in their pool and can be learned once', () => {
    const general = UPGRADES.filter((u) => u.kind === 'card' && u.pool === 'general').map((u) => u.id);
    expect(general).toEqual(expect.arrayContaining(['card:patch_up', 'card:hurl', 'card:rush', 'card:feint', 'card:second_breath']));
    expect(UPGRADES.find((u) => u.id === 'card:rage')).toBeUndefined();
    const c = createCharacter('B', look, 'brawler', 'port');
    applyUpgrade(c, 'card:haymaker');
    expect(c.cards).toContain('haymaker');
    expect(() => applyUpgrade(c, 'card:haymaker')).toThrow();
    expect(eligibleUpgrades(c, 'brawler').some((u) => u.id === 'card:haymaker')).toBe(false);
  });
});

describe('starting cards', () => {
  const brawler = generateOpponent(10, new Rng(51), 'brawler');
  const parkour = generateOpponent(10, new Rng(52), 'parkour');
  const bouncer = generateOpponent(10, new Rng(53), 'bouncer');
  const tamer = generateOpponent(10, new Rng(54), 'tamer');
  const mystic = generateOpponent(10, new Rng(55), 'mystic');
  const deckOf = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));
  const after = (log: FightLog, card: string) => log.events.slice(log.events.findIndex((e) => e.t === 'card' && e.card === card && e.actor === 0));

  it('Rage adds damage to the next 3 turns', () => {
    // Rage costs 4 and a fighter starts with 3 energy, so it is played at tick 4, when the 4th point arrives.
    const hits = (plays: CardPlay[]) => {
      const log = runFight(brawler, bouncer, 7, { a: { interactive: true, deck: deckOf('rage'), plays, breaks: [] }, b: { deck: {} } });
      return log.events.slice(log.events.findIndex((e) => e.t === 'tick' && e.n === 4)).filter((e) => e.t === 'hit' && e.actor === 0).slice(0, 3).map((e) => (e.t === 'hit' ? e.damage : 0));
    };
    const normal = hits([]);
    const raged = hits([{ tick: 4, card: 'rage' }]);
    expect(raged.reduce((s, d) => s + d, 0)).toBeGreaterThan(normal.reduce((s, d) => s + d, 0));
  });

  it('Roll dodges the next 2 attacks for sure', () => {
    const firstTwo = (plays: CardPlay[]) => {
      const log = runFight(parkour, brawler, 9, { a: { interactive: true, deck: deckOf('roll'), plays, breaks: [] }, b: { deck: {} } });
      const from = plays.length > 0 ? after(log, 'roll') : log.events;
      return from.filter((e) => (e.t === 'hit' || e.t === 'dodge' || e.t === 'block') && e.actor !== 0 && 'target' in e && e.target === 0).slice(0, 2);
    };
    const withCard = firstTwo([{ tick: 0, card: 'roll' }]);
    expect(withCard).toHaveLength(2);
    expect(withCard.every((e) => e.t === 'dodge')).toBe(true);
    expect(firstTwo([]).every((e) => e.t === 'dodge')).toBe(false);
  });

  it('Wall blocks the next 3 hits for sure', () => {
    const firstThree = (plays: CardPlay[]) => {
      const log = runFight(bouncer, brawler, 9, { a: { interactive: true, deck: deckOf('wall'), plays, breaks: [] }, b: { deck: {} } });
      // Wall costs 4, so it is played at tick 4; the control run looks from the same tick.
      const from = plays.length > 0 ? after(log, 'wall') : log.events.slice(log.events.findIndex((e) => e.t === 'tick' && e.n === 4));
      return from.filter((e) => (e.t === 'hit' || e.t === 'block') && e.actor !== 0 && e.target === 0 && e.kind !== 'spell').slice(0, 3);
    };
    const withCard = firstThree([{ tick: 4, card: 'wall' }]);
    expect(withCard).toHaveLength(3);
    expect(withCard.every((e) => e.t === 'block')).toBe(true);
    expect(firstThree([]).every((e) => e.t === 'block')).toBe(false);
  });

  it("Sic 'em makes every pet attack at once", () => {
    const log = runFight(tamer, brawler, 4, { a: { interactive: true, deck: deckOf('sic_em'), plays: [{ tick: 0, card: 'sic_em' }], breaks: [] }, b: { deck: {} } });
    const i = log.events.findIndex((e) => e.t === 'card' && e.card === 'sic_em');
    const pets = log.roster.map((u, idx) => (u.team === 0 && !u.isMain ? idx : -1)).filter((idx) => idx >= 0);
    const next = log.events.slice(i + 1, i + 1 + pets.length);
    expect(pets.length).toBeGreaterThan(0);
    for (const e of next) expect(pets).toContain('actor' in e ? e.actor : -1);
  });

  it('Overcharge gives mana and boosts the next spell', () => {
    const log = runFight(mystic, brawler, 2, { a: { interactive: true, deck: deckOf('overcharge'), plays: [{ tick: 4, card: 'overcharge' }], breaks: [] }, b: { deck: {} } });
    const plain = runFight(mystic, brawler, 2, { a: { interactive: true, deck: deckOf('overcharge'), plays: [], breaks: [] }, b: { deck: {} } });
    // Overcharge costs 4, so it is played at tick 4; look at spells after that.
    const firstSpell = (l: FightLog) => l.events.slice(l.events.findIndex((e) => e.t === 'tick' && e.n === 4)).find((e) => e.t === 'hit' && e.kind === 'spell' && e.actor === 0);
    expect((firstSpell(log) as { damage: number }).damage).toBeGreaterThan((firstSpell(plain) as { damage: number }).damage);
  });
});
