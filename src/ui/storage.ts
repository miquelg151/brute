import { migrateSave, newLeague, type LeagueState, type Legend, type SaveData } from '../core';

const KEY = 'brute.save';
// Legends waiting for a new fighter, kept when the fighter is deleted so a reload does not lose them.
const LEGENDS_KEY = 'brute.legends';
// The league (trophies, road rewards, unlocked items), kept the same way as the legends.
const LEAGUE_KEY = 'brute.league';
// A copy of a save that could not be read, so a bad save is never lost for good.
const UNREADABLE_KEY = 'brute.save.unreadable';

// localStorage can be unavailable (private mode, blocked storage), so every access is guarded.
export function loadSave(): SaveData | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const save = migrateSave(JSON.parse(raw));
    if (save) return save;
  } catch {
    // Falls through: the save could not be read.
  }
  if (raw) rescueUnreadable(raw);
  return null;
}

/** Keeps a copy of a save we cannot open, and saves its legends so a new fighter still gets them. */
function rescueUnreadable(raw: string): void {
  try {
    if (localStorage.getItem(UNREADABLE_KEY) === null) localStorage.setItem(UNREADABLE_KEY, raw);
  } catch {
    // Nothing more we can do.
  }
  try {
    const legends: unknown = JSON.parse(raw)?.legends;
    if (Array.isArray(legends) && legends.length > 0 && !localStorage.getItem(LEGENDS_KEY)) {
      localStorage.setItem(LEGENDS_KEY, JSON.stringify(legends));
    }
    const league: unknown = JSON.parse(raw)?.league;
    if (league && typeof league === 'object' && !localStorage.getItem(LEAGUE_KEY)) localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
  } catch {
    // The raw text was not even JSON: only the copy above remains.
  }
}

export function storeSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    localStorage.removeItem(LEGENDS_KEY);
    localStorage.removeItem(LEAGUE_KEY);
  } catch {
    // Progress just won't persist this session.
  }
}

/** Deletes the fighter. The legends and the league are kept apart, for the next fighter. */
export function clearSave(legends: Legend[] = [], league?: LeagueState): void {
  try {
    // Legends and league first: if a write fails, the fighter (and its legends) is still there.
    if (legends.length > 0) localStorage.setItem(LEGENDS_KEY, JSON.stringify(legends));
    if (league) localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The legends kept after the fighter was deleted (none if there are none). */
export function loadLegends(): Legend[] {
  try {
    const raw = localStorage.getItem(LEGENDS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    // Only real legends: each one needs a fighter.
    return list.filter((l) => l && typeof l.character === 'object' && l.character !== null);
  } catch {
    return [];
  }
}

/** The league kept after the fighter was deleted (a fresh one if there is none). */
export function loadLeague(): LeagueState {
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    const league = raw ? JSON.parse(raw) : null;
    if (league && typeof league === 'object' && typeof league.trophies === 'number') return { ...newLeague(), ...league };
  } catch {
    // Falls through to a fresh league.
  }
  return newLeague();
}
