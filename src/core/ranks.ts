// Ranks: how seasoned a fighter looks. They change only the look (art layer `fighter.rank`)
// and a badge next to the name; they never change a fight.
export type RankId = 'rookie' | 'regular' | 'veteran' | 'champion' | 'legend';

export interface RankDef {
  id: RankId;
  name: string;
  /** The fighter level where this rank starts. */
  from: number;
}

export const RANKS: readonly RankDef[] = [
  { id: 'rookie', name: 'Rookie', from: 1 },
  { id: 'regular', name: 'Regular', from: 5 },
  { id: 'veteran', name: 'Veteran', from: 10 },
  { id: 'champion', name: 'Champion', from: 15 },
  { id: 'legend', name: 'Legend', from: 20 },
];

export function rankOf(level: number): RankDef {
  let rank = RANKS[0]!;
  for (const r of RANKS) if (level >= r.from) rank = r;
  return rank;
}
