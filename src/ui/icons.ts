// Small pixel icons used across the interface instead of words. Each icon is a grid of
// characters: '.' is transparent, any other character is a colour from its palette.
// Custom art can replace any icon: list it under "icons" in public/art/manifest.json.
import { artImage, artManifest, imageToCanvas } from './art';
import { h, pixelArt } from './dom';
import { sprite } from './sprites';
import { PAL, type PixelSize } from './theme';

interface IconDef {
  rows: string[];
  colors: Record<string, string>;
}

const ICONS = {
  health: {
    rows: ['.RR.RR.', 'RwRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
    colors: { R: PAL.red, w: PAL.blush },
  },
  strength: {
    rows: ['G.....G', 'G.....G', 'GGGGGGG', 'G.....G', 'G.....G'],
    colors: { G: PAL.smoke },
  },
  agility: {
    rows: ['....FF', '...FFF', '..FFF.', '.FFF..', 'FFF...', 'F.....'],
    colors: { F: PAL.teal },
  },
  speed: {
    rows: ['...YY', '..YY.', '.YYYY', '..YY.', '.YY..', 'YY...'],
    colors: { Y: PAL.yellow },
  },
  armor: {
    rows: ['SSSSSSS', 'SwSSSSS', 'SSSSSSS', '.SSSSS.', '..SSS..', '...S...'],
    colors: { S: PAL.fog, w: PAL.white },
  },
  damage: {
    rows: ['O..O..O', '.O.O.O.', '..OOO..', 'OOOYOOO', '..OOO..', '.O.O.O.', 'O..O..O'],
    colors: { O: PAL.orange, Y: PAL.yellow },
  },
  dodge: {
    rows: ['TTTTT..', '.....T.', '.TTTT..', '......T', 'TTTTTT.'],
    colors: { T: PAL.cyan },
  },
  skill: {
    rows: ['...P...', '...P...', '.PPPPP.', 'PPPWPPP', '.PPPPP.', '...P...', '...P...'],
    colors: { P: PAL.pink, W: PAL.blush },
  },
  weapon: {
    rows: ['.....BB', '....BBB', '...BBB.', '..BBB..', '.HB....', 'HH.....'],
    colors: { B: PAL.wood, H: PAL.brownDark },
  },
  pet: {
    rows: ['.P...P.', 'PP.P.PP', '...P...', '.PPPPP.', 'PPPPPPP', '.PP.PP.'],
    colors: { P: PAL.tan },
  },
  xp: {
    rows: ['...B...', '..BBB..', '.BBBBB.', 'BB.B.BB', '...B...', '...B...'],
    colors: { B: PAL.sky },
  },
  fights: {
    rows: ['.RRRR..', 'RRRRRR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '.WWWW..'],
    colors: { R: PAL.red, W: PAL.paper },
  },
  target: {
    rows: ['..RRR..', '.R...R.', 'R..R..R', 'R.RRR.R', 'R..R..R', '.R...R.', '..RRR..'],
    colors: { R: PAL.pink },
  },
  origin: {
    rows: ['...H...', '..HHH..', '.HHHHH.', 'HHHHHHH', '.W.W.W.', '.W.D.W.', '.WWDWW.'],
    colors: { H: PAL.crimson, W: PAL.paper2, D: PAL.brownDark },
  },
  stance: {
    rows: ['..K..', '.KKK.', '..K..', '.K.K.', 'K...K'],
    colors: { K: PAL.paper },
  },
  fragile: {
    rows: ['.RR.RR.', 'RRR.RRR', 'RRRR.RR', '.RR.RR.', '..R.R..', '...R...'],
    colors: { R: PAL.red },
  },
  heavy: {
    rows: ['..GGG..', '..G.G..', 'GGGGGGG', 'GGGGGGG', 'GGGGGGG', 'GGGGGGG'],
    colors: { G: PAL.stone },
  },
  manyHits: {
    rows: ['O.O.O', 'O.O.O', '.O.O.O', '.O.O.O', 'O.O.O', 'O.O.O'],
    colors: { O: PAL.orange },
  },
  stamina: {
    rows: ['...G...', '..GGG..', '.GGGGG.', 'GGWGGGG', 'GGGGGGG', '.GGGGG.', '..GGG..'],
    colors: { G: PAL.lime, W: PAL.white },
  },
  mana: {
    rows: ['...B...', '..BBB..', '.BBWBB.', 'BBBWBBB', '.BBBBB.', '..BBB..', '...B...'],
    colors: { B: PAL.blue, W: PAL.ice },
  },
  magic: {
    rows: ['P.....P', '.P...P.', '..PPP..', '.PPWPP.', '..PPP..', '.P...P.', 'P.....P'],
    colors: { P: PAL.purple, W: PAL.lilac },
  },
  magicResist: {
    rows: ['PPPPPPP', 'PWPPPPP', 'PPP.PPP', '.PP.PP.', '..PPP..', '...P...'],
    colors: { P: PAL.violet, W: PAL.lilac },
  },
  accessory: {
    rows: ['..YYY..', '.Y...Y.', 'Y.....Y', 'Y.....Y', '.Y...Y.', '..YYY..'],
    colors: { Y: PAL.yellow },
  },
  round: {
    rows: ['.KKKKK.', 'K..K..K', 'K..K..K', 'K..KK.K', 'K.....K', '.KKKKK.'],
    colors: { K: PAL.paper },
  },
  counter: {
    rows: ['...T...', '..TT...', '.TTTTT.', '..TT..T', '...T..T', '......T', '.TTTTT.'],
    colors: { T: PAL.teal },
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function drawIcon(name: IconName): HTMLCanvasElement {
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
export function icon(name: IconName, label: string, size: PixelSize = 'small'): HTMLElement {
  return h('span', { class: 'icon', role: 'img', 'aria-label': label, title: label }, pixelArt(drawIcon(name), size));
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
  return h('h2', { class: 'section-icon' }, icon(name, text, 'normal'), h('span', { class: 'sr-only' }, text));
}
