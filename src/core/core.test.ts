import { describe, expect, it } from 'vitest';
import {
  CLASS_IDS,
  DEFAULT_PLAN,
  FIGHTS_PER_DAY,
  Rng,
  UPGRADES_BY_ID,
  addXp,
  applyUpgrade,
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
  rollOffer,
  traitsOf,
  simulateFight,
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

/** Plays a whole daily fight like the UI does, answering every special with `quality`. */
function playAuto(save: SaveData, day: number, quality = 50) {
  if (!prepareFight(save, day)) return null;
  startFight(save, DEFAULT_PLAN, save.character.weapons);
  const specials: number[] = [];
  while (simulateFight(save, specials).winner === null) specials.push(quality);
  return finishFight(save, specials);
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
    expect(locked).toEqual({ stance: 'defensive', target: 'pets', weaponStyle: 'keep', weapons: [], warmup: 80 });
  });
});

describe('skill', () => {
  const a = generateOpponent(10, new Rng(11), 'brawler');
  const b = generateOpponent(10, new Rng(12), 'bouncer');

  it('stops at a special strike until the input is given, keeping the same prefix', () => {
    const partial = runFight(a, b, 42, { a: { interactive: true } });
    expect(partial.winner).toBeNull();
    const last = partial.events.at(-1)!;
    expect(last).toMatchObject({ t: 'special', actor: 0, index: 0, quality: null });

    const next = runFight(a, b, 42, { a: { interactive: true, specials: [90] } });
    expect(next.events.slice(0, partial.events.length - 1)).toEqual(partial.events.slice(0, -1));
    expect(next.events[partial.events.length - 1]).toMatchObject({ t: 'special', quality: 90 });
    // Specials cannot be dodged, but a shield can still block them.
    expect(next.events[partial.events.length]).toMatchObject({ actor: 0, kind: 'special' });
    expect(['hit', 'block']).toContain(next.events[partial.events.length]!.t);
  });

  it('a failed special plays a normal turn', () => {
    const log = runFight(a, b, 42, { a: { interactive: true, specials: [0, 0] } });
    expect(log.winner).not.toBeNull();
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
