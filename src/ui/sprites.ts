// Placeholder pixel art drawn in code, so the prototype needs no image assets.
// Every sprite faces right; the replay flips it for the right-hand team.
import type { Appearance, ClassId } from '../core';
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, shade } from './palette';

type Px = (x: number, y: number, color: string) => void;
type Rect = (x: number, y: number, w: number, h: number, color: string) => void;

const OUTLINE = '#141218';

function sprite(w: number, h: number, draw: (px: Px, rect: Rect) => void): HTMLCanvasElement {
  const grid: (string | null)[][] = Array.from({ length: h }, () => Array<string | null>(w).fill(null));
  const px: Px = (x, y, color) => {
    if (x >= 0 && y >= 0 && x < w && y < h) grid[y]![x] = color;
  };
  const rect: Rect = (x, y, rw, rh, color) => {
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) px(x + i, y + j, color);
  };
  draw(px, rect);

  // One-pixel outline around every filled shape, for readability on any background.
  const canvas = document.createElement('canvas');
  canvas.width = w + 2;
  canvas.height = h + 2;
  const ctx = canvas.getContext('2d')!;
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && grid[y]![x] !== null;
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      const color = filled(x, y) ? grid[y]![x]! : null;
      const edge = !color && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1));
      if (color || edge) {
        ctx.fillStyle = color ?? OUTLINE;
        ctx.fillRect(x + 1, y + 1, 1, 1);
      }
    }
  }
  return canvas;
}

export function drawFighter(look: Appearance, classId: ClassId): HTMLCanvasElement {
  const skin = SKIN_TONES[look.skinTone] ?? SKIN_TONES[0]!;
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0]!;
  const outfit = OUTFIT_COLORS[look.outfitColor] ?? OUTFIT_COLORS[0]!;
  const pants = '#374151';
  const wide = classId === 'bouncer';

  return sprite(16, 24, (px, rect) => {
    // Legs and shoes
    rect(5, 17, 3, 5, pants);
    rect(8, 17, 3, 5, shade(pants, -0.2));
    const shoes = classId === 'parkour' ? '#f5f5f5' : '#1f1f1f';
    rect(5, 22, 3, 2, shoes);
    rect(8, 22, 4, 2, shoes);
    // Torso and belt
    rect(wide ? 3 : 4, 10, wide ? 10 : 8, 6, outfit);
    rect(wide ? 3 : 4, 10, 1, 6, shade(outfit, -0.25));
    rect(wide ? 3 : 4, 16, wide ? 10 : 8, 1, '#2a2a2a');
    // Arms: sleeve then skin, hand at the bottom
    const backArm = wide ? 2 : 3;
    const frontArm = wide ? 13 : 12;
    rect(backArm, 10, 1, 3, shade(outfit, -0.35));
    rect(backArm, 13, 1, 3, shade(skin, -0.2));
    rect(frontArm, 10, 1, 3, outfit);
    rect(frontArm, 13, 1, 3, skin);
    // Neck and head
    rect(7, 9, 2, 1, shade(skin, -0.2));
    rect(5, 2, 6, 7, skin);
    rect(5, 2, 1, 7, shade(skin, -0.15));
    px(9, 5, '#111111');
    px(9, 7, shade(skin, -0.35));
    // Hair
    switch (look.hairStyle) {
      case 0:
        rect(5, 1, 6, 2, hair);
        rect(5, 3, 1, 2, hair);
        break;
      case 1:
        rect(7, 0, 2, 3, hair);
        break;
      case 2:
        rect(5, 1, 6, 2, hair);
        rect(4, 2, 2, 8, hair);
        break;
    }
    // Class accessory
    switch (classId) {
      case 'brawler':
        rect(5, 3, 6, 1, '#dc2626');
        px(4, 4, '#dc2626');
        px(backArm, 15, '#f5f5f5');
        px(frontArm, 15, '#f5f5f5');
        break;
      case 'parkour':
        rect(4, 1, 2, 8, shade(outfit, -0.3));
        rect(5, 1, 5, 1, shade(outfit, -0.3));
        break;
      case 'bouncer':
        rect(8, 5, 3, 1, '#0a0a0a');
        break;
      case 'tamer':
        rect(5, 1, 6, 2, '#4d7c0f');
        rect(11, 2, 2, 1, '#3f6212');
        break;
    }
  });
}

export function drawPet(petId: string): HTMLCanvasElement {
  switch (petId) {
    case 'crow':
      return sprite(8, 8, (px, rect) => {
        rect(1, 3, 5, 3, '#27272a');
        rect(4, 1, 3, 3, '#27272a');
        px(7, 2, '#facc15');
        px(5, 2, '#f5f5f5');
        rect(0, 3, 2, 1, '#3f3f46');
        rect(2, 6, 1, 2, '#facc15');
        rect(4, 6, 1, 2, '#facc15');
      });
    case 'raccoon':
      return sprite(12, 8, (px, rect) => {
        rect(2, 3, 7, 3, '#8a8a95');
        rect(8, 1, 4, 4, '#8a8a95');
        rect(8, 2, 4, 1, '#27272a');
        px(10, 2, '#f5f5f5');
        rect(0, 2, 2, 1, '#8a8a95');
        rect(0, 3, 2, 1, '#27272a');
        rect(0, 4, 2, 1, '#8a8a95');
        rect(3, 6, 1, 2, '#52525b');
        rect(7, 6, 1, 2, '#52525b');
      });
    default:
      return sprite(12, 8, (px, rect) => {
        rect(2, 3, 7, 3, '#a16207');
        rect(8, 1, 3, 4, '#a16207');
        px(11, 3, '#713f12');
        px(8, 0, '#713f12');
        px(10, 2, '#111111');
        rect(0, 2, 2, 1, '#a16207');
        rect(3, 6, 1, 2, '#854d0e');
        rect(7, 6, 1, 2, '#854d0e');
      });
  }
}

export function drawWeapon(weaponId: string): HTMLCanvasElement {
  switch (weaponId) {
    case 'chain':
      return sprite(10, 3, (px) => {
        for (let x = 0; x < 10; x++) px(x, x % 2, x % 4 < 2 ? '#a1a1aa' : '#71717a');
      });
    case 'skateboard':
      return sprite(12, 3, (px, rect) => {
        rect(0, 0, 12, 1, '#f97316');
        px(2, 1, '#52525b');
        px(9, 1, '#52525b');
        px(2, 2, '#e5e5e5');
        px(9, 2, '#e5e5e5');
      });
    case 'umbrella':
      return sprite(10, 5, (px, rect) => {
        rect(0, 2, 9, 1, '#3f3f46');
        rect(6, 0, 4, 2, '#7c3aed');
        rect(5, 1, 1, 3, '#7c3aed');
        px(0, 3, '#3f3f46');
      });
    case 'traffic_sign':
      return sprite(12, 6, (_px, rect) => {
        rect(0, 2, 8, 1, '#9ca3af');
        rect(8, 0, 4, 6, '#dc2626');
        rect(9, 2, 2, 2, '#f5f5f5');
      });
    case 'extinguisher':
      return sprite(10, 4, (_px, rect) => {
        rect(0, 0, 8, 4, '#dc2626');
        rect(8, 1, 2, 2, '#27272a');
        rect(1, 0, 1, 4, '#f5f5f5');
      });
    default:
      return sprite(11, 3, (px, rect) => {
        rect(0, 1, 4, 1, '#3f2a14');
        rect(4, 0, 7, 3, '#b45309');
        px(10, 0, '#92400e');
      });
  }
}
