# Visual overhaul plan

Goal: make the font, logo, icons, pixel art and animations feel like **one game**, built
first for phones (iOS and Android): easy to tap, easy to drag, smooth on cheap devices.
Gameplay changes come later; this plan only touches how things look and feel.

The current idea stays: **posters and stickers taped to a neighbourhood wall at night**,
one hand-drawn font (Shantell Sans). We extend it instead of replacing it.

## What is wrong today (seen at 390 px wide)

1. **Three visual languages fight each other.** Smooth hand lettering and wobbly paper
   borders sit next to hard pixel sprites, with nothing linking them.
2. **Pixels have no fixed size.** The same pixel is drawn at 2×, 3×, 4× or 6× depending on
   the screen (`icon(..., 2)`, `pixelArt(..., 6)` in `home.ts`, `prefight.ts`, `create.ts`,
   `widgets.ts`), and the arena uses yet another scale. Icons look tiny and blurry-sized
   next to the big fighter.
3. **Every icon has its own colours** (`src/ui/icons.ts`), not a shared palette, so they
   don't look like one set.
4. **No identity.** No logo, no app icon, no splash; `theme-color` (#16131f) doesn't match
   the wall colour (#2a2830).
5. **Long, wordy screens.** Pre-fight is ~2000 px of scrolling; creation is ~1800 px.
6. **The fight screen wastes the phone.** The arena is ~230 px tall and the bottom half of
   the screen is empty; the special-strike overlay covers the fighters.
7. **Touch details.** Text arrows `<` `>` for the look editor, no swipe or drag anywhere,
   main buttons at the bottom of long pages (far from the thumb), rotated cards spill off
   the right edge (stats card on home) — turned out to be a screenshot artefact, not a bug.
8. **Almost no motion.** Only a press-scale on buttons; screens just swap.

## Direction: "pixel stickers on hand-drawn posters"

The rule that ties everything together:

- **Hand-drawn layer** = paper, borders, font, tape, spray marks (the wall).
- **Pixel layer** = everything that is a *thing* in the game world: fighters, pets,
  weapons, gear, icons. Every pixel object is shown as a **die-cut sticker**: a paper-
  coloured outline 2 px around the art plus a small soft shadow, slightly rotated.
  That outline is what makes pixels look "stuck onto" the hand-drawn world instead of
  floating in it.
- **Three pixel sizes only** (`PIXEL` in `src/ui/theme.ts`): one art pixel is 3 CSS px
  for icons in text, 4 px for everything else, 6 px for your own big fighter.
- **One palette** (`PAL` in `src/ui/theme.ts`, ~50 colours including the 6 skin tones)
  shared by CSS, icons, sprites and the Phaser arena. The spray colours come from it.
- **Everything editable by hand:** every sprite and icon can be replaced by a PNG
  (`docs/ART.md`), every colour and size lives in one commented place, and the
  `?gallery` page shows all art and the palette.

## Phases

Each phase is shippable on its own and is checked with screenshots at 320, 390 and
412 px and in landscape before moving on.

### Phase 0 — Foundations (tokens) · small · DONE

- `src/ui/theme.ts`: master palette `PAL`; `applyTheme()` puts it into the CSS
  variables; sprites, icons and the Phaser arena use `PAL` too. Gallery shows it and
  saves it as a `.gpl` palette for drawing tools.
- Six text sizes (`--t-xs` … `--t-xxl`) in `style.css`.
- `pixelArt(canvas, 'small' | 'normal' | 'big')` instead of raw numbers.
- Motion tokens: `--fast 120ms`, `--med 220ms`, `--slow 400ms`, one "bouncy" easing.
- Fix: `100vh` → `100dvh`, `theme-color` = wall colour,
  `touch-action: manipulation` (no double-tap zoom), `overscroll-behavior: none`,
  no text selection on buttons.

### Phase 1 — Identity: logo and app icon · small/medium

- **Logo:** "BRUTE" as a hand-lettered spray tag (SVG, same family as Shantell, drips in
  pink) with a **pixel fist** sticker as the mark. The fist alone is the app icon.
- App icons 192/512 + maskable, favicon, Apple touch icon, PWA `manifest.webmanifest`
  (portrait, standalone, wall background) so it can be "installed" on iOS and Android.
- A short title screen (logo + fighter + "tap to start") shown on first open only.

### Phase 2 — One icon family · medium

- Redraw all icons in `icons.ts` on the same **9×9 grid**, only palette colours, same
  1 px dark outline as sprites, same light direction (top-left).
- Show them at one size (`--px-inline` in text, `--px` for headings and stats).
- Replace remaining words with icons where clear: `<` `>` become pixel arrows, x1/Skip
  become speed/skip icons, "Random look" becomes a dice.
- Add the gallery page section "Icons" so the whole set can be seen side by side.

### Phase 3 — Touch and layout · medium/large

- **Thumb zone:** the main action of each screen (Create / Fight / Start fight /
  Continue) lives in a sticky bottom bar with safe-area padding; always reachable.
- Touch targets ≥ 48 px, ≥ 8 px apart.
- **Swipe** instead of long lists:
  - class picker = horizontal snap carousel of big class cards (fighter sprite in front);
  - look editor = swipe left/right on the fighter preview to change the selected
    part; tap a part chip (skin, hair, colour, outfit) to choose what you change.
- **Drag** where it feels physical: drag a weapon / armor / accessory sticker into the
  fight slots (with tap-to-equip as the fallback, always). Pointer Events, works the
  same for mouse and finger; a small vibration on drop on Android (`navigator.vibrate`;
  iOS has none, so the visual "slap" is the feedback).
- **Pre-fight compacted:** opponent poster on top, scouting as a row of trait stickers
  (tap one to read it), strategy as icon segmented controls (stance / target / weapons)
  with the ✓ marks; long texts move into a bottom sheet that opens on tap.

### Phase 4 — Fight screen · medium

- Arena uses the phone: portrait background **320 × 280** (taller sky and street) so
  it fills the width and ~45% of the height; landscape keeps the current fit.
- HUD (names, health, stamina, mana bars) in DOM above the arena, with the same font and
  palette, drawn as hand-drawn bars with pixel fill — readable, unlike tiny canvas text.
- Special strike: the timing bar moves **below** the arena and the **whole lower half
  of the screen** is the tap zone; fighters stay visible.
- Juice inside Phaser: hit-stop (60 ms), small screen shake on big hits, damage numbers
  in the font with palette colours, dust puffs, KO slow-motion.
- Break panel as a bottom sheet over the arena instead of a long page below it.

### Phase 5 — Motion · medium

- Screen transitions: the new screen is a poster sliding in and settling with a tiny
  rotation (220 ms); going back slides the other way.
- Stickers "slap" on when they appear (scale 1.15 → 1 with a small bounce).
- Level-up: three cards dealt from the bottom, chosen card stamps, others fall away.
- Rewards: XP bar fills with a pop, level badge bounce.
- Only `transform` and `opacity` (smooth on cheap Android); everything respects
  `prefers-reduced-motion`.

### Phase 6 — Real pixel art · large (art work)

- Final art with the pipeline in `docs/ART.md`, using the master palette (export it as
  an Aseprite/Lospec `.gpl` file so drawing tools use exactly the same colours).
- Animation frames: idle (2), walk (4), attack (3), hit (1), KO (1) per class; needs
  frame support in `art.ts` and `ReplayScene.ts` (sprite sheets in the manifest).
- New fight background(s) at the new portrait size, same palette, night street.

### Phase 7 — Check on real phones · small

- Test list: iPhone SE (320/375), a normal iPhone (390), Android 360 and 412, landscape,
  installed as PWA, slow-CPU mode in Chrome devtools.
- Playwright screenshots of every screen at those widths, compared before/after.
- Contrast check (text on paper and on wall) and tap target check.

## Suggested order

0 → 1 → 2 → 4 → 3 → 5 → 6 → 7. Foundations and icons first because every later step
uses them; the fight screen before the big layout work because it is where players
spend the most time; real art last, once sizes and palette are locked.
