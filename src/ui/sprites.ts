// Sprites for fighters, pets and weapons. Hand-made art from public/art is used when
// present (see art.ts); otherwise a placeholder drawn in code.
// Every sprite faces right; the replay flips it for the right-hand team.
import type { Appearance, ClassId } from '../core';
import { artImage, artManifest, imageToCanvas } from './art';
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, shade } from './palette';
import { PAL } from './theme';

type Px = (x: number, y: number, color: string) => void;
type Rect = (x: number, y: number, w: number, h: number, color: string) => void;

const OUTLINE = PAL.black;

export function sprite(w: number, h: number, draw: (px: Px, rect: Rect) => void): HTMLCanvasElement {
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

function placeholderFighter(look: Appearance, classId: ClassId): HTMLCanvasElement {
  const skin = SKIN_TONES[look.skinTone] ?? SKIN_TONES[0]!;
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0]!;
  const outfit = OUTFIT_COLORS[look.outfitColor] ?? OUTFIT_COLORS[0]!;
  const pants = PAL.asphalt;
  const wide = classId === 'bouncer';

  return sprite(16, 24, (px, rect) => {
    // Legs and shoes
    rect(5, 17, 3, 5, pants);
    rect(8, 17, 3, 5, shade(pants, -0.2));
    const shoes = classId === 'parkour' ? PAL.white : PAL.night;
    rect(5, 22, 3, 2, shoes);
    rect(8, 22, 4, 2, shoes);
    // Torso and belt
    rect(wide ? 3 : 4, 10, wide ? 10 : 8, 6, outfit);
    rect(wide ? 3 : 4, 10, 1, 6, shade(outfit, -0.25));
    rect(wide ? 3 : 4, 16, wide ? 10 : 8, 1, PAL.night);
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
    px(9, 5, PAL.black);
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
        rect(5, 3, 6, 1, PAL.crimson);
        px(4, 4, PAL.crimson);
        px(backArm, 15, PAL.white);
        px(frontArm, 15, PAL.white);
        break;
      case 'parkour':
        rect(4, 1, 2, 8, shade(outfit, -0.3));
        rect(5, 1, 5, 1, shade(outfit, -0.3));
        break;
      case 'bouncer':
        rect(8, 5, 3, 1, PAL.black);
        break;
      case 'tamer':
        rect(5, 1, 6, 2, PAL.moss);
        rect(11, 2, 2, 1, PAL.forest);
        break;
      case 'mystic':
        // Deep hood with glowing neon runes on the chest.
        rect(4, 0, 7, 2, PAL.grape);
        rect(4, 2, 1, 7, PAL.grape);
        rect(10, 1, 1, 2, PAL.grape);
        px(6, 12, PAL.cyan);
        px(8, 12, PAL.cyan);
        px(7, 13, PAL.magenta);
        px(7, 11, PAL.magenta);
        break;
    }
  });
}

function placeholderPet(petId: string): HTMLCanvasElement {
  switch (petId) {
    case 'spirit':
      return sprite(10, 12, (px, rect) => {
        rect(2, 0, 6, 2, PAL.ice);
        rect(1, 2, 8, 6, PAL.ice);
        rect(1, 8, 2, 3, PAL.ice);
        rect(4, 8, 2, 4, PAL.ice);
        rect(7, 8, 2, 3, PAL.ice);
        rect(2, 2, 1, 6, PAL.ice);
        px(5, 4, PAL.navy);
        px(7, 4, PAL.navy);
      });
    case 'crow':
      return sprite(8, 8, (px, rect) => {
        rect(1, 3, 5, 3, PAL.night);
        rect(4, 1, 3, 3, PAL.night);
        px(7, 2, PAL.yellow);
        px(5, 2, PAL.white);
        rect(0, 3, 2, 1, PAL.asphalt);
        rect(2, 6, 1, 2, PAL.yellow);
        rect(4, 6, 1, 2, PAL.yellow);
      });
    case 'raccoon':
      return sprite(12, 8, (px, rect) => {
        rect(2, 3, 7, 3, PAL.smoke);
        rect(8, 1, 4, 4, PAL.smoke);
        rect(8, 2, 4, 1, PAL.night);
        px(10, 2, PAL.white);
        rect(0, 2, 2, 1, PAL.smoke);
        rect(0, 3, 2, 1, PAL.night);
        rect(0, 4, 2, 1, PAL.smoke);
        rect(3, 6, 1, 2, PAL.stone);
        rect(7, 6, 1, 2, PAL.stone);
      });
    default:
      return sprite(12, 8, (px, rect) => {
        rect(2, 3, 7, 3, PAL.wood);
        rect(8, 1, 3, 4, PAL.wood);
        px(11, 3, PAL.brown);
        px(8, 0, PAL.brown);
        px(10, 2, PAL.black);
        rect(0, 2, 2, 1, PAL.wood);
        rect(3, 6, 1, 2, PAL.brown);
        rect(7, 6, 1, 2, PAL.brown);
      });
  }
}

function placeholderWeapon(weaponId: string): HTMLCanvasElement {
  switch (weaponId) {
    case 'chain':
      return sprite(10, 3, (px) => {
        for (let x = 0; x < 10; x++) px(x, x % 2, x % 4 < 2 ? PAL.fog : PAL.smoke);
      });
    case 'skateboard':
      return sprite(12, 3, (px, rect) => {
        rect(0, 0, 12, 1, PAL.orange);
        px(2, 1, PAL.stone);
        px(9, 1, PAL.stone);
        px(2, 2, PAL.mist);
        px(9, 2, PAL.mist);
      });
    case 'umbrella':
      return sprite(10, 5, (px, rect) => {
        rect(0, 2, 9, 1, PAL.asphalt);
        rect(6, 0, 4, 2, PAL.violet);
        rect(5, 1, 1, 3, PAL.violet);
        px(0, 3, PAL.asphalt);
      });
    case 'traffic_sign':
      return sprite(12, 6, (_px, rect) => {
        rect(0, 2, 8, 1, PAL.fog);
        rect(8, 0, 4, 6, PAL.crimson);
        rect(9, 2, 2, 2, PAL.white);
      });
    case 'extinguisher':
      return sprite(10, 4, (_px, rect) => {
        rect(0, 0, 8, 4, PAL.crimson);
        rect(8, 1, 2, 2, PAL.night);
        rect(1, 0, 1, 4, PAL.white);
      });
    default:
      return sprite(11, 3, (px, rect) => {
        rect(0, 1, 4, 1, PAL.brownDark);
        rect(4, 0, 7, 3, PAL.wood);
        px(10, 0, PAL.brown);
      });
  }
}

/** Layered custom fighter: body, outfit, hair (tinted), then untinted class details. */
function customFighter(look: Appearance, classId: ClassId): HTMLCanvasElement | null {
  const f = artManifest().fighter;
  const body = artImage(f?.body);
  if (!f || !body) return null;
  const canvas = document.createElement('canvas');
  canvas.width = body.naturalWidth;
  canvas.height = body.naturalHeight;
  imageToCanvas(body, SKIN_TONES[look.skinTone], canvas);
  const outfit = artImage(f.outfit?.[classId]);
  if (outfit) imageToCanvas(outfit, OUTFIT_COLORS[look.outfitColor], canvas);
  const hair = artImage(f.hair?.[look.hairStyle]);
  if (hair) imageToCanvas(hair, HAIR_COLORS[look.hairColor], canvas);
  const extra = artImage(f.extra?.[classId]);
  if (extra) imageToCanvas(extra, undefined, canvas);
  return canvas;
}

export function drawFighter(look: Appearance, classId: ClassId): HTMLCanvasElement {
  return customFighter(look, classId) ?? placeholderFighter(look, classId);
}

export function drawPet(petId: string): HTMLCanvasElement {
  const img = artImage(artManifest().pets?.[petId]);
  return img ? imageToCanvas(img) : placeholderPet(petId);
}

export function drawWeapon(weaponId: string): HTMLCanvasElement {
  const img = artImage(artManifest().weapons?.[weaponId]);
  return img ? imageToCanvas(img) : placeholderWeapon(weaponId);
}
