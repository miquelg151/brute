import { migrateSave, type SaveData } from '../core';

const KEY = 'brute.save';

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
  } catch {
    // Progress just won't persist this session.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
