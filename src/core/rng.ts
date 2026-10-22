/**
 * Deterministic PRNG (mulberry32). Uses only 32-bit integer math, so the same
 * seed produces the same sequence in every browser, on mobile and on the server.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Next unsigned 32-bit integer. */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number {
    if (maxExclusive <= min) return min;
    return min + (this.next() % (maxExclusive - min));
  }

  /** True with the given probability, in whole percent. */
  chance(percent: number): boolean {
    if (percent <= 0) return false;
    if (percent >= 100) return true;
    return this.int(0, 100) < percent;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty list');
    return items[this.int(0, items.length)] as T;
  }
}

/** Derives a new seed from two numbers (e.g. save seed + fight number). */
export function mixSeed(a: number, b: number): number {
  let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ (b >>> 0);
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  return (h ^ (h >>> 16)) >>> 0;
}
