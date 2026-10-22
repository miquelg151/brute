import { SAVE_VERSION, type SaveData } from '../core';

const KEY = 'brute.save';

// localStorage can be unavailable (private mode, blocked storage), so every access is guarded.
export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as SaveData;
    return save.version === SAVE_VERSION ? save : null;
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
