import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CARDS,
  FISTS_DAMAGE,
  GEAR,
  PETS,
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
import { weaponDetail } from '../ui/describe';

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
  const me = generateOpponent(12, new Rng(16), 'brawler');
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
    const t = generateOpponent(12, new Rng(784), 'tamer');
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
    // Content expansion: a skill, a card and an item per branch.
    'skill:rhythm': ['brawler', 'boxer'],
    'card:jab_flurry': ['brawler', 'boxer'],
    'gear:boxing_wraps': ['brawler', 'boxer'],
    'skill:bone_breaker': ['brawler', 'brute'],
    'card:street_bite': ['brawler', 'brute'],
    'weapon:knuckles': ['brawler', 'brute'],
    'skill:momentum': ['parkour', 'acrobat'],
    'card:backflip': ['parkour', 'acrobat'],
    'gear:spring_sneakers': ['parkour', 'acrobat'],
    'skill:quick_hands': ['parkour', 'thief'],
    'card:heist': ['parkour', 'thief'],
    'weapon:switchblade': ['parkour', 'thief'],
    'skill:thorns': ['bouncer', 'wall'],
    'card:taunt': ['bouncer', 'wall'],
    'gear:dumpster_lid': ['bouncer', 'wall'],
    'skill:demolition': ['bouncer', 'wrecker'],
    'card:sledge_swing': ['bouncer', 'wrecker'],
    'weapon:sledgehammer': ['bouncer', 'wrecker'],
    'skill:pack_call': ['tamer', 'pack'],
    'card:gang_up': ['tamer', 'pack'],
    'pet:rat': ['tamer', 'pack'],
    'pet:pigeon': ['tamer', 'pack'],
    'skill:guardian': ['tamer', 'bond'],
    'card:together': ['tamer', 'bond'],
    'gear:key_collar': ['tamer', 'bond'],
    'skill:flame': ['mystic', 'witch'],
    'card:fireball': ['mystic', 'witch'],
    'gear:neon_spray': ['mystic', 'witch'],
    'skill:overflow': ['mystic', 'warden'],
    'card:rune_circle': ['mystic', 'warden'],
    'gear:rune_amulet': ['mystic', 'warden'],
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
    let changed = 0;
    for (let seed = 0; seed < 20; seed++) {
      const save = newGame('Me', look, 'brawler', 'port', seed);
      save.character.level = BRANCH_LEVEL;
      save.pendingLevelUps = 1;
      prepareLevelUp(save);
      const before = save.offer!;
      expect(before.every((id) => UPGRADES_BY_ID[id]!.branch === undefined)).toBe(true);
      chooseFighterBranch(save, 'boxer');
      expect(save.character.branch).toBe('boxer');
      // The new offer is exactly a fresh roll with the branch set (it may hold the same items).
      const fresh = { ...save, offer: null };
      prepareLevelUp(fresh);
      expect(save.offer).toEqual(fresh.offer);
      if (save.offer!.some((id) => UPGRADES_BY_ID[id]!.branch === 'boxer')) changed++;
    }
    // Over a few seeds, branch items do show up.
    expect(changed).toBeGreaterThan(0);
  });

  it('a version 6 save with a waiting offer from the old pools gets a fresh, valid offer', () => {
    const save = newGame('M', look, 'brawler', 'port', 6) as unknown as Record<string, unknown>;
    (save.character as Character).level = 3;
    save.version = 6;
    save.pendingLevelUps = 1;
    save.offer = ['pet:dog', 'gen_health', 'gen_speed'];
    const migrated = migrateSave(JSON.parse(JSON.stringify(save)))!;
    expect(migrated.offer).toBeNull();
    expect(prepareLevelUp(migrated)).toBe(true);
    expect(migrated.offer).toHaveLength(3);
    for (const id of migrated.offer!) expect(UPGRADES_BY_ID[id]).toBeDefined();
    chooseUpgrade(migrated, migrated.offer![0]!);
    expect(migrated.pendingLevelUps).toBe(0);
    expect(migrated.offer).toBeNull();
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

  it('a bot can be made with a chosen branch (the balance tool uses this)', () => {
    const rng = new Rng(23);
    for (let i = 0; i < 20; i++) {
      const bot = generateOpponent(10, rng, 'tamer', undefined, 'bond');
      expect(bot.branch).toBe('bond');
      expect(bot.classId).toBe('tamer');
    }
    // Below the branch level there is no branch yet.
    expect(generateOpponent(4, rng, 'tamer', undefined, 'bond').branch).toBeUndefined();
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
    expect(CARDS.headbutt!.cost).toBe(6);
    expect(CARDS.pickpocket!.cost).toBe(3);
    expect(CARDS.ground_pound!.cost).toBe(5);
    expect(CARDS.pickpocket!.describe(4)).toContain('3');
  });
});

describe('class branch skills and cards', () => {
  const deckOf = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));
  /** A copy of a fighter that also knows a skill. */
  const learn = (c: Character, skill: string): Character => ({ ...c, skills: [...c.skills, skill] });
  const fresh = (classId: Character['classId']) => createCharacter('N', look, classId, 'port');
  const foe = createCharacter('F', look, 'brawler', 'port');
  const plain = (a: Character, b: Character, seed: number) => runFight(a, b, seed, { a: { deck: {} }, b: { deck: {} } });
  const hitsBy = (log: FightLog, actor: number, kind?: string) =>
    log.events.filter((e) => (e.t === 'hit' || e.t === 'block') && e.actor === actor && (kind === undefined || e.kind === kind));
  const total = (events: FightEvent[]) => events.reduce((s, e) => s + (e.t === 'hit' || e.t === 'block' ? e.damage : 0), 0);
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

  it('Jab makes the first attack of each turn hit harder', () => {
    // Jab uses no randomness, so both runs roll the same hits.
    const jab = hitsBy(plain(learn(fresh('brawler'), 'jab'), foe, 3), 0, 'melee').slice(0, 3);
    const none = hitsBy(plain(fresh('brawler'), foe, 3), 0, 'melee').slice(0, 3);
    expect(jab).toHaveLength(3);
    expect(total(jab)).toBeGreaterThan(total(none));
  });

  it('Thick Skull gives more max health and less damage taken below half health', () => {
    const skull = plain(learn(fresh('brawler'), 'thick_skull'), foe, 4);
    const none = plain(fresh('brawler'), foe, 4);
    expect(skull.roster[0]!.maxHp).toBe(Math.floor((none.roster[0]!.maxHp * 110) / 100));
    // The same hits are rolled; once below half health they do less.
    const taken = (log: FightLog) =>
      log.events.filter((e) => (e.t === 'hit' || e.t === 'block') && e.target === 0).map((e) => (e.t === 'hit' || e.t === 'block' ? e.damage : 0));
    const a = taken(skull);
    const b = taken(none);
    const n = Math.min(a.length, b.length);
    let lower = 0;
    for (let i = 0; i < n; i++) {
      expect(a[i]!).toBeLessThanOrEqual(b[i]!);
      if (a[i]! < b[i]!) lower++;
    }
    expect(lower).toBeGreaterThan(0);
  });

  it('Wall Run makes counters hit harder', () => {
    const run = (c: Character) => seeds.reduce((s, seed) => s + total(hitsBy(plain(c, foe, seed), 0, 'counter')), 0);
    expect(run(learn(fresh('parkour'), 'wall_run'))).toBeGreaterThan(run(fresh('parkour')));
  });

  it('Bulwark makes the Shield block more often', () => {
    const blocks = (c: Character) => seeds.reduce((s, seed) => s + plain(foe, c, seed).events.filter((e) => e.t === 'block' && e.target === 1).length, 0);
    expect(blocks(learn(fresh('bouncer'), 'bulwark'))).toBeGreaterThan(blocks(fresh('bouncer')));
  });

  it('Bond heals the owner right after a pet deals damage', () => {
    const healsAfterPetHit = (c: Character) =>
      seeds.some((seed) => {
        const log = plain(c, foe, seed);
        return log.events.some((e, i) => {
          const next = log.events[i + 1];
          return e.t === 'hit' && e.actor !== 0 && log.roster[e.actor]!.team === 0 && e.damage > 0 && next?.t === 'heal' && next.actor === 0;
        });
      });
    expect(healsAfterPetHit(learn(fresh('tamer'), 'bond'))).toBe(true);
    expect(healsAfterPetHit(fresh('tamer'))).toBe(false);
  });

  it('Feral makes some pet hits do double damage', () => {
    // The tamer's dog is unit 1.
    const average = (c: Character) => {
      const hits = seeds.flatMap((seed) => plain(c, foe, seed).events.filter((e) => e.t === 'hit' && e.actor === 1));
      return total(hits) / hits.length;
    };
    expect(average(learn(fresh('tamer'), 'feral'))).toBeGreaterThan(average(fresh('tamer')) * 1.1);
  });

  it('Arcane Flow makes spells cheaper, so more get cast', () => {
    const casts = (c: Character) => seeds.reduce((s, seed) => s + plain(c, foe, seed).events.filter((e) => e.t === 'cast' && e.actor === 0).length, 0);
    expect(casts(learn(fresh('mystic'), 'arcane_flow'))).toBeGreaterThan(casts(fresh('mystic')));
  });

  const play = (me: Character, card: string, tick: number, seed: number, other: Character = foe) =>
    runFight(me, other, seed, { a: { interactive: true, deck: deckOf(card), plays: [{ tick, card }], breaks: [] }, b: { deck: {} } });
  const noPlay = (me: Character, card: string, seed: number, other: Character = foe) =>
    runFight(me, other, seed, { a: { interactive: true, deck: deckOf(card), plays: [], breaks: [] }, b: { deck: {} } });
  const cardIndex = (log: FightLog, card: string) => log.events.findIndex((e) => e.t === 'card' && e.card === card && e.actor === 0);
  /** Everything before the card (and its energy event) is the same as without playing it. */
  const sameBefore = (log: FightLog, without: FightLog, card: string) => {
    const from = cardIndex(log, card) - 1;
    expect(log.events[from]).toMatchObject({ t: 'energy', actor: 0 });
    expect(log.events.slice(0, from)).toEqual(without.events.slice(0, from));
  };

  /** The first attack the fighter (actor 0) makes after the given event index. */
  const nextStrike = (log: FightLog, from: number) =>
    log.events.slice(from).find((e) => (e.t === 'hit' || e.t === 'block' || e.t === 'dodge' || e.t === 'miss') && e.actor === 0)!;

  it('Headbutt makes the enemy lose their next turn when the next hit lands', () => {
    // Costs 6: playable at tick 15. The card itself does not attack: the next hit carries it.
    const me = fresh('brawler');
    let stuns = 0;
    for (const seed of seeds) {
      const log = play(me, 'headbutt', 15, seed);
      sameBefore(log, noPlay(me, 'headbutt', seed), 'headbutt');
      const from = cardIndex(log, 'headbutt');
      expect(log.events[from + 1]?.t).not.toMatch(/^(hit|block|dodge)$/);
      const strike = nextStrike(log, from);
      const after = log.events.slice(log.events.indexOf(strike) + 1);
      const stunned = after.findIndex((e) => e.t === 'stunned' && e.actor === 1);
      if ((strike.t === 'hit' || strike.t === 'block') && strike.hp > 0) {
        expect(stunned).toBeGreaterThanOrEqual(0);
        // Before losing that turn, the enemy did not act.
        expect(after.slice(0, stunned).some((e) => (e.t === 'hit' || e.t === 'block' || e.t === 'dodge' || e.t === 'rest') && e.actor === 1)).toBe(false);
        stuns++;
      } else if (strike.t === 'dodge' || strike.t === 'miss') {
        // A dodged or missed hit uses the Headbutt up without stunning.
        expect(log.events.some((e) => e.t === 'stunned')).toBe(false);
      }
    }
    expect(stuns).toBeGreaterThanOrEqual(10);
  });

  it('Headbutt makes the next hit stronger, with the same roll', () => {
    // Playing Headbutt uses no randomness, so the next hit rolls the same as without it.
    // A stronger Brawler, so the +10% is at least one more point before the roll.
    const me = fresh('brawler');
    me.bonusStats = { ...me.bonusStats, strength: 5 };
    let compared = 0;
    let stronger = 0;
    for (const seed of seeds) {
      const log = play(me, 'headbutt', 15, seed);
      const without = noPlay(me, 'headbutt', seed);
      const butt = nextStrike(log, cardIndex(log, 'headbutt'));
      const tick = without.events.findIndex((e) => e.t === 'tick' && e.n === 15);
      const plainHit = nextStrike(without, tick);
      expect(butt.t).toBe(plainHit.t);
      if (butt.t === 'hit' && plainHit.t === 'hit') {
        expect(butt.damage).toBeGreaterThanOrEqual(plainHit.damage);
        if (butt.damage > plainHit.damage) stronger++;
        compared++;
      }
    }
    expect(compared).toBeGreaterThanOrEqual(10);
    expect(stronger).toBeGreaterThan(0);
  });

  it('Pickpocket steals 2 energy from the enemy', () => {
    // Costs 3: playable at tick 0, when both sides have 3 energy.
    const me = fresh('parkour');
    const log = play(me, 'pickpocket', 0, 5);
    sameBefore(log, noPlay(me, 'pickpocket', 5), 'pickpocket');
    const after = log.events.slice(cardIndex(log, 'pickpocket'));
    expect(after.find((e) => e.t === 'energy' && e.actor === 1)).toMatchObject({ energy: 1 });
    expect(after.find((e) => e.t === 'energy' && e.actor === 0)).toMatchObject({ energy: 2 });
  });

  it('Ground Pound hits every enemy unit and is never dodged', () => {
    // Costs 5: playable at tick 10. The tamer brings a dog.
    const me = fresh('bouncer');
    const tamer = fresh('tamer');
    const log = play(me, 'ground_pound', 10, 6, tamer);
    sameBefore(log, noPlay(me, 'ground_pound', 6, tamer), 'ground_pound');
    const from = cardIndex(log, 'ground_pound');
    const enemies = log.roster.map((u, i) => (u.team === 1 ? i : -1)).filter((i) => i >= 0);
    // The strikes come right after the card, before anyone's turn.
    const strikes = log.events.slice(from + 1).filter((e) => e.t === 'hit' || e.t === 'block' || e.t === 'dodge').slice(0, enemies.length);
    for (const e of strikes) expect(e).toMatchObject({ actor: 0 });
    expect(strikes.some((e) => e.t === 'dodge')).toBe(false);
    expect(strikes.map((e) => (e.t === 'dodge' ? -1 : e.target))).toEqual(enemies);
  });

  it('Ground Pound is never dodged, even by a dodgy foe, and does 60% damage', () => {
    // A bare-fisted Brawler: every hit starts from the same base damage, before the 80-120% roll.
    const me = fresh('brawler');
    const dodger = learn(createCharacter('P', look, 'parkour', 'rooftops'), 'sixth_sense');
    const base = CLASSES.brawler.baseStats.strength + FISTS_DAMAGE;
    const pound = Math.floor((base * 60) / 100);
    const lowest = Math.floor((pound * 80) / 100);
    const highest = Math.floor((pound * 120) / 100);
    // A full-strength hit could never be this weak, so the range really checks the 60%.
    expect(highest).toBeLessThan(Math.floor((base * 80) / 100));
    let strikes = 0;
    let plainDodges = 0;
    for (const seed of seeds) {
      const log = play(me, 'ground_pound', 10, seed, dodger);
      const from = cardIndex(log, 'ground_pound');
      expect(from).toBeGreaterThanOrEqual(0);
      const strike = log.events.slice(from + 1).find((e) => e.t === 'hit' || e.t === 'block' || e.t === 'dodge')!;
      expect(strike).toMatchObject({ t: 'hit', actor: 0, target: 1 });
      if (strike.t === 'hit') {
        expect(strike.damage).toBeGreaterThanOrEqual(lowest);
        expect(strike.damage).toBeLessThanOrEqual(highest);
      }
      strikes++;
      plainDodges += noPlay(me, 'ground_pound', seed, dodger).events.filter((e) => e.t === 'dodge' && e.actor === 0).length;
    }
    expect(strikes).toBe(seeds.length);
    // This foe dodges plain hits often, so a dodgeable Ground Pound would have been dodged.
    expect(plainDodges).toBeGreaterThan(seeds.length);
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

describe('content expansion data', () => {
  it('each branch has 6-7 own upgrades', () => {
    for (const pair of Object.values(BRANCHES)) {
      for (const b of pair) {
        const own = UPGRADES.filter((u) => u.branch === b.id);
        expect([b.id, own.length >= 6 && own.length <= 7]).toEqual([b.id, true]);
      }
    }
  });

  it('the general pool has 8 weapons and 7 gear', () => {
    const general = UPGRADES.filter((u) => u.pool === 'general');
    expect(general.filter((u) => u.kind === 'weapon').map((u) => u.id).sort()).toEqual(
      ['bat', 'chain', 'skateboard', 'umbrella', 'brick', 'bottle', 'pool_cue', 'crowbar'].map((id) => `weapon:${id}`).sort(),
    );
    expect(general.filter((u) => u.kind === 'gear').map((u) => u.id).sort()).toEqual(
      ['leather_jacket', 'sneakers', 'charm', 'cap', 'patched_coat', 'backpack', 'headphones'].map((id) => `gear:${id}`).sort(),
    );
  });

  it('new skills exist with a description', () => {
    for (const id of ['rhythm', 'bone_breaker', 'momentum', 'quick_hands', 'thorns', 'demolition', 'pack_call', 'guardian', 'flame', 'overflow']) {
      expect(SKILLS[id]?.description.length).toBeGreaterThan(10);
      expect(SPELLS[id]).toBeUndefined();
    }
  });

  it('new cards are class cards with the spec costs and describe every level', () => {
    const costs: Record<string, [string, number]> = {
      jab_flurry: ['brawler', 4],
      street_bite: ['brawler', 4],
      backflip: ['parkour', 4],
      heist: ['parkour', 4],
      taunt: ['bouncer', 3],
      sledge_swing: ['bouncer', 5],
      gang_up: ['tamer', 5],
      together: ['tamer', 4],
      fireball: ['mystic', 5],
      rune_circle: ['mystic', 4],
    };
    for (const [id, [pool, cost]] of Object.entries(costs)) {
      const card = CARDS[id]!;
      expect([id, card.pool, card.cost, card.starting]).toEqual([id, pool, cost, false]);
      expect(card.describe(1).length).toBeGreaterThan(10);
    }
    // Scaled numbers show up in the text.
    expect(CARDS.street_bite!.describe(1)).toContain('5');
    expect(CARDS.street_bite!.describe(5)).toContain('7');
    expect(CARDS.backflip!.describe(4)).toContain('3');
  });

  it('new weapons have the spec numbers', () => {
    const spec: Record<string, [number, number, boolean]> = {
      knuckles: [5, 10, false],
      switchblade: [4, 15, false],
      sledgehammer: [12, -15, true],
      brick: [5, 0, false],
      bottle: [8, 0, false],
      pool_cue: [4, 20, false],
      crowbar: [8, -5, true],
    };
    for (const [id, [damage, accuracy, heavy]] of Object.entries(spec)) {
      const w = WEAPONS[id]!;
      expect([id, w.damage, w.accuracy, w.heavy]).toEqual([id, damage, accuracy, heavy]);
    }
    expect(WEAPONS.bottle!.breaks).toBe(true);
    expect(WEAPONS.brick!.throwBonusPct).toBe(50);
    expect(WEAPONS.bat!.breaks).toBeUndefined();
  });

  it('new gear has the spec slot and numbers', () => {
    expect(GEAR.boxing_wraps).toMatchObject({ slot: 'accessory', startRhythm: 2 });
    expect(GEAR.spring_sneakers).toMatchObject({ slot: 'accessory', dodge: 6 });
    expect(GEAR.dumpster_lid).toMatchObject({ slot: 'armor', armor: 2, thorns: 10 });
    expect(GEAR.key_collar).toMatchObject({ slot: 'accessory', petHealth: 40 });
    expect(GEAR.neon_spray).toMatchObject({ slot: 'accessory', magic: 2 });
    expect(GEAR.rune_amulet).toMatchObject({ slot: 'accessory', magicResist: 30 });
    expect(GEAR.cap).toMatchObject({ slot: 'accessory', dodge: 4 });
    expect(GEAR.patched_coat).toMatchObject({ slot: 'armor', armor: 2, speed: -1 });
    expect(GEAR.backpack).toMatchObject({ slot: 'accessory', staminaRegen: 1 });
    expect(GEAR.headphones).toMatchObject({ slot: 'accessory', speed: 1, dodge: 2 });
  });

  it('new pets have the spec numbers', () => {
    expect(PETS.rat).toMatchObject({ maxHp: 7, damage: 2, agility: 8, speed: 8 });
    expect(PETS.pigeon).toMatchObject({ maxHp: 6, damage: 1, agility: 12, speed: 9 });
  });

  it('gear magic adds to the fighter magic in fights', () => {
    const c = createCharacter('M', look, 'mystic', 'port');
    c.gear = ['neon_spray'];
    const foe = createCharacter('F', look, 'brawler', 'port');
    const plain = runFight(c, foe, 3, { a: { gear: { armor: null, accessory: null } } });
    const sprayed = runFight(c, foe, 3, { a: { gear: { armor: null, accessory: 'neon_spray' } } });
    // Same seed: the first spell hit lands the same way, only bigger with 2 more magic.
    const firstSpell = (log: FightLog) => log.events.find((e) => e.t === 'hit' && e.kind === 'spell' && e.actor === 0);
    const a = firstSpell(plain);
    const b = firstSpell(sprayed);
    expect(a && a.t === 'hit' && b && b.t === 'hit' && b.damage > a.damage).toBe(true);
  });
});

describe('signature mechanics: Rhythm, Bleed, Momentum, Steal, Thorns', () => {
  const learn = (c: Character, ...skills: string[]): Character => ({ ...c, skills: [...c.skills, ...skills] });
  const fresh = (classId: Character['classId']) => createCharacter('N', look, classId, 'port');
  /** A fighter with big stats, so percentages of damage are not rounded away. */
  const strong = (c: Character): Character => ({ ...c, bonusStats: { health: 40, strength: 40, agility: 0, speed: 0, magic: 0 } });
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
  const plain = (a: Character, b: Character, seed: number, opts: { a?: TeamOptions; b?: TeamOptions } = {}) =>
    runFight(a, b, seed, { a: { deck: {}, ...opts.a }, b: { deck: {}, ...opts.b } });
  const play = (me: Character, card: string, tick: number, seed: number, other: Character, level = 1) =>
    runFight(me, other, seed, { a: { interactive: true, deck: { [card]: level }, plays: [{ tick, card }], breaks: [] }, b: { deck: {} } });
  const noPlay = (me: Character, card: string, seed: number, other: Character, level = 1) =>
    runFight(me, other, seed, { a: { interactive: true, deck: { [card]: level }, plays: [], breaks: [] }, b: { deck: {} } });
  const cardIndex = (log: FightLog, card: string) => log.events.findIndex((e) => e.t === 'card' && e.card === card && e.actor === 0);
  /** Everything before the card (and its energy event) is the same as without playing it. */
  const sameBefore = (log: FightLog, without: FightLog, card: string) => {
    const from = cardIndex(log, card) - 1;
    expect(log.events[from]).toMatchObject({ t: 'energy', actor: 0 });
    expect(log.events.slice(0, from)).toEqual(without.events.slice(0, from));
  };
  type Strike = Extract<FightEvent, { t: 'hit' | 'block' | 'dodge' }>;
  const isStrike = (e: FightEvent): e is Strike => e.t === 'hit' || e.t === 'block' || e.t === 'dodge';
  const strikes = (log: FightLog, actor: number) => log.events.filter((e) => (e.t === 'hit' || e.t === 'block') && e.actor === actor);
  const sum = (events: FightEvent[]) => events.reduce((s, e) => s + (e.t === 'hit' || e.t === 'block' ? e.damage : 0), 0);
  const foe = fresh('brawler');

  // --- Rhythm (Boxer) ---
  it('Rhythm stacks up to 5 on landed hits and resets when the fighter takes damage', () => {
    const boxer = learn(fresh('brawler'), 'rhythm');
    let maxStacks = 0;
    let resets = 0;
    let checked = 0;
    for (const seed of seeds) {
      const log = plain(boxer, foe, seed);
      let stacks = 0;
      log.events.forEach((e, i) => {
        if (e.t === 'rhythm' && e.actor === 0) {
          // One step up at a time, or straight to zero.
          expect(e.stacks === 0 || e.stacks === stacks + 1).toBe(true);
          if (e.stacks === 0) resets++;
          stacks = e.stacks;
          maxStacks = Math.max(maxStacks, stacks);
        }
        // Damage to the boxer: the reset is emitted right BEFORE the hit event.
        // Stacks are already 0 by then, so we look at the event that reset them.
        if (e.t === 'hit' && e.target === 0 && e.damage > 0) {
          const before = log.events[i - 1]!;
          if (before.t === 'rhythm' && before.actor === 0) {
            expect(before.stacks).toBe(0);
            checked++;
          } else {
            // No reset event right before: there were no stacks to lose.
            expect(stacks).toBe(0);
          }
        }
      });
    }
    // The reset check really ran, and it ran on hits that had stacks to lose.
    expect(checked).toBeGreaterThan(0);
    expect(maxStacks).toBe(5);
    expect(resets).toBeGreaterThan(0);
  });

  it('Rhythm stacks add 5% damage each, only with the skill', () => {
    const boxer = learn(fresh('brawler'), 'rhythm');
    // Rhythm uses no randomness: the same dice, but every stack makes the hits stronger.
    const first = (c: Character) => seeds.reduce((s, seed) => s + sum(strikes(plain(c, foe, seed), 0).slice(0, 6)), 0);
    expect(first(boxer)).toBeGreaterThan(first(fresh('brawler')));
    expect(seeds.some((seed) => plain(fresh('brawler'), foe, seed).events.some((e) => e.t === 'rhythm'))).toBe(false);
  });

  it('Boxing Wraps start every round with 2 rhythm stacks and make them count', () => {
    const wrapped: Character = { ...fresh('brawler'), gear: ['boxing_wraps'] };
    const worn = { gear: { armor: null, accessory: 'boxing_wraps' } };
    const log = runFight(wrapped, foe, 3, { a: { deck: {}, ...worn, interactive: true, plays: [], breaks: [keep([])] }, b: { deck: {} } });
    const round1 = log.events.findIndex((e) => e.t === 'round' && e.round === 1);
    expect(log.events[round1 + 1]).toMatchObject({ t: 'rhythm', actor: 0, stacks: 2 });
    const round2 = log.events.findIndex((e) => e.t === 'round' && e.round === 2);
    expect(round2).toBeGreaterThan(0);
    expect(log.events.slice(round2, round2 + 3)).toContainEqual({ t: 'rhythm', actor: 0, stacks: 2 });
    // Two stacks are +10% from the very first hit, with no skill (big stats, so 10% is not rounded away).
    const first = (c: Character, gear: TeamOptions['gear']) =>
      seeds.reduce((s, seed) => s + sum(strikes(plain(strong(c), foe, seed, { a: { gear } }), 0).slice(0, 1)), 0);
    expect(first(wrapped, worn.gear)).toBeGreaterThan(first(fresh('brawler'), undefined));
  });

  it('Jab Flurry strikes 3 times at 60% and adds rhythm stacks even without the skill', () => {
    // Costs 4: playable at tick 5. A bare-fisted Brawler: every hit starts from the same base damage.
    const me = fresh('brawler');
    const base = CLASSES.brawler.baseStats.strength + FISTS_DAMAGE;
    const jab = Math.floor((base * 60) / 100);
    const highest = Math.floor((jab * 120) / 100);
    expect(highest).toBeLessThan(Math.floor((base * 80) / 100));
    let allLanded = 0;
    for (const seed of seeds) {
      const log = play(me, 'jab_flurry', 5, seed, foe);
      sameBefore(log, noPlay(me, 'jab_flurry', seed, foe), 'jab_flurry');
      const from = cardIndex(log, 'jab_flurry');
      const flurry = log.events.slice(from + 1).filter((e): e is Strike => isStrike(e) && e.actor === 0).slice(0, 3);
      expect(flurry).toHaveLength(3);
      for (const e of flurry) {
        expect(e.kind).toBe('double');
        if (e.t === 'hit') expect(e.damage).toBeLessThanOrEqual(highest);
      }
      const stacks = log.events.slice(from).filter((e) => e.t === 'rhythm' && e.actor === 0);
      const landed = flurry.filter((e) => e.t !== 'dodge').length;
      expect(stacks.slice(0, landed).map((e) => (e.t === 'rhythm' ? e.stacks : -1))).toEqual(Array.from({ length: landed }, (_, k) => k + 1));
      if (landed === 3) allLanded++;
    }
    expect(allLanded).toBeGreaterThan(0);
  });

  // --- Bleed (Brute) ---
  it('Street Bite makes them bleed 5 on each of their next 3 turns when it lands, ignoring armor', () => {
    const me = fresh('brawler');
    let landed = 0;
    let dodged = 0;
    for (const seed of seeds) {
      const log = play(me, 'street_bite', 5, seed, foe);
      sameBefore(log, noPlay(me, 'street_bite', seed, foe), 'street_bite');
      const from = cardIndex(log, 'street_bite');
      const strike = log.events.slice(from + 1).find((e) => (e.t === 'hit' || e.t === 'block' || e.t === 'dodge' || e.t === 'miss') && e.actor === 0)!;
      const bleeds = log.events.slice(from).filter((e) => e.t === 'bleed');
      if (strike.t === 'dodge') {
        dodged++;
        expect(bleeds).toHaveLength(0);
      } else {
        landed++;
        // Three bleeds, unless the fight ended first.
        if (log.events.some((e) => e.t === 'death')) expect(bleeds.length).toBeLessThanOrEqual(3);
        else expect(bleeds).toHaveLength(3);
        expect(bleeds.length).toBeGreaterThan(0);
        for (const b of bleeds) expect(b).toMatchObject({ actor: 1, damage: 5 });
      }
    }
    expect(landed).toBeGreaterThan(0);
    expect(dodged).toBeGreaterThan(0);
  });

  it('Bone Breaker makes some landed hits bleed 3, and a weaker bleed never replaces a stronger one', () => {
    const brute = learn(fresh('brawler'), 'bone_breaker');
    const none = seeds.reduce((s, seed) => s + plain(fresh('brawler'), foe, seed).events.filter((e) => e.t === 'bleed').length, 0);
    expect(none).toBe(0);
    const bleeds = seeds.flatMap((seed) => plain(brute, foe, seed).events.filter((e) => e.t === 'bleed'));
    expect(bleeds.length).toBeGreaterThan(0);
    for (const b of bleeds) expect(b).toMatchObject({ actor: 1, damage: 3 });
    // Street Bite (5) first, then Bone Breaker (3) lands more bleeds: the 5 stays, and the turns restart.
    let refreshed = 0;
    for (const seed of seeds) {
      const log = play(brute, 'street_bite', 5, seed, foe);
      const after = log.events.slice(cardIndex(log, 'street_bite')).filter((e) => e.t === 'bleed');
      // Only fights where the bite landed (its bleed is the first one, and it is 5).
      if (after.length === 0 || after[0]!.t !== 'bleed' || after[0]!.damage !== 5) continue;
      for (const b of after.slice(0, 3)) expect(b).toMatchObject({ damage: 5 });
      if (after.length > 3) refreshed++;
    }
    expect(refreshed).toBeGreaterThan(0);
  });

  it('Brass Knuckles and Switchblade are drawn and hit harder than bare fists', () => {
    const avg = (c: Character) => {
      const hits = seeds.flatMap((seed) => strikes(plain(c, foe, seed), 0).filter((e) => e.t === 'hit' && e.kind === 'melee'));
      return { mean: sum(hits) / hits.length, weapons: new Set(hits.map((e) => (e.t === 'hit' ? e.weapon : null))) };
    };
    const bare = avg({ ...fresh('brawler'), weapons: [] });
    const knuckles = avg({ ...fresh('brawler'), weapons: ['knuckles'] });
    expect(knuckles.weapons.has('knuckles')).toBe(true);
    expect(knuckles.mean).toBeGreaterThan(bare.mean);
    const bareThief = avg({ ...fresh('parkour'), weapons: [] });
    const blade = avg({ ...fresh('parkour'), weapons: ['switchblade'] });
    expect(blade.weapons.has('switchblade')).toBe(true);
    expect(blade.mean).toBeGreaterThan(bareThief.mean);
  });

  // --- Momentum (Acrobat) ---
  it('Momentum gives +1 energy on every dodge', () => {
    const acrobat = learn(fresh('parkour'), 'momentum', 'sixth_sense');
    let dodges = 0;
    for (const seed of seeds) {
      const log = plain(acrobat, foe, seed);
      let energy = 3;
      log.events.forEach((e, i) => {
        if (e.t === 'energy' && e.actor === 0) energy = e.energy;
        // With a full energy bar (nobody plays cards here) there is nothing to give.
        if (e.t === 'dodge' && e.target === 0 && energy < 10) {
          dodges++;
          const next = log.events[i + 1]!;
          expect(next).toMatchObject({ t: 'momentum', actor: 0 });
          expect(log.events[i + 2]).toMatchObject({ t: 'energy', actor: 0, energy: next.t === 'momentum' ? next.energy : -1 });
        }
      });
      // The same fighter without the skill never gets one.
      expect(plain(learn(fresh('parkour'), 'sixth_sense'), foe, seed).events.some((e) => e.t === 'momentum')).toBe(false);
    }
    expect(dodges).toBeGreaterThan(10);
  });

  it('Momentum gives nothing for the sure dodges of Backflip', () => {
    const acrobat = learn(fresh('parkour'), 'momentum');
    const bouncer = fresh('bouncer');
    for (const seed of [1, 2, 3, 4, 5]) {
      const log = play(acrobat, 'backflip', 5, seed, bouncer);
      const after = log.events.slice(cardIndex(log, 'backflip'));
      // The two sure dodges come right after the card, with no Momentum event next to them.
      const sure = after.filter((e) => e.t === 'dodge' && e.target === 0).slice(0, 2);
      expect(sure.length).toBe(2);
      for (const d of sure) expect(after[after.indexOf(d) + 1]!.t).not.toBe('momentum');
      // Backflip's own +2 energy is still there.
      expect(after.find((e) => e.t === 'energy' && e.actor === 0)).toMatchObject({ energy: 2 });
    }
  });

  it('Backflip dodges the next 2 attacks for sure and gives +2 energy', () => {
    // Costs 4: playable at tick 5, when the fighter has 4 energy.
    const me = fresh('bouncer');
    const attacksOn0 = (log: FightLog) =>
      log.events.slice(cardIndex(log, 'backflip')).filter((e) => (e.t === 'hit' || e.t === 'block' || e.t === 'dodge') && e.target === 0 && e.kind !== 'counter');
    for (const seed of [1, 2, 3, 4, 5]) {
      const log = play(me, 'backflip', 5, seed, foe);
      sameBefore(log, noPlay(me, 'backflip', seed, foe), 'backflip');
      expect(log.events.slice(cardIndex(log, 'backflip')).find((e) => e.t === 'energy' && e.actor === 0)).toMatchObject({ energy: 2 });
      expect(attacksOn0(log).slice(0, 2).map((e) => e.t)).toEqual(['dodge', 'dodge']);
    }
    // Card level 4 dodges one more.
    expect(attacksOn0(play(me, 'backflip', 5, 2, foe, 4)).slice(0, 3).map((e) => e.t)).toEqual(['dodge', 'dodge', 'dodge']);
  });

  // --- Steal (Thief) ---
  it('Quick Hands steals 5 stamina from some landed hits', () => {
    const thief = learn(fresh('parkour'), 'quick_hands');
    const steals = seeds.flatMap((seed) => plain(thief, foe, seed).events.filter((e) => e.t === 'steal'));
    expect(steals.length).toBeGreaterThan(0);
    for (const s of steals) expect(s).toMatchObject({ actor: 0, target: 1, energy: 0, stamina: 5 });
    expect(seeds.some((seed) => plain(fresh('parkour'), foe, seed).events.some((e) => e.t === 'steal'))).toBe(false);
  });

  it('Heist steals 2 energy and 15 stamina (3 and 19 at card level 4)', () => {
    // Costs 4: playable at tick 5. Nobody else spends energy, so the foe has 4 energy then.
    const me = fresh('parkour');
    const log = play(me, 'heist', 5, 5, foe);
    sameBefore(log, noPlay(me, 'heist', 5, foe), 'heist');
    const after = log.events.slice(cardIndex(log, 'heist'));
    expect(after.find((e) => e.t === 'steal')).toMatchObject({ actor: 0, target: 1, energy: 2, stamina: 15 });
    expect(after.find((e) => e.t === 'energy' && e.actor === 1)).toMatchObject({ energy: 2 });
    expect(after.find((e) => e.t === 'energy' && e.actor === 0)).toMatchObject({ energy: 2 });
    const log4 = play(me, 'heist', 5, 5, foe, 4);
    expect(log4.events.slice(cardIndex(log4, 'heist')).find((e) => e.t === 'steal')).toMatchObject({ energy: 3, stamina: 19 });
  });

  it('Heist shows no steal event when the foe has nothing to take', () => {
    const me = fresh('parkour');
    let heists = 0;
    for (const seed of seeds) {
      // The foe has played its energy away, and heist is played again and again.
      const log = runFight(me, foe, seed, {
        a: { interactive: true, deck: { heist: 1 }, plays: [10, 15, 20, 25, 30, 35, 40, 45, 50].map((tick) => ({ tick, card: 'heist' })), breaks: [] },
        b: { interactive: true, deck: { rage: 1 }, plays: [{ tick: 0, card: 'rage' }], breaks: [] },
      });
      for (const e of log.events) {
        if (e.t === 'steal') expect(e.energy + e.stamina).toBeGreaterThan(0);
      }
      heists += log.events.filter((e) => e.t === 'card' && e.card === 'heist').length;
    }
    expect(heists).toBeGreaterThan(0);
  });

  // --- Thorns (Wall) ---
  /** For every thorns event of the bearer: the hit that caused it, found right before. */
  const thornsPairs = (log: FightLog, bearer: number) =>
    log.events.flatMap((e, i) => {
      if (e.t !== 'thorns' || e.actor !== bearer) return [];
      const cause = log.events.slice(0, i).reverse().find((x) => (x.t === 'hit' || x.t === 'block') && x.target === bearer && x.actor === e.target);
      return [{ thorns: e, hit: cause as Extract<FightEvent, { t: 'hit' }> }];
    });

  it('Thorns reflects 20% of the damage dealt, at least 1', () => {
    const wall = learn(fresh('bouncer'), 'thorns');
    let seen = 0;
    for (const seed of seeds) {
      for (const { thorns, hit } of thornsPairs(plain(wall, foe, seed), 0)) {
        seen++;
        expect(thorns).toMatchObject({ target: 1, damage: Math.max(1, Math.floor((hit.damage * 20) / 100)) });
      }
      expect(plain(fresh('bouncer'), foe, seed).events.some((e) => e.t === 'thorns')).toBe(false);
    }
    expect(seen).toBeGreaterThan(10);
    // Against a heavy hitter the share really is 20%.
    const big = thornsPairs(plain(strong(wall), strong(foe), 4), 0);
    expect(big.some((p) => p.hit.damage >= 20 && p.thorns.damage === Math.floor(p.hit.damage / 5))).toBe(true);
  });

  it('Dumpster Lid gives 10% thorns, and stacks with the skill to 30%', () => {
    const lid = (c: Character): Character => ({ ...c, gear: ['dumpster_lid'] });
    const worn = { gear: { armor: 'dumpster_lid', accessory: null } };
    const check = (c: Character, pct: number) => {
      const pairs = thornsPairs(plain(strong(c), strong(foe), 4, { a: worn }), 0);
      expect(pairs.length).toBeGreaterThan(0);
      for (const { thorns, hit } of pairs) expect(thorns.damage).toBe(Math.max(1, Math.floor((hit.damage * pct) / 100)));
    };
    check(lid(fresh('bouncer')), 10);
    check(learn(lid(fresh('bouncer')), 'thorns'), 30);
  });

  it('Taunt forces enemy pets onto you for 2 turns and doubles your thorns against them', () => {
    // A test-only armor with 100% thorns, so doubling is easy to see in the numbers.
    GEAR.test_spikes = { id: 'test_spikes', name: 'Test Spikes', slot: 'armor', thorns: 100 };
    try {
      const me: Character = { ...fresh('bouncer'), pets: ['dog'], gear: ['test_spikes'] };
      const tamer = fresh('tamer');
      const worn = { gear: { armor: 'test_spikes', accessory: null } };
      const run = (taunt: boolean, seed: number) =>
        runFight(me, tamer, seed, { a: { interactive: true, deck: { taunt: 1 }, plays: taunt ? [{ tick: 0, card: 'taunt' }] : [], breaks: [], ...worn }, b: { deck: {} } });
      const enemyPets = (log: FightLog) => log.roster.map((u, i) => (u.team === 1 && !u.isMain ? i : -1)).filter((i) => i >= 0);
      /** Events from the card to the end of the fighter's second turn after it (Taunt lasts 2 turns). */
      const window = (log: FightLog) => {
        const from = cardIndex(log, 'taunt');
        /** A turn of the fighter (mine) or of someone else: a plain attack or a rest. */
        const turnOf = (e: FightEvent, mine: boolean) =>
          (e.t === 'rest' && (e.actor === 0) === mine) ||
          ((e.t === 'hit' || e.t === 'block' || e.t === 'dodge') && (e.actor === 0) === mine && (e.kind === 'melee' || e.kind === 'throw'));
        let turns = 0;
        for (let i = from + 1; i < log.events.length; i++) {
          const e = log.events[i]!;
          if (turns < 2 && turnOf(e, true)) turns++;
          // The first thing that is not part of the fighter's second turn closes the window.
          else if (turns === 2 && (e.t === 'tick' || turnOf(e, false))) return log.events.slice(from, i);
        }
        return log.events.slice(from);
      };
      const petStrike = (pets: number[]) => (e: FightEvent): e is Strike => isStrike(e) && pets.includes(e.actor) && e.kind !== 'counter';
      let spared = 0;
      let doubled = 0;
      for (const seed of seeds) {
        const log = run(true, seed);
        const without = run(false, seed);
        sameBefore(log, without, 'taunt');
        const pets = enemyPets(log);
        const inWindow = window(log);
        for (const e of inWindow.filter(petStrike(pets))) expect(e).toMatchObject({ target: 0 });
        // Without Taunt, pets sometimes pick the fighter's own pet instead.
        if (without.events.slice(0, inWindow.length + cardIndex(log, 'taunt')).filter(petStrike(pets)).some((e) => e.t !== 'dodge' && e.target !== 0)) spared++;
        // Thorns from a pet's hit: 100% normally, 200% while taunting.
        for (const { thorns, hit } of thornsPairs({ ...log, events: inWindow }, 0)) {
          if (pets.includes(thorns.target)) {
            expect(thorns.damage).toBe(Math.max(1, hit.damage * 2));
            doubled++;
          }
        }
      }
      expect(spared).toBeGreaterThan(0);
      expect(doubled).toBeGreaterThan(0);
      // Without Taunt, the same armor reflects exactly the damage dealt.
      const plainPairs = seeds.flatMap((seed) => thornsPairs(run(false, seed), 0));
      expect(plainPairs.length).toBeGreaterThan(0);
      for (const { thorns, hit } of plainPairs) expect(thorns.damage).toBe(Math.max(1, hit.damage));
    } finally {
      delete GEAR.test_spikes;
    }
  });

  it('bots answer an enemy Rage with Backflip or Taunt', () => {
    const bot = fresh('parkour');
    const log = runFight(foe, bot, 5, {
      a: { interactive: true, deck: { rage: 1 }, plays: [{ tick: 10, card: 'rage' }], breaks: [] },
      b: { deck: { backflip: 1, taunt: 1 } },
    });
    const reaction = log.events.find((e) => e.t === 'card' && e.actor === 1);
    expect(reaction).toMatchObject({ card: expect.stringMatching(/^(backflip|taunt)$/) });
  });

  it('bots do not answer with Taunt when the enemy has no pets', () => {
    const bot = fresh('parkour');
    /** Ticks at which the bot (team 1 main) played Taunt in the 5 ticks after the Rage at tick 10 (its reaction time). */
    const tauntReactions = (log: FightLog) => {
      let tick = 0;
      const ticks: number[] = [];
      for (const e of log.events) {
        if (e.t === 'tick') tick = e.n;
        if (e.t === 'card' && e.card === 'taunt' && e.actor === log.roster.findIndex((u) => u.team === 1 && u.isMain) && tick >= 10 && tick <= 15) ticks.push(tick);
      }
      return ticks;
    };
    const opts = { a: { interactive: true, deck: { rage: 1 }, plays: [{ tick: 10, card: 'rage' }], breaks: [] }, b: { deck: { taunt: 1 } } };
    // Only Taunt in the deck: with no enemy pets, the bot does not pick it as a defence.
    expect(tauntReactions(runFight(foe, bot, 5, opts))).toEqual([]);
    // With an enemy pet around, it is a valid answer.
    expect(tauntReactions(runFight(createCharacter('T', look, 'tamer', 'port'), bot, 5, opts)).length).toBeGreaterThan(0);
  });
});

describe('signature mechanics: Armor break, Pack bonus, Guardian, Burn, Overheal', () => {
  const learn = (c: Character, ...skills: string[]): Character => ({ ...c, skills: [...c.skills, ...skills] });
  const fresh = (classId: Character['classId']) => createCharacter('N', look, classId, 'port');
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
  const plain = (a: Character, b: Character, seed: number, opts: { a?: TeamOptions; b?: TeamOptions } = {}) =>
    runFight(a, b, seed, { a: { deck: {}, ...opts.a }, b: { deck: {}, ...opts.b } });
  const play = (me: Character, card: string, tick: number, seed: number, other: Character, level = 1) =>
    runFight(me, other, seed, { a: { interactive: true, deck: { [card]: level }, plays: [{ tick, card }], breaks: [] }, b: { deck: {} } });
  const noPlay = (me: Character, card: string, seed: number, other: Character, level = 1) =>
    runFight(me, other, seed, { a: { interactive: true, deck: { [card]: level }, plays: [], breaks: [] }, b: { deck: {} } });
  const cardIndex = (log: FightLog, card: string) => log.events.findIndex((e) => e.t === 'card' && e.card === card && e.actor === 0);
  /** Everything before the card (and its energy event) is the same as without playing it. */
  const sameBefore = (log: FightLog, without: FightLog, card: string) => {
    const from = cardIndex(log, card) - 1;
    expect(log.events[from]).toMatchObject({ t: 'energy', actor: 0 });
    expect(log.events.slice(0, from)).toEqual(without.events.slice(0, from));
  };
  type Strike = Extract<FightEvent, { t: 'hit' | 'block' | 'dodge' }>;
  const isStrike = (e: FightEvent): e is Strike => e.t === 'hit' || e.t === 'block' || e.t === 'dodge';
  const foe = fresh('brawler');
  const lid = { gear: { armor: 'dumpster_lid', accessory: null } };
  const armoredFoe: Character = { ...fresh('bouncer'), gear: ['dumpster_lid'] };
  const petIdx = (log: FightLog, team: number) => log.roster.map((u, i) => (u.team === team && !u.isMain ? i : -1)).filter((i) => i >= 0);

  // --- Armor break (Wrecker) ---
  it('Demolition removes 1 armor per landed hit for the rest of the fight, never below 0', () => {
    const wrecker = learn(fresh('bouncer'), 'demolition');
    let breaks = 0;
    for (const seed of seeds) {
      const log = plain(wrecker, armoredFoe, seed, { b: lid });
      const events = log.events.filter((e) => e.t === 'armor_break');
      breaks += events.length;
      // Down by one each time, even across rounds: the stance at the start of a round does not give it back.
      // (A new stance at the start of a round can add armor, so the chain restarts there.)
      let last = -1;
      for (const e of log.events) {
        if (e.t === 'round') last = -1;
        if (e.t !== 'armor_break') continue;
        expect(e).toMatchObject({ actor: 0, target: 1, amount: 1 });
        expect(e.armor).toBeGreaterThanOrEqual(0);
        if (last >= 0) expect(e.armor).toBe(last - 1);
        last = e.armor;
      }
      expect(plain(fresh('bouncer'), armoredFoe, seed, { b: lid }).events.some((e) => e.t === 'armor_break')).toBe(false);
    }
    expect(breaks).toBeGreaterThan(10);
  });

  it('broken armor makes later hits stronger', () => {
    const wrecker = learn(fresh('bouncer'), 'demolition');
    const total = (c: Character) =>
      seeds.reduce((s, seed) => s + plain(c, armoredFoe, seed, { b: lid }).events.reduce((x, e) => x + ((e.t === 'hit' || e.t === 'block') && e.actor === 0 ? e.damage : 0), 0), 0);
    expect(total(wrecker)).toBeGreaterThan(total(fresh('bouncer')));
  });

  it('Sledge Swing removes 4 armor when it lands, even without the skill, and a dodge removes nothing', () => {
    // Costs 5: playable at tick 10 (3 energy at the start, +1 every 5 ticks).
    const me = fresh('bouncer');
    let landed = 0;
    let dodged = 0;
    for (const seed of seeds) {
      const log = play(me, 'sledge_swing', 10, seed, armoredFoe);
      sameBefore(log, noPlay(me, 'sledge_swing', seed, armoredFoe), 'sledge_swing');
      const after = log.events.slice(cardIndex(log, 'sledge_swing'));
      const strike = after.find((e): e is Strike => isStrike(e) && e.actor === 0)!;
      const broken = after.find((e) => e.t === 'armor_break');
      if (strike.t === 'dodge') {
        dodged++;
        expect(after.slice(0, after.indexOf(strike)).some((e) => e.t === 'armor_break')).toBe(false);
      } else {
        landed++;
        expect(broken).toMatchObject({ t: 'armor_break', actor: 0, target: 1 });
        if (broken?.t === 'armor_break') {
          // Four if they had four to lose, else whatever was left.
          expect(broken.amount).toBeLessThanOrEqual(4);
          if (broken.armor + broken.amount >= 4) expect(broken.amount).toBe(4);
        }
      }
    }
    expect(landed).toBeGreaterThan(0);
    expect(dodged).toBeGreaterThan(0);
  });

  it('Sledge Swing never takes more armor than they have', () => {
    const naked: Character = { ...foe, gear: [] };
    for (const seed of seeds) {
      const log = play(fresh('bouncer'), 'sledge_swing', 10, seed, naked);
      for (const e of log.events) if (e.t === 'armor_break') expect(e.armor).toBeGreaterThanOrEqual(0);
    }
  });

  // --- Pack bonus (Pack) ---
  const packer = (...skills: string[]): Character => ({ ...learn(fresh('tamer'), ...skills), pets: ['rat', 'pigeon', 'dog'] });
  const petStrikes = (log: FightLog, team: number) => {
    const pets = petIdx(log, team);
    return log.events.filter((e): e is Extract<FightEvent, { t: 'hit' | 'block' }> => (e.t === 'hit' || e.t === 'block') && pets.includes(e.actor));
  };

  it('Pack Call gives +15% pet damage per pet beyond the first', () => {
    let stronger = 0;
    for (const seed of seeds) {
      // No randomness is used, so the first pet hits are the same rolls, only bigger or equal.
      const a = petStrikes(plain(packer('pack_call'), foe, seed), 0).slice(0, 4);
      const b = petStrikes(plain(packer(), foe, seed), 0).slice(0, 4);
      a.forEach((hit, i) => {
        expect(hit.damage).toBeGreaterThanOrEqual(b[i]!.damage);
        if (hit.damage > b[i]!.damage) stronger++;
      });
    }
    expect(stronger).toBeGreaterThan(0);
  });

  it('Pack Call does nothing with a single pet', () => {
    const single = (skills: string[]): Character => ({ ...learn(fresh('tamer'), ...skills), pets: ['dog'] });
    for (const seed of [1, 2, 3]) expect(plain(single(['pack_call']), foe, seed).events).toEqual(plain(single([]), foe, seed).events);
  });

  it('Gang Up makes every pet attack at once, then you', () => {
    // Costs 5: playable at tick 10.
    const me = packer();
    for (const seed of [1, 2, 3, 4, 5]) {
      const log = play(me, 'gang_up', 10, seed, foe);
      sameBefore(log, noPlay(me, 'gang_up', seed, foe), 'gang_up');
      const pets = petIdx(log, 0);
      expect(pets).toHaveLength(3);
      const strikes = log.events.slice(cardIndex(log, 'gang_up')).filter((e): e is Strike => isStrike(e) && e.kind !== 'counter');
      expect(strikes.slice(0, 4).map((e) => e.actor)).toEqual([...pets, 0]);
    }
  });

  // --- Guardian (Bond) ---
  const guardian = (...skills: string[]): Character => ({ ...learn(fresh('tamer'), ...skills), pets: ['rat', 'dog'] });

  it('Guardian sends 30% of the damage aimed at you to your healthiest pet', () => {
    let seen = 0;
    for (const seed of seeds) {
      const log = plain(guardian('guardian'), foe, seed);
      const pets = petIdx(log, 0);
      log.events.forEach((e, i) => {
        if (e.t !== 'guardian') return;
        seen++;
        expect(pets).toContain(e.actor);
        expect(e.target).toBe(0);
        // The hit on the fighter comes next (a pet's death may come between), already without the redirected part.
        const hit = log.events.slice(i + 1).find((x) => x.t === 'hit' || x.t === 'block');
        expect(hit).toMatchObject({ target: 0 });
        if (hit?.t === 'hit' || hit?.t === 'block') expect(e.damage).toBe(Math.floor(((hit.damage + e.damage) * 30) / 100));
      });
      expect(plain(guardian(), foe, seed).events.some((e) => e.t === 'guardian')).toBe(false);
    }
    expect(seen).toBeGreaterThan(5);
  });

  it('Guardian picks the pet with the most health, and stops when it is dead', () => {
    // The dog (more health than the rat) is the first guardian.
    const first = plain(guardian('guardian'), foe, 2);
    const e = first.events.find((x) => x.t === 'guardian');
    expect(e && first.roster[e.actor]!.defId).toBe('dog');
    for (const seed of seeds) {
      const dead = new Set<number>();
      for (const x of plain(guardian('guardian'), foe, seed).events) {
        if (x.t === 'death') dead.add(x.actor);
        if (x.t === 'guardian') expect(dead.has(x.actor)).toBe(false);
      }
    }
  });

  it('Together heals you and your pets 15% of their health (more at card level 4)', () => {
    const me = guardian();
    // Late enough to be hurt: tick 40.
    let healed = 0;
    for (const level of [1, 4]) {
      for (const seed of seeds.slice(0, 10)) {
        const log = play(me, 'together', 40, seed, foe, level);
        const at = cardIndex(log, 'together');
        if (at < 0) continue;
        sameBefore(log, noPlay(me, 'together', seed, foe, level), 'together');
        const heals = log.events.slice(at + 1).filter((e) => e.t === 'heal').slice(0, 3);
        const alive = [0, ...petIdx(log, 0)].filter((i) => !log.events.slice(0, at).some((e) => e.t === 'death' && e.actor === i));
        expect(heals.map((e) => (e.t === 'heal' ? e.actor : -1))).toEqual(alive);
        for (const h of heals) {
          if (h.t !== 'heal') continue;
          const raw = Math.floor((log.roster[h.actor]!.maxHp * scaled(15, level)) / 100);
          // Either the full heal, or it filled the bar.
          expect(h.amount === raw || h.hp === log.roster[h.actor]!.maxHp).toBe(true);
          if (h.amount === raw) healed++;
        }
      }
    }
    expect(healed).toBeGreaterThan(0);
  });

  it('Key Collar makes pets 40% healthier', () => {
    const me = guardian();
    const base = plain(me, foe, 1);
    const collared = plain({ ...me, gear: ['key_collar'] }, foe, 1, { a: { gear: { armor: null, accessory: 'key_collar' } } });
    expect(petIdx(base, 0)).toHaveLength(2);
    // Tamers start with Pack Leader (+25%): the collar adds its 40 on top of that.
    for (const i of petIdx(base, 0)) {
      const pet = PETS[base.roster[i]!.defId]!;
      expect(base.roster[i]!.maxHp).toBe(Math.floor((pet.maxHp * 125) / 100));
      expect(collared.roster[i]!.maxHp).toBe(Math.floor((pet.maxHp * 165) / 100));
    }
  });

  // --- Burn (Witch) ---
  const witch = (...skills: string[]): Character => learn(fresh('mystic'), ...skills);

  it('Flame makes damaging spells burn 3 on each of their next 3 turns', () => {
    let burns = 0;
    for (const seed of seeds) {
      const events = plain(witch('flame'), foe, seed).events.filter((e) => e.t === 'burn');
      burns += events.length;
      for (const b of events) expect(b).toMatchObject({ actor: 1, damage: 3 });
      expect(plain(witch(), foe, seed).events.some((e) => e.t === 'burn')).toBe(false);
    }
    expect(burns).toBeGreaterThan(5);
  });

  it('Fireball burns 5 for sure, 3 turns long, and cannot be dodged', () => {
    // Costs 5: playable at tick 10.
    const me = witch();
    const dodgy = { ...foe, bonusStats: { health: 0, strength: 0, agility: 30, speed: 0, magic: 0 } };
    for (const seed of seeds.slice(0, 8)) {
      const log = play(me, 'fireball', 10, seed, dodgy);
      sameBefore(log, noPlay(me, 'fireball', seed, dodgy), 'fireball');
      const after = log.events.slice(cardIndex(log, 'fireball'));
      expect(after[1]).toMatchObject({ t: 'cast', actor: 0, spell: 'fireball' });
      expect(after[2]).toMatchObject({ t: 'hit', actor: 0, target: 1, kind: 'spell' });
      const burns = after.filter((e) => e.t === 'burn');
      if (!after.some((e) => e.t === 'death')) expect(burns).toHaveLength(3);
      for (const b of burns) expect(b).toMatchObject({ actor: 1, damage: 5 });
    }
    // A higher card level burns more.
    const log4 = play(me, 'fireball', 10, 2, foe, 4);
    expect(log4.events.find((e) => e.t === 'burn')).toMatchObject({ damage: scaled(5, 4) });
  });

  it('a stronger burn replaces a weaker one (Flame 3, then Fireball 5)', () => {
    const log = play(witch('flame'), 'fireball', 10, 2, foe);
    const burns = log.events.slice(cardIndex(log, 'fireball')).filter((e) => e.t === 'burn');
    expect(burns.length).toBeGreaterThan(0);
    for (const b of burns.slice(0, 3)) expect(b).toMatchObject({ damage: 5 });
  });

  it('burning halves heals (at least 1)', () => {
    // I burn them at tick 10 with Fireball; they play Patch Up (10%) at tick 12.
    const healer = fresh('bouncer');
    const run = (burn: boolean, seed: number) =>
      runFight(witch(), healer, seed, {
        a: { interactive: true, deck: { fireball: 1 }, plays: burn ? [{ tick: 10, card: 'fireball' }] : [], breaks: [] },
        b: { interactive: true, deck: { patch_up: 1 }, plays: [{ tick: 12, card: 'patch_up' }], breaks: [] },
      });
    const healOf = (log: FightLog) => {
      const at = log.events.findIndex((e) => e.t === 'card' && e.actor === 1 && e.card === 'patch_up');
      return at < 0 ? undefined : log.events.slice(at).find((e) => e.t === 'heal' && e.actor === 1);
    };
    let halved = 0;
    for (const seed of seeds) {
      const burning = run(true, seed);
      const heal = healOf(burning);
      if (heal?.t !== 'heal') continue;
      const raw = Math.floor((burning.roster[1]!.maxHp * 10) / 100);
      // The burn from tick 10 is still running (3 turns), so the heal is half.
      expect(heal.amount === Math.max(1, Math.floor(raw / 2)) || heal.hp === burning.roster[1]!.maxHp).toBe(true);
      if (heal.amount < raw) halved++;
      const calm = healOf(run(false, seed));
      if (calm?.t === 'heal') expect(calm.amount === raw || calm.hp === burning.roster[1]!.maxHp).toBe(true);
    }
    expect(halved).toBeGreaterThan(0);
  });

  // --- Overheal (Warden) ---
  it('Overflow turns healing above max health into a ward, up to 20% of max health', () => {
    // Patch Up early (tick 5), mostly at full health: the heal is all extra.
    const warden = learn(fresh('mystic'), 'overflow');
    let wards = 0;
    for (const seed of seeds) {
      const log = play(warden, 'patch_up', 5, seed, foe, 4);
      const over = log.events.slice(cardIndex(log, 'patch_up')).find((e) => e.t === 'overheal');
      const cap = Math.floor((log.roster[0]!.maxHp * 20) / 100);
      if (over?.t === 'overheal') {
        wards++;
        expect(over.actor).toBe(0);
        expect(over.amount).toBeGreaterThan(0);
        expect(over.ward).toBeGreaterThan(0);
        expect(over.ward).toBeLessThanOrEqual(cap);
      }
      expect(play(fresh('mystic'), 'patch_up', 5, seed, foe, 4).events.some((e) => e.t === 'overheal')).toBe(false);
    }
    expect(wards).toBeGreaterThan(0);
  });

  it('overheal wards from several heals stay within 20% of max health', () => {
    const big: Character = { ...learn(fresh('mystic'), 'overflow'), bonusStats: { health: 40, strength: 0, agility: 0, speed: 0, magic: 0 } };
    // Energy: 4 at tick 5, spent; back to 4 at tick 25 and 45.
    const plays = [5, 25, 45].map((tick) => ({ tick, card: 'patch_up' }));
    const log = runFight(big, foe, 4, { a: { interactive: true, deck: { patch_up: 4 }, plays, breaks: [] }, b: { deck: {} } });
    const cap = Math.floor((log.roster[0]!.maxHp * 20) / 100);
    const overs = log.events.filter((e) => e.t === 'overheal');
    expect(overs.length).toBeGreaterThan(0);
    for (const o of overs) if (o.t === 'overheal') expect(o.ward).toBeLessThanOrEqual(cap);
  });

  it('overheal stops at the cap when the wards pile up', () => {
    // A foe who can barely hurt a ward: two heals at full health add up past 20%, and the second is cut off.
    const weakFoe: Character = { ...fresh('mystic'), gear: [], skills: [] };
    const me: Character = { ...learn(fresh('mystic'), 'overflow'), bonusStats: { health: 40, strength: 0, agility: 0, speed: 0, magic: 0 } };
    const plays = [5, 25].map((tick) => ({ tick, card: 'patch_up' }));
    let capped = 0;
    for (const seed of seeds) {
      const log = runFight(me, weakFoe, seed, { a: { interactive: true, deck: { patch_up: 4 }, plays, breaks: [] }, b: { deck: {} } });
      const cap = Math.floor((log.roster[0]!.maxHp * 20) / 100);
      const overs = log.events.filter((e) => e.t === 'overheal');
      for (const o of overs) if (o.t === 'overheal') expect(o.ward).toBeLessThanOrEqual(cap);
      if (overs.some((o) => o.t === 'overheal' && o.ward === cap)) capped++;
    }
    expect(capped).toBeGreaterThan(0);
  });

  it('Rune Circle heals 10% and raises a ward of 8 + magic', () => {
    // Costs 4: playable at tick 5.
    const me = fresh('mystic');
    const magic = CLASSES.mystic.baseStats.magic;
    for (const seed of [1, 2, 3]) {
      const log = play(me, 'rune_circle', 5, seed, foe);
      sameBefore(log, noPlay(me, 'rune_circle', seed, foe), 'rune_circle');
      const after = log.events.slice(cardIndex(log, 'rune_circle'));
      const heal = after.findIndex((e) => e.t === 'heal' && e.actor === 0);
      expect(heal).toBeGreaterThan(0);
      expect(after[heal + 1]).toMatchObject({ t: 'ward', actor: 0, absorbed: 0, left: 8 + magic });
    }
  });

  it('Rune Amulet cuts magic damage taken', () => {
    const spellHit = (accessory: string | null) => {
      const target: Character = { ...fresh('mystic'), gear: accessory ? [accessory] : [] };
      return plain(witch(), target, 4, { b: { gear: { armor: null, accessory } } }).events.find((e) => e.t === 'hit' && e.kind === 'spell' && e.actor === 0);
    };
    const bare = spellHit(null);
    const worn = spellHit('rune_amulet');
    expect(bare?.t === 'hit' && worn?.t === 'hit' && worn.damage < bare.damage).toBe(true);
  });

  // --- General weapons and gear ---
  it('a Bottle breaks after its first landed hit and is not drawn again', () => {
    const me: Character = { ...fresh('brawler'), weapons: ['bottle'] };
    let broke = 0;
    for (const seed of seeds) {
      const log = plain(me, foe, seed, { a: { weaponStyle: 'keep' } });
      const hits = log.events.filter((e) => (e.t === 'hit' || e.t === 'block') && e.actor === 0 && e.weapon === 'bottle');
      expect(hits.length).toBeLessThanOrEqual(1);
      const breaks = log.events.filter((e) => e.t === 'weapon_break');
      // (A hit that ends the fight leaves nothing to show.)
      if (hits.length === 1 && log.events[log.events.indexOf(hits[0]!) + 1]?.t === 'death') continue;
      expect(breaks).toHaveLength(hits.length);
      if (hits.length === 1) {
        broke++;
        const i = log.events.indexOf(breaks[0]!);
        expect(breaks[0]).toMatchObject({ actor: 0, weapon: 'bottle' });
        expect(log.events[i - 1]).toBe(hits[0]);
        // Never drawn again after it broke.
        expect(log.events.slice(i).some((e) => e.t === 'draw' && e.actor === 0)).toBe(false);
      }
    }
    expect(broke).toBeGreaterThan(0);
  });

  it('a Brick thrown hits harder than another thrown weapon of the same damage', () => {
    WEAPONS.test_stone = { id: 'test_stone', name: 'Test Stone', damage: 5, accuracy: 0, heavy: false };
    try {
      const target: Character = { ...foe, gear: [], skills: [], pets: [] };
      const throwHit = (weapon: string, seed: number) =>
        plain({ ...fresh('brawler'), weapons: [weapon] }, target, seed, { a: { weaponStyle: 'throw' } }).events.find((e) => e.t === 'hit' && e.actor === 0 && e.kind === 'throw');
      let compared = 0;
      for (const seed of seeds) {
        const brick = throwHit('brick', seed);
        const stone = throwHit('test_stone', seed);
        if (brick?.t !== 'hit' || stone?.t !== 'hit') continue;
        compared++;
        // x2.0 against x1.5 (the bonus adds to the throw multiplier): about a third more.
        expect(brick.damage).toBeGreaterThan(stone.damage);
        expect(brick.damage).toBeLessThanOrEqual(Math.ceil((stone.damage * 4) / 3) + 1);
      }
      expect(compared).toBeGreaterThan(5);
    } finally {
      delete WEAPONS.test_stone;
    }
  });

  it('Hurl never weakens a throw that is already stronger than the card (Brick + Thrower)', () => {
    // Brick + Thrower throws at x2.5 on their own; Hurl (x2 total) must not pull that down.
    const target: Character = { ...foe, gear: [], skills: [], pets: [] };
    const thrower: Character = { ...fresh('brawler'), weapons: ['brick'], skills: ['thrower'], pets: [] };
    const base = addStats(CLASSES.brawler.baseStats, thrower.bonusStats).strength + WEAPONS.brick!.damage;
    let seen = 0;
    for (const seed of seeds) {
      const log = runFight(thrower, target, seed, { a: { interactive: true, deck: { hurl: 1 }, plays: [{ tick: 30, card: 'hurl' }], breaks: [], weaponStyle: 'keep' }, b: { deck: {} } });
      const i = cardIndex(log, 'hurl');
      const hit = log.events[i + 1];
      if (!log.events.slice(0, i).some((e) => e.t === 'draw' && e.actor === 0) || hit?.t !== 'hit' || hit.kind !== 'throw') continue;
      seen++;
      expect(hit.damage).toBeGreaterThanOrEqual(Math.floor((Math.floor(base * 2.5) * 80) / 100));
    }
    expect(seen).toBeGreaterThan(5);
  });

  it('Pool Cue and Crowbar have their numbers and the Crowbar hits harder', () => {
    expect(WEAPONS.pool_cue).toMatchObject({ damage: 4, accuracy: 20, heavy: false });
    expect(WEAPONS.crowbar).toMatchObject({ damage: 8, accuracy: -5, heavy: true });
    const mean = (weapon: string) => {
      const hits = seeds.flatMap((seed) =>
        plain({ ...fresh('brawler'), weapons: [weapon] }, foe, seed, { a: { weaponStyle: 'keep' } }).events.filter((e) => e.t === 'hit' && e.actor === 0 && e.weapon === weapon),
      );
      return { n: hits.length, mean: hits.reduce((s, e) => s + (e.t === 'hit' ? e.damage : 0), 0) / Math.max(1, hits.length) };
    };
    expect(mean('pool_cue').n).toBeGreaterThan(0);
    expect(mean('crowbar').n).toBeGreaterThan(0);
    expect(mean('crowbar').mean).toBeGreaterThan(mean('pool_cue').mean);
  });

  it('weapon descriptions mention breaking and the thrown bonus', () => {
    expect(weaponDetail('bottle')).toMatch(/breaks/i);
    expect(weaponDetail('brick')).toMatch(/50%/);
  });

  it('every new general gear piece changes how a fight goes', () => {
    for (const id of ['cap', 'patched_coat', 'backpack', 'headphones']) {
      const slot = GEAR[id]!.slot;
      const worn = { gear: { armor: slot === 'armor' ? id : null, accessory: slot === 'accessory' ? id : null } };
      const differs = seeds.some((seed) => JSON.stringify(plain({ ...fresh('brawler'), gear: [id] }, foe, seed, { a: worn }).events) !== JSON.stringify(plain(fresh('brawler'), foe, seed).events));
      expect([id, differs]).toEqual([id, true]);
    }
  });
});

describe('old content regression guard', () => {
  /**
   * Fights between starting fighters (no new skills, cards or items) must stay exactly the same
   * as on main before the content expansion (these hashes were checked against main). Each fight log is squeezed into one short hash.
   * If you change an OLD rule on purpose, the hashes change: run the tests, check that the new
   * values in the failure message are what you expect, then paste them below.
   */
  const hash = (log: FightLog): string => {
    const text = JSON.stringify(log.events);
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
    return `${text.length}:${h.toString(16)}`;
  };
  const fighters = (id: Character['classId']) => createCharacter('N', look, id, 'port');
  const expected: Record<string, string> = {
    'brawler vs tamer, seed 1': '6986:fa59e3de',
    'tamer vs mystic, seed 2': '5788:df0a9366',
    'mystic vs brawler, seed 3': '5399:2a52057e',
    'brawler vs brawler, seed 4': '4967:e0c14c83',
  };

  it('keeps the exact fight logs of old-content fights', () => {
    const seeds: [Character['classId'], Character['classId'], number][] = [
      ['brawler', 'tamer', 1],
      ['tamer', 'mystic', 2],
      ['mystic', 'brawler', 3],
      ['brawler', 'brawler', 4],
    ];
    const actual: Record<string, string> = {};
    for (const [a, b, seed] of seeds) actual[`${a} vs ${b}, seed ${seed}`] = hash(runFight(fighters(a), fighters(b), seed));
    expect(actual).toEqual(expected);
  });
});
