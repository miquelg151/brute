import { describe, expect, it } from 'vitest';
import {
  CLASS_IDS,
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
  newGame,
  playFight,
  rollOffer,
  runFight,
  useFight,
  xpToNext,
  type Appearance,
  type FightLog,
} from './index';

const look: Appearance = { skinTone: 0, hairStyle: 0, hairColor: 0, outfitColor: 0 };

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
      if (!playFight(save, day)) day++;
    }
    expect(playFight(save, day)).toBeNull();
    const offer = save.offer!;
    expect(offer).toHaveLength(3);
    chooseUpgrade(save, offer[0]!);
    expect(save.offer).toBeNull();
    expect(save.pendingLevelUps).toBe(0);
  });

  it('a save survives a JSON round trip and stays deterministic', () => {
    const save = newGame('Me', look, 'parkour', 'rooftops', 5);
    const copy = JSON.parse(JSON.stringify(save));
    expect(playFight(save, 1)).toEqual(playFight(copy, 1));
  });

  it('cannot choose an upgrade that is not offered', () => {
    const save = newGame('Me', look, 'parkour', 'rooftops', 5);
    expect(() => chooseUpgrade(save, 'gen_health')).toThrow();
  });
});
