// The night street behind the fighters: the fight arena and the Fight tab both use it.
// Your own picture in public/art (manifest "background") replaces the one drawn in code.
import { Rng } from '../core';
import { artImage, artManifest, imageToCanvas } from './art';
import { PAL } from './theme';

/** Size of the street picture in art pixels (the same as the fight arena). */
export const STREET_W = 240;
export const STREET_H = 210;
/** Where the pavement starts, from the top. */
export const STREET_GROUND_Y = 175;

type Rect = (x: number, y: number, w: number, h: number, color: string) => void;

/** Draws the street made in code: the wall, a city skyline with lit windows, the pavement. */
export function paintStreet(rect: Rect, seed: number): void {
  rect(0, 0, STREET_W, STREET_GROUND_Y, PAL.wall);
  // The skyline is seeded, so the same seed always draws the same city.
  const rng = new Rng(seed);
  for (let x = -10; x < STREET_W; ) {
    const w = rng.int(24, 48);
    const top = rng.int(40, 120);
    rect(x, top, w, STREET_GROUND_Y - top, PAL.night);
    for (let wy = top + 6; wy < STREET_GROUND_Y - 14; wy += 9) {
      for (let wx = x + 4; wx < x + w - 4; wx += 7) if (rng.chance(25)) rect(wx, wy, 3, 4, PAL.amber);
    }
    x += w + rng.int(2, 8);
  }
  rect(0, STREET_GROUND_Y, STREET_W, STREET_H - STREET_GROUND_Y, PAL.asphalt);
  rect(0, STREET_GROUND_Y, STREET_W, 3, PAL.stone);
  for (let x = 8; x < STREET_W; x += 32) rect(x, STREET_GROUND_Y + 20, 16, 2, PAL.stone);
}

/** The street as a canvas: your picture when there is one, otherwise the one drawn in code. */
export function streetCanvas(seed: number): HTMLCanvasElement {
  const custom = artImage(artManifest().background);
  if (custom) return imageToCanvas(custom);
  const canvas = document.createElement('canvas');
  canvas.width = STREET_W;
  canvas.height = STREET_H;
  const ctx = canvas.getContext('2d')!;
  paintStreet((x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }, seed);
  return canvas;
}
