// Graduation: a fighter who beat the Champion at level 20 can retire as a Legend.
// The Legend is a snapshot of the fighter; nothing that happens later can change it.
import type { SaveData } from './game';
import type { Legend } from './types';

/** The level a fighter must reach to graduate. */
const GRADUATION_LEVEL = 20;

/** True when the fighter is level 20, has beaten the Champion, and has no fight or level-up waiting. */
export function canGraduate(save: SaveData): boolean {
  const c = save.character;
  return c.level >= GRADUATION_LEVEL && c.bosses?.champion === 'beaten' && save.pendingLevelUps === 0 && !save.offer && !save.pendingFight;
}

/**
 * Adds a copy of the fighter to `save.legends` and returns it. The caller then goes to
 * creation and passes `save.legends` to `newGame`, so the new fighter keeps every legend.
 */
export function graduate(save: SaveData, now: Date): Legend {
  if (!canGraduate(save)) throw new Error('This fighter cannot graduate yet');
  const legend: Legend = { character: structuredClone(save.character), graduatedAt: now.toISOString() };
  save.legends.push(legend);
  return legend;
}
