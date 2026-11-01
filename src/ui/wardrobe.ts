// The wardrobe: a sheet where the fighter in progress changes hat, hair, colours and the
// victory celebration. Locked cosmetics can be tried on to see them, but not kept: the note
// says how to get them.
import {
  APPEARANCE_OPTIONS,
  COSMETICS,
  canWear,
  cosmeticsOf,
  ownsCosmetic,
  setCelebration,
  setLook,
  type Appearance,
  type CosmeticDef,
  type CosmeticKind,
  type LookPart,
  type SaveData,
} from '../core';
import { h, pixelArt } from './dom';
import { icon } from './icons';
import { HAIR_COLORS, HAIR_STYLE_NAMES, OUTFIT_COLORS, SKIN_TONES } from './palette';
import { drawFighter } from './sprites';
import { openSheet } from './widgets';

/** The cosmetic behind a hair style or colour index, if that option is a cosmetic. */
const cosmeticAt = (kind: CosmeticKind, index: number): CosmeticDef | undefined => cosmeticsOf(kind).find((c) => c.index === index);

/** Opens the wardrobe. `onSaved` runs after the new look (or celebration) is kept. */
export function openWardrobe(save: SaveData, onSaved: () => void): void {
  const c = save.character;
  const state = save.cosmetics;
  const draft: Appearance = { ...c.appearance };
  let celebration = state.celebration;

  const preview = h('div', { class: 'spot wardrobe-spot' });
  const note = h('p', { class: 'wardrobe-note small', 'aria-live': 'polite' });
  const doneBtn = h('button', { class: 'btn btn-primary btn-big', type: 'button' }, 'Done');
  const refreshers: (() => void)[] = [];

  /** Draws the fighter again and says what is locked in the current choice. */
  const refresh = () => {
    preview.replaceChildren(pixelArt(drawFighter({ ...c, appearance: draft }), 'big'));
    const locked: CosmeticDef[] = [];
    if (draft.hat && !ownsCosmetic(state, draft.hat)) locked.push(COSMETICS[draft.hat]!);
    for (const [kind, part] of [['hairStyle', 'hairStyle'], ['hairColor', 'hairColor'], ['outfitColor', 'outfitColor']] as const) {
      const def = cosmeticAt(kind, draft[part]);
      if (def && !ownsCosmetic(state, def.id)) locked.push(def);
    }
    if (!ownsCosmetic(state, celebration)) locked.push(COSMETICS[celebration]!);
    note.textContent = locked.length ? `🔒 ${locked.map((d) => `${d.name}: ${d.how}`).join(' ')}` : '';
    doneBtn.disabled = locked.length > 0;
    doneBtn.textContent = locked.length ? 'Locked' : 'Done';
    for (const r of refreshers) r();
  };

  // ---- Hat and hair style: ◀ name ▶ ----
  const stepper = (label: string, count: number, get: () => number, set: (i: number) => void, name: (i: number) => string, locked: (i: number) => boolean) => {
    const value = h('span', { class: 'look-value' });
    refreshers.push(() => {
      const i = get();
      value.textContent = `${locked(i) ? '🔒 ' : ''}${name(i)}`;
    });
    const step = (d: number) => () => {
      set((get() + d + count) % count);
      refresh();
    };
    return h(
      'div',
      { class: 'look-row' },
      h('span', { class: 'look-label' }, label),
      h('button', { class: 'btn btn-small btn-icon', type: 'button', 'aria-label': `Previous ${label}`, onclick: step(-1) }, icon('left', 'Previous')),
      value,
      h('button', { class: 'btn btn-small btn-icon', type: 'button', 'aria-label': `Next ${label}`, onclick: step(1) }, icon('right', 'Next')),
    );
  };

  const hats = [undefined, ...cosmeticsOf('hat').map((d) => d.id)];
  const hatRow = stepper(
    'Hat',
    hats.length,
    () => hats.indexOf(draft.hat),
    (i) => {
      draft.hat = hats[i];
    },
    (i) => (hats[i] ? COSMETICS[hats[i]!]!.name : 'None'),
    (i) => !!hats[i] && !ownsCosmetic(state, hats[i]!),
  );
  const hairRow = stepper(
    'Hair',
    HAIR_STYLE_NAMES.length,
    () => draft.hairStyle,
    (i) => {
      draft.hairStyle = i;
    },
    (i) => HAIR_STYLE_NAMES[i] ?? '',
    (i) => {
      const def = cosmeticAt('hairStyle', i);
      return !!def && !ownsCosmetic(state, def.id);
    },
  );

  // ---- Colours: a row of swatches; locked ones carry a padlock ----
  const swatches = (label: string, part: LookPart, kind: CosmeticKind | null, colors: string[]) => {
    const buttons = colors.map((color, i) => {
      const def = kind ? cosmeticAt(kind, i) : undefined;
      const locked = !!def && !ownsCosmetic(state, def.id);
      const btn = h(
        'button',
        { class: `swatch${locked ? ' locked' : ''}`, type: 'button', style: `--swatch:${color}`, 'aria-label': `${label} ${def?.name ?? i + 1}${locked ? ', locked' : ''}` },
        locked ? '🔒' : '',
      );
      btn.addEventListener('click', () => {
        draft[part] = i;
        refresh();
      });
      return btn;
    });
    refreshers.push(() => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(draft[part] === i))));
    return h('div', { class: 'look-row look-swatches' }, h('span', { class: 'look-label' }, label), h('div', { class: 'swatch-list' }, ...buttons));
  };

  // ---- Celebration: one button each ----
  const celebrations = cosmeticsOf('celebration').map((def) => {
    const locked = !ownsCosmetic(state, def.id);
    const btn = h('button', { class: 'segment', type: 'button' }, `${locked ? '🔒 ' : ''}${def.name}`);
    btn.addEventListener('click', () => {
      celebration = def.id;
      refresh();
    });
    refreshers.push(() => btn.setAttribute('aria-pressed', String(celebration === def.id)));
    return btn;
  });

  const close = openSheet(
    'Look',
    h('h2', { class: 'section-icon' }, icon('look', '', 'normal'), 'Look'),
    preview,
    note,
    hatRow,
    hairRow,
    swatches('Hair colour', 'hairColor', 'hairColor', HAIR_COLORS),
    swatches('Outfit', 'outfitColor', 'outfitColor', OUTFIT_COLORS),
    swatches('Skin', 'skinTone', null, SKIN_TONES.slice(0, APPEARANCE_OPTIONS.skinTone)),
    h('div', { class: 'look-row look-celebrations' }, h('span', { class: 'look-label' }, 'Win'), h('div', { class: 'segments celebration-segments', role: 'group' }, ...celebrations)),
    h('div', { class: 'sheet-actions' }, doneBtn),
  );

  doneBtn.addEventListener('click', () => {
    if (!canWear(state, draft) || !ownsCosmetic(state, celebration)) return;
    setLook(state, c, draft);
    setCelebration(state, celebration);
    close();
    onSaved();
  });
  refresh();
}
