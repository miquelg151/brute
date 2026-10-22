// How many rounds fights last, per level. Run with `npx tsx tools/rounds.ts`.
// Breaks only matter if most fights reach them.
import { Rng, generateOpponent, mixSeed, runFight } from '../src/core';

const FIGHTS = 2000;
for (const level of [1, 5, 10, 20]) {
  const counts = [0, 0, 0, 0];
  let decided = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const rng = new Rng(mixSeed(level, i));
    const log = runFight(generateOpponent(level, rng), generateOpponent(level, rng), rng.next());
    const rounds = log.events.filter((e) => e.t === 'round').length;
    counts[rounds]!++;
    if (log.events.at(-1)?.t === 'death') decided++;
  }
  const pct = (n: number) => `${Math.round((100 * n) / FIGHTS)}%`;
  console.log(`level ${level}: ended in round 1 ${pct(counts[1]!)}, round 2 ${pct(counts[2]!)}, round 3 ${pct(counts[3]!)}; knockouts ${pct(decided)}`);
}
