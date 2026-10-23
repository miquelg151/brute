// The Brute fist: the game's logo mark and app icon. Pure data (no browser code), so
// tools/make-icons.ts can also read it to build the app icons.
// Same format as the icons in icons.ts: '.' is transparent, any other character is a
// colour from `colors`. A dark outline is added around it automatically.
// After changing it, run `npm run icons` to rebuild the app icons in public/icons.
import { PAL } from './theme';

export const FIST = {
  rows: [
    '.LLdLLdLLdLL.',
    'LSSdSSdSSdSSS',
    'SSSdSSdSSdSSS',
    'DSSdSSdSSdSSD',
    'DLLLLLLLLSSSD',
    'dSSSSSSSSdSSD',
    '.ddddddddSSD.',
    '..SSSSSSSSD..',
    '..RRRRRRRRR..',
    '..rrrrrrrrr..',
  ],
  colors: {
    L: PAL.skin2, // light
    S: PAL.skin3, // skin
    D: PAL.skin4, // shadow
    d: PAL.brown, // creases between fingers
    R: PAL.red, // wristband
    r: PAL.crimson,
  } as Record<string, string>,
};
