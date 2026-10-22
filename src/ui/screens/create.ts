import { CLASSES, CLASS_IDS, ORIGINS, ORIGIN_IDS, APPEARANCE_OPTIONS, SKILLS, newGame, type Appearance, type ClassId, type SaveData } from '../../core';
import { h, pixelArt } from '../dom';
import { CLASS_COLORS, HAIR_STYLE_NAMES } from '../palette';
import { drawFighter } from '../sprites';

const LOOK_ROWS: { key: keyof Appearance; label: string }[] = [
  { key: 'skinTone', label: 'Skin' },
  { key: 'hairStyle', label: 'Hair' },
  { key: 'hairColor', label: 'Hair color' },
  { key: 'outfitColor', label: 'Outfit' },
];

function randomLook(): Appearance {
  const r = (n: number) => Math.floor(Math.random() * n);
  return {
    skinTone: r(APPEARANCE_OPTIONS.skinTone),
    hairStyle: r(APPEARANCE_OPTIONS.hairStyle),
    hairColor: r(APPEARANCE_OPTIONS.hairColor),
    outfitColor: r(APPEARANCE_OPTIONS.outfitColor),
  };
}

function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}

export function renderCreate(root: HTMLElement, onCreated: (save: SaveData) => void): void {
  const look = randomLook();
  let classId: ClassId = 'brawler';
  let originId = ORIGIN_IDS[0]!;

  const preview = h('div', { class: 'spot spot-big' });
  const nameInput = h('input', { class: 'name-input', maxLength: 14, placeholder: 'Name your fighter', autocomplete: 'off' });
  const startBtn = h('button', { class: 'btn btn-primary btn-big', disabled: true }, 'Create fighter');
  const lookValues = new Map<keyof Appearance, HTMLElement>();

  const refreshPreview = () => {
    preview.replaceChildren(pixelArt(drawFighter(look, classId), 6));
    for (const row of LOOK_ROWS) {
      const v = look[row.key];
      lookValues.get(row.key)!.textContent = row.key === 'hairStyle' ? HAIR_STYLE_NAMES[v] ?? '' : `${v + 1}`;
    }
  };

  const lookRow = (key: keyof Appearance, label: string) => {
    const value = h('span', { class: 'look-value' });
    lookValues.set(key, value);
    const step = (d: number) => () => {
      const n = APPEARANCE_OPTIONS[key];
      look[key] = (look[key] + d + n) % n;
      refreshPreview();
    };
    return h(
      'div',
      { class: 'look-row' },
      h('span', { class: 'look-label' }, label),
      h('button', { class: 'btn btn-small', onclick: step(-1), 'aria-label': `Previous ${label}` }, '<'),
      value,
      h('button', { class: 'btn btn-small', onclick: step(1), 'aria-label': `Next ${label}` }, '>'),
    );
  };

  const choiceGrid = <T extends string>(
    ids: readonly T[],
    card: (id: T) => HTMLElement,
    onPick: (id: T) => void,
    selected: T,
    accent?: (id: T) => string,
  ) => {
    const grid = h('div', { class: 'choice-grid' });
    const buttons = ids.map((id) => {
      const btn = h('button', { class: 'choice', style: accent?.(id) ?? '' }, card(id));
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        onPick(id);
      });
      if (id === selected) btn.classList.add('selected');
      return btn;
    });
    grid.append(...buttons);
    return grid;
  };

  const classCard = (id: ClassId) => {
    const c = CLASSES[id];
    const s = c.baseStats;
    return h(
      'div',
      {},
      h('div', { class: 'choice-title', style: `color:${CLASS_COLORS[id]}` }, c.name),
      h('div', { class: 'choice-desc' }, c.description),
      h('div', { class: 'choice-stats' }, `HP ${s.health}, STR ${s.strength}, AGI ${s.agility}, SPD ${s.speed}`),
      h('div', { class: 'choice-stats' }, `Starts with ${SKILLS[c.startSkill]?.name ?? ''}`),
    );
  };

  const originCard = (id: string) => {
    const o = ORIGINS[id]!;
    return h('div', {}, h('div', { class: 'choice-title' }, o.name), h('div', { class: 'choice-desc' }, o.description));
  };

  nameInput.addEventListener('input', () => {
    startBtn.disabled = nameInput.value.trim().length === 0;
  });
  startBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) onCreated(newGame(name, look, classId, originId, randomSeed()));
  });

  root.append(
    h(
      'main',
      { class: 'screen create' },
      h('h1', {}, 'New fighter'),
      h('p', { class: 'lede' }, 'Pick a look, a fighting style and where you grew up.'),
      preview,
      nameInput,
      h('h2', {}, 'Look'),
      h(
        'section',
        { class: 'card' },
        ...LOOK_ROWS.map((r) => lookRow(r.key, r.label)),
        h('button', { class: 'btn btn-small', onclick: () => (Object.assign(look, randomLook()), refreshPreview()) }, 'Random look'),
      ),
      h('h2', {}, 'Class'),
      h('p', { class: 'lede small' }, 'Sets your starting stats and skill, and which upgrades you see most.'),
      choiceGrid(CLASS_IDS, classCard, (id) => ((classId = id), refreshPreview()), classId, (id) => `--accent:${CLASS_COLORS[id]}`),
      h('h2', {}, 'Origin'),
      h('p', { class: 'lede small' }, 'A small bonus in every fight.'),
      choiceGrid(ORIGIN_IDS, originCard, (id) => (originId = id), originId),
      startBtn,
    ),
  );
  refreshPreview();
}
