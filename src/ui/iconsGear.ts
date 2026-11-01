// One icon per gear piece, named `gear_<id>` (the id is the key in GEAR in
// src/core/catalog.ts). Same 7 × 7 format as icons.ts. A PNG listed under "icons" in
// public/art/manifest.json with the same name replaces any of them.
import type { IconDef } from './icons';
import { PAL } from './theme';

export const GEAR_ICONS = {
  gear_leather_jacket: {
    rows: ['.BBKBB.', 'BBBKBBB', 'BBBKBBB', 'B.BKB.B', 'L.BKB.L', '..BKB..', '..BBB..'],
    colors: { B: PAL.brown, K: PAL.brownDark, L: PAL.skin3 },
  },
  gear_riot_vest: {
    rows: ['.B...B.', '.BB.BB.', 'BBBBBBB', 'BLLLLLB', 'BBBBBBB', 'BLLLLLB', 'BBBBBBB'],
    colors: { B: PAL.blue, L: PAL.sky },
  },
  gear_tracksuit: {
    rows: ['.TT.TT.', 'TTTTTTT', 'TWTTTWT', 'TWTTTWT', '.WTTTW.', '..TTT..', '..TTT..'],
    colors: { T: PAL.teal, W: PAL.white },
  },
  gear_rune_hoodie: {
    rows: ['..PPP..', '.PKKKP.', 'PPPPPPP', 'PPPLPPP', 'P.PPP.P', 'P.PPP.P', '..PPP..'],
    colors: { P: PAL.violet, K: PAL.grape, L: PAL.lilac },
  },
  gear_sneakers: {
    rows: ['.......', '.......', '.RR....', '.RRR...', '.RRRRR.', 'RRRRRRR', 'WWWWWWW'],
    colors: { R: PAL.red, W: PAL.white },
  },
  // A four-leaf clover.
  gear_charm: {
    rows: ['.GG.GG.', 'GLG.GLG', '.GGFGG.', '...F...', '.GGFGG.', 'GLG.GLG', '.GG.GG.'],
    colors: { G: PAL.green, L: PAL.lime, F: PAL.forest },
  },
  // A boxing glove.
  gear_gloves: {
    rows: ['.RRRR..', 'RLRRRR.', 'RRRRRRR', 'RRRRRRD', '.RRRRD.', '.WWWW..', '.WWWW..'],
    colors: { R: PAL.red, L: PAL.coral, D: PAL.crimson, W: PAL.white },
  },
  // A bag with a bone on it.
  gear_treat_bag: {
    rows: ['..BTB..', '...B...', '.TTTTT.', 'TTTTTTB', 'TWTTTWB', 'TWWWWWB', '.BBBBB.'],
    colors: { T: PAL.tan, B: PAL.wood, W: PAL.white },
  },
  // Hand wraps.
  gear_boxing_wraps: {
    rows: ['.......', '.WWWWW.', 'WSWSWSW', 'WWWWWWW', 'SWSWSWS', '.WWWWW.', '..SSS..'],
    colors: { W: PAL.white, S: PAL.mist },
  },
  // A shoe on a spring.
  gear_spring_sneakers: {
    rows: ['.TT....', '.TTTT..', 'TTTTTTT', 'WWWWWWW', '.G.G.G.', '..G.G..', '.G.G.G.'],
    colors: { T: PAL.teal, W: PAL.white, G: PAL.fog },
  },
  // A bin lid with a handle.
  gear_dumpster_lid: {
    rows: ['.......', '..GGG..', '..G.G..', 'FFFFFFF', 'FGGGGGF', 'FFFFFFF', '.......'],
    colors: { G: PAL.green, F: PAL.forest },
  },
  // A collar with a key tag.
  gear_key_collar: {
    rows: ['.RRRRR.', 'R.....R', 'R.....R', '.RRRRR.', '...Y...', '..YYY..', '...Y...'],
    colors: { R: PAL.red, Y: PAL.yellow },
  },
  // A spray can.
  gear_neon_spray: {
    rows: ['M.M.KK.', '.M..SS.', 'M..PPPP', '...PLPP', '...PPPP', '...PPPP', '...PPPP'],
    colors: { M: PAL.magenta, K: PAL.fog, S: PAL.stone, P: PAL.pink, L: PAL.white },
  },
  // A pendant on a chain.
  gear_rune_amulet: {
    rows: ['.Y...Y.', '..Y.Y..', '...Y...', '..PPP..', '.PPLPP.', '..PPP..', '...P...'],
    colors: { Y: PAL.yellow, P: PAL.violet, L: PAL.lilac },
  },
  // A cap with its brim to the right.
  gear_cap: {
    rows: ['.......', '.......', '..BBB..', '.BLBBB.', 'BBBBBB.', 'BBBBDDD', '.......'],
    colors: { B: PAL.blue, L: PAL.sky, D: PAL.navy },
  },
  // A coat with two patches.
  gear_patched_coat: {
    rows: ['.TT.TT.', 'TTTBTTT', 'TRTBTTT', 'T.TBTG.', 'T.TBTT.', '..TBTT.', '..TTTT.'],
    colors: { T: PAL.tan, B: PAL.brown, R: PAL.red, G: PAL.teal },
  },
  gear_backpack: {
    rows: ['..BBB..', '.B...B.', 'OOOOOOO', 'OOKKKOO', 'OOOOOOO', 'OOOOOOO', '.OOOOO.'],
    colors: { O: PAL.orange, K: PAL.brown, B: PAL.brown },
  },
  gear_headphones: {
    rows: ['..KKK..', '.K...K.', 'K.....K', 'K.....K', 'RR...RR', 'RR...RR', 'RR...RR'],
    colors: { K: PAL.stone, R: PAL.red },
  },
  // League gear.
  gear_bike_helmet: {
    rows: ['.......', '..RRR..', '.RWRWR.', 'RRRRRRR', 'RRRRRRR', 'K.....K', '.K...K.'],
    colors: { R: PAL.orange, W: PAL.white, K: PAL.asphalt },
  },
  gear_neon_jacket: {
    rows: ['.MM.MM.', 'MMMCMMM', 'MCMCMCM', 'M.MCM.M', 'C.MCM.C', '..MCM..', '..MMM..'],
    colors: { M: PAL.magenta, C: PAL.cyan },
  },
} satisfies Record<string, IconDef>;
