// Optional hand-made pixel art. Files listed in public/art/manifest.json replace the
// placeholder sprites drawn in code; anything not listed (or missing) keeps the placeholder.
// See docs/ART.md for the file format.
import type { ClassId } from '../core';

export interface ArtManifest {
  fighter?: {
    /** Body and face, drawn in greyscale: tinted with the skin tone. */
    body?: string;
    /** One file per hair style index, in greyscale: tinted with the hair colour. */
    hair?: (string | null)[];
    /** Clothes per class, in greyscale: tinted with the outfit colour. */
    outfit?: Partial<Record<ClassId, string>>;
    /** Full-colour details per class (headband, cap, glasses...), drawn on top untinted. */
    extra?: Partial<Record<ClassId, string>>;
  };
  pets?: Record<string, string>;
  weapons?: Record<string, string>;
  /** Fight background, 320x200. */
  background?: string;
  /** Interface icons by name (health, strength, skill...). See src/ui/icons.ts. */
  icons?: Record<string, string>;
}

const ART_ROOT = `${import.meta.env.BASE_URL}art/`;
const images = new Map<string, HTMLImageElement>();
let manifest: ArtManifest = {};

function collectPaths(m: ArtManifest): string[] {
  const f = m.fighter ?? {};
  return [
    f.body,
    ...(f.hair ?? []),
    ...Object.values(f.outfit ?? {}),
    ...Object.values(f.extra ?? {}),
    ...Object.values(m.pets ?? {}),
    ...Object.values(m.weapons ?? {}),
    ...Object.values(m.icons ?? {}),
    m.background,
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
}

/** Loads the manifest and every image it lists. Never throws: missing art just isn't used. */
export async function loadArt(): Promise<void> {
  try {
    const res = await fetch(`${ART_ROOT}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return;
    manifest = (await res.json()) as ArtManifest;
  } catch {
    // No manifest (or not valid JSON): placeholders everywhere.
    return;
  }
  await Promise.all(
    collectPaths(manifest).map(
      (path) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            images.set(path, img);
            resolve();
          };
          img.onerror = () => {
            console.warn(`[art] Could not load art/${path}, using the placeholder`);
            resolve();
          };
          img.src = ART_ROOT + path;
        }),
    ),
  );
}

export function artManifest(): ArtManifest {
  return manifest;
}

export function artImage(path: string | null | undefined): HTMLImageElement | undefined {
  return path ? images.get(path) : undefined;
}

/** Copies an image into a new canvas, optionally multiplying it by a colour (white becomes that colour). */
export function imageToCanvas(img: HTMLImageElement, tint?: string, into?: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = into ?? document.createElement('canvas');
  if (!into) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
  }
  const ctx = canvas.getContext('2d')!;
  if (!tint) {
    ctx.drawImage(img, 0, 0);
    return canvas;
  }
  const layer = document.createElement('canvas');
  layer.width = img.naturalWidth;
  layer.height = img.naturalHeight;
  const lctx = layer.getContext('2d')!;
  lctx.drawImage(img, 0, 0);
  const data = lctx.getImageData(0, 0, layer.width, layer.height);
  const n = parseInt(tint.slice(1), 16);
  const [tr, tg, tb] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = (data.data[i]! * tr) / 255;
    data.data[i + 1] = (data.data[i + 1]! * tg) / 255;
    data.data[i + 2] = (data.data[i + 2]! * tb) / 255;
  }
  lctx.putImageData(data, 0, 0);
  ctx.drawImage(layer, 0, 0);
  return canvas;
}
