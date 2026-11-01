import { describe, expect, it } from 'vitest';
import {
  ARENAS,
  LOCKED_CONTENT,
  ROAD,
  applyMatch,
  arenaIndex,
  buildRival,
  canGraduate,
  finishFight,
  fighterOf,
  generateOpponent,
  graduate,
  leagueFloor,
  leagueTitle,
  migrateSave,
  newGame,
  newLeague,
  prepareFight,
  prepareLeagueFight,
  simulateFight,
  startFight,
  recordBreak,
  unlockedUpTo,
  DEFAULT_PLAN,
  Rng,
  type SaveData,
} from './index';

const look = { skinTone: 0, hairStyle: 0, hairColor: 0, outfitColor: 0 };

/** A save with one legend: a level 20 bot that has beaten the Champion. */
function saveWithLegend(): SaveData {
  const save = newGame('Next', look, 'brawler', 'port', 7);
  const veteran = generateOpponent(20, new Rng(3), 'bouncer');
  veteran.bosses = { rusty: 'beaten', alley_cat: 'beaten', sewer_king: 'beaten', champion: 'beaten' };
  save.character = veteran;
  expect(canGraduate(save)).toBe(true);
  graduate(save, new Date('2026-11-01'));
  save.character = newGame('Next', look, 'brawler', 'port', 7).character;
  return save;
}

/** Plays the pending fight to the end with no cards and the same plan at every break. */
function playOut(save: SaveData) {
  startFight(save, DEFAULT_PLAN, [], undefined, []);
  for (let i = 0; i < 4; i++) {
    const log = simulateFight(save);
    if (log.winner !== null) break;
    recordBreak(save, { ...DEFAULT_PLAN, weapons: [], recover: false } as never);
  }
  return finishFight(save);
}

describe('league rules', () => {
  it('arenas start every 300 trophies and the road has a stop every 150', () => {
    expect(ARENAS.map((a) => a.trophies)).toEqual([0, 300, 600, 900, 1200]);
    expect(ROAD.map((s) => s.trophies)).toEqual([150, 300, 450, 600, 750, 900, 1050, 1200, 1500]);
    expect(arenaIndex(0)).toBe(0);
    expect(arenaIndex(299)).toBe(0);
    expect(arenaIndex(300)).toBe(1);
    expect(arenaIndex(5000)).toBe(4);
  });

  it('the road unlocks every league item exactly once', () => {
    expect(unlockedUpTo(10_000).sort()).toEqual([...LOCKED_CONTENT].sort());
    expect(unlockedUpTo(299)).toEqual([]);
    expect(unlockedUpTo(300)).toEqual(['cheap_shot']);
  });

  it('a win gives 30 trophies, a loss takes 20, never below the arena floor', () => {
    const state = newLeague();
    applyMatch(state, false);
    expect(state.trophies).toBe(0);
    applyMatch(state, true);
    expect(state.trophies).toBe(30);
    applyMatch(state, false);
    expect(state.trophies).toBe(10);
    state.trophies = 310;
    state.best = 310;
    expect(leagueFloor(state)).toBe(300);
    applyMatch(state, false);
    expect(state.trophies).toBe(300);
  });

  it('road stops are claimed once, in order, giving titles and unlocks', () => {
    const state = newLeague();
    state.trophies = 290;
    const first = applyMatch(state, true);
    expect(first.newStops.map((s) => s.id)).toEqual(['r150', 'r300']);
    expect(first.arenaBefore).toBe(0);
    expect(first.arenaAfter).toBe(1);
    expect(state.unlocked).toEqual(['cheap_shot']);
    expect(leagueTitle(state)).toBe('Alley Cat');
    expect(applyMatch(state, false).newStops).toEqual([]);
    expect(applyMatch(state, true).newStops).toEqual([]);
    state.trophies = 1490;
    applyMatch(state, true);
    expect(leagueTitle(state)).toBe('King of the Strip');
    expect(state.unlocked.sort()).toEqual([...LOCKED_CONTENT].sort());
  });

  it('rivals are level 20 and stronger in higher arenas', () => {
    expect(buildRival(0, new Rng(9)).level).toBe(20);
    // Over many rivals, the top arena's are clearly stronger (each build differs, so compare totals).
    const total = (arena: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 20; seed++) for (const v of Object.values(buildRival(arena, new Rng(seed)).bonusStats)) sum += v;
      return sum;
    };
    expect(total(4)).toBeGreaterThan(total(0) * 1.08);
  });
});

describe('league matches', () => {
  it('a league match uses the legend, moves trophies and leaves the legend unchanged', () => {
    const save = saveWithLegend();
    const legendBefore = JSON.stringify({ ...save.legends[0]!.character, deck: undefined });
    const fighterBefore = JSON.stringify(save.character);
    const fight = prepareLeagueFight(save, 0)!;
    expect(fight.league).toEqual({ legend: 0 });
    expect(fight.opponent.level).toBe(20);
    expect(fighterOf(save)).toBe(save.legends[0]!.character);
    const result = playOut(save);
    expect(result.league).toBeDefined();
    expect(result.xpGained).toBe(0);
    expect(save.league.trophies).toBe(result.won ? 30 : 0);
    expect(save.league.fights).toBe(1);
    expect(JSON.stringify({ ...save.legends[0]!.character, deck: undefined })).toBe(legendBefore);
    expect(JSON.stringify(save.character)).toBe(fighterBefore);
    expect(save.pendingFight).toBeNull();
  });

  it('a league match waits while a normal fight is pending, and needs a real legend', () => {
    const save = saveWithLegend();
    expect(prepareLeagueFight(save, 5)).toBeNull();
    prepareFight(save);
    expect(prepareLeagueFight(save, 0)).toBeNull();
  });

  it('a new fighter may be offered the items the league unlocked', () => {
    const league = newLeague();
    league.unlocked = ['cheap_shot'];
    const save = newGame('New', look, 'mystic', 'port', 3, [], league);
    expect(save.character.unlocked).toEqual(['cheap_shot']);
    expect(save.league).toBe(league);
    expect(newGame('Plain', look, 'mystic', 'port', 3).character.unlocked).toBeUndefined();
  });

  it('a version 8 save gets an empty league', () => {
    const save = newGame('Old', look, 'brawler', 'port', 4) as unknown as Record<string, unknown>;
    delete save.league;
    save.version = 8;
    const migrated = migrateSave(JSON.parse(JSON.stringify(save)))!;
    expect(migrated.version).toBe(9);
    expect(migrated.league).toEqual(newLeague());
  });
});
