// Small pixel icons used across the interface instead of words. Each icon is a grid of
// characters: '.' is transparent, any other character is a colour from its palette.
// Custom art can replace any icon: list it under "icons" in public/art/manifest.json.
import { artImage, artManifest, imageToCanvas } from './art';
import { h, pixelArt } from './dom';
import { FIST } from './fist';
import { sprite } from './sprites';
import { PAL, type PixelSize } from './theme';

interface IconDef {
  rows: string[];
  colors: Record<string, string>;
}

// Every icon is drawn on the same 7 × 7 grid (a few are narrower), only with palette
// colours, lit from the top left: L is the light side, D the dark side.

const ICONS = {
  health: {
    rows: [
      '.RR.RR.',
      'RLRRRLR',
      'RRRRRRR',
      '.RRRRR.',
      '..RRR..',
      '...R...',
      '.......',
    ],
    colors: { R: PAL.red, L: PAL.blush },
  },

  strength: {
    rows: [
      '...L...',
      '..LG L..'.replace(/ /g, ''),
      '.LGGG L.'.replace(/ /g, ''),
      'LGGGGGL',
      '.LGGG L.'.replace(/ /g, ''),
      '..LG L..'.replace(/ /g, ''),
      '...L...',
    ],
    colors: { G: PAL.fog, L: PAL.white },
  },

  agility: {
    rows: [
      '......T',
      '.....TT',
      '....TTD',
      '...TTD.',
      '..TTD..',
      '.TD....',
      'T......',
    ],
    colors: { T: PAL.teal, D: PAL.forest },
  },

  speed: {
    rows: [
      '.....Y.',
      '....YY.',
      '...YYY.',
      '.YYYYYD',
      '...YYD.',
      '..YYD..',
      '.YD....',
    ],
    colors: { Y: PAL.yellow, D: PAL.orange },
  },

  armor: {
    rows: [
      '..LLL..',
      '.LSSSL.',
      'LSSSSSD',
      'LSSSSSD',
      '.SSSSD.',
      '..SSD..',
      '...D...',
    ],
    colors: { S: PAL.mist, L: PAL.white, D: PAL.smoke },
  },

  damage: {
    rows: [
      '...O...',
      '..OOO..',
      '.OYYYO.',
      'OYYLYYO',
      '.OYYYO.',
      '..OOO..',
      '...O...',
    ],
    colors: { O: PAL.orange, Y: PAL.yellow, L: PAL.white },
  },

  dodge: {
    rows: [
      'LCC....',
      '.LCCC..',
      '..LCCCC',
      '.LCCC..',
      'LCC....',
      '.......',
      '.......',
    ],
    colors: { C: PAL.cyan, L: PAL.white },
  },

  skill: {
    rows: [
      '...P...',
      '..PLP..',
      '.PPLPP.',
      'PPPLPPP',
      '..PPD..',
      '.PD.PD.',
      '.D...D.',
    ],
    colors: { P: PAL.pink, L: PAL.blush, D: PAL.magenta },
  },

  weapon: {
    rows: [
      '.....LB',
      '....LBD',
      '...LBD.',
      '..LBD..',
      '.HBD...',
      'HH.....',
      'H......',
    ],
    colors: { B: PAL.wood, L: PAL.tan, D: PAL.brown, H: PAL.brownDark },
  },

  pet: {
    rows: [
      '.L...L.',
      '.P...P.',
      '..LPL..',
      '.LPPPL.',
      'LPPPPPL',
      '.PPPPD.',
      '..PDD..',
    ],
    colors: { P: PAL.tan, L: PAL.sand, D: PAL.wood },
  },

  xp: {
    rows: [
      '...L...',
      '..LBB..',
      '.LBBBD.',
      'LBBBBBD',
      '..BBD..',
      '..BBD..',
      '...D...',
    ],
    colors: { B: PAL.sky, L: PAL.white, D: PAL.blue },
  },

  fights: {
    rows: [
      '..LLRR.',
      '.LRRRRL',
      'LRRRRRD',
      'RRRRRRD',
      '.RRRRD.',
      '..WW...',
      '.WWWW..',
    ],
    colors: { R: PAL.red, L: PAL.coral, D: PAL.crimson, W: PAL.white },
  },

  target: {
    rows: [
      '..PPP..',
      '.P...P.',
      'P..P..P',
      'P.PLP.P',
      'P..P..P',
      '.P...P.',
      '..PPP..',
    ],
    colors: { P: PAL.pink, L: PAL.white },
  },

  origin: {
    rows: [
      '...H...',
      '..HLH..',
      '.HLLLH.',
      'HHHHHHH',
      '.WWWWW.',
      '.WWDWW.',
      '..WDW..',
    ],
    colors: { H: PAL.crimson, L: PAL.coral, W: PAL.paper2, D: PAL.brown },
  },

  stance: {
    rows: [
      '...W...',
      '..WWW..',
      '.W.W.W.',
      '...W...',
      '..W.W..',
      '.W...W.',
      '.......',
    ],
    colors: { W: PAL.coral },
  },

  fragile: {
    rows: [
      '.RR.RR.',
      'RLRRLRR',
      'RLR.RRD',
      'RRR.RRD',
      '.RRR.D.',
      '..R.D..',
      '...D...',
    ],
    colors: { R: PAL.red, L: PAL.blush, D: PAL.crimson },
  },

  heavy: {
    rows: [
      '..LLL..',
      '.L...L.',
      'LGGGGGL',
      'LGGGGGD',
      'LGGGGGD',
      '.GGGGG.',
      '..DDD..',
    ],
    colors: { G: PAL.stone, L: PAL.fog, D: PAL.asphalt },
  },

  manyHits: {
    rows: [
      'L.L.L.L',
      'O.O.O.O',
      'O.O.O.O',
      'OOOOOOO',
      '.D.D.D.',
      '..D.D..',
      '.......',
    ],
    colors: { O: PAL.orange, L: PAL.yellow, D: PAL.crimson },
  },

  stamina: {
    rows: [
      '...G...',
      '..GGG..',
      '.GLGGG.',
      'GLGGGGD',
      'GGGGGGD',
      '.GGGGD.',
      '..DDD..',
    ],
    colors: { G: PAL.lime, L: PAL.white, D: PAL.green },
  },

  mana: {
    rows: [
      '...L...',
      '..LBB..',
      '.LBBBD.',
      'LBBBBBD',
      '.BBBB D'.replace(/ /g, ''),
      '..BBD..',
      '...D...',
    ],
    colors: { B: PAL.blue, L: PAL.sky, D: PAL.navy },
  },

  magic: {
    rows: [
      '...P...',
      '..PLP..',
      '.PPLPP.',
      'PPLLLPP',
      '..PPD..',
      '...D...',
      '...D...',
    ],
    colors: { P: PAL.purple, L: PAL.lilac, D: PAL.violet },
  },

  magicResist: {
    rows: [
      '..LLL..',
      '.LPPPL.',
      'LPPWPPD',
      'LPPWPPD',
      '.LPPPD.',
      '..PPD..',
      '...D...',
    ],
    colors: { P: PAL.purple, L: PAL.lilac, D: PAL.violet, W: PAL.white },
  },

  accessory: {
    rows: [
      '..PPP..',
      '...P...',
      '.LYYYL.',
      'LY...YD',
      'Y.....D',
      'YD...DD',
      '.DDDDD.',
    ],
    colors: { Y: PAL.yellow, L: PAL.white, D: PAL.amber, P: PAL.pink },
  },

  round: {
    rows: [
      '..LLL..',
      '.LWWWS.',
      'LWWKWS.',
      'LWWKWS.',
      '.LWWWS.',
      '..SSS..',
      '.......',
    ],
    colors: { W: PAL.paper, L: PAL.white, K: PAL.ink, S: PAL.paperEdge },
  },

  counter: {
    rows: [
      '..L....',
      '.LT....',
      'LTTTTT.',
      '.TD..T.',
      '..D..T.',
      '.....T.',
      '.TTTTD.',
    ],
    colors: { T: PAL.teal, L: PAL.cyan, D: PAL.forest },
  },

  rage: {
    rows: [
      '...R...',
      '..RRR..',
      '..RRR.R',
      '.RRYRRR',
      'RRYYYRR',
      'RYYWYYR',
      '.RYYYR.',
    ],
    colors: { R: PAL.red, Y: PAL.yellow, W: PAL.white },
  },

  fist: FIST,

  left: {
    rows: [
      '...W...',
      '..WW...',
      '.WWWWWW',
      'WWWWWWW',
      '.WWWWWW',
      '..WW...',
      '...W...',
    ],
    colors: { W: PAL.pink },
  },

  right: {
    rows: [
      '...W...',
      '...WW..',
      'WWWWWW.',
      'WWWWWWW',
      'WWWWWW.',
      '...WW..',
      '...W...',
    ],
    colors: { W: PAL.pink },
  },

  fast: {
    rows: [
      'W..W...',
      'WW.WW..',
      'WWWWWWW',
      'WW.WW..',
      'W..W...',
      '.......',
      '.......',
    ],
    colors: { W: PAL.pink },
  },

  skip: {
    rows: [
      'W...WW.',
      'WW..WW.',
      'WWW.WW.',
      'WW..WW.',
      'W...WW.',
      '.......',
      '.......',
    ],
    colors: { W: PAL.pink },
  },

  dice: {
    rows: [
      'WWWWWWW',
      'WK...KW',
      'W.....W',
      'W..K..W',
      'W.....W',
      'WK...KW',
      'WWWWWWW',
    ],
    colors: { W: PAL.white, K: PAL.ink },
  },

  // A padlock, for things you don't have yet.
  lock: {
    rows: [
      '..SSS..',
      '.S...S.',
      '.S...S.',
      'LYYYYYY',
      'LYYKYYD',
      'LYYKYYD',
      '.DDDDD.',
    ],
    colors: { S: PAL.fog, L: PAL.white, Y: PAL.sand, D: PAL.wood, K: PAL.brownDark },
  },
  // A medal on a ribbon, for feats and boss wins.
  medal: {
    rows: [
      '.R...B.',
      '..R.B..',
      '..RBB..',
      '.LYYYD.',
      '.YYLYD.',
      '.YYYYD.',
      '..DDD..',
    ],
    colors: { R: PAL.red, B: PAL.blue, L: PAL.white, Y: PAL.yellow, D: PAL.amber },
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

/** The picture on each plan button (stance, target, weapon use), by option id. */
export const OPTION_ICONS: Record<string, IconName> = {
  balanced: 'stance',
  aggressive: 'rage',
  defensive: 'armor',
  agile: 'dodge',
  mixed: 'target',
  fighter: 'fist',
  pets: 'pet',
  normal: 'weapon',
  throw: 'fast',
  keep: 'lock',
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
