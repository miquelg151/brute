// Art preview page (open the game with ?gallery). Shows every sprite the game can draw,
// marks which ones come from custom art, and lets you save any of them as a PNG template.
// It also shows the game palette, which can be saved for Aseprite, LibreSprite or Piskel.
import { APPEARANCE_OPTIONS, CLASSES, CLASS_IDS, ORIGINS, ORIGIN_IDS, PETS, RANKS, WEAPONS, type Appearance, type ClassId } from '../../core';
import { artImage, artManifest } from '../art';
import { h, pixelArt } from '../dom';
import { ICON_NAMES, drawIcon } from '../icons';
import { HAIR_STYLE_NAMES } from '../palette';
import { drawFighter, drawPet, drawWeapon } from '../sprites';
import { PAL, paletteGpl } from '../theme';

const BASE_LOOK: Appearance = { skinTone: 2, hairStyle: 0, hairColor: 1, outfitColor: 0 };

function tile(label: string, canvas: HTMLCanvasElement, fileName: string, custom: boolean): HTMLElement {
  const url = canvas.toDataURL('image/png');
  return h(
    'figure',
    { class: 'gallery-tile' },
    h('div', { class: 'gallery-art' }, pixelArt(canvas, 'normal')),
    h('figcaption', {}, label, custom ? h('span', { class: 'tag' }, 'custom') : ''),
    h('a', { href: url, download: fileName, class: 'small' }, 'Save PNG'),
  );
}

function swatch(name: string, hex: string): HTMLElement {
  return h(
    'figure',
    { class: 'swatch' },
    h('span', { class: 'swatch-color', style: `background:${hex}` }),
    h('figcaption', {}, name, h('span', { class: 'dim' }, hex)),
  );
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function renderGallery(root: HTMLElement): void {
  const m = artManifest();
  const customFighter = !!artImage(m.fighter?.body);
  const fighter = (look: Appearance, classId: ClassId, label: string, file: string, originId?: string, level?: number) =>
    tile(label, drawFighter({ appearance: look, classId, originId, level }), `${file}.png`, customFighter);

  root.append(
    h(
      'main',
      { class: 'screen gallery' },
      h('h1', {}, 'Art gallery'),
      h(
        'p',
        { class: 'lede' },
        'Every sprite in the game. Put your PNGs in public/art, list them in public/art/manifest.json and reload this page. The file docs/ART.md explains the sizes and layers.',
      ),
      h('h2', {}, 'Palette'),
      h('p', { class: 'lede' }, 'Draw with these colours so your art matches the game. Change them in src/ui/theme.ts.'),
      h('div', { class: 'swatches' }, ...Object.entries(PAL).map(([name, hex]) => swatch(name, hex))),
      h(
        'a',
        { href: URL.createObjectURL(new Blob([paletteGpl()], { type: 'text/plain' })), download: 'brute-palette.gpl', class: 'btn btn-small' },
        'Save palette for Aseprite (.gpl)',
      ),
      h('h2', {}, 'Classes'),
      h('div', { class: 'gallery-grid' }, ...CLASS_IDS.map((id) => fighter(BASE_LOOK, id, CLASSES[id].name, `fighter-${id}`))),
      h('h2', {}, 'Origins'),
      h(
        'div',
        { class: 'gallery-grid' },
        ...ORIGIN_IDS.map((id) => fighter(BASE_LOOK, 'brawler', ORIGINS[id]!.name, `origin-${id}`, id)),
      ),
      h('h2', {}, 'Ranks'),
      h(
        'div',
        { class: 'gallery-grid' },
        // Rookie has no layer, so the ranks start at Regular.
        ...RANKS.slice(1).map((rank) => fighter(BASE_LOOK, 'brawler', `${rank.name} (level ${rank.from})`, `rank-${rank.id}`, undefined, rank.from)),
      ),
      h('h2', {}, 'Skin tones'),
      h('div', { class: 'gallery-grid' }, ...range(APPEARANCE_OPTIONS.skinTone).map((i) => fighter({ ...BASE_LOOK, skinTone: i }, 'brawler', `Skin ${i + 1}`, `skin-${i}`))),
      h('h2', {}, 'Hair styles'),
      h(
        'div',
        { class: 'gallery-grid' },
        ...range(APPEARANCE_OPTIONS.hairStyle).map((i) => fighter({ ...BASE_LOOK, hairStyle: i }, 'bouncer', HAIR_STYLE_NAMES[i] ?? `Hair ${i}`, `hair-${i}`)),
      ),
      h('h2', {}, 'Outfit colours'),
      h(
        'div',
        { class: 'gallery-grid' },
        ...range(APPEARANCE_OPTIONS.outfitColor).map((i) => fighter({ ...BASE_LOOK, outfitColor: i }, 'parkour', `Outfit ${i + 1}`, `outfit-${i}`)),
      ),
      h('h2', {}, 'Pets'),
      h(
        'div',
        { class: 'gallery-grid' },
        ...[...Object.values(PETS), { id: 'spirit', name: 'Spirit (summon)' }].map((p) => tile(p.name, drawPet(p.id), `${p.id}.png`, !!artImage(m.pets?.[p.id]))),
      ),
      h('h2', {}, 'Weapons'),
      h(
        'div',
        { class: 'gallery-grid' },
        ...Object.values(WEAPONS).map((w) => tile(w.name, drawWeapon(w.id), `${w.id}.png`, !!artImage(m.weapons?.[w.id]))),
      ),
      h('h2', {}, 'Icons'),
      h('div', { class: 'gallery-grid' }, ...ICON_NAMES.map((name) => tile(name, drawIcon(name), `${name}.png`, !!artImage(m.icons?.[name])))),
      h('a', { href: './', class: 'btn' }, 'Back to the game'),
    ),
  );
}
