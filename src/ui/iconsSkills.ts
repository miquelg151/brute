// One icon per skill, spell and boss trick, named `skill_<id>` (the id is the key in
// SKILLS in src/core/catalog.ts). Same 7 × 7 format as icons.ts: '.' is transparent,
// any other character is a colour from `colors`. A PNG listed under "icons" in
// public/art/manifest.json with the same name replaces any of them.
import type { IconDef } from './icons';
import { PAL } from './theme';

export const SKILL_ICONS = {
  // Two linked rings: one hit chains into the next.
  skill_combo: {
    rows: ['.......', '.LLL...', 'L...L..', 'L..DDD.', '.LLD..D', '...D..D', '....DD.'],
    colors: { L: PAL.amber, D: PAL.orange },
  },
  // An arrow that turns back on the attacker.
  skill_counter: {
    rows: ['TTTTT..', '.....T.', '......T', '..L...T', '.LL..T.', 'LLLTT..', '.LL....'],
    colors: { T: PAL.teal, L: PAL.cyan, D: PAL.forest },
  },
  // A round wooden shield with a metal boss.
  skill_shield: {
    rows: ['..WWW..', '.WTTTW.', 'WTTLTTB', 'WTLLLTB', 'WTTLTTB', '.BTTTB.', '..BBB..'],
    colors: { W: PAL.tan, T: PAL.wood, L: PAL.fog, B: PAL.brown },
  },
  // A crown over a paw.
  skill_pack_leader: {
    rows: ['.Y.Y.Y.', '.YYYYY.', '.......', '.P.P.P.', '..PPP..', '.PPPPP.', '..PPP..'],
    colors: { Y: PAL.yellow, P: PAL.tan },
  },
  // A grey metal fist.
  skill_iron_fists: {
    rows: ['.......', '.LLLLL.', 'LGDGDGD', 'LGDGDGD', 'LGGGGGD', '.GGGGD.', '..DDD..'],
    colors: { L: PAL.white, G: PAL.fog, D: PAL.smoke },
  },
  // An angry red face.
  skill_fury: {
    rows: ['.RRRRR.', 'RKRRRKR', 'RRKRKRR', 'RRRRRRR', 'RRKKKRR', 'RKRRRKR', '.RRRRR.'],
    colors: { R: PAL.red, K: PAL.ink },
  },
  // Gusts of wind.
  skill_second_wind: {
    rows: ['....GG.', '.....G.', 'GGGGGG.', '.......', 'DDDDDDD', '......D', '....DD.'],
    colors: { G: PAL.lime, D: PAL.green },
  },
  // Two slashes side by side.
  skill_double_strike: {
    rows: ['....L.L', '...O.O.', '..O.O..', '.O.O...', 'O.O....', '.......', '.......'],
    colors: { O: PAL.orange, L: PAL.yellow },
  },
  // A stopwatch.
  skill_quick_start: {
    rows: ['..KKK..', '...K...', '.WWWWW.', 'WWWKWWS', 'WWWKKWS', 'WWWWWWS', '.SSSSS.'],
    colors: { W: PAL.white, K: PAL.ink, S: PAL.mist },
  },
  // A weapon with a red cross: knocked away.
  skill_disarm: {
    rows: ['R.R..TB', '.R..TBD', 'R.RTBD.', '..TBD..', '.HBD...', 'HH.....', 'H......'],
    colors: { R: PAL.red, T: PAL.tan, B: PAL.wood, D: PAL.brown, H: PAL.brownDark },
  },
  // A big hammer.
  skill_heavy_hands: {
    rows: ['LGGGGD.', 'LGGGGD.', '..BB...', '..BB...', '..BB...', '..BB...', '..HH...'],
    colors: { L: PAL.fog, G: PAL.stone, D: PAL.asphalt, B: PAL.wood, H: PAL.brown },
  },
  // A riveted metal plate.
  skill_iron_skin: {
    rows: ['LLLLLLL', 'LKGGGKD', 'LGGGGGD', 'LGGGGGD', 'LGGGGGD', 'LKGGGKD', 'DDDDDDD'],
    colors: { L: PAL.fog, G: PAL.stone, D: PAL.asphalt, K: PAL.ink },
  },
  // A whistle.
  skill_whistle: {
    rows: ['.......', '....L..', '.YYYYYY', 'YYKYYY.', 'YYYYY..', '.YYY...', '.......'],
    colors: { Y: PAL.yellow, K: PAL.ink, L: PAL.white },
  },
  // A weapon flying, with speed lines.
  skill_thrower: {
    rows: ['.......', 'PP.....', '....TB.', 'PPTTBBD', '....DD.', 'PP.....', '.......'],
    colors: { T: PAL.tan, B: PAL.wood, D: PAL.brown, P: PAL.pink },
  },
  // An open eye.
  skill_sixth_sense: {
    rows: ['.......', '..PPP..', '.PWWWP.', 'PWWKWWP', '.PWWWP.', '..PPP..', '.......'],
    colors: { P: PAL.purple, W: PAL.white, K: PAL.ink },
  },
  // A quick fist with speed lines.
  skill_jab: {
    rows: ['.......', '....LL.', 'OO.LSSD', '...SSSD', 'OO.SSSD', '....DD.', '.......'],
    colors: { L: PAL.skin2, S: PAL.skin3, D: PAL.skin4, O: PAL.orange },
  },
  // A skull.
  skill_thick_skull: {
    rows: ['.WWWWW.', 'WWWWWWS', 'WKKWKKS', 'WKKWKKS', 'WWWKWWS', '.WSWSW.', '.S.S.S.'],
    colors: { W: PAL.white, S: PAL.mist, K: PAL.ink },
  },
  // A brick wall.
  skill_wall_run: {
    rows: ['RRMRRRM', 'MMMMMMM', 'RMRRRMR', 'MMMMMMM', 'RRMRRRM', 'MMMMMMM', 'RMRRRMR'],
    colors: { R: PAL.crimson, M: PAL.maroon },
  },
  // A tall blue shield with a cross.
  skill_bulwark: {
    rows: ['LLLLLLL', 'LSSWSSD', 'LSSWSSD', 'LWWWWWD', 'LSSWSSD', '.SSWSD.', '..DDD..'],
    colors: { L: PAL.sky, S: PAL.blue, D: PAL.navy, W: PAL.white },
  },
  // Two hearts.
  skill_bond: {
    rows: ['RR.RR..', 'RRRRR..', '.RRR...', '..PP.PP', '..PPPPP', '...PPP.', '....P..'],
    colors: { R: PAL.red, P: PAL.pink },
  },
  // Claw marks.
  skill_feral: {
    rows: ['L.L.L..', 'R.R.R..', '.R.R.R.', '.R.R.R.', '..R.R.R', '..D.D.D', '.......'],
    colors: { L: PAL.coral, R: PAL.red, D: PAL.crimson },
  },
  // A magic swirl.
  skill_arcane_flow: {
    rows: ['.PPPPP.', 'P.....P', 'P.LLL.P', 'P.L.L.P', 'P.L...P', 'P.LLLP.', 'P......'],
    colors: { P: PAL.violet, L: PAL.purple },
  },
  // Two music notes.
  skill_rhythm: {
    rows: ['..YYYYY', '..Y...Y', '..Y...Y', '..Y...Y', 'YYY.YYY', 'YYY.YYY', '.......'],
    colors: { Y: PAL.yellow },
  },
  // A cracked bone.
  skill_bone_breaker: {
    rows: ['WW.....', 'WWW....', '.WWW...', '..WR...', '...RWW.', '....WWW', '.....WW'],
    colors: { W: PAL.white, R: PAL.red },
  },
  // A rolling ball with speed lines.
  skill_momentum: {
    rows: ['.......', '...OOO.', 'P.OYLYO', '..OYYYO', 'P.OYYYO', '...OOO.', '.......'],
    colors: { O: PAL.orange, Y: PAL.yellow, L: PAL.white, P: PAL.pink },
  },
  // A stamina drop caught in a hand.
  skill_quick_hands: {
    rows: ['...G...', '..GGG..', '.GLGGG.', '.GGGGG.', '..GGG..', 'S.....S', '.SSSSS.'],
    colors: { G: PAL.lime, L: PAL.white, S: PAL.skin3 },
  },
  // A thorny burst.
  skill_thorns: {
    rows: ['...G...', '.G.G.G.', '..GGG..', 'GGGFGGG', '..GGG..', '.G.G.G.', '...G...'],
    colors: { G: PAL.green, F: PAL.forest },
  },
  // A wrecking ball on a chain.
  skill_demolition: {
    rows: ['....K..', '....K..', '....K..', '...GGG.', '..GLGGD', '..GGGGD', '...DDD.'],
    colors: { K: PAL.fog, G: PAL.stone, L: PAL.mist, D: PAL.asphalt },
  },
  // A paw with sound waves: calling the pack.
  skill_pack_call: {
    rows: ['.P.P...', 'P...P.W', '..PPP.W', '.PPPPP.', '.PPPP.W', '..PP..W', '.......'],
    colors: { P: PAL.tan, W: PAL.white },
  },
  // A paw on a shield.
  skill_guardian: {
    rows: ['..LLL..', '.LSSSL.', 'LSPSPSD', 'LSSPSSD', '.SPPPD.', '..SSD..', '...D...'],
    colors: { L: PAL.white, S: PAL.mist, D: PAL.smoke, P: PAL.wood },
  },
  // An orange flame.
  skill_flame: {
    rows: ['...O...', '..OO...', '..OOO.O', '.OOYOOO', 'OOYYYOO', 'OYYWYYO', '.OYYYO.'],
    colors: { O: PAL.orange, Y: PAL.yellow, W: PAL.white },
  },
  // A cup running over.
  skill_overflow: {
    rows: ['.B.B.B.', 'BBBBBBB', 'WBBBBBS', 'WBBBBBS', '.WBBBS.', '..WWS..', '.WWWSS.'],
    colors: { B: PAL.sky, W: PAL.white, S: PAL.mist },
  },

  // Boss tricks.
  // A cog: spare parts.
  skill_boss_spare_parts: {
    rows: ['.G.G.G.', 'GGGGGGG', '.GG.GG.', 'GG...GG', '.GG.GG.', 'GGGGGGG', '.G.G.G.'],
    colors: { G: PAL.fog },
  },
  // A cat face.
  skill_boss_nine_lives: {
    rows: ['K.....K', 'KK...KK', 'KKKKKKK', 'KYKKKYK', 'KKKKKKK', '.KKPKK.', '..KKK..'],
    colors: { K: PAL.smoke, Y: PAL.lime, P: PAL.pink },
  },
  // A rat.
  skill_boss_rat_tide: {
    rows: ['.P.....', 'PSSS...', 'SKSSSS.', 'SSSSSSS', '.SSSSSP', '.S..S.P', '.....P.'],
    colors: { S: PAL.fog, K: PAL.ink, P: PAL.pink },
  },
  // A magnifying glass: he reads your plan.
  skill_boss_read_the_fight: {
    rows: ['.LLL...', 'L...L..', 'L.K.L..', 'L...L..', '.LLLB..', '....BB.', '.....BB'],
    colors: { L: PAL.sky, K: PAL.white, B: PAL.wood },
  },

  // Spells.
  // A magic bolt.
  skill_spark: {
    rows: ['....PL.', '...PP..', '..PPPL.', '....PP.', '...PP..', '..PP...', '.P.....'],
    colors: { P: PAL.purple, L: PAL.lilac },
  },
  // A rune circle.
  skill_ward: {
    rows: ['..LLL..', '.L...L.', 'L.P.P.L', 'L..P..L', 'L.P.P.L', '.L...L.', '..LLL..'],
    colors: { L: PAL.sky, P: PAL.violet },
  },
  // A drop of blood pulled away.
  skill_drain: {
    rows: ['...R...', '..RRR..', '.RRLRR.', '.RRRRR.', '..RRR..', 'P.....P', '.PPPPP.'],
    colors: { R: PAL.red, L: PAL.blush, P: PAL.purple },
  },
  // A ghost.
  skill_spirit: {
    rows: ['..III..', '.IIIII.', 'IKIIKII', 'IIIIIII', 'IIIIIII', 'IIIIIII', 'I.I.I.I'],
    colors: { I: PAL.ice, K: PAL.navy },
  },
  // A blinding flash.
  skill_flash: {
    rows: ['...Y...', '.Y.Y.Y.', '..WWW..', 'YYWWWYY', '..WWW..', '.Y.Y.Y.', '...Y...'],
    colors: { Y: PAL.yellow, W: PAL.white },
  },
  // A green healing cross.
  skill_mend: {
    rows: ['..GGG..', '..GLG..', 'GGGLGGG', 'GLLLLLG', 'GGGLGGG', '..GLG..', '..GGG..'],
    colors: { G: PAL.green, L: PAL.lime },
  },
} satisfies Record<string, IconDef>;
