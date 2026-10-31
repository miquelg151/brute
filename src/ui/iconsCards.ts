// Icons drawn only for cards, named `card_<id>` (the id is the key in CARDS in
// src/core/cards.ts). Cards whose idea already has an icon use that one instead: the
// full list "card → icon" is CARD_ICONS in cardView.ts. Same 7 × 7 format as icons.ts.
import type { IconDef } from './icons';
import { PAL } from './theme';

export const CARD_ART = {
  // A dog's head with floppy ears.
  card_stray_dog: {
    rows: ['BB...BB', 'BTTTTTB', 'BTKTKTB', '.TTTTT.', '.TTKTT.', '..TTT..', '.......'],
    colors: { B: PAL.brown, T: PAL.tan, K: PAL.ink },
  },
  // A heart with a paw in it.
  card_together: {
    rows: ['.RR.RR.', 'RRRRRRR', 'RTRTRTR', 'RRTTTRR', '.RTTTR.', '..RRR..', '...R...'],
    colors: { R: PAL.red, T: PAL.sand },
  },
  // A shield made of scraps.
  card_scrap_shield: {
    rows: ['..LLL..', '.LGBGL.', 'LGBBGGD', 'LGGGRGD', '.GGRRD.', '..GGD..', '...D...'],
    colors: { L: PAL.fog, G: PAL.stone, D: PAL.asphalt, B: PAL.wood, R: PAL.crimson },
  },
  // A shout bubble with "!".
  card_taunt: {
    rows: ['.WWWWW.', 'WWWKWWW', 'WWWKWWW', 'WWWWWWW', 'WWWKWWW', '.WWWWW.', '.W.....'],
    colors: { W: PAL.white, K: PAL.red },
  },
  // A rune ring with a healing cross.
  card_rune_circle: {
    rows: ['..PPP..', '.P...P.', 'P..G..P', 'P.GGG.P', 'P..G..P', '.P...P.', '..PPP..'],
    colors: { P: PAL.violet, G: PAL.lime },
  },
  // A head hitting, with a burst.
  card_headbutt: {
    rows: ['Y.Y....', '.Y..SSS', 'Y.YSSSS', '...SKSS', '...SSSS', '....SSD', '....SD.'],
    colors: { Y: PAL.yellow, S: PAL.skin3, D: PAL.skin4, K: PAL.ink },
  },
  // A sledgehammer in mid-swing.
  card_sledge_swing: {
    rows: ['W....GG', 'W...GGG', '.W.GGG.', '..WBG..', '..B....', '.B.....', 'B......'],
    colors: { W: PAL.white, G: PAL.stone, B: PAL.wood },
  },
  // A fist slamming the ground.
  card_ground_pound: {
    rows: ['..SSS..', '..SSS..', '..SSS..', 'Y.....Y', '.Y...Y.', 'BBBBBBB', 'B.B.B.B'],
    colors: { S: PAL.skin3, Y: PAL.yellow, B: PAL.brown },
  },
  // Three quick jabs.
  card_jab_flurry: {
    rows: ['.......', 'OO.SSS.', '.......', 'OO.SSS.', '.......', 'OO.SSS.', '.......'],
    colors: { O: PAL.orange, S: PAL.skin3 },
  },
  // Three paws together.
  card_gang_up: {
    rows: ['.......', '..P.P..', '...P...', '.......', 'P.P.P.P', '.P...P.', '.......'],
    colors: { P: PAL.tan },
  },
  // An open jaw.
  card_street_bite: {
    rows: ['.RRRRR.', 'RWWWWWR', 'RW.W.WR', 'R.....R', 'RW.W.WR', 'RWWWWWR', '.RRRRR.'],
    colors: { R: PAL.red, W: PAL.white },
  },
  // A loop arrow.
  card_backflip: {
    rows: ['..CCC..', '.C...C.', 'C.....C', 'C.....C', '.C...C.', '..C.CCC', '.....C.'],
    colors: { C: PAL.cyan },
  },
  // A loot bag.
  card_heist: {
    rows: ['..BB...', '...B...', '.TTTT..', 'TTYTTT.', 'TYYYTT.', 'TTYTTT.', '.TTTT..'],
    colors: { B: PAL.brown, T: PAL.tan, Y: PAL.yellow },
  },
  // A hook snatching energy.
  card_pickpocket: {
    rows: ['..LL...', '.L..L..', '....L..', '...L.Y.', '..L.YY.', '..LYY..', '...Y...'],
    colors: { L: PAL.fog, Y: PAL.yellow },
  },
  // A ball of fire.
  card_fireball: {
    rows: ['....OO.', '..OOOYO', '.OOYYWO', 'RROYYYO', '.ROOYO.', 'R.ROO..', '.......'],
    colors: { O: PAL.orange, Y: PAL.yellow, W: PAL.white, R: PAL.red },
  },
  // A wave.
  card_weather_wave: {
    rows: ['.......', '...BB..', '..BLLB.', '.B...BL', 'BLB....', 'BBBBBBB', 'NNNNNNN'],
    colors: { B: PAL.blue, L: PAL.white, N: PAL.navy },
  },
  // An arrow jumping up off a ledge.
  card_leap: {
    rows: ['...T...', '..TTT..', '.T.T.T.', '...T...', '...T...', '..TTT..', '.TTTTT.'],
    colors: { T: PAL.teal },
  },
  // The front of a train.
  card_last_train: {
    rows: ['.SSSSS.', 'SWWSWWS', 'SWWSWWS', 'SSSSSSS', 'SYSSSYS', '.SSSSS.', 'S.....S'],
    colors: { S: PAL.fog, W: PAL.sky, Y: PAL.yellow },
  },
  // An electric bolt.
  card_power_surge: {
    rows: ['...CC..', '..CC...', '.CCCCC.', '...CC..', '..CC...', '.CC....', '.......'],
    colors: { C: PAL.cyan },
  },
  // A drop of poison with a sick face.
  card_toxic_spit: {
    rows: ['...G...', '..GGG..', '.GLGGG.', 'GKGGGKF', 'GGGGGGF', '.GKKKF.', '..FFF..'],
    colors: { G: PAL.green, L: PAL.lime, F: PAL.forest, K: PAL.ink },
  },
} satisfies Record<string, IconDef>;
