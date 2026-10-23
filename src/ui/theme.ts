// The look of the whole game in one place: colours and pixel sizes.
// Change a colour here and it changes everywhere: the interface (style.css reads these
// as CSS variables), the icons, the placeholder sprites and the fight arena.
// The ?gallery page shows every colour and can save the palette for Aseprite/LibreSprite.

/** The game palette. Pixel art should only use these colours (plus the skin tones). */
export const PAL = {
  // Darks and greys, slightly purple like the night wall.
  black: '#141218', // sprite outlines
  night: '#1d1b24',
  wall: '#2a2830', // page background
  asphalt: '#3b3844',
  stone: '#555162',
  smoke: '#7d7889',
  fog: '#aaa4b5',
  mist: '#d4cfdb',
  white: '#fbf7ee',

  // Paper and ink: cards, posters and the text written on them.
  paper: '#f0e9da',
  paper2: '#e2d9c6',
  paperEdge: '#cfc4ae',
  ink: '#26232c',
  inkSoft: '#6c6575',

  // Reds and pinks
  maroon: '#7f1d1d',
  crimson: '#c23b3b',
  red: '#e5484d',
  coral: '#ff6b5b',
  blush: '#ffd6dc',
  pink: '#ff5d8f', // spray paint: selection, highlights
  magenta: '#ff5dd8',

  // Browns, oranges, yellows
  brownDark: '#5a3a1e',
  brown: '#7a4e24',
  wood: '#a8642a',
  tan: '#d9a066',
  orange: '#ff8a3d',
  amber: '#ffb347',
  sand: '#e3c06a',
  yellow: '#ffd23f', // spray paint: main actions

  // Greens
  forest: '#1f7a3e',
  moss: '#4f7a1f',
  green: '#3cba5f',
  lime: '#8bd450',

  // Blues and purples
  navy: '#1e1f4b',
  blue: '#5b8cff',
  sky: '#93c5fd',
  teal: '#2ec4b6', // spray paint: progress
  cyan: '#7df9ff',
  ice: '#d6f6ff',
  grape: '#2d2148',
  violet: '#7c4dff',
  purple: '#b388ff',
  lilac: '#e6dbff',

  // Skin tones, light to dark (the player picks one).
  skin1: '#f6d7b8',
  skin2: '#e8b98f',
  skin3: '#c68b59',
  skin4: '#a0673f',
  skin5: '#7a4a2a',
  skin6: '#4f2f1c',
} as const;

export type PalName = keyof typeof PAL;

/**
 * How big one art pixel is on screen, in CSS pixels. Every sprite and icon uses one of
 * these three sizes, so pixels look the same size across the whole game.
 */
export const PIXEL = {
  small: 3, // icons inside text
  normal: 4, // icons, items, pets, fighters on posters
  big: 6, // your fighter on the home and creation screens
} as const;

export type PixelSize = keyof typeof PIXEL;

/** A palette colour as a number, the way Phaser wants it (0xrrggbb). */
export function num(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/** Interface colours used by style.css, as `var(--name)`. */
const CSS_COLORS: Record<string, string> = {
  wall: PAL.wall,
  'wall-text': PAL.paper, // text written straight on the wall
  'wall-dim': PAL.fog,
  paper: PAL.paper, // cards
  'paper-2': PAL.paper2, // insets, slots, inputs
  'paper-edge': PAL.paperEdge,
  'paper-lit': PAL.white, // a selected card
  ink: PAL.ink, // text on paper
  'ink-soft': PAL.inkSoft,
  yellow: PAL.yellow,
  pink: PAL.pink,
  teal: PAL.teal,
  orange: PAL.orange,
  lime: PAL.lime,
  cyan: PAL.cyan,
  purple: PAL.purple,
  blue: PAL.blue,
  'green-lit': PAL.green, // "you won" sticker
  'coral-lit': PAL.coral, // "you lost" sticker
  good: PAL.forest,
  bad: PAL.crimson,
  outline: PAL.black, // hard shadows and outlines
  'poster-sky': PAL.asphalt, // top of the fight poster
  arena: PAL.night, // behind the fight canvas
};

/** Puts the palette into CSS variables. Runs once, before anything is drawn. */
export function applyTheme(): void {
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(CSS_COLORS)) root.setProperty(`--${name}`, value);
  // The browser bar on phones takes the wall colour too.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PAL.wall);
}

/** The palette as a GIMP .gpl file, which Aseprite, LibreSprite and Piskel can load. */
export function paletteGpl(): string {
  const lines = ['GIMP Palette', 'Name: Brute', 'Columns: 8', '#'];
  for (const [name, hex] of Object.entries(PAL)) {
    const n = num(hex);
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => String(v).padStart(3)).join(' ');
    lines.push(`${rgb}\t${name}`);
  }
  return lines.join('\n') + '\n';
}
