import type { ClassId } from '../core';

export const SKIN_TONES = ['#f6d7b8', '#e8b98f', '#c68b59', '#a0673f', '#7a4a2a', '#4f2f1c'];
export const HAIR_COLORS = ['#1b1b1b', '#5a3a1e', '#a8642a', '#e3c06a', '#c43c3c', '#6a5acd'];
export const OUTFIT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#f97316', '#14b8a6', '#e5e7eb'];
export const HAIR_STYLE_NAMES = ['Short', 'Mohawk', 'Long', 'Bald'];

export const CLASS_COLORS: Record<ClassId, string> = {
  brawler: '#ff6b5b',
  parkour: '#4fd1e8',
  bouncer: '#c3c7d4',
  tamer: '#9fd356',
  mystic: '#b388ff',
};

/** Darkens (negative) or lightens (positive) a #rrggbb color by an amount in [-1, 1]. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const out = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
    return Math.round(Math.max(0, Math.min(255, out)));
  };
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
