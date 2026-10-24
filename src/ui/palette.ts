import type { ClassId } from '../core';
import { PAL } from './theme';

// Colours the player can pick for a fighter, and the colour of each class.
// They all come from the game palette in theme.ts.
export const SKIN_TONES = [PAL.skin1, PAL.skin2, PAL.skin3, PAL.skin4, PAL.skin5, PAL.skin6];
export const HAIR_COLORS = [PAL.night, PAL.brownDark, PAL.wood, PAL.sand, PAL.crimson, PAL.violet];
export const OUTFIT_COLORS = [PAL.blue, PAL.red, PAL.green, PAL.yellow, PAL.purple, PAL.orange, PAL.teal, PAL.mist];
export const HAIR_STYLE_NAMES = ['Short', 'Mohawk', 'Long', 'Bald'];

/** The colour of each origin (its cards' stripe). */
export const ORIGIN_COLORS: Record<string, string> = {
  port: PAL.blue,
  rooftops: PAL.amber,
  metro: PAL.magenta,
  industrial: PAL.orange,
  sewers: PAL.moss,
  scrapyard: PAL.cyan,
};

export const CLASS_COLORS: Record<ClassId, string> = {
  brawler: PAL.coral,
  parkour: PAL.teal,
  bouncer: PAL.mist,
  tamer: PAL.lime,
  mystic: PAL.purple,
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
