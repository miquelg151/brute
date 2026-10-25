// Balance report. Run with `npm run balance` (all sections) or pick one:
//   npm run balance -- 2000 classes   class vs class win rates at several levels
//   npm run balance -- 2000 origins   each origin against the same class from a random origin
//   npm run balance -- 2000 skill     how much playing cards well matters
//   npm run balance -- 2000 advice    whether each strategy option's advice is true
//   npm run balance -- 2000 cards     how much each card helps the fighter who brings it
//                                     (origin cards are measured with fighters of their own origin)
//   npm run balance -- 2000 branches  each class branch vs random fighters, and each class's two branches head to head
// The number is fights per measurement. Exits with code 1 if anything is out of range.
import {
  BRANCHES,
  CARDS,
  CLASS_IDS,
  ORIGIN_IDS,
  Rng,
  STANCES,
  STANCE_IDS,
  TARGETS,
  TARGET_IDS,
  TRAITS,
  WEAPON_STYLES,
  WEAPON_STYLE_IDS,
  botCardLevel,
  cardOrigin,
  generateOpponent,
  mixSeed,
  runFight,
  startingCards,
  traitsOf,
  type BranchId,
  type Character,
  type ClassId,
  type Plan,
  type TacticOption,
} from '../src/core';

const FIGHTS = Number(process.argv[2] ?? 4000);
const ONLY = process.argv[3];
const section = (name: string) => !ONLY || ONLY === name;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
let problems = 0;

// --- Classes ----------------------------------------------------------------
// Each matchup builds fresh random characters per fight and swaps sides every
// other fight so initiative ties do not bias the result.
// Some rock-paper-scissors between classes is fine; each class overall should be even.
// LEVELS=10,20 npm run balance ... measures only those levels.
const LEVELS = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : [1, 5, 10, 20];
const CLASS_MIN = 0.45;
const CLASS_MAX = 0.55;
const MATCHUP_MIN = 0.35;
const MATCHUP_MAX = 0.65;
const ORIGIN_MIN = 0.45;
const ORIGIN_MAX = 0.55;

function winRate(a: ClassId, b: ClassId, level: number): number {
  let wins = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const rng = new Rng(mixSeed(level * 7919 + CLASS_IDS.indexOf(a) * 31 + CLASS_IDS.indexOf(b), i));
    const ca = generateOpponent(level, rng, a);
    const cb = generateOpponent(level, rng, b);
    const aFirst = i % 2 === 0;
    const log = aFirst ? runFight(ca, cb, rng.next()) : runFight(cb, ca, rng.next());
    if (log.winner === (aFirst ? 0 : 1)) wins++;
  }
  return wins / FIGHTS;
}

if (section('classes')) {
  for (const level of LEVELS) {
    console.log(`\nLevel ${level}  (row vs column, ${FIGHTS} fights each)`);
    console.log('           ' + CLASS_IDS.map((c) => c.padStart(9)).join(''));
    for (const a of CLASS_IDS) {
      const row: string[] = [];
      let total = 0;
      for (const b of CLASS_IDS) {
        if (a === b) {
          row.push('        -');
          continue;
        }
        const rate = winRate(a, b, level);
        total += rate;
        const flag = rate < MATCHUP_MIN || rate > MATCHUP_MAX ? '!' : ' ';
        if (flag === '!') problems++;
        row.push(`${pct(rate)}${flag}`.padStart(9));
      }
      const overall = total / (CLASS_IDS.length - 1);
      const classFlag = overall < CLASS_MIN || overall > CLASS_MAX ? '!' : '';
      if (classFlag) problems++;
      console.log(a.padEnd(11) + row.join('') + `   avg ${pct(overall)}${classFlag}`);
    }
  }
  console.log(`Targets: matchups ${Math.round(MATCHUP_MIN * 100)}-${Math.round(MATCHUP_MAX * 100)}%, class averages ${Math.round(CLASS_MIN * 100)}-${Math.round(CLASS_MAX * 100)}%`);
}

// --- Origins ---------------------------------------------------------------
// Each origin against the same class from a random origin, so only the origin differs.
if (section('origins')) {
  console.log(`
Origins: win rate against the same class from a random origin`);
  console.log(`${'level'.padEnd(8)}${ORIGIN_IDS.map((id) => id.padEnd(12)).join('')}`);
  for (const level of LEVELS) {
    const cells: string[] = [];
    for (const originId of ORIGIN_IDS) {
      let wins = 0;
      for (let i = 0; i < FIGHTS; i++) {
        const rng = new Rng(mixSeed(level * 4241 + ORIGIN_IDS.indexOf(originId) * 17, i));
        const classId = CLASS_IDS[i % CLASS_IDS.length]!;
        const ca = generateOpponent(level, rng, classId, originId);
        const cb = generateOpponent(level, rng, classId);
        const aFirst = i % 2 === 0;
        const log = aFirst ? runFight(ca, cb, rng.next()) : runFight(cb, ca, rng.next());
        if (log.winner === (aFirst ? 0 : 1)) wins++;
      }
      const rate = wins / FIGHTS;
      const flag = rate < ORIGIN_MIN || rate > ORIGIN_MAX ? '!' : ' ';
      if (flag === '!') problems++;
      cells.push(`${pct(rate)}${flag}`.padEnd(12));
    }
    console.log(`${String(level).padEnd(8)}${cells.join('')}`);
  }
  console.log(`Targets: ${Math.round(ORIGIN_MIN * 100)}-${Math.round(ORIGIN_MAX * 100)}%`);
}

// --- Branches ---------------------------------------------------------------
// Each branch (bots forced to it) against random fighters of random classes, and each
// class's two branches against each other. Branches only exist from level 5.
const BRANCH_LEVELS = [5, 10, 20];
const BRANCH_MIN = 0.45;
const BRANCH_MAX = 0.55;
const BRANCH_MIRROR_MIN = 0.4;
const BRANCH_MIRROR_MAX = 0.6;

// Win rate of `branch` fighters against fighters made by `makeFoe`.
function branchWinRate(classId: ClassId, branch: BranchId, level: number, seed: number, makeFoe: (rng: Rng) => Character): number {
  let wins = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const rng = new Rng(mixSeed(seed, i));
    const ca = generateOpponent(level, rng, classId, undefined, branch);
    const cb = makeFoe(rng);
    const aFirst = i % 2 === 0;
    const log = aFirst ? runFight(ca, cb, rng.next()) : runFight(cb, ca, rng.next());
    if (log.winner === (aFirst ? 0 : 1)) wins++;
  }
  return wins / FIGHTS;
}

if (section('branches')) {
  console.log(`
Branches: win rate vs random fighters of random classes (${FIGHTS} fights each)`);
  console.log(`${''.padEnd(20)}${BRANCH_LEVELS.map((l) => `level ${l}`.padStart(11)).join('')}`);
  for (const classId of CLASS_IDS) {
    for (const b of BRANCHES[classId]) {
      const cells = BRANCH_LEVELS.map((level) => {
        const seed = level * 6007 + CLASS_IDS.indexOf(classId) * 53 + (b === BRANCHES[classId][0] ? 0 : 1);
        const rate = branchWinRate(classId, b.id, level, seed, (rng) => generateOpponent(level, rng));
        const flag = rate < BRANCH_MIN || rate > BRANCH_MAX ? '!' : ' ';
        if (flag === '!') problems++;
        return `${pct(rate)}${flag}`.padStart(11);
      });
      console.log(`${`${classId} ${b.id}`.padEnd(20)}${cells.join('')}`);
    }
  }
  console.log(`
Branch mirrors: first branch vs second branch of the same class`);
  for (const classId of CLASS_IDS) {
    const [first, second] = BRANCHES[classId];
    const cells = BRANCH_LEVELS.map((level) => {
      const seed = level * 3301 + CLASS_IDS.indexOf(classId) * 71;
      const rate = branchWinRate(classId, first.id, level, seed, (rng) => generateOpponent(level, rng, classId, undefined, second.id));
      const flag = rate < BRANCH_MIRROR_MIN || rate > BRANCH_MIRROR_MAX ? '!' : ' ';
      if (flag === '!') problems++;
      return `${pct(rate)}${flag}`.padStart(11);
    });
    console.log(`${`${first.id} v ${second.id}`.padEnd(20)}${cells.join('')}`);
  }
  console.log(`Targets: branches ${Math.round(BRANCH_MIN * 100)}-${Math.round(BRANCH_MAX * 100)}%, mirrors ${Math.round(BRANCH_MIRROR_MIN * 100)}-${Math.round(BRANCH_MIRROR_MAX * 100)}%`);
}

// --- Player skill -----------------------------------------------------------
const SKILL_MAX = 0.65;
const SKILL_LEVEL = 10;
// Mirror matches: team A plays its cards (with the given special-strike timing), team B
// brings no cards at all. Answers: how much does playing cards well matter?
const profiles: { name: string; quality: number }[] = [
  { name: 'bad player', quality: 10 },
  { name: 'average player', quality: 60 },
  { name: 'perfect player', quality: 100 },
];

function skillWinRate(classId: ClassId, quality: number): number {
  let wins = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const rng = new Rng(mixSeed(424242 + CLASS_IDS.indexOf(classId), i));
    const ca = generateOpponent(SKILL_LEVEL, rng, classId);
    const cb = generateOpponent(SKILL_LEVEL, rng, classId);
    const log = runFight(ca, cb, rng.next(), { a: { specialQuality: quality }, b: { deck: {} } });
    if (log.winner === 0) wins++;
  }
  return wins / FIGHTS;
}

if (section('skill')) {
  console.log(`\nPlayer skill at level ${SKILL_LEVEL} (mirror match win rate vs a passive copy, max ${SKILL_MAX * 100}%)`);
  console.log('           ' + profiles.map((p) => p.name.padStart(16)).join(''));
  for (const classId of CLASS_IDS) {
    const cells = profiles.map((p) => {
      const rate = skillWinRate(classId, p.quality);
      const flag = rate > SKILL_MAX ? '!' : ' ';
      if (flag === '!') problems++;
      return `${pct(rate)}${flag}`.padStart(16);
    });
    console.log(classId.padEnd(11) + cells.join(''));
  }
}

// --- Strategy advice --------------------------------------------------------
// Every option says which opponent trait it is strong against. Check that this is
// true: against opponents with that trait, the option must beat the default choice.
const ADVICE_MIN_EDGE = 0.02;
const categories: { name: string; ids: readonly string[]; defs: Record<string, TacticOption<string>>; key: keyof Plan }[] = [
  { name: 'Stance', ids: STANCE_IDS, defs: STANCES, key: 'stance' },
  { name: 'Target', ids: TARGET_IDS, defs: TARGETS, key: 'target' },
  { name: 'Weapons', ids: WEAPON_STYLE_IDS, defs: WEAPON_STYLES, key: 'weaponStyle' },
];

if (section('advice')) {
  console.log(`\nStrategy advice at level ${SKILL_LEVEL}: win rate vs opponents with the trait / without (default choice in brackets)`);
  for (const cat of categories) {
    for (const id of cat.ids) {
      const trait = cat.defs[id]!.strongVs;
      if (!trait) continue;
      const opt = [0, 0];
      const def = [0, 0];
      const n = [0, 0];
      for (let i = 0; i < FIGHTS * 2; i++) {
        const rng = new Rng(mixSeed(7777, i));
        const ca = generateOpponent(SKILL_LEVEL, rng);
        const cb = generateOpponent(SKILL_LEVEL, rng);
        const seed = rng.next();
        const k = traitsOf(cb).includes(trait) ? 0 : 1;
        n[k]!++;
        if (runFight(ca, cb, seed, { a: { [cat.key]: id } }).winner === 0) opt[k]!++;
        if (runFight(ca, cb, seed).winner === 0) def[k]!++;
      }
      const rate = (arr: number[], k: number) => arr[k]! / Math.max(1, n[k]!);
      const edge = rate(opt, 0) - rate(def, 0);
      const flag = edge < ADVICE_MIN_EDGE ? '!' : ' ';
      if (flag === '!') problems++;
      console.log(
        `${`${cat.name}: ${cat.defs[id]!.name}`.padEnd(24)} vs ${TRAITS[trait].name.padEnd(16)} ` +
          `${pct(rate(opt, 0))} (${pct(rate(def, 0))}) ${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(1)}${flag}  ` +
          `without: ${pct(rate(opt, 1))} (${pct(rate(def, 1))})  [${n[0]} fights with the trait]`,
      );
    }
  }
  console.log(`Advice needs at least +${ADVICE_MIN_EDGE * 100} points over the default against its trait`);
}

// --- Cards ------------------------------------------------------------------
// Each card's value: fighters who bring it (on top of their starting cards) against the
// same fighters without it. A card should help a bit, not decide fights alone.
const CARD_MIN = 0.5;
const CARD_MAX = 0.62;

if (section('cards')) {
  // Pace: how many cards a bot plays per round, with its default deck, against random fighters.
  let plays = 0;
  let rounds = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const rng = new Rng(mixSeed(5151, i));
    const ca = generateOpponent(SKILL_LEVEL, rng);
    const cb = generateOpponent(SKILL_LEVEL, rng);
    const log = runFight(ca, cb, rng.next());
    plays += log.events.filter((e) => e.t === 'card').length;
    rounds += log.events.filter((e) => e.t === 'round').length;
  }
  console.log(`\nPace at level ${SKILL_LEVEL}: bots play ${(plays / Math.max(1, rounds) / 2).toFixed(2)} cards per round each`);
  console.log(`\nCards at level ${SKILL_LEVEL}: win rate with the card vs the same fighter without it, and how often it gets played`);
  for (const card of Object.values(CARDS)) {
    const classes = card.pool === 'general' || card.pool === 'origin' ? CLASS_IDS : [card.pool];
    let wins = 0;
    let played = 0;
    let total = 0;
    // Origin cards: both fighters come from that origin, so the base deck is their real starting cards.
    const originId = card.pool === 'origin' ? cardOrigin(card.id) : undefined;
    for (const classId of classes) {
      for (let i = 0; i < FIGHTS / classes.length; i++) {
        const rng = new Rng(mixSeed(9090 + CLASS_IDS.indexOf(classId), i));
        const ca = generateOpponent(SKILL_LEVEL, rng, classId, originId);
        const cb = generateOpponent(SKILL_LEVEL, rng, classId, originId);
        const level = botCardLevel(SKILL_LEVEL);
        const base = Object.fromEntries(startingCards(classId, ca.originId).filter((id) => id !== card.id).map((id) => [id, level]));
        // Swap sides every other fight: bots on side B see side A's card in the same tick
        // and can answer it at once, so always giving the card to side A would undersell it.
        const withCard = { deck: { ...base, [card.id]: level } };
        const without = { deck: base };
        const aFirst = i % 2 === 0;
        const log = aFirst
          ? runFight(ca, cb, rng.next(), { a: withCard, b: without })
          : runFight(cb, ca, rng.next(), { a: without, b: withCard });
        if (log.winner === (aFirst ? 0 : 1)) wins++;
        const holder = aFirst ? 0 : 1;
        if (log.events.some((e) => e.t === 'card' && e.card === card.id && log.roster[e.actor]?.team === holder)) played++;
        total++;
      }
    }
    const rate = wins / Math.max(1, total);
    const flag = rate < CARD_MIN || rate > CARD_MAX ? '!' : ' ';
    if (flag === '!') problems++;
    console.log(`${card.name.padEnd(16)} ${pct(rate)}${flag}  played in ${pct(played / Math.max(1, total))} of fights`);
  }
  console.log(`Targets: ${CARD_MIN * 100}-${CARD_MAX * 100}%`);
}

// --- Option matrix (design aid, never fails) ---------------------------------
// Win rate of every option against opponents with each trait. A good set of options
// has a different best choice per column. Run with: npm run balance -- 2000 matrix
if (ONLY === 'matrix') {
  const traitIds = Object.keys(TRAITS) as (keyof typeof TRAITS)[];
  console.log(`\nOption matrix at level ${SKILL_LEVEL} (win rate vs opponents with each trait)`);
  console.log(''.padEnd(24) + traitIds.map((t) => TRAITS[t].name.slice(0, 12).padStart(13)).join(''));
  const pairs = Array.from({ length: FIGHTS * 2 }, (_, i) => {
    const rng = new Rng(mixSeed(7777, i));
    const ca = generateOpponent(SKILL_LEVEL, rng);
    const cb = generateOpponent(SKILL_LEVEL, rng);
    return { ca, cb, seed: rng.next(), traits: traitsOf(cb) };
  });
  for (const cat of categories) {
    for (const id of cat.ids) {
      const cells = traitIds.map((t) => {
        const subset = pairs.filter((p) => p.traits.includes(t));
        const wins = subset.filter((p) => runFight(p.ca, p.cb, p.seed, { a: { [cat.key]: id } }).winner === 0).length;
        return pct(wins / Math.max(1, subset.length)).padStart(13);
      });
      console.log(`${cat.name}: ${cat.defs[id]!.name}`.padEnd(24) + cells.join(''));
    }
  }
}

console.log(`\n${problems} problems (marked with !)`);
process.exitCode = problems > 0 ? 1 : 0;
