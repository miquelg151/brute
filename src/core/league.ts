// The Legends League: graduated fighters play matches for trophies. Trophies move the
// player through district arenas along a trophy road; the road's stops give titles and
// unlock new items (LOCKED_CONTENT) for fighters created afterwards. Pure rules only: the
// league fight itself is set up and finished in game.ts.
import { CLASSES } from './catalog';
import { generateOpponent } from './opponents';
import type { Rng } from './rng';
import { STATS_KEYS, type Character } from './types';

export interface LeagueState {
  trophies: number;
  /** The most trophies ever reached: road rewards and the arena floor follow it. */
  best: number;
  /** League matches started, for their seeds. */
  fights: number;
  /** Ids of the road stops already rewarded. */
  rewards: string[];
  /** Items (from LOCKED_CONTENT) unlocked on the road, for fighters created from now on. */
  unlocked: string[];
}

export const WIN_TROPHIES = 30;
export const LOSS_TROPHIES = 20;

export interface ArenaDef {
  id: string;
  name: string;
  /** Trophies needed to enter. */
  trophies: number;
  /** Extra stats (% of their own) rivals get here. */
  rivalStatPct: number;
  /** Rivals pick the plan that counters the player's legend (like the Champion). */
  rivalsCounter: boolean;
}

export const ARENAS: ArenaDef[] = [
  { id: 'back_alley', name: 'Back Alley', trophies: 0, rivalStatPct: 0, rivalsCounter: false },
  { id: 'docks', name: 'The Docks', trophies: 300, rivalStatPct: 4, rivalsCounter: false },
  { id: 'subway', name: 'Subway', trophies: 600, rivalStatPct: 8, rivalsCounter: true },
  { id: 'rooftops', name: 'Rooftops', trophies: 900, rivalStatPct: 12, rivalsCounter: true },
  { id: 'neon_strip', name: 'Neon Strip', trophies: 1200, rivalStatPct: 16, rivalsCounter: true },
];

export type RoadReward = { kind: 'title'; title: string } | { kind: 'unlock'; item: string };

export interface RoadStop {
  id: string;
  trophies: number;
  rewards: RoadReward[];
}

/** The trophy road: a stop every 150 trophies. Arena entries unlock an item. */
export const ROAD: RoadStop[] = [
  { id: 'r150', trophies: 150, rewards: [{ kind: 'title', title: 'Alley Cat' }] },
  { id: 'r300', trophies: 300, rewards: [{ kind: 'unlock', item: 'cheap_shot' }] },
  { id: 'r450', trophies: 450, rewards: [{ kind: 'title', title: 'Dock Boss' }] },
  { id: 'r600', trophies: 600, rewards: [{ kind: 'unlock', item: 'bike_helmet' }] },
  { id: 'r750', trophies: 750, rewards: [{ kind: 'title', title: 'Tunnel Rat' }] },
  { id: 'r900', trophies: 900, rewards: [{ kind: 'unlock', item: 'smoke_bomb' }] },
  { id: 'r1050', trophies: 1050, rewards: [{ kind: 'title', title: 'Skyline Runner' }] },
  { id: 'r1200', trophies: 1200, rewards: [{ kind: 'unlock', item: 'neon_jacket' }] },
  {
    id: 'r1500',
    trophies: 1500,
    rewards: [
      { kind: 'unlock', item: 'crowd_favourite' },
      { kind: 'title', title: 'King of the Strip' },
    ],
  },
];

export function newLeague(): LeagueState {
  return { trophies: 0, best: 0, fights: 0, rewards: [], unlocked: [] };
}

/** Index in ARENAS of the arena a trophy count is in. */
export function arenaIndex(trophies: number): number {
  let index = 0;
  ARENAS.forEach((a, i) => {
    if (trophies >= a.trophies) index = i;
  });
  return index;
}

/** Trophies never drop below the start of the best arena ever reached. */
export function leagueFloor(state: LeagueState): number {
  return ARENAS[arenaIndex(state.best)]!.trophies;
}

/** The highest road title earned, if any. */
export function leagueTitle(state: LeagueState): string | undefined {
  let title: string | undefined;
  for (const stop of ROAD) {
    if (!state.rewards.includes(stop.id)) continue;
    for (const r of stop.rewards) if (r.kind === 'title') title = r.title;
  }
  return title;
}

/** Items the road unlocks up to a trophy count (what rivals of that arena may carry). */
export function unlockedUpTo(trophies: number): string[] {
  return ROAD.filter((s) => s.trophies <= trophies).flatMap((s) => s.rewards.flatMap((r) => (r.kind === 'unlock' ? [r.item] : [])));
}

/** What one match changed. */
export interface MatchOutcome {
  trophiesBefore: number;
  trophiesAfter: number;
  arenaBefore: number;
  arenaAfter: number;
  /** Road stops reached for the first time, in order. */
  newStops: RoadStop[];
}

/** Moves the trophies after a match and claims the road stops reached for the first time. */
export function applyMatch(state: LeagueState, won: boolean): MatchOutcome {
  const trophiesBefore = state.trophies;
  const arenaBefore = arenaIndex(state.best);
  state.trophies = won ? state.trophies + WIN_TROPHIES : Math.max(leagueFloor(state), state.trophies - LOSS_TROPHIES);
  state.best = Math.max(state.best, state.trophies);
  const newStops = ROAD.filter((s) => s.trophies <= state.best && !state.rewards.includes(s.id));
  for (const stop of newStops) {
    state.rewards.push(stop.id);
    for (const r of stop.rewards) if (r.kind === 'unlock' && !state.unlocked.includes(r.item)) state.unlocked.push(r.item);
  }
  return { trophiesBefore, trophiesAfter: state.trophies, arenaBefore, arenaAfter: arenaIndex(state.best), newStops };
}

/** A level 20 rival for an arena: a random bot with the arena's items and extra stats. */
export function buildRival(arena: number, rng: Rng): Character {
  const def = ARENAS[arena]!;
  const rival = generateOpponent(20, rng, undefined, undefined, undefined, unlockedUpTo(def.trophies));
  const base = CLASSES[rival.classId].baseStats;
  for (const key of STATS_KEYS) {
    rival.bonusStats[key] += Math.round(((base[key] + rival.bonusStats[key]) * def.rivalStatPct) / 100);
  }
  return rival;
}
