// Builds the app icons in public/icons from the fist in src/ui/fist.ts:
// the fist as a sticker (dark outline, paper edge, pink shadow) on the wall colour.
// Run with `npm run icons` after changing the fist or the palette.
// To use your own icon instead, just replace the PNG files and don't run this.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { FIST } from '../src/ui/fist';
import { PAL } from '../src/ui/theme';

type Grid = (string | null)[][];

const OUT_DIR = 'public/icons';

/** The fist as a grid of colours, with its outline, sticker edge and shadow. */
function stickerGrid(): Grid {
  const PAD = 3; // outline + sticker edge + shadow
  const w = FIST.rows[0]!.length + PAD * 2;
  const h = FIST.rows.length + PAD * 2;
  const art: Grid = Array.from({ length: h }, () => Array<string | null>(w).fill(null));
  FIST.rows.forEach((row, y) => [...row].forEach((ch, x) => (art[y + PAD]![x + PAD] = FIST.colors[ch] ?? null)));

  // Adds a one-pixel ring of `color` around everything already drawn.
  const ring = (grid: Grid, color: string): Grid =>
    grid.map((row, y) =>
      row.map((c, x) => c ?? ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy!]?.[x + dx!]) ? color : null)),
    );
  const sticker = ring(ring(art, PAL.black), PAL.white);

  // Pink shadow: the sticker's shape moved one pixel down-right, underneath it.
  return sticker.map((row, y) => row.map((c, x) => c ?? (sticker[y - 1]?.[x - 1] ? PAL.pink : null)));
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A square PNG: wall background with the sticker scaled up (whole pixels) and centred. */
function iconPng(size: number, fill: number): Buffer {
  const grid = stickerGrid();
  const gw = grid[0]!.length;
  const gh = grid.length;
  const scale = Math.max(1, Math.floor((size * fill) / Math.max(gw, gh)));
  const left = Math.floor((size - gw * scale) / 2);
  const top = Math.floor((size - gh * scale) / 2);
  const bg = rgb(PAL.wall);

  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - left) / scale);
      const gy = Math.floor((y - top) / scale);
      const inside = x >= left && y >= top && gx < gw && gy < gh;
      const color = inside ? grid[gy]![gx] : null;
      const [r, g, b] = color ? rgb(color) : bg;
      raw.set([r, g, b], rowStart + 1 + x * 3);
    }
  }

  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ICONS: { file: string; size: number; fill: number }[] = [
  { file: 'icon-192.png', size: 192, fill: 0.75 },
  { file: 'icon-512.png', size: 512, fill: 0.75 },
  // Android may cut maskable icons into a circle, so the fist stays inside the middle.
  { file: 'maskable-512.png', size: 512, fill: 0.55 },
  { file: 'apple-touch-icon.png', size: 180, fill: 0.75 },
  { file: 'favicon-64.png', size: 64, fill: 0.95 },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size, fill } of ICONS) {
  writeFileSync(`${OUT_DIR}/${file}`, iconPng(size, fill));
  console.log(`${OUT_DIR}/${file}`);
}
