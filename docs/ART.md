# Adding your own pixel art

The fighters, pets, weapons and the fight background are PNG files in `public/art/`,
listed in `public/art/manifest.json`. Open any of them in your drawing program, change it,
save it with the same name and reload the game: that's all. If a file is missing or not
listed, the game falls back to a simple placeholder drawn in code, so nothing breaks.
The interface icons are still drawn in code (`src/ui/icons.ts`), but can be replaced the
same way (see the end of this page).

## Workflow

1. Run the game (`npm run dev`) and open **http://localhost:5199/?gallery**.
   The gallery shows every sprite, including one brawler per origin and one per rank
   (Regular to Legend). Use **Save PNG** to download one as a size reference.
2. Draw your sprite. Good tools:
   - **Aseprite** (paid, the standard for pixel art)
   - **LibreSprite** (free, Aseprite's open-source fork)
   - **Piskel** (free, runs in the browser: piskelapp.com)
3. Export it as PNG into `public/art/` (sub-folders are fine).
4. List it in `public/art/manifest.json` (see the example below).
5. Reload the gallery. Your sprite now shows a green **custom** tag. If it doesn't,
   the browser console says which file could not be loaded.

## Use the game palette

All the colours of the game live in `src/ui/theme.ts` (`PAL`). The gallery page shows
them and has a **Save palette for Aseprite (.gpl)** button: load that file in Aseprite,
LibreSprite or Piskel and draw only with those colours, so your art matches the interface
and the rest of the art. Skin, hair and outfit colours are picked from the same palette.

## Rules for every sprite

- PNG with a transparent background.
- One pixel in the file is one pixel in the game. The game scales it up itself, so
  never export it scaled.
- No anti-aliasing or soft brushes: hard pixels only.
- Colours from the game palette (see above).
- Everything faces **right**. The game mirrors it for the opponent.
- Draw your own outline. The 1-pixel dark outline is only added to placeholders.

## Sizes

| What | Size (px) | Notes |
|---|---|---|
| Fighter layers | 18 × 26 per frame, 5 frames side by side = 90 × 26 | All layers of a fighter must be the same size. Feet on the bottom row. |
| Pets | about 13 × 9 (+ outline) | Feet on the bottom row. |
| Weapons | about 13 × 4 (+ outline) | Drawn lying flat, handle on the left. |
| Fight background | 240 × 210 exactly | The street (where fighters stand) starts at y = 175. In the arena every sprite is shown 3 times bigger. The Fight tab shows it too, behind your fighter. |

## Fighters are drawn in layers

The player picks a skin tone, hair style, hair colour and outfit colour, so a
fighter is assembled from layers that the game colours in:

| Layer | Colour it | How to draw it |
|---|---|---|
| `body` | skin tone | Head, chest, arms and hands. **Greyscale.** |
| `outfit` (one per class) | outfit colour | Top: shirt, hoodie, jacket, robe. **Greyscale.** |
| `hair` (one per hair style) | hair colour | **Greyscale.** Use `null` for "bald". |
| `extra` (one per class, optional) | not coloured | Real colours: trousers and shoes, plus the class details (headband, cap, sunglasses, hood, runes...). |
| `origin` (one per origin, optional) | not coloured | Where the fighter grew up: beanie and anchor tattoos (port), hood and scarf (rooftops), headphones (metro), goggles and apron (industrial), mutant ears and eyes (sewers), metal plates and LED eye (scrapyard). Drawn after `extra`. |
| `rank` (one per rank, optional) | not coloured | How seasoned the fighter is: wrist wraps, chain, medal, gold belt... Drawn last, and they stack (see below). |

They are drawn in that order, so `rank` covers everything else.

Ranks come from the fighter's level: **Regular** from level 5, **Veteran** from 10,
**Champion** from 15 and **Legend** from 20. A **Rookie** (levels 1-4) has no rank layer,
so there is no file for it. The rank layers stack: a fighter wears every rank layer from
Regular up to its own rank, in that order. A Legend shows the Regular wraps and patches,
the Veteran chain, knee pads and scar, the Champion bandages, medal and shoulder pads, and
the Legend belt and crown. So each rank file only needs what that rank adds; check in
`?gallery` that it still looks right on top of the earlier ones.

### Animation frames

Every layer file is a strip of 5 frames, each 18 × 26, side by side. The game cuts them
using `frameWidth` in the manifest and plays them with `animations`:

| Frame | Pose | Used when |
|---|---|---|
| 0 | standing | idle (and on every screen outside fights) |
| 1 | standing, breathing in | idle: frames 0 and 1 take turns |
| 2 | wind-up / guard | running in to attack, casting |
| 3 | punch | the moment of the hit, throwing |
| 4 | hurt | taking a hit, knocked out |

In Aseprite, set the grid to 18 × 26 (View → Grid Settings) to see the frames. Keep the
same pose in the same place in every layer, or the layers won't line up. You can add more
frames: make the strip wider and list them, e.g. `"idle": [0, 1, 5]`.

**How greyscale colouring works:** the game multiplies each pixel by the chosen
colour. White becomes exactly that colour, light grey becomes a slightly darker
shade, and black stays black. So draw the lit parts white, the shadows grey, and
the lines black.

Once you add `fighter.body`, **every class** uses your layers, so draw an outfit
for each class too, or classes without one will have no clothes.

## The manifest

`public/art/manifest.json` lists every file. Open it to see the current one; the part
for fighters looks like this:

```json
"fighter": {
  "body": "fighter/body.png",
  "hair": ["fighter/hair-short.png", "fighter/hair-mohawk.png", "fighter/hair-long.png", null],
  "outfit": { "brawler": "fighter/outfit-brawler.png", "...": "one per class" },
  "extra": { "brawler": "fighter/extra-brawler.png", "...": "one per class" },
  "origin": { "port": "fighter/origin-port.png", "...": "one per origin" },
  "rank": { "regular": "fighter/rank-regular.png", "veteran": "...", "champion": "...", "legend": "..." },
  "frameWidth": 18,
  "animations": { "idle": [0, 1], "attack": [2, 3], "hurt": [4] }
}
```

Interface icons (health, strength, skill, pet...) can be replaced the same way, with an
`"icons": { "health": "icons/health.png" }` entry. The icon names and the placeholder
designs are in `src/ui/icons.ts`; icons are about 7 × 7 pixels.
Card stickers have no icons of their own: each card reuses an interface icon, listed in
`CARD_ICONS` in `src/ui/cardView.ts`. So replacing, for example, `icons/pet.png` also
changes the Sic 'em and Stray Dog cards.

You only need the entries you have art for. Ids (like `traffic_sign`) are the ones
in `src/core/catalog.ts`.

## Logo and app icon

The fist next to the word BRUTE (and the app icon on the phone's home screen) is drawn
in `src/ui/fist.ts`, in the same format as the icons. After changing it, run
`npm run icons`: it rebuilds the PNGs in `public/icons/` (app icons for iPhone and
Android, and the browser tab icon). You can also draw those PNGs yourself and simply
not run the command: keep the same file names and sizes (192, 512 and 180 px squares,
plus a 64 px favicon; `maskable-512.png` needs the art inside the middle 60%, because
Android may cut it into a circle).

## Changing the look of the interface

| What | Where |
|---|---|
| Every colour (interface, icons, sprites, arena) | `PAL` in `src/ui/theme.ts`. Change one there and it changes everywhere. |
| Which palette colour each interface part uses (`--paper`, `--ink`, `--yellow`...) | `CSS_COLORS` in `src/ui/theme.ts` |
| How big pixels are on screen (small / normal / big) | `PIXEL` in `src/ui/theme.ts` |
| Font, text sizes, spacing, animation speeds | The variables at the top of `src/style.css` (`--t-m`, `--step`, `--fast`...) |
| Sticker lettering (letter colour, outline, pink shadow) | `--sticker-...` variables in `src/style.css` (search "Sticker lettering") |
| Paper outline around fighters | `--sticker-edge` in `src/style.css` |
| Which skin, hair, outfit and class colours exist | `src/ui/palette.ts` |
| Placeholder fight background (skyline, street) | `paintStreet` in `src/ui/street.ts` (the fight and the Fight tab both use it) |
| Buttons' darker bottom edge, the tab bar, the top bar | `.btn`, `.tab-bar`, `.top-bar` in `src/style.css` |

Adding a new hair style or more colour choices also needs the option counts in
`APPEARANCE_OPTIONS` (`src/core/types.ts`) and, for hair, a name in
`HAIR_STYLE_NAMES` (`src/ui/palette.ts`).
