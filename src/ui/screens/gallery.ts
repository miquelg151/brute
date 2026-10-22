// Art preview page (open the game with ?gallery). Shows every sprite the game can draw,
// marks which ones come from custom art, and lets you save any of them as a PNG template.
import { APPEARANCE_OPTIONS, CLASSES, CLASS_IDS, PETS, WEAPONS, type Appearance, type ClassId } from '../../core';
import { artImage, artManifest } from '../art';
import { h, pixelArt } from '../dom';
import { HAIR_STYLE_NAMES } from '../palette';
import { drawFighter, drawPet, drawWeapon } from '../sprites';

const BASE_LOOK: Appearance = { skinTone: 2, hairStyle: 0, hairColor: 1, outfitColor: 0 };

function tile(label: string, canvas: HTMLCanvasElement, fileName: string, custom: boolean): HTMLElement {
  const url = canvas.toDataURL('image/png');
  return h(
    'figure',
    { class: 'gallery-tile' },
    h('div', { class: 'gallery-art' }, pixelArt(canvas, 4)),
    h('figcaption', {}, label, custom ? h('span', { class: 'tag' }, 'custom') : ''),
    h('a', { href: url, download: fileName, class: 'small' }, 'Save PNG'),
  );
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function renderGallery(root: HTMLElement): void {
  const m = artManifest();
  const customFighter = !!artImage(m.fighter?.body);
  const fighter = (look: Appearance, classId: ClassId, label: string, file: string) =>
    tile(label, drawFighter(look, classId), `${file}.png`, customFighter);

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
      h('h2', {}, 'Classes'),
      h('div', { class: 'gallery-grid' }, ...CLASS_IDS.map((id) => fighter(BASE_LOOK, id, CLASSES[id].name, `fighter-${id}`))),
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
      h('div', { class: 'gallery-grid' }, ...Object.values(PETS).map((p) => tile(p.name, drawPet(p.id), `${p.id}.png`, !!artImage(m.pets?.[p.id])))),
      h('h2', {}, 'Weapons'),
      h(
        'div',
        { class: 'gallery-grid' },
        ...Object.values(WEAPONS).map((w) => tile(w.name, drawWeapon(w.id), `${w.id}.png`, !!artImage(m.weapons?.[w.id]))),
      ),
      h('a', { href: './', class: 'btn' }, 'Back to the game'),
    ),
  );
}
