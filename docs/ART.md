# Adding your own pixel art

Right now every sprite is a placeholder drawn in code. You can replace any of them
with a PNG without touching code. Anything you don't replace keeps the placeholder,
so you can go one sprite at a time.

## Workflow

1. Run the game (`npm run dev`) and open **http://localhost:5199/?gallery**.
   The gallery shows every sprite. Use **Save PNG** to download the placeholder
   as a size reference.
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
| Fighter layers | 16 × 24 suggested | All layers of a fighter must be the same size. Feet on the bottom row. |
| Pets | about 12 × 8 | Feet on the bottom row. |
| Weapons | about 10 × 3 | Drawn lying flat, handle on the left. |
| Fight background | 240 × 210 exactly | The street (where fighters stand) starts at y = 175. In the arena every sprite is shown 3 times bigger. |

## Fighters are drawn in layers

The player picks a skin tone, hair style, hair colour and outfit colour, so a
fighter is assembled from layers that the game colours in:

| Layer | Colour it | How to draw it |
|---|---|---|
| `body` | skin tone | Head, hands, legs, shoes. **Greyscale.** |
| `outfit` (one per class) | outfit colour | Clothes. **Greyscale.** |
| `hair` (one per hair style) | hair colour | **Greyscale.** Use `null` for "bald". |
| `extra` (one per class, optional) | not coloured | Details in their real colours: the Brawler's headband, the Tamer's cap, sunglasses... |

**How greyscale colouring works:** the game multiplies each pixel by the chosen
colour. White becomes exactly that colour, light grey becomes a slightly darker
shade, and black stays black. So draw the lit parts white, the shadows grey, and
the lines black.

Once you add `fighter.body`, **every class** uses your layers, so draw an outfit
for each class too, or classes without one will have no clothes.

## Example `public/art/manifest.json`

```json
{
  "fighter": {
    "body": "fighter/body.png",
    "hair": ["fighter/hair-short.png", "fighter/hair-mohawk.png", "fighter/hair-long.png", null],
    "outfit": {
      "brawler": "fighter/outfit-brawler.png",
      "parkour": "fighter/outfit-parkour.png",
      "bouncer": "fighter/outfit-bouncer.png",
      "tamer": "fighter/outfit-tamer.png"
    },
    "extra": {
      "brawler": "fighter/extra-brawler.png",
      "tamer": "fighter/extra-tamer.png"
    }
  },
  "pets": {
    "dog": "pets/dog.png",
    "crow": "pets/crow.png",
    "raccoon": "pets/raccoon.png"
  },
  "weapons": {
    "bat": "weapons/bat.png",
    "chain": "weapons/chain.png",
    "skateboard": "weapons/skateboard.png",
    "umbrella": "weapons/umbrella.png",
    "traffic_sign": "weapons/traffic_sign.png",
    "extinguisher": "weapons/extinguisher.png"
  },
  "background": "backgrounds/street.png"
}
```

Interface icons (health, strength, skill, pet...) can be replaced the same way, with an
`"icons": { "health": "icons/health.png" }` entry. The icon names and the placeholder
designs are in `src/ui/icons.ts`; icons are about 7 × 7 pixels.

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
| Placeholder fight background (skyline, street) | `drawBackground` in `src/fight/ReplayScene.ts` |

Adding a new hair style or more colour choices also needs the option counts in
`APPEARANCE_OPTIONS` (`src/core/types.ts`) and, for hair, a name in
`HAIR_STYLE_NAMES` (`src/ui/palette.ts`).
