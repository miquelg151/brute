import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CARDS,
  ORIGINS,
  ORIGIN_IDS,
  RANKS,
  rankOf,
  originCard,
  cardOrigin,
  weatherWavePct,
  CLASSES,
  WEAPONS,
  addStats,
  CLASS_IDS,
  DEFAULT_PLAN,
  Rng,
  START_STAMINA,
  UPGRADES,
  UPGRADES_BY_ID,
  eligibleUpgrades,
  addXp,
  applyUpgrade,
  botCardLevel,
  cardLevel,
  chooseUpgrade,
  createCharacter,
  defaultTactics,
  preferredDeck,
  setPreferredDeck,
  generateOpponent,
  mixSeed,
  finishFight,
  loadoutFor,
  newGame,
  prepareFight,
  prepareLevelUp,
  recordPlay,
  lastPlayTick,
  playsInOrder,
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
  type FightEvent,
  type FightLog,
  type SaveData,
  type TeamOptions,
  BRANCHES,
  BRANCHES_BY_ID,
  BRANCH_LEVEL,
  CROSS_CLASS_LEVEL,
  OFFER_SIZE,
  OTHER_BRANCH_CHANCE,
  SAVE_VERSION,
  SKILLS,
  SPELLS,
  chooseBranch,
  chooseFighterBranch,
  isCrossClass,
  needsBranch,
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
    // With a branch, so the class pool holds more than its two stat boosts.
    c.level = BRANCH_LEVEL;
    chooseBranch(c, 'wall');
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
    applyUpgrade(c, 'pet:crow');
    expect(() => applyUpgrade(c, 'pet:crow')).toThrow();
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

  it('prepareLevelUp makes the offer when level-ups wait without one, and keeps an existing offer', () => {
    const save = newGame('Me', look, 'brawler', 'port', 77);
    expect(prepareLevelUp(save)).toBe(false);
    expect(save.offer).toBeNull();
    save.pendingLevelUps = 1;
    expect(prepareLevelUp(save)).toBe(true);
    const offer = save.offer!;
    expect(offer).toHaveLength(3);
    expect(prepareLevelUp(save)).toBe(true);
    expect(save.offer).toBe(offer);
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
    recordPlay(save, { tick: 5, card: 'rage' });
    for (let log = simulateFight(save); log.winner === null; log = simulateFight(save)) recordBreak(save, keep([]));
    const result = finishFight(save);
    expect(result.cardsPlayed.rage).toBe(1);
    expect(save.character.cardUses.rage).toBe(3);
    expect(result.cardLevelUps).toEqual([{ card: 'rage', level: 2 }]);
  });

  it('a play at or before the last saved play is not saved (no redo after a reload)', () => {
    const save = newGame('Me', look, 'brawler', 'port', 21);
    prepareFight(save);
    startFight(save, DEFAULT_PLAN, []);
    expect(recordPlay(save, { tick: 20, card: 'rage' })).toBe(true);
    // Watching the fight again after a reload, the player taps earlier: ignored.
    expect(recordPlay(save, { tick: 8, card: 'special', quality: 100 })).toBe(false);
    expect(recordPlay(save, { tick: 20, card: 'special', quality: 100 })).toBe(false);
    expect(save.pendingFight!.inputs.plays).toEqual([{ tick: 20, card: 'rage' }]);
    expect(lastPlayTick(save)).toBe(20);
    expect(recordPlay(save, { tick: 21, card: 'special', quality: 100 })).toBe(true);
    expect(lastPlayTick(save)).toBe(21);
  });

  it('the simulation applies plays only in non-decreasing tick order', () => {
    expect(playsInOrder([{ tick: 5, card: 'a' }, { tick: 3, card: 'b' }, { tick: 5, card: 'c' }, { tick: 9, card: 'd' }]).map((p) => p.card)).toEqual(['a', 'c', 'd']);
    const a = generateOpponent(10, new Rng(11), 'brawler');
    const b = generateOpponent(10, new Rng(12), 'bouncer');
    const run = (plays: CardPlay[]) => runFight(a, b, 42, { a: { interactive: true, deck: { rage: 1, second_breath: 1 }, plays, breaks: [] }, b: { deck: {} } });
    // The Second Breath at tick 10 comes after a play at tick 20 in the list, so it never happens.
    const late = run([{ tick: 20, card: 'rage' }, { tick: 10, card: 'second_breath' }]);
    expect(late.events).toEqual(run([{ tick: 20, card: 'rage' }]).events);
    expect(late.events.filter((e) => e.t === 'card' && e.actor === 0).map((e) => (e.t === 'card' ? e.card : ''))).toEqual(['rage']);
  });

  it('a version 4 save is migrated, keeping the fighter', () => {
    const v4 = { version: 4, seed: 1, fightCount: 3, character: { ...createCharacter('Old', look, 'parkour', 'port') }, daily: { day: 5, used: 2 }, pendingLevelUps: 0, offer: null, pendingFight: null };
    delete (v4.character as Partial<Character>).cards;
    delete (v4.character as Partial<Character>).cardUses;
    const save = migrateSave(JSON.parse(JSON.stringify(v4)))!;
    expect(save.version).toBe(7);
    expect(save.character.name).toBe('Old');
    expect(save.character.cards).toEqual(['special', 'roll', 'weather_wave']);
    expect(save.character.cardUses).toEqual({});
    expect('daily' in save).toBe(false);
    expect(migrateSave({ version: 1 })).toBeNull();
  });

  it('a version 5 save gets its origin card and drops a fight in progress', () => {
    const save = newGame('M', look, 'bouncer', 'industrial', 7) as unknown as Record<string, unknown>;
    const c = save.character as { cards: string[] };
    c.cards = ['special', 'wall', 'patch_up', 'hurl', 'rush'];
    save.version = 5;
    save.pendingFight = { anything: true };
    const migrated = migrateSave(save)!;
    expect(migrated.version).toBe(7);
    expect(migrated.character.cards).toEqual(['special', 'wall', 'scrap_shield', 'patch_up', 'hurl', 'rush']);
    expect(migrated.pendingFight).toBeNull();
  });
});

describe('energy and cards', () => {
  const a = generateOpponent(10, new Rng(11), 'brawler');
  const b = generateOpponent(10, new Rng(12), 'bouncer');
  const energyOf = (log: FightLog, actor: number) => log.events.filter((e) => e.t === 'energy' && e.actor === actor).map((e) => (e.t === 'energy' ? e.energy : 0));

  it('energy starts at 3, fills one point every 5 ticks and never passes 10', () => {
    const { log } = playThrough(a, b, 42);
    const first = log.events.find((e) => e.t === 'energy' && e.actor === 0);
    expect(first).toEqual({ t: 'energy', actor: 0, energy: 3 });
    expect(Math.max(...energyOf(log, 0))).toBeLessThanOrEqual(10);
    const tick10 = log.events.findIndex((e) => e.t === 'tick' && e.n === 10);
    const at10 = log.events.slice(0, tick10 + 2).filter((e) => e.t === 'energy' && e.actor === 0).at(-1);
    expect(at10).toMatchObject({ energy: 5 });
  });

  it('a play is applied at its tick and leaves earlier events identical', () => {
    const before = playThrough(a, b, 42).log;
    const plays = [{ tick: 8, card: 'rage' }];
    const after = playThrough(a, b, 42, plays).log;
    const cut = before.events.findIndex((e) => e.t === 'tick' && e.n === 8);
    expect(after.events.slice(0, cut + 1)).toEqual(before.events.slice(0, cut + 1));
    // A level-10 fighter's default deck is at bot level 3.
    expect(after.events.slice(cut + 1).find((e) => e.t === 'card' && e.actor === 0)).toEqual({ t: 'card', actor: 0, card: 'rage', level: 3 });
  });

  it('a play without enough energy does nothing', () => {
    const { log } = playThrough(a, b, 42, [{ tick: 1, card: 'special', quality: 100 }]);
    expect(log.events.some((e) => e.t === 'card' && e.actor === 0)).toBe(false);
  });

  it('the special strike card makes the next attack an undodgeable special', () => {
    const { log } = playThrough(a, b, 42, [{ tick: 10, card: 'special', quality: 90 }]);
    const i = log.events.findIndex((e) => e.t === 'special' && e.actor === 0);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(log.events[i]).toEqual({ t: 'special', actor: 0, quality: 90 });
    expect(log.events[i + 1]).toMatchObject({ actor: 0, kind: 'special' });
    expect(['hit', 'block']).toContain(log.events[i + 1]!.t);
  });

  it('a failed special strike plays a normal turn', () => {
    const { log } = playThrough(a, b, 42, [{ tick: 10, card: 'special', quality: 0 }]);
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
    // Stamina left after the first action (below the starting stamina), which costs the same base amount in both fights.
    const afterFirst = (stance: 'aggressive' | 'defensive') => {
      const log = runFight(a, b, 9, { a: { stance } });
      const res = log.events.find((e) => e.t === 'res' && e.actor === 0 && e.stamina < START_STAMINA);
      return res && res.t === 'res' ? res.stamina : START_STAMINA;
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
    // Magic resistance makes the fight longer too, so again compare only the spells both fights share.
    const withCharm = spellDamage(charmed);
    const both = Math.min(base.length, withCharm.length);
    const sum = (list: number[]) => list.slice(0, both).reduce((x, y) => x + y, 0);
    expect(sum(withCharm)).toBeLessThan(sum(base));
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

  it('every fighter starts with the special strike, its class card and its origin card', () => {
    expect(startingCards('brawler', 'port')).toEqual(['special', 'rage', 'weather_wave']);
    expect(startingCards('parkour', 'rooftops')).toEqual(['special', 'roll', 'leap']);
    expect(startingCards('bouncer', 'industrial')).toEqual(['special', 'wall', 'scrap_shield']);
    expect(startingCards('tamer', 'metro')).toEqual(['special', 'sic_em', 'last_train']);
    expect(startingCards('mystic', 'sewers')).toEqual(['special', 'overcharge', 'toxic_spit']);
    expect(startingCards('brawler', 'scrapyard')).toEqual(['special', 'rage', 'power_surge']);
    expect(startingCards('brawler')).toEqual(['special', 'rage']);
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
    expect(c.cards).toEqual(['special', 'overcharge', 'weather_wave']);
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
    // Rage costs 4 and a fighter starts with 3 energy, so it is played at tick 5, when the 4th point arrives.
    const hits = (plays: CardPlay[]) => {
      const log = runFight(brawler, bouncer, 7, { a: { interactive: true, deck: deckOf('rage'), plays, breaks: [] }, b: { deck: {} } });
      return log.events.slice(log.events.findIndex((e) => e.t === 'tick' && e.n === 5)).filter((e) => e.t === 'hit' && e.actor === 0).slice(0, 3).map((e) => (e.t === 'hit' ? e.damage : 0));
    };
    const normal = hits([]);
    const raged = hits([{ tick: 5, card: 'rage' }]);
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

  it('Wall blocks the next hit for sure', () => {
    const firstOne = (plays: CardPlay[]) => {
      const log = runFight(bouncer, brawler, 9, { a: { interactive: true, deck: deckOf('wall'), plays, breaks: [] }, b: { deck: {} } });
      // Wall costs 5, so it is played at tick 10; the control run looks from the same tick.
      const from = plays.length > 0 ? after(log, 'wall') : log.events.slice(log.events.findIndex((e) => e.t === 'tick' && e.n === 10));
      return from.filter((e) => (e.t === 'hit' || e.t === 'block') && e.actor !== 0 && e.target === 0 && e.kind !== 'spell').slice(0, 1);
    };
    const withCard = firstOne([{ tick: 10, card: 'wall' }]);
    expect(withCard).toHaveLength(1);
    expect(withCard[0]!.t).toBe('block');
    expect(firstOne([])[0]!.t).toBe('hit');
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
    const log = runFight(mystic, brawler, 2, { a: { interactive: true, deck: deckOf('overcharge'), plays: [{ tick: 5, card: 'overcharge' }], breaks: [] }, b: { deck: {} } });
    const plain = runFight(mystic, brawler, 2, { a: { interactive: true, deck: deckOf('overcharge'), plays: [], breaks: [] }, b: { deck: {} } });
    // Overcharge costs 4, so it is played at tick 5; look at spells after that.
    const firstSpell = (l: FightLog) => l.events.slice(l.events.findIndex((e) => e.t === 'tick' && e.n === 5)).find((e) => e.t === 'hit' && e.kind === 'spell' && e.actor === 0);
    expect((firstSpell(log) as { damage: number }).damage).toBeGreaterThan((firstSpell(plain) as { damage: number }).damage);
  });
});

describe('level-up cards', () => {
  const me = generateOpponent(12, new Rng(261), 'brawler');
  const foe = generateOpponent(12, new Rng(262), 'bouncer');
  // A fighter starts with 3 energy and gains 1 every 5 ticks, so a card costing c can first be played at tick 5 * (c - 3).
  const run = (c: Character, card: string, tick: number, opts: Partial<TeamOptions> = {}) =>
    runFight(c, foe, 5, { a: { interactive: true, deck: { [card]: 1 }, plays: [{ tick, card }], breaks: [], ...opts }, b: { deck: {} } });
  const cardIndex = (log: FightLog, card: string) => log.events.findIndex((e) => e.t === 'card' && e.card === card && e.actor === 0);
  const evAfter = (log: FightLog, card: string) => {
    const i = cardIndex(log, card);
    expect(i).toBeGreaterThanOrEqual(0);
    return log.events.slice(i + 1);
  };
  const isStrike = (e: FightEvent) => e.t === 'hit' || e.t === 'dodge' || e.t === 'block';

  it('Patch Up heals', () => {
    const log = run(me, 'patch_up', 5);
    const heal = evAfter(log, 'patch_up')[0] as { t: 'heal'; amount: number; hp: number };
    expect(heal).toMatchObject({ t: 'heal', actor: 0 });
    // The reported amount is the health really gained, never more than the missing health.
    const before = log.events.slice(0, cardIndex(log, 'patch_up')).reverse().find((e) => (e.t === 'hit' || e.t === 'block') && e.target === 0) as { hp: number } | undefined;
    const hpBefore = before ? before.hp : log.roster[0]!.maxHp;
    expect(heal.hp - hpBefore).toBe(heal.amount);
    expect(heal.hp).toBeLessThanOrEqual(log.roster[0]!.maxHp);
  });

  it('Hurl throws the weapon in hand at once', () => {
    const armed = { ...me, weapons: ['bat'] };
    const log = runFight(armed, foe, 5, { a: { interactive: true, deck: { hurl: 1 }, plays: [{ tick: 30, card: 'hurl' }], breaks: [], weaponStyle: 'keep' }, b: { deck: {} } });
    const i = cardIndex(log, 'hurl');
    expect(i).toBeGreaterThanOrEqual(0);
    const holding = log.events.slice(0, i).some((e) => e.t === 'draw' && e.actor === 0);
    // Armed: the very next event is the thrown weapon landing. Unarmed: a plain shove.
    expect(log.events[i + 1]).toMatchObject({ t: 'hit', actor: 0, kind: holding ? 'throw' : 'melee' });
    expect(holding).toBe(true);
  });

  it('Rush makes the fighter act on this tick', () => {
    const actsBeforeTick1 = (l: FightLog) => {
      const end = l.events.findIndex((e) => e.t === 'tick' && e.n === 1);
      return l.events.slice(0, end).some((e) => 'actor' in e && e.actor === 0 && e.t !== 'energy' && e.t !== 'res' && e.t !== 'card');
    };
    const log = run(me, 'rush', 0);
    expect(cardIndex(log, 'rush')).toBeGreaterThanOrEqual(0);
    expect(actsBeforeTick1(log)).toBe(true);
    // Without the card the same fighter has no turn yet at tick 0.
    expect(actsBeforeTick1(run(me, 'rush', 0, { plays: [] }))).toBe(false);
  });

  it("Feint makes the enemy's next attack miss", () => {
    const log = run(me, 'feint', 0);
    const first = evAfter(log, 'feint').find((e) => (isStrike(e) || e.t === 'miss') && e.actor !== 0 && 'target' in e && e.target === 0);
    expect(first?.t).toBe('miss');
  });

  it('Second Breath gives stamina', () => {
    // Played at tick 24, when the fighter has already spent some stamina.
    const firstRes = (plays: CardPlay[]) => {
      const log = runFight(me, foe, 5, { a: { interactive: true, deck: { second_breath: 1 }, plays, breaks: [] }, b: { deck: {} } });
      const from = log.events.findIndex((e) => e.t === 'tick' && e.n === 24);
      const res = log.events.slice(from).find((e) => e.t === 'res' && e.actor === 0);
      return (res as { stamina: number }).stamina;
    };
    expect(firstRes([{ tick: 24, card: 'second_breath' }])).toBeGreaterThan(firstRes([]));
  });

  // A defender who dodges a lot, to show that a "can't be dodged" card really changes something.
  const dodger = { ...generateOpponent(12, new Rng(68), 'parkour'), skills: ['sixth_sense'] };
  const dodgesOver = (seeds: number, a: Character, card: string, tick: number, played: boolean, spell = false) => {
    let dodged = 0;
    for (let seed = 0; seed < seeds; seed++) {
      const log = runFight(a, dodger, seed, { a: { interactive: true, deck: { [card]: 1 }, plays: played ? [{ tick, card }] : [], breaks: [] }, b: { deck: {} } });
      const from = played ? cardIndex(log, card) : log.events.findIndex((e) => e.t === 'tick' && e.n === tick);
      expect(from).toBeGreaterThanOrEqual(0);
      const first = log.events.slice(from).find((e) => (e.t === 'hit' || e.t === 'block' || e.t === 'dodge') && e.actor === 0 && (spell ? e.kind === 'spell' : e.kind !== 'spell'));
      if (first?.t === 'dodge') dodged++;
    }
    return dodged;
  };

  it("Haymaker's hit can't be dodged", () => {
    expect(dodgesOver(40, me, 'haymaker', 5, false)).toBeGreaterThan(0);
    expect(dodgesOver(40, me, 'haymaker', 5, true)).toBe(0);
  });

  it('Flurry strikes 3 times on the next turn', () => {
    const p = generateOpponent(12, new Rng(63), 'parkour');
    const log = run(p, 'flurry', 10);
    const mine = evAfter(log, 'flurry').filter((e) => isStrike(e) && e.actor === 0);
    expect(mine.length).toBeGreaterThanOrEqual(3);
    expect(mine.slice(0, 3).every((e) => 'kind' in e && e.kind === 'double')).toBe(true);
  });

  it('Body Slam hits and pushes the enemy turn back', () => {
    const b = generateOpponent(12, new Rng(64), 'bouncer');
    const log = run(b, 'body_slam', 10);
    expect(evAfter(log, 'body_slam')[0]).toMatchObject({ actor: 0, kind: 'melee' });
    expect(['hit', 'block']).toContain(evAfter(log, 'body_slam')[0]!.t);
    // The tick of the enemy's first action from tick 10 on: later with the card than without it.
    const enemyActsAt = (l: FightLog) => {
      let tick = -1;
      for (const e of l.events) {
        if (e.t === 'tick') tick = e.n;
        else if (tick >= 10 && 'actor' in e && e.actor === 1 && e.t !== 'energy' && e.t !== 'res') return tick;
      }
      return Infinity;
    };
    expect(enemyActsAt(log)).toBeGreaterThan(enemyActsAt(run(b, 'body_slam', 10, { plays: [] })));
  });

  it('Stray Dog joins until the round ends', () => {
    const t = generateOpponent(12, new Rng(65), 'tamer');
    const log = run(t, 'stray_dog', 15);
    const dog = log.roster.findIndex((u) => u.name === 'Stray Dog');
    expect(dog).toBeGreaterThanOrEqual(0);
    expect(evAfter(log, 'stray_dog')[0]).toMatchObject({ t: 'summon', actor: dog });
  });

  it("Bolt can't be dodged", () => {
    const m = generateOpponent(12, new Rng(166), 'mystic');
    expect(dodgesOver(60, m, 'bolt', 10, false, true)).toBeGreaterThan(0);
    expect(dodgesOver(60, m, 'bolt', 10, true, true)).toBe(0);
  });

  it('Hurl does exactly the card damage multiplier', () => {
    // With no armor, no gear and no skills on the target, a hit is floor(floor(base * 2) * roll / 100), roll 80-120.
    // The wrong (stacked) multiplier would be x2.25, whose top rolls go well above x2.4.
    const target = { ...foe, gear: [], skills: [], pets: [], originId: 'port' };
    const base = (c: Character) => addStats(CLASSES[c.classId].baseStats, c.bonusStats).strength + WEAPONS.bat!.damage;
    for (const skills of [[], ['thrower']]) {
      const thrower = { ...me, weapons: ['bat'], gear: [], skills, pets: [] };
      const doubled = base(thrower) * 2;
      let seen = 0;
      for (let seed = 0; seed < 60; seed++) {
        const log = runFight(thrower, target, seed, { a: { interactive: true, deck: { hurl: 1 }, plays: [{ tick: 30, card: 'hurl' }], breaks: [], weaponStyle: 'keep' }, b: { deck: {} } });
        const i = cardIndex(log, 'hurl');
        const hit = log.events[i + 1];
        if (!log.events.slice(0, i).some((e) => e.t === 'draw' && e.actor === 0) || hit?.t !== 'hit' || hit.kind !== 'throw') continue;
        seen++;
        expect(hit.damage).toBeGreaterThanOrEqual(Math.floor((doubled * 80) / 100));
        expect(hit.damage).toBeLessThanOrEqual(Math.floor((doubled * 120) / 100));
      }
      expect(seen).toBeGreaterThan(10);
    }
  });

  it('a bot reacts to a card from the next tick on, never in the same tick', () => {
    // Team 0 plays Rage at tick 5; the bot on team 1 can afford Feint, but only sees the Rage at tick 6.
    const log = runFight(me, foe, 5, { a: { interactive: true, deck: { rage: 1 }, plays: [{ tick: 5, card: 'rage' }], breaks: [] }, b: { deck: { feint: 1 } } });
    const tickOf = (i: number) => {
      for (let j = i; j >= 0; j--) {
        const e = log.events[j]!;
        if (e.t === 'tick') return e.n;
      }
      return -1;
    };
    const rage = cardIndex(log, 'rage');
    const feint = log.events.findIndex((e) => e.t === 'card' && e.actor !== 0 && e.card === 'feint');
    expect(tickOf(rage)).toBe(5);
    expect(tickOf(feint)).toBe(6);
  });

  it('bots never play a defence in the same tick as the enemy offensive card', () => {
    const OFFENSIVE = ['rage', 'haymaker', 'flurry', 'special'];
    const DEFENSIVE = ['wall', 'roll', 'feint'];
    // Two sturdy fighters, so the fights last long enough for many cards.
    const x = { ...generateOpponent(25, new Rng(70), 'bouncer'), cards: ['rage', 'haymaker', 'feint', 'wall'] };
    const y = { ...generateOpponent(25, new Rng(71), 'bouncer'), cards: ['special', 'haymaker', 'roll', 'feint'] };
    // A defence in the same tick as an enemy offensive card is fine only for another reason:
    // the bot had 8+ energy (it spends anyway), or the enemy played an offensive card in the 5 ticks before.
    let reactions = 0;
    for (let seed = 0; seed < 20; seed++) {
      for (const [l, r] of [[x, y], [y, x]] as const) {
        const log = runFight(l, r, seed);
        let tick = -1;
        const energy = [3, 3];
        const offenceTicks: number[][] = [[], []];
        let offenceThisTick = [false, false];
        for (const e of log.events) {
          if (e.t === 'tick') {
            tick = e.n;
            offenceThisTick = [false, false];
          } else if (e.t === 'energy') energy[log.roster[e.actor]!.team] = e.energy;
          else if (e.t === 'card') {
            // Events name units by roster index; the main fighters are found by team.
            const team = log.roster[e.actor]!.team;
            const enemy = team === 0 ? 1 : 0;
            if (DEFENSIVE.includes(e.card)) {
              // The energy event of this play came just before it: add the cost back.
              const before = energy[team]! + CARDS[e.card]!.cost;
              const earlierOffence = offenceTicks[enemy]!.some((t) => t < tick && tick - t <= 5);
              if (earlierOffence) reactions++;
              if (offenceThisTick[enemy]) expect(before >= 8 || earlierOffence, `seed ${seed} tick ${tick}`).toBe(true);
            }
            if (OFFENSIVE.includes(e.card)) {
              offenceThisTick[team] = true;
              offenceTicks[team]!.push(tick);
            }
          }
        }
      }
    }
    expect(reactions).toBeGreaterThan(0);
  });

  it('Stray Dog cannot be played while its dog is fighting', () => {
    const t = generateOpponent(12, new Rng(765), 'tamer');
    const weak = { ...generateOpponent(3, new Rng(272), 'mystic'), pets: [] };
    let checked = 0;
    for (let seed = 0; seed < 20; seed++) {
      // Energy is full (10) when round 2 starts at tick 45; a second play at tick 60 could afford it (7 energy).
      const plays = [{ tick: 45, card: 'stray_dog' }, { tick: 60, card: 'stray_dog' }];
      const breaks: BreakChoice[] = [keep(t.weapons)];
      const log = runFight(t, weak, seed, { a: { interactive: true, deck: { stray_dog: 1 }, plays, breaks }, b: { deck: {} } });
      const dog = log.roster.findIndex((u) => u.name === 'Stray Dog');
      const tick60 = log.events.findIndex((e) => e.t === 'tick' && e.n === 60);
      const first = cardIndex(log, 'stray_dog');
      if (tick60 < 0 || first < 0 || log.events.slice(first, tick60).some((e) => e.t === 'death' && e.actor === dog)) continue;
      checked++;
      // Only one Stray Dog card was played, and the energy was not spent a second time.
      expect(log.events.filter((e) => e.t === 'card' && e.actor === 0).length).toBe(1);
      const energyAt60 = log.events.slice(0, tick60 + 3).filter((e) => e.t === 'energy' && e.actor === 0).at(-1);
      expect(energyAt60).toMatchObject({ energy: 7 });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('bots heal when low and defend against Rage', () => {
    const bot = { ...generateOpponent(12, new Rng(67), 'bouncer'), cards: ['special', 'wall', 'patch_up'] };
    let healed = 0;
    let walled = 0;
    for (let seed = 0; seed < 40; seed++) {
      const log = runFight(me, bot, seed, { a: { interactive: true, deck: { rage: 1 }, plays: [{ tick: 12, card: 'rage' }], breaks: [] } });
      const mine = log.events.findIndex((e) => e.t === 'card' && e.actor === 0);
      if (log.events.slice(mine).some((e) => e.t === 'card' && e.actor !== 0 && e.card === 'wall')) walled++;
      if (log.events.some((e) => e.t === 'card' && e.card === 'patch_up')) healed++;
    }
    expect(walled).toBeGreaterThan(0);
    expect(healed).toBeGreaterThan(0);
  });
});

describe('origins', () => {
  it('there are six origins, each with its own starting card', () => {
    expect(ORIGIN_IDS).toEqual(['port', 'rooftops', 'metro', 'industrial', 'sewers', 'scrapyard']);
    for (const id of ORIGIN_IDS) {
      const card = originCard(id)!;
      expect(CARDS[card]!.pool).toBe('origin');
      expect(CARDS[card]!.starting).toBe(true);
      expect(cardOrigin(card)).toBe(id);
    }
  });

  it('origin cards are never offered at level-ups', () => {
    const origin = new Set(ORIGIN_IDS.map((id) => originCard(id)));
    expect(UPGRADES.some((u) => u.kind === 'card' && origin.has(u.ref))).toBe(false);
  });

  it('origin passives match the design', () => {
    expect(ORIGINS.port!.hpPercent).toBe(8);
    expect(ORIGINS.rooftops!.dodge).toBe(9);
    expect(ORIGINS.metro!.initiative).toBe(100);
    expect(ORIGINS.industrial!.armor).toBe(1);
    expect(ORIGINS.sewers!.hpRegen).toBe(1);
    expect(ORIGINS.scrapyard!.armor).toBe(0);
    expect(ORIGINS.scrapyard!.magicResist).toBe(15);
  });

  it('a new fighter gets its origin card', () => {
    const c = createCharacter('S', look, 'mystic', 'sewers');
    expect(c.cards).toEqual(['special', 'overcharge', 'toxic_spit']);
  });

  it('a generated opponent can be given an origin', () => {
    const c = generateOpponent(5, new Rng(3), 'bouncer', 'scrapyard');
    expect(c.originId).toBe('scrapyard');
    expect(c.cards).toContain('power_surge');
  });

  it('Weather the Wave softens more with card level, up to 70%', () => {
    expect(weatherWavePct(1)).toBe(50);
    expect(weatherWavePct(2)).toBe(55);
    expect(weatherWavePct(5)).toBe(70);
    expect(weatherWavePct(9)).toBe(70);
  });
});

describe('ranks', () => {
  it('ranks come at levels 1, 5, 10, 15 and 20', () => {
    expect(RANKS.map((r) => [r.id, r.from])).toEqual([
      ['rookie', 1],
      ['regular', 5],
      ['veteran', 10],
      ['champion', 15],
      ['legend', 20],
    ]);
    expect(rankOf(1).id).toBe('rookie');
    expect(rankOf(4).id).toBe('rookie');
    expect(rankOf(5).id).toBe('regular');
    expect(rankOf(14).id).toBe('veteran');
    expect(rankOf(15).id).toBe('champion');
    expect(rankOf(20).id).toBe('legend');
    expect(rankOf(37).id).toBe('legend');
  });
});

describe('origin cards', () => {
  const deckOf = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));
  const brawler = generateOpponent(10, new Rng(71), 'brawler', 'port');
  const parkour = generateOpponent(10, new Rng(72), 'parkour', 'rooftops');
  const tamer = generateOpponent(10, new Rng(73), 'tamer', 'metro');
  const bouncer = generateOpponent(10, new Rng(74), 'bouncer', 'industrial');
  const mystic = generateOpponent(10, new Rng(75), 'mystic', 'sewers');
  const robot = generateOpponent(10, new Rng(76), 'brawler', 'scrapyard');
  const foe = generateOpponent(10, new Rng(77), 'brawler', 'metro');
  const play = (me: Character, card: string, tick: number, seed: number, other: Character = foe) =>
    runFight(me, other, seed, { a: { interactive: true, deck: deckOf(card), plays: [{ tick, card }], breaks: [] }, b: { deck: {} } });
  const noPlay = (me: Character, card: string, seed: number, other: Character = foe) =>
    runFight(me, other, seed, { a: { interactive: true, deck: deckOf(card), plays: [], breaks: [] }, b: { deck: {} } });
  const cardIndex = (log: FightLog, card: string) => log.events.findIndex((e) => e.t === 'card' && e.card === card && e.actor === 0);
  const tickIndex = (log: FightLog, n: number) => log.events.findIndex((e) => e.t === 'tick' && e.n === n);
  const damageTo0 = (log: FightLog, from: number, count: number) =>
    log.events
      .slice(from)
      .filter((e) => (e.t === 'hit' || e.t === 'block') && e.target === 0 && e.damage > 0)
      .slice(0, count)
      .map((e) => (e.t === 'hit' || e.t === 'block' ? e.damage : 0));

  it('Weather the Wave makes the next 2 hits taken weaker', () => {
    // Costs 3: playable at tick 0. The card uses no randomness, so both runs roll the same hits.
    const soft = damageTo0(play(brawler, 'weather_wave', 0, 5), 0, 2);
    const plain = damageTo0(noPlay(brawler, 'weather_wave', 5), 0, 2);
    expect(soft).toHaveLength(2);
    expect(soft.reduce((s, d) => s + d, 0)).toBeLessThan(plain.reduce((s, d) => s + d, 0));
  });

  it('Leap dodges the next attack and strikes back at once', () => {
    const log = play(parkour, 'leap', 0, 9);
    const from = cardIndex(log, 'leap');
    const i = log.events.findIndex((e, k) => k > from && (e.t === 'hit' || e.t === 'block' || e.t === 'dodge') && e.target === 0);
    expect(log.events[i]!.t).toBe('dodge');
    const next = log.events.slice(i + 1).find((e) => e.t === 'hit' || e.t === 'block' || e.t === 'dodge');
    expect(next).toMatchObject({ actor: 0, kind: 'counter' });
  });

  it('Last Train gives more turns early in the round', () => {
    // A turn starts with exactly one of these from the fighter (extra double/combo hits are not counted).
    const turns = (log: FightLog) =>
      log.events
        .slice(0, tickIndex(log, 20))
        .filter((e) => (e.t === 'rest' && e.actor === 0) || ((e.t === 'hit' || e.t === 'block' || e.t === 'dodge') && e.actor === 0 && (e.kind === 'melee' || e.kind === 'throw'))).length;
    expect(turns(play(tamer, 'last_train', 0, 3))).toBeGreaterThan(turns(noPlay(tamer, 'last_train', 3)));
  });

  it('Scrap Shield stops physical damage until the round ends', () => {
    // Costs 4: playable at tick 5. One break choice so the fight goes on into round 2.
    const log = runFight(bouncer, foe, 4, {
      a: { interactive: true, deck: deckOf('scrap_shield'), plays: [{ tick: 5, card: 'scrap_shield' }], breaks: [keep(bouncer.weapons)] },
      b: { deck: {} },
    });
    const from = cardIndex(log, 'scrap_shield');
    const scraps = log.events.slice(from).filter((e) => e.t === 'scrap' && e.actor === 0);
    expect(scraps[0]).toMatchObject({ absorbed: 0, left: 12 });
    expect(scraps.some((e) => e.t === 'scrap' && e.absorbed > 0)).toBe(true);
    const round2 = log.events.findIndex((e) => e.t === 'round' && e.round === 2);
    expect(round2).toBeGreaterThanOrEqual(0);
    expect(log.events.slice(round2).some((e) => e.t === 'scrap')).toBe(false);
  });

  it('Toxic Spit poisons the enemy for 3 turns, ignoring armor', () => {
    const log = play(mystic, 'toxic_spit', 5, 6, bouncer);
    const poison = log.events.filter((e) => e.t === 'poison');
    expect(poison).toHaveLength(3);
    for (const e of poison) expect(e).toMatchObject({ actor: 1, damage: 4 });
  });

  it('Power Surge makes the enemy lose their next turn when it lands', () => {
    // Costs 6: playable at tick 15.
    const log = play(robot, 'power_surge', 15, 2, bouncer);
    const from = cardIndex(log, 'power_surge');
    const strike = log.events.slice(from).find((e) => (e.t === 'hit' || e.t === 'block' || e.t === 'dodge') && e.actor === 0)!;
    expect(strike.t).not.toBe('dodge');
    const after = log.events.slice(log.events.indexOf(strike) + 1);
    const stunned = after.findIndex((e) => e.t === 'stunned' && e.actor === 1);
    expect(stunned).toBeGreaterThanOrEqual(0);
    // Before losing that turn, the enemy did not act.
    expect(after.slice(0, stunned).some((e) => (e.t === 'hit' || e.t === 'block' || e.t === 'dodge' || e.t === 'rest') && e.actor === 1)).toBe(false);
  });

  it('Sewers fighters heal 1 health at the start of their turns', () => {
    const log = noPlay(mystic, 'toxic_spit', 8, brawler);
    expect(log.events.some((e) => e.t === 'heal' && e.actor === 0 && e.amount === 1)).toBe(true);
  });

  it('Scrapyard fighters take less magic damage', () => {
    // The same bouncer from two origins; spells ignore armor, so only magic resistance differs.
    const caster = generateOpponent(10, new Rng(78), 'mystic', 'port');
    const base = generateOpponent(10, new Rng(79), 'bouncer', 'industrial');
    const spellDamage = (originId: string) => {
      const log = runFight(caster, { ...base, originId }, 12, { a: { deck: {} }, b: { deck: {} } });
      return log.events.filter((e) => e.t === 'hit' && e.kind === 'spell' && e.actor === 0).slice(0, 5).reduce((s, e) => s + (e.t === 'hit' ? e.damage : 0), 0);
    };
    expect(spellDamage('scrapyard')).toBeLessThan(spellDamage('industrial'));
  });
});

describe('preferred deck', () => {
  const mk = () => {
    const c = createCharacter('D', look, 'brawler', 'port');
    c.cards.push('patch_up', 'hurl', 'rush');
    return c;
  };

  it('without a saved deck, it is the first cards', () => {
    expect(preferredDeck(mk())).toEqual(['special', 'rage', 'weather_wave', 'patch_up']);
  });

  it('a saved deck is used, in its order', () => {
    const c = mk();
    setPreferredDeck(c, ['rush', 'special', 'hurl', 'rage']);
    expect(preferredDeck(c)).toEqual(['rush', 'special', 'hurl', 'rage']);
    expect(defaultTactics(c).deck).toEqual(['rush', 'special', 'hurl', 'rage']);
  });

  it('cards not owned are dropped and the deck is topped up in card order', () => {
    const c = mk();
    c.deck = ['rush', 'bolt', 'rush'];
    expect(preferredDeck(c)).toEqual(['rush', 'special', 'rage', 'weather_wave']);
  });

  it('setPreferredDeck keeps only owned cards, no repeats, at most DECK_SIZE', () => {
    const c = mk();
    setPreferredDeck(c, ['hurl', 'hurl', 'bolt', 'special', 'rage', 'rush', 'patch_up']);
    expect(c.deck).toEqual(['hurl', 'special', 'rage', 'rush']);
  });

  it('starting a fight remembers the deck that was brought', () => {
    const save = newGame('E', look, 'brawler', 'port', 3);
    save.character.cards.push('rush');
    prepareFight(save);
    startFight(save, DEFAULT_PLAN, [], undefined, ['rush', 'special']);
    expect(save.character.deck).toEqual(['rush', 'special']);
  });
});

describe('class branches', () => {
  // The spec's branch table: every class item that is not a stat, with its branch ('' = class-common).
  const TABLE: Record<string, [string, string]> = {
    'skill:iron_fists': ['brawler', 'boxer'],
    'skill:double_strike': ['brawler', 'boxer'],
    'skill:jab': ['brawler', 'boxer'],
    'card:haymaker': ['brawler', 'boxer'],
    'skill:fury': ['brawler', 'brute'],
    'skill:second_wind': ['brawler', 'brute'],
    'skill:thick_skull': ['brawler', 'brute'],
    'card:headbutt': ['brawler', 'brute'],
    'gear:gloves': ['brawler', ''],
    'skill:sixth_sense': ['parkour', 'acrobat'],
    'skill:wall_run': ['parkour', 'acrobat'],
    'card:flurry': ['parkour', 'acrobat'],
    'skill:disarm': ['parkour', 'thief'],
    'skill:quick_start': ['parkour', 'thief'],
    'skill:thrower': ['parkour', 'thief'],
    'card:pickpocket': ['parkour', 'thief'],
    'gear:tracksuit': ['parkour', ''],
    'skill:iron_skin': ['bouncer', 'wall'],
    'skill:bulwark': ['bouncer', 'wall'],
    'gear:riot_vest': ['bouncer', 'wall'],
    'card:body_slam': ['bouncer', 'wall'],
    'skill:heavy_hands': ['bouncer', 'wrecker'],
    'weapon:traffic_sign': ['bouncer', 'wrecker'],
    'weapon:extinguisher': ['bouncer', 'wrecker'],
    'card:ground_pound': ['bouncer', 'wrecker'],
    'skill:whistle': ['tamer', 'pack'],
    'pet:raccoon': ['tamer', 'pack'],
    'card:stray_dog': ['tamer', 'pack'],
    'pet:crow': ['tamer', 'bond'],
    'skill:bond': ['tamer', 'bond'],
    'skill:feral': ['tamer', 'bond'],
    'gear:treat_bag': ['tamer', ''],
    'skill:drain': ['mystic', 'witch'],
    'card:bolt': ['mystic', 'witch'],
    'skill:arcane_flow': ['mystic', 'witch'],
    'skill:ward': ['mystic', 'warden'],
    'skill:mend': ['mystic', 'warden'],
    'skill:flash': ['mystic', 'warden'],
    'skill:spirit': ['mystic', 'warden'],
    'gear:rune_hoodie': ['mystic', ''],
  };

  it('every non-stat class upgrade has the pool and branch of the spec table', () => {
    const classItems = UPGRADES.filter((u) => u.kind !== 'stat' && u.pool !== 'general');
    expect(classItems.map((u) => u.id).sort()).toEqual(Object.keys(TABLE).sort());
    for (const u of classItems) {
      const [pool, branch] = TABLE[u.id]!;
      expect([u.id, u.pool, u.branch ?? '']).toEqual([u.id, pool, branch]);
      if (u.branch) expect(BRANCHES_BY_ID[u.branch].classId).toBe(u.pool);
    }
    // Class stats are class-common.
    expect(UPGRADES.filter((u) => u.kind === 'stat' && u.branch !== undefined)).toEqual([]);
  });

  it('every class has two branches with a name, a description and three known icons', () => {
    // Icon names are read from the UI icon file, so core tests stay free of the browser.
    const iconFile = readFileSync(new URL('../ui/icons.ts', import.meta.url), 'utf-8');
    const iconNames = [...iconFile.matchAll(/^ {2}([a-zA-Z]+): [{F]/gm)].map((m) => m[1]);
    for (const classId of CLASS_IDS) {
      const pair = BRANCHES[classId];
      expect(pair).toHaveLength(2);
      for (const b of pair) {
        expect(b.classId).toBe(classId);
        expect(BRANCHES_BY_ID[b.id]).toBe(b);
        expect(b.name.length).toBeGreaterThan(2);
        expect(b.description.length).toBeGreaterThan(5);
        expect(b.icons).toHaveLength(3);
        for (const name of b.icons) expect(iconNames).toContain(name);
      }
    }
  });

  it('the general pool has no pet, no spell and no skill', () => {
    const general = UPGRADES.filter((u) => u.pool === 'general');
    expect(general.some((u) => u.kind === 'pet')).toBe(false);
    expect(general.some((u) => u.kind === 'skill')).toBe(false);
    expect(general.some((u) => u.kind !== 'stat' && SPELLS[u.ref])).toBe(false);
    expect(UPGRADES_BY_ID['pet:dog']).toBeUndefined();
  });

  it('a Brawler never gets a pet or a spell from its own offers', () => {
    for (let seed = 0; seed < 200; seed++) {
      // Below the cross-class level: nothing from other classes at all.
      const young = generateOpponent(CROSS_CLASS_LEVEL - 1, new Rng(seed), 'brawler');
      expect(young.pets).toEqual([]);
      expect(young.skills.filter((s) => SPELLS[s])).toEqual([]);
      // At level 30 the only pet or spell can be the one from the level-15 cross-class slot.
      const old = generateOpponent(30, new Rng(seed), 'brawler');
      const petsAndSpells = old.pets.length + old.skills.filter((s) => SPELLS[s]).length;
      expect(petsAndSpells).toBeLessThanOrEqual(1);
      const crossOwned = UPGRADES.filter((u) => u.kind !== 'stat' && isCrossClass(old, u.id) && ownsUpgrade(old, u.id));
      expect(crossOwned.length).toBeLessThanOrEqual(1);
    }
  });

  it('before level 5 offers have no branch items; at level 5 without a branch one must be chosen', () => {
    const rng = new Rng(4);
    for (const classId of CLASS_IDS) {
      const c = createCharacter('A', look, classId, 'port');
      for (let level = 1; level < BRANCH_LEVEL; level++) {
        c.level = level;
        expect(needsBranch(c)).toBe(false);
        for (let i = 0; i < 40; i++) {
          for (const id of rollOffer(c, rng)) expect(UPGRADES_BY_ID[id]!.branch).toBeUndefined();
        }
      }
      c.level = BRANCH_LEVEL;
      expect(needsBranch(c)).toBe(true);
      // Still no branch: still no branch items.
      for (let i = 0; i < 40; i++) {
        for (const id of rollOffer(c, rng)) expect(UPGRADES_BY_ID[id]!.branch).toBeUndefined();
      }
      chooseBranch(c, BRANCHES[classId][0].id);
      expect(needsBranch(c)).toBe(false);
    }
  });

  it("chooseBranch rejects another class's branch and a second choice", () => {
    const c = createCharacter('A', look, 'brawler', 'port');
    c.level = BRANCH_LEVEL;
    expect(() => chooseBranch(c, 'witch')).toThrow();
    expect(c.branch).toBeUndefined();
    chooseBranch(c, 'brute');
    expect(c.branch).toBe('brute');
    expect(() => chooseBranch(c, 'boxer')).toThrow();
    expect(c.branch).toBe('brute');
  });

  it('class slots come from the other branch about 15% of the time', () => {
    const rng = new Rng(21);
    const c = createCharacter('A', look, 'brawler', 'port');
    c.level = 6;
    chooseBranch(c, 'brute');
    let classPicks = 0;
    let boxer = 0;
    while (classPicks < 2000) {
      for (const id of rollOffer(c, rng)) {
        const u = UPGRADES_BY_ID[id]!;
        if (u.pool !== 'brawler') continue;
        classPicks++;
        if (u.branch === 'boxer') boxer++;
      }
    }
    const share = boxer / classPicks;
    expect(OTHER_BRANCH_CHANCE).toBe(15);
    expect(share).toBeGreaterThan(0.08);
    expect(share).toBeLessThan(0.22);
  });

  it('the offer for level 15 has exactly one upgrade from another class, and only that one', () => {
    for (const classId of CLASS_IDS) {
      for (let seed = 0; seed < 30; seed++) {
        const c = generateOpponent(14, new Rng(seed), classId);
        const cross = (forLevel: number) => rollOffer(c, new Rng(seed + 1000), OFFER_SIZE, forLevel).filter((id) => isCrossClass(c, id));
        expect(cross(CROSS_CLASS_LEVEL - 1)).toEqual([]);
        expect(cross(CROSS_CLASS_LEVEL)).toHaveLength(1);
        expect(cross(CROSS_CLASS_LEVEL + 1)).toEqual([]);
        const [id] = cross(CROSS_CLASS_LEVEL);
        expect(UPGRADES_BY_ID[id!]!.kind).not.toBe('stat');
      }
    }
  });

  it('a save rolls the level-15 cross-class offer for the right level, even with level-ups waiting', () => {
    const save = newGame('Me', look, 'parkour', 'port', 3);
    const c = save.character;
    c.level = 16;
    c.branch = 'thief';
    save.pendingLevelUps = 2;
    expect(prepareLevelUp(save)).toBe(true);
    expect(save.offer!.filter((id) => isCrossClass(c, id))).toHaveLength(1);
    const pick = save.offer!.find((id) => !isCrossClass(c, id))!;
    chooseUpgrade(save, pick);
    expect(save.offer!.filter((id) => isCrossClass(c, id))).toEqual([]);
  });

  it('choosing the branch remakes a waiting offer', () => {
    const save = newGame('Me', look, 'brawler', 'port', 8);
    save.character.level = BRANCH_LEVEL;
    save.pendingLevelUps = 1;
    prepareLevelUp(save);
    expect(save.offer!.every((id) => UPGRADES_BY_ID[id]!.branch === undefined)).toBe(true);
    chooseFighterBranch(save, 'boxer');
    expect(save.character.branch).toBe('boxer');
    expect(save.offer).toHaveLength(3);
  });

  it('bots at level 5 and up have a branch of their class; younger bots have none', () => {
    const rng = new Rng(17);
    for (let i = 0; i < 100; i++) {
      const level = 1 + (i % 30);
      const bot = generateOpponent(level, rng);
      if (level >= BRANCH_LEVEL) expect(BRANCHES[bot.classId].map((b) => b.id)).toContain(bot.branch);
      else expect(bot.branch).toBeUndefined();
    }
  });

  it('a version 6 save becomes version 7, keeping the fight in progress and no branch', () => {
    const save = newGame('M', look, 'tamer', 'metro', 4) as unknown as Record<string, unknown>;
    (save.character as Character).level = 9;
    save.version = 6;
    save.pendingFight = { anything: true };
    const migrated = migrateSave(JSON.parse(JSON.stringify(save)))!;
    expect(migrated.version).toBe(7);
    expect(SAVE_VERSION).toBe(7);
    expect(migrated.pendingFight).toEqual({ anything: true });
    expect(migrated.character.branch).toBeUndefined();
    expect(needsBranch(migrated.character)).toBe(true);
  });

  it('new skills and cards are defined with descriptions', () => {
    for (const id of ['jab', 'thick_skull', 'wall_run', 'bulwark', 'bond', 'feral', 'arcane_flow']) {
      expect(SKILLS[id]!.description.length).toBeGreaterThan(10);
    }
    expect(CARDS.headbutt!.cost).toBe(5);
    expect(CARDS.pickpocket!.cost).toBe(3);
    expect(CARDS.ground_pound!.cost).toBe(5);
    expect(CARDS.pickpocket!.describe(4)).toContain('3');
  });
});

/** True if the fighter already owns the upgrade (learning it again throws). */
function ownsUpgrade(c: Character, upgradeId: string): boolean {
  try {
    applyUpgrade(JSON.parse(JSON.stringify(c)), upgradeId);
    return false;
  } catch {
    return true;
  }
}
