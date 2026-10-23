import { describe, expect, it } from 'vitest';
import {
  CARDS,
  CLASS_IDS,
  DEFAULT_PLAN,
  FIGHTS_PER_DAY,
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
  fightsLeft,
  generateOpponent,
  mixSeed,
  finishFight,
  loadoutFor,
  newGame,
  prepareFight,
  recordWarmup,
  recordBreak,
  recordSpecial,
  rollOffer,
  scaled,
  scaledCount,
  startingCards,
  traitsOf,
  usesForLevel,
  simulateFight,
  gearFor,
  type BreakChoice,
  type Character,
  startFight,
  warmupBonus,
  runFight,
  useFight,
  xpToNext,
  type Appearance,
  type FightLog,
  type SaveData,
} from './index';

const look: Appearance = { skinTone: 0, hairStyle: 0, hairColor: 0, outfitColor: 0 };

const keep = (weapons: string[], recover = false): BreakChoice => ({ ...DEFAULT_PLAN, weapons, recover });

/** Plays a whole daily fight like the UI does: every special gets `quality`, every break keeps the plan. */
function playAuto(save: SaveData, day: number, quality = 50) {
  if (!prepareFight(save, day)) return null;
  startFight(save, DEFAULT_PLAN, save.character.weapons);
  for (let log = simulateFight(save); log.winner === null; log = simulateFight(save)) {
    const last = log.events.at(-1)!;
    if (last.t === 'special') recordSpecial(save, quality);
    else recordBreak(save, keep(save.character.weapons));
  }
  return finishFight(save);
}

/** Runs an interactive fight for side a to the end, answering everything the same way. */
function playThrough(a: Character, b: Character, seed: number, quality: number, recover = false) {
  const specials: number[] = [];
  const breaks: BreakChoice[] = [];
  for (;;) {
    const log = runFight(a, b, seed, { a: { interactive: true, specials, breaks } });
    if (log.winner !== null) return { log, specials, breaks };
    const last = log.events.at(-1)!;
    if (last.t === 'special') specials.push(quality);
    else breaks.push(keep(a.weapons, recover));
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

  it('daily fights reset on a new day', () => {
    const d = { day: -1, used: 0 };
    for (let i = 0; i < FIGHTS_PER_DAY; i++) expect(useFight(d, 100)).toBe(true);
    expect(useFight(d, 100)).toBe(false);
    expect(fightsLeft(d, 101)).toBe(FIGHTS_PER_DAY);
    expect(useFight(d, 101)).toBe(true);
  });
});

describe('game', () => {
  it('plays fights, levels up and requires choosing an upgrade', () => {
    const save = newGame('Me', look, 'brawler', 'port', 77);
    let day = 1;
    while (save.pendingLevelUps === 0) {
      if (!playAuto(save, day)) day++;
    }
    expect(prepareFight(save, day)).toBeNull();
    const offer = save.offer!;
    expect(offer).toHaveLength(3);
    chooseUpgrade(save, offer[0]!);
    expect(save.offer).toBeNull();
    expect(save.pendingLevelUps).toBe(0);
  });

  it('a save survives a JSON round trip and stays deterministic', () => {
    const save = newGame('Me', look, 'parkour', 'rooftops', 5);
    const copy = JSON.parse(JSON.stringify(save));
    expect(playAuto(save, 1)).toEqual(playAuto(copy, 1));
  });

  it('cannot choose an upgrade that is not offered', () => {
    const save = newGame('Me', look, 'parkour', 'rooftops', 5);
    expect(() => chooseUpgrade(save, 'gen_health')).toThrow();
  });

  it('a prepared fight is reused, so the opponent cannot be rerolled', () => {
    const save = newGame('Me', look, 'tamer', 'metro', 9);
    const first = prepareFight(save, 1);
    expect(prepareFight(save, 1)).toBe(first);
    expect(save.daily.used).toBe(1);
  });

  it('tactics and warm-up are locked once the fight starts', () => {
    const save = newGame('Me', look, 'bouncer', 'port', 3);
    prepareFight(save, 1);
    recordWarmup(save, 80);
    recordWarmup(save, 100);
    startFight(save, { stance: 'defensive', target: 'pets', weaponStyle: 'keep' }, []);
    const locked = startFight(save, DEFAULT_PLAN, ['bat']);
    expect(locked).toEqual({
      stance: 'defensive',
      target: 'pets',
      weaponStyle: 'keep',
      weapons: [],
      gear: { armor: null, accessory: null },
      warmup: 80,
    });
  });
});

describe('skill', () => {
  const a = generateOpponent(10, new Rng(11), 'brawler');
  const b = generateOpponent(10, new Rng(12), 'bouncer');

  it('stops at each input and keeps the same events before it', () => {
    const specials: number[] = [];
    const breaks: BreakChoice[] = [];
    let previous: FightLog | null = null;
    for (let step = 0; step < 20; step++) {
      const log = runFight(a, b, 42, { a: { interactive: true, specials, breaks } });
      if (previous) expect(log.events.slice(0, previous.events.length - 1)).toEqual(previous.events.slice(0, -1));
      if (log.winner !== null) return;
      const last = log.events.at(-1)!;
      expect(['special', 'break']).toContain(last.t);
      if (last.t === 'special') specials.push(90);
      else breaks.push(keep(a.weapons));
      previous = log;
    }
    throw new Error('fight never ended');
  });

  it('a special strike cannot be dodged', () => {
    const { log } = playThrough(a, b, 42, 90);
    const i = log.events.findIndex((e) => e.t === 'special' && e.quality === 90);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(log.events[i + 1]).toMatchObject({ actor: 0, kind: 'special' });
    // A shield can still block it.
    expect(['hit', 'block']).toContain(log.events[i + 1]!.t);
  });

  it('a failed special plays a normal turn', () => {
    const { log } = playThrough(a, b, 42, 0);
    expect(log.events.some((e) => (e.t === 'hit' || e.t === 'block') && e.kind === 'special')).toBe(false);
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

  it('warm-up bonus is capped at 5%', () => {
    expect(warmupBonus(0)).toBe(0);
    expect(warmupBonus(100)).toBe(5);
    expect(warmupBonus(500)).toBe(5);
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
    const log = runFight(a, b, 1, { a: { interactive: true, specials: [50, 50, 50] } });
    const last = log.events.at(-1)!;
    if (last.t !== 'break') return; // the fight ended in round 1
    expect(last.choices[0]).toBeNull();
    expect(last.choices[1]).not.toBeNull();
  });

  it('recovering at a break gives more stamina', () => {
    const staminaAfterBreak = (recover: boolean) => {
      const { log } = playThrough(a, b, 5, 50, recover);
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
    for (const e of before) if ((e.t === 'hit' || e.t === 'dodge' || e.t === 'block') && e.actor === 0) expect(e.target).toBe(dogIdx);
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
