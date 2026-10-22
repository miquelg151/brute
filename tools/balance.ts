// Win-rate matrix between classes at several levels. Run with `npm run balance`.
// Each matchup builds fresh random characters per fight and swaps sides every
// other fight so initiative ties do not bias the result.
import { CLASS_IDS, Rng, SPECIAL_TURNS, STANCE_IDS, generateOpponent, mixSeed, runFight, type ClassId, type Stance } from '../src/core';

const FIGHTS = Number(process.argv[2] ?? 4000);
const LEVELS = [1, 5, 10, 20];
// Some rock-paper-scissors between classes is fine; each class overall should be even.
const CLASS_MIN = 0.45;
const CLASS_MAX = 0.55;
const MATCHUP_MIN = 0.35;
const MATCHUP_MAX = 0.65;

function winRate(a: ClassId, b: ClassId, level: number): { rate: number; avgEvents: number } {
  let wins = 0;
  let events = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const rng = new Rng(mixSeed(level * 7919 + CLASS_IDS.indexOf(a) * 31 + CLASS_IDS.indexOf(b), i));
    const ca = generateOpponent(level, rng, a);
    const cb = generateOpponent(level, rng, b);
    const aFirst = i % 2 === 0;
    const log = aFirst ? runFight(ca, cb, rng.next()) : runFight(cb, ca, rng.next());
    if (log.winner === (aFirst ? 0 : 1)) wins++;
    events += log.events.length;
  }
  return { rate: wins / FIGHTS, avgEvents: events / FIGHTS };
}

let outOfRange = 0;
for (const level of LEVELS) {
  console.log(`\nLevel ${level}  (row vs column, ${FIGHTS} fights each)`);
  console.log('           ' + CLASS_IDS.map((c) => c.padStart(9)).join(''));
  let eventsSum = 0;
  let cells = 0;
  for (const a of CLASS_IDS) {
    const row: string[] = [];
    let total = 0;
    for (const b of CLASS_IDS) {
      if (a === b) {
        row.push('        -');
        continue;
      }
      const { rate, avgEvents } = winRate(a, b, level);
      total += rate;
      eventsSum += avgEvents;
      cells++;
      const flag = rate < MATCHUP_MIN || rate > MATCHUP_MAX ? '!' : ' ';
      if (flag === '!') outOfRange++;
      row.push(`${(rate * 100).toFixed(1)}%${flag}`.padStart(9));
    }
    const overall = total / (CLASS_IDS.length - 1);
    const classFlag = overall < CLASS_MIN || overall > CLASS_MAX ? '!' : '';
    if (classFlag) outOfRange++;
    console.log(a.padEnd(11) + row.join('') + `   avg ${(overall * 100).toFixed(1)}%${classFlag}`);
  }
  console.log(`events per fight: ${(eventsSum / cells).toFixed(1)}`);
}
console.log(
  `\n${outOfRange} values out of range (marked with !): ` +
    `matchups ${Math.round(MATCHUP_MIN * 100)}-${Math.round(MATCHUP_MAX * 100)}%, class averages ${Math.round(CLASS_MIN * 100)}-${Math.round(CLASS_MAX * 100)}%`,
);
process.exitCode = outOfRange > 0 ? 1 : 0;

// --- Player skill -----------------------------------------------------------
// Mirror matches (same class, same level): team A plays with skill, team B does not.
// Answers: how much does being good at specials and the warm-up actually matter?
const SKILL_MAX = 0.65;
const SKILL_LEVEL = 10;
const profiles: { name: string; quality: number; warmup: number }[] = [
  { name: 'bad player', quality: 10, warmup: 20 },
  { name: 'average player', quality: 60, warmup: 50 },
  { name: 'perfect player', quality: 100, warmup: 100 },
];

function skillWinRate(classId: ClassId, quality: number, warmup: number, stance: Stance = 'balanced'): number {
  let wins = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const rng = new Rng(mixSeed(424242 + CLASS_IDS.indexOf(classId), i));
    const ca = generateOpponent(SKILL_LEVEL, rng, classId);
    const cb = generateOpponent(SKILL_LEVEL, rng, classId);
    const log = runFight(ca, cb, rng.next(), {
      a: { interactive: true, specials: SPECIAL_TURNS.map(() => quality), warmup, stance },
    });
    if (log.winner === 0) wins++;
  }
  return wins / FIGHTS;
}

let skillOut = 0;
console.log(`\nPlayer skill at level ${SKILL_LEVEL} (mirror match win rate vs a passive copy, max ${SKILL_MAX * 100}%)`);
console.log('           ' + profiles.map((p) => p.name.padStart(16)).join(''));
for (const classId of CLASS_IDS) {
  const cells = profiles.map((p) => {
    const rate = skillWinRate(classId, p.quality, p.warmup);
    const flag = rate > SKILL_MAX ? '!' : ' ';
    if (flag === '!') skillOut++;
    return `${(rate * 100).toFixed(1)}%${flag}`.padStart(16);
  });
  console.log(classId.padEnd(11) + cells.join(''));
}

// --- Stances ----------------------------------------------------------------
// Win rate of team A using each stance against random opponents (both balanced otherwise).
// No stance should be best everywhere; the right one should depend on the opponent.
console.log(`\nStance vs opponent class at level ${SKILL_LEVEL} (A uses the stance, B is balanced; any A class)`);
console.log('           ' + CLASS_IDS.map((c) => c.padStart(9)).join(''));
for (const stance of STANCE_IDS) {
  const row = CLASS_IDS.map((enemy) => {
    let wins = 0;
    for (let i = 0; i < FIGHTS; i++) {
      const rng = new Rng(mixSeed(99 + CLASS_IDS.indexOf(enemy), i));
      const ca = generateOpponent(SKILL_LEVEL, rng);
      const cb = generateOpponent(SKILL_LEVEL, rng, enemy);
      if (runFight(ca, cb, rng.next(), { a: { stance } }).winner === 0) wins++;
    }
    return `${((wins / FIGHTS) * 100).toFixed(1)}%`.padStart(9);
  });
  console.log(stance.padEnd(11) + row.join(''));
}

console.log(`\n${skillOut} skill values above ${SKILL_MAX * 100}%`);
if (skillOut > 0) process.exitCode = 1;
