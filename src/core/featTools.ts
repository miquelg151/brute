// Types and small helpers for feats. A feat reads a finished fight (the log) and says how far
// along it is. Nothing here touches the simulation: it only looks at what already happened.
import type { FightEvent } from './fight';
import type { FightResult } from './game';
import type { BranchId, Character, FighterStats } from './types';

export interface FeatContext {
  character: Character;
  result: FightResult;
  /** The player's side in the log events (always 0 for now). */
  side: 0 | 1;
  /** Progress before this fight. */
  progress: number;
}

export interface FeatDef {
  id: string;
  name: string;
  /** What to do, in plain words. Says how the condition is read where it could be read two ways. */
  description: string;
  /** Shown as "???" until completed. */
  secret?: boolean;
  /** Only fighters of this branch can earn it. */
  branch?: BranchId;
  /** The title the fighter may wear after completing it. */
  title?: string;
  /** Progress needed to complete it (default 1). */
  target?: number;
  /** Returns the new progress. */
  check: (ctx: FeatContext) => number;
}

type Ev<T extends FightEvent['t']> = Extract<FightEvent, { t: T }>;

// ---- Progress ----

/** 1 when the condition holds, otherwise the progress stays as it was. */
export const flag = (done: boolean, ctx: FeatContext): number => (done ? 1 : ctx.progress);
/** For "in one fight" counts: the best fight so far. */
export const best = (n: number, ctx: FeatContext): number => Math.max(ctx.progress, n);
export const total = (list: number[]): number => list.reduce((a, b) => a + b, 0);

export const statsOf = (ctx: FeatContext): FighterStats => ctx.character.stats ?? { fights: 0, wins: 0, kos: 0, streak: 0, bestStreak: 0, bossLosses: {} };

// ---- Who is who ----

const roster = (ctx: FeatContext) => ctx.result.log.roster;
export const me = (ctx: FeatContext): number => roster(ctx).findIndex((u) => u.isMain && u.team === ctx.side);
export const foe = (ctx: FeatContext): number => roster(ctx).findIndex((u) => u.isMain && u.team !== ctx.side);
export const maxHp = (ctx: FeatContext): number => roster(ctx)[me(ctx)]?.maxHp ?? 1;
export const events = (ctx: FeatContext): FightEvent[] => ctx.result.log.events;

/** The player's own pets (not spirits, dogs or rats that were summoned). */
export const ownPets = (ctx: FeatContext): number[] => roster(ctx).flatMap((u, i) => (u.team === ctx.side && !u.isMain && !u.summoned ? [i] : []));
export const isMyPet = (ctx: FeatContext, idx: number): boolean => ownPets(ctx).includes(idx);
export const isFoePet = (ctx: FeatContext, idx: number): boolean => {
  const u = roster(ctx)[idx];
  return !!u && !u.isMain && u.team !== ctx.side;
};
export const died = (ctx: FeatContext, idx: number): boolean => events(ctx).some((e) => e.t === 'death' && e.actor === idx);

// ---- Event queries ----

export function eventsOf<T extends FightEvent['t']>(ctx: FeatContext, t: T): Ev<T>[] {
  return events(ctx).filter((e): e is Ev<T> => e.t === t);
}

/** Landed strikes (hits and blocked hits). */
export const strikes = (ctx: FeatContext): (Ev<'hit'> | Ev<'block'>)[] => events(ctx).filter((e): e is Ev<'hit'> | Ev<'block'> => e.t === 'hit' || e.t === 'block');

/** How many times the player played a card (any card, or the one given). */
export const cardCount = (ctx: FeatContext, id?: string): number => eventsOf(ctx, 'card').filter((e) => e.actor === me(ctx) && (id === undefined || e.card === id)).length;

/** Total damage of landed strikes by the player (`pets` false) or by the player's pets (`pets` true). */
export const damageBy = (ctx: FeatContext, pets: boolean): number =>
  total(strikes(ctx).filter((e) => (pets ? isMyPet(ctx, e.actor) : e.actor === me(ctx))).map((e) => e.damage));

/** The player's health over the fight: [event index, health], starting at full health. */
export function hpTrace(ctx: FeatContext): { at: number; hp: number }[] {
  const id = me(ctx);
  const trace = [{ at: -1, hp: maxHp(ctx) }];
  events(ctx).forEach((e, at) => {
    if ((e.t === 'hit' || e.t === 'block' || e.t === 'thorns') && e.target === id) trace.push({ at, hp: e.hp });
    else if ((e.t === 'heal' || e.t === 'poison' || e.t === 'bleed' || e.t === 'burn') && e.actor === id) trace.push({ at, hp: e.hp });
  });
  return trace;
}
export const lowestHp = (ctx: FeatContext): number => Math.min(...hpTrace(ctx).map((p) => p.hp));
export const finalHp = (ctx: FeatContext): number => hpTrace(ctx).at(-1)!.hp;

/** True when a main fighter went down (the fight did not go to points). */
export const wasKnockout = (ctx: FeatContext): boolean => events(ctx).some((e) => e.t === 'death' && !!roster(ctx)[e.actor]?.isMain);

// ---- Knockouts ----

/** Index of the foe's death, or -1. */
export const knockoutAt = (ctx: FeatContext): number => events(ctx).findIndex((e) => e.t === 'death' && e.actor === foe(ctx));

/** The event just before the foe went down (the one that did it), if the foe went down. */
export function lastBlow(ctx: FeatContext): FightEvent | undefined {
  const at = knockoutAt(ctx);
  return at > 0 ? events(ctx)[at - 1] : undefined;
}

/**
 * True when the foe went down straight from a card the player played: walking back from the
 * knockout we meet only events that belong to the card's burst (`part`), then the card itself.
 * `maxStrikes` stops a later normal turn in the same tick from being counted as the card.
 */
export function knockedOutByCard(ctx: FeatContext, cardId: string, part: (e: FightEvent) => boolean, maxStrikes: number): boolean {
  const list = events(ctx);
  let strikesSeen = 0;
  for (let i = knockoutAt(ctx) - 1; i >= 0; i--) {
    const e = list[i]!;
    if (e.t === 'card') return e.actor === me(ctx) && e.card === cardId;
    if (!part(e)) return false;
    if (e.t === 'hit' || e.t === 'block') strikesSeen++;
    if (strikesSeen > maxStrikes) return false;
  }
  return false;
}
