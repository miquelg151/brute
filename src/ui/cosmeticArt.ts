// Hats and the extra hair styles, drawn in code on top of the fighter's head. Each one is a
// grid 12 pixels wide: column 0 is one pixel left of the head, column 11 one pixel right of
// it. `sit` is the head row (0 = the top of the head) where the grid's last row lands.
// The fighter faces right, so the front of a hat is on the right.
// A PNG strip listed under fighter.hat.<id> (or fighter.hair, for a hair style) in
// public/art/manifest.json replaces any of them; see docs/ART.md.
import { PAL } from './theme';

export interface HeadArt {
  rows: string[];
  /** Letter -> colour. For hair styles, H, S and L are filled from the hair colour instead. */
  colors: Record<string, string>;
  sit: number;
}

export const HAT_ART: Record<string, HeadArt> = {
  cap: {
    rows: ['...BBBBBB...', '..BBLBBBBB..', '..BBBBBBBBDD'],
    colors: { B: PAL.blue, L: PAL.sky, D: PAL.navy },
    sit: 1,
  },
  bandana: {
    rows: ['.RRRRRRRRRR.', 'RR.RRWRRRRRR', 'R...........'],
    colors: { R: PAL.red, W: PAL.white },
    sit: 3,
  },
  sweatband: {
    rows: ['.WWWWWWWWWW.', '.RRRRRRRRRR.'],
    colors: { W: PAL.white, R: PAL.red },
    sit: 3,
  },
  hard_hat: {
    rows: ['....YYYY....', '..YYYLYYYY..', '.YYYYYYYYYY.', 'DDDDDDDDDDDD'],
    colors: { Y: PAL.yellow, L: PAL.white, D: PAL.amber },
    sit: 1,
  },
  cat_ears: {
    rows: ['.KK......KK.', '.KPK....KPK.', '.KKKKKKKKKK.'],
    colors: { K: PAL.smoke, P: PAL.pink },
    sit: 1,
  },
  rat_crown: {
    rows: ['.M..M..M..M.', '.MM.MM.MM.M.', '.MMMMMMMMMM.', '.MGMMGMMGMM.'],
    colors: { M: PAL.moss, G: PAL.lime },
    sit: 1,
  },
  champion_band: {
    rows: ['.....W......', '.YYYYYYYYYY.', '.DDDDDDDDDD.'],
    colors: { Y: PAL.yellow, D: PAL.amber, W: PAL.white },
    sit: 3,
  },
  shades: {
    rows: ['...KKKKKKKKK', '......KLK.KK'],
    colors: { K: PAL.black, L: PAL.white },
    sit: 3,
  },
  ninja_mask: {
    rows: ['..KKKKKKKK..', '.KKKKKKKKKK.', '.KKKKKKKKKKK', '.K..........', '.KKKKKKKKKK.', '.KKKKKKKKKK.'],
    colors: { K: PAL.asphalt },
    sit: 5,
  },
  crown: {
    rows: ['..Y...Y...Y.', '..YY.YYY.YY.', '..YYYYYYYYY.', '..YRYYBYYRY.'],
    colors: { Y: PAL.yellow, R: PAL.red, B: PAL.blue },
    sit: 1,
  },
};

/** Extra hair styles, by their index in the appearance (see COSMETICS). */
export const HAIR_ART: Record<number, HeadArt> = {
  // Spiky
  4: {
    rows: ['..H.H.H.H...', '..HHHHHHHH..', '.HHLHHHHHH..', '.SHHHHHH....'],
    colors: {},
    sit: 1,
  },
  // Bun
  5: {
    rows: ['..SHH.......', '.SHHHH......', '..SHHHHHH...', '.SHHHHHHHH..', '.SH.........'],
    colors: {},
    sit: 2,
  },
};
