// Win-rate matrix between classes at several levels. Run with `npm run balance`.
// Each matchup builds fresh random characters per fight and swaps sides every
// other fight so initiative ties do not bias the result.
import { CLASS_IDS, Rng, generateOpponent, mixSeed, runFight, type ClassId } from '../src/core';

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
