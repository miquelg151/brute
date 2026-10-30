// Feats: small goals checked after every fight. A completed feat becomes a medal on the fighter,
// and some give a title the fighter may wear. Feats only read the finished fight, they never
// change it. The branch feats live in featsBranch.ts.
import { BOSSES } from './bosses';
import {
  best, flag, finalHp, hpTrace, lastBlow, lowestHp, maxHp, me, statsOf, strikes, cardCount, wasKnockout,
  type FeatContext, type FeatDef,
} from './featTools';
import { BRANCH_FEATS } from './featsBranch';
import type { FightResult } from './game';
import type { Character } from './types';

export type { FeatDef, FeatContext } from './featTools';

const won = (ctx: FeatContext): boolean => ctx.result.won;
/** A win against a boss (any try that beats it). */
const bossWin = (ctx: FeatContext, id?: string): boolean => won(ctx) && !!ctx.result.bossId && (id === undefined || ctx.result.bossId === id);

const GENERAL_FEATS: FeatDef[] = [
  { id: 'first_blood', name: 'First Blood', description: 'Win a fight.', check: (ctx) => flag(won(ctx), ctx) },
  { id: 'hot_streak', name: 'Hot Streak', description: 'Win 5 fights in a row.', target: 5, check: (ctx) => statsOf(ctx).bestStreak },
  { id: 'unstoppable', name: 'Unstoppable', description: 'Win 15 fights in a row.', target: 15, title: 'The Unstoppable', check: (ctx) => statsOf(ctx).bestStreak },
  {
    id: 'close_call', name: 'Close Call', secret: true,
    description: 'Win with less than 10% health left.',
    check: (ctx) => flag(won(ctx) && finalHp(ctx) * 10 < maxHp(ctx), ctx),
  },
  {
    id: 'untouchable', name: 'Untouchable', title: 'The Untouchable',
    description: 'Win without your health ever dropping by 10% of your max or more.',
    check: (ctx) => flag(won(ctx) && (maxHp(ctx) - lowestHp(ctx)) * 10 < maxHp(ctx), ctx),
  },
  {
    id: 'comeback', name: 'Comeback',
    description: 'Win a fight in which you were below 25% health at a break between rounds.',
    check: (ctx) => {
      const trace = hpTrace(ctx);
      const low = ctx.result.log.events.some((e, at) => {
        if (e.t !== 'break') return false;
        const hp = trace.filter((p) => p.at < at).at(-1)!.hp;
        return hp * 100 < maxHp(ctx) * 25;
      });
      return flag(won(ctx) && low, ctx);
    },
  },
  {
    id: 'junk_thrower', name: 'Junk Thrower', description: 'Knock out a foe with a thrown weapon.',
    check: (ctx) => {
      const blow = lastBlow(ctx);
      return flag(!!blow && (blow.t === 'hit' || blow.t === 'block') && blow.actor === me(ctx) && blow.kind === 'throw', ctx);
    },
  },
  { id: 'full_hand', name: 'Full Hand', description: 'Play 5 cards in one fight.', target: 5, check: (ctx) => best(cardCount(ctx), ctx) },
  {
    id: 'bare_hands', name: 'Bare Hands', description: 'Win without hitting with any weapon.',
    check: (ctx) => flag(won(ctx) && !strikes(ctx).some((e) => e.actor === me(ctx) && e.weapon !== null), ctx),
  },
  {
    id: 'on_points', name: 'On Points', description: 'Win at the end of round 3 without a knockout.',
    check: (ctx) => flag(won(ctx) && !wasKnockout(ctx), ctx),
  },
  { id: 'veteran', name: 'Veteran', description: 'Fight 100 fights.', target: 100, check: (ctx) => statsOf(ctx).fights },
  { id: 'knockout_artist', name: 'Knockout Artist', description: 'Win 50 fights by knockout.', target: 50, title: 'Knockout Artist', check: (ctx) => statsOf(ctx).kos },
  {
    id: 'stubborn', name: 'Stubborn', secret: true, description: 'Beat a boss after losing to it 3 times.',
    check: (ctx) => flag(bossWin(ctx) && (statsOf(ctx).bossLosses[ctx.result.bossId!] ?? 0) >= 3, ctx),
  },
  {
    id: 'prodigy', name: 'Prodigy', secret: true, title: 'Prodigy',
    description: 'Beat all four bosses without losing to any of them.',
    check: (ctx) => {
      const clean = Object.values(BOSSES).every((b) => ctx.character.bosses?.[b.id] === 'beaten' && !statsOf(ctx).bossLosses[b.id]);
      return flag(bossWin(ctx) && clean, ctx);
    },
  },
  { id: 'graduate', name: 'Graduate', description: 'Beat The Champion.', check: (ctx) => flag(bossWin(ctx, 'champion'), ctx) },
];

export const FEATS: FeatDef[] = [...GENERAL_FEATS, ...BRANCH_FEATS];

const FEATS_BY_ID: Record<string, FeatDef> = Object.fromEntries(FEATS.map((f) => [f.id, f]));

/** The feats a fighter can earn: the general ones plus the ones of their own branch. */
export function featsFor(c: Character): FeatDef[] {
  return FEATS.filter((f) => !f.branch || f.branch === c.branch);
}

/**
 * Checks every feat the fighter can earn against the finished fight. Saves progress, adds the
 * newly completed feats to the medals and returns their ids. Needs the fighter's record
 * (stats) and bosses already updated for this fight.
 */
export function evaluateFeats(c: Character, result: FightResult): string[] {
  const fresh: string[] = [];
  const medals = (c.medals ??= []);
  const progress = (c.featProgress ??= {});
  for (const feat of featsFor(c)) {
    if (medals.includes(feat.id)) continue;
    const target = feat.target ?? 1;
    const now = feat.check({ character: c, result, side: 0, progress: progress[feat.id] ?? 0 });
    progress[feat.id] = Math.min(now, target);
    if (now >= target) {
      medals.push(feat.id);
      fresh.push(feat.id);
    }
  }
  return fresh;
}

/** The titles the fighter has earned (from completed feats), in feat order. */
export function availableTitles(c: Character): string[] {
  return FEATS.filter((f) => f.title && c.medals?.includes(f.id)).map((f) => f.title!);
}

/** Wears an earned title, or none with undefined. */
export function setTitle(c: Character, title: string | undefined): void {
  if (title === undefined) {
    delete c.title;
    return;
  }
  if (!availableTitles(c).includes(title)) throw new Error(`Title '${title}' is not earned`);
  c.title = title;
}

/** The feat with this id, if there is one (boss medals are not feats). */
export const featById = (id: string): FeatDef | undefined => FEATS_BY_ID[id];

/** The readable name of a medal id: a feat's name, or the boss for `boss_<id>`. */
export function medalName(id: string): string {
  if (id.startsWith('boss_')) {
    const boss = BOSSES[id.slice(5) as keyof typeof BOSSES];
    return boss ? `Beat ${boss.name}` : id;
  }
  return featById(id)?.name ?? id;
}
