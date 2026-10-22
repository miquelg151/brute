// Small pixel icons used across the interface instead of words. Each icon is a grid of
// characters: '.' is transparent, any other character is a colour from its palette.
// Custom art can replace any icon: list it under "icons" in public/art/manifest.json.
import { artImage, artManifest, imageToCanvas } from './art';
import { h, pixelArt } from './dom';
import { sprite } from './sprites';

interface IconDef {
  rows: string[];
  colors: Record<string, string>;
}

const ICONS = {
  health: {
    rows: ['.RR.RR.', 'RwRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
    colors: { R: '#e5484d', w: '#ffd0d0' },
  },
  strength: {
    rows: ['G.....G', 'G.....G', 'GGGGGGG', 'G.....G', 'G.....G'],
    colors: { G: '#8b8f9c' },
  },
  agility: {
    rows: ['....FF', '...FFF', '..FFF.', '.FFF..', 'FFF...', 'F.....'],
    colors: { F: '#2ec4b6' },
  },
  speed: {
    rows: ['...YY', '..YY.', '.YYYY', '..YY.', '.YY..', 'YY...'],
    colors: { Y: '#ffd23f' },
  },
  armor: {
    rows: ['SSSSSSS', 'SwSSSSS', 'SSSSSSS', '.SSSSS.', '..SSS..', '...S...'],
    colors: { S: '#9aa3b5', w: '#e6ebf5' },
  },
  damage: {
    rows: ['O..O..O', '.O.O.O.', '..OOO..', 'OOOYOOO', '..OOO..', '.O.O.O.', 'O..O..O'],
    colors: { O: '#ff8a3d', Y: '#ffd23f' },
  },
  dodge: {
    rows: ['TTTTT..', '.....T.', '.TTTT..', '......T', 'TTTTTT.'],
    colors: { T: '#7fdbff' },
  },
  skill: {
    rows: ['...P...', '...P...', '.PPPPP.', 'PPPWPPP', '.PPPPP.', '...P...', '...P...'],
    colors: { P: '#ff5d8f', W: '#ffe0ea' },
  },
  weapon: {
    rows: ['.....BB', '....BBB', '...BBB.', '..BBB..', '.HB....', 'HH.....'],
    colors: { B: '#c47a2c', H: '#5a3a1e' },
  },
  pet: {
    rows: ['.P...P.', 'PP.P.PP', '...P...', '.PPPPP.', 'PPPPPPP', '.PP.PP.'],
    colors: { P: '#d9a066' },
  },
  xp: {
    rows: ['...B...', '..BBB..', '.BBBBB.', 'BB.B.BB', '...B...', '...B...'],
    colors: { B: '#6cb6ff' },
  },
  fights: {
    rows: ['.RRRR..', 'RRRRRR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '.WWWW..'],
    colors: { R: '#e5484d', W: '#f0e9da' },
  },
  target: {
    rows: ['..RRR..', '.R...R.', 'R..R..R', 'R.RRR.R', 'R..R..R', '.R...R.', '..RRR..'],
    colors: { R: '#ff5d8f' },
  },
  origin: {
    rows: ['...H...', '..HHH..', '.HHHHH.', 'HHHHHHH', '.W.W.W.', '.W.D.W.', '.WWDWW.'],
    colors: { H: '#c94f3d', W: '#e8dcc4', D: '#5a3a1e' },
  },
  stance: {
    rows: ['..K..', '.KKK.', '..K..', '.K.K.', 'K...K'],
    colors: { K: '#efe8d8' },
  },
  fragile: {
    rows: ['.RR.RR.', 'RRR.RRR', 'RRRR.RR', '.RR.RR.', '..R.R..', '...R...'],
    colors: { R: '#e5484d' },
  },
  heavy: {
    rows: ['..GGG..', '..G.G..', 'GGGGGGG', 'GGGGGGG', 'GGGGGGG', 'GGGGGGG'],
    colors: { G: '#6b7080' },
  },
  manyHits: {
    rows: ['O.O.O', 'O.O.O', '.O.O.O', '.O.O.O', 'O.O.O', 'O.O.O'],
    colors: { O: '#ff8a3d' },
  },
  stamina: {
    rows: ['...G...', '..GGG..', '.GGGGG.', 'GGWGGGG', 'GGGGGGG', '.GGGGG.', '..GGG..'],
    colors: { G: '#8bd450', W: '#e4ffd0' },
  },
  mana: {
    rows: ['...B...', '..BBB..', '.BBWBB.', 'BBBWBBB', '.BBBBB.', '..BBB..', '...B...'],
    colors: { B: '#5b8cff', W: '#d6e4ff' },
  },
  magic: {
    rows: ['P.....P', '.P...P.', '..PPP..', '.PPWPP.', '..PPP..', '.P...P.', 'P.....P'],
    colors: { P: '#b388ff', W: '#f1e6ff' },
  },
  magicResist: {
    rows: ['PPPPPPP', 'PWPPPPP', 'PPP.PPP', '.PP.PP.', '..PPP..', '...P...'],
    colors: { P: '#9b6dff', W: '#e9ddff' },
  },
  accessory: {
    rows: ['..YYY..', '.Y...Y.', 'Y.....Y', 'Y.....Y', '.Y...Y.', '..YYY..'],
    colors: { Y: '#ffd23f' },
  },
  round: {
    rows: ['.KKKKK.', 'K..K..K', 'K..K..K', 'K..KK.K', 'K.....K', '.KKKKK.'],
    colors: { K: '#efe8d8' },
  },
  counter: {
    rows: ['...T...', '..TT...', '.TTTTT.', '..TT..T', '...T..T', '......T', '.TTTTT.'],
    colors: { T: '#2ec4b6' },
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

function drawIcon(name: IconName): HTMLCanvasElement {
  const custom = artImage(artManifest().icons?.[name]);
  if (custom) return imageToCanvas(custom);
  const def: IconDef = ICONS[name];
  const width = Math.max(...def.rows.map((r) => r.length));
  return sprite(width, def.rows.length, (px) => {
    def.rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const color = def.colors[ch];
        if (color) px(x, y, color);
      });
    });
  });
}

/** An icon with an accessible name (read by screen readers and shown on hover). */
export function icon(name: IconName, label: string, scale = 2): HTMLElement {
  return h('span', { class: 'icon', role: 'img', 'aria-label': label, title: label }, pixelArt(drawIcon(name), scale));
}

/** Icon followed by a value, e.g. a heart and "75". */
export function iconValue(name: IconName, label: string, value: string | number): HTMLElement {
  return h('span', { class: 'icon-value' }, icon(name, label), h('span', {}, String(value)));
}

export const TRAIT_ICONS: Record<string, IconName> = {
  tough: 'armor',
  fragile: 'fragile',
  many_hits: 'manyHits',
  heavy_hitter: 'heavy',
  has_pets: 'pet',
  counters: 'counter',
  magic_user: 'magic',
};

/** Health, strength, agility and speed as a row of icon + value. */
export function statRow(hp: number, strength: number, agility: number, speed: number): HTMLElement {
  return h(
    'span',
    { class: 'icon-row' },
    iconValue('health', 'Health', hp),
    iconValue('strength', 'Strength', strength),
    iconValue('agility', 'Agility', agility),
    iconValue('speed', 'Speed', speed),
  );
}

/** A section heading shown as an icon; the word stays for screen readers. */
export function iconHeading(name: IconName, text: string): HTMLElement {
  return h('h2', { class: 'section-icon' }, icon(name, text, 3), h('span', { class: 'sr-only' }, text));
}
