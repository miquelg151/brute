import { migrateSave, type Legend, type SaveData } from '../core';

const KEY = 'brute.save';
// Legends waiting for a new fighter, kept when the fighter is deleted so a reload does not lose them.
const LEGENDS_KEY = 'brute.legends';

// localStorage can be unavailable (private mode, blocked storage), so every access is guarded.
export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function storeSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    localStorage.removeItem(LEGENDS_KEY);
  } catch {
    // Progress just won't persist this session.
  }
}

/** Deletes the fighter. The legends are kept apart, for the next fighter. */
export function clearSave(legends: Legend[] = []): void {
  try {
    localStorage.removeItem(KEY);
    if (legends.length > 0) localStorage.setItem(LEGENDS_KEY, JSON.stringify(legends));
  } catch {
    // Nothing to clear.
  }
}

/** The legends kept after the fighter was deleted (none if there are none). */
export function loadLegends(): Legend[] {
  try {
    const raw = localStorage.getItem(LEGENDS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
