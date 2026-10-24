import { CARDS, CLASSES, CLASS_IDS, ORIGINS, ORIGIN_IDS, APPEARANCE_OPTIONS, SKILLS, newGame, originCard as originCardId, type Appearance, type ClassId, type SaveData } from '../../core';
import { cardSticker } from '../cardView';
import { h, pixelArt } from '../dom';
import { icon, statRow } from '../icons';
import { logo } from '../logo';
import { CLASS_COLORS, HAIR_COLORS, ORIGIN_COLORS, HAIR_STYLE_NAMES, OUTFIT_COLORS, SKIN_TONES } from '../palette';
import { drawFighter } from '../sprites';
import { actionBar } from '../widgets';

const LOOK_ROWS: { key: keyof Appearance; label: string }[] = [
  { key: 'skinTone', label: 'Skin' },
  { key: 'hairStyle', label: 'Hair' },
  { key: 'hairColor', label: 'Hair color' },
  { key: 'outfitColor', label: 'Outfit' },
];

/** Look options that are colours, shown as a swatch instead of a number. */
const LOOK_COLORS: Partial<Record<keyof Appearance, string[]>> = {
  skinTone: SKIN_TONES,
  hairColor: HAIR_COLORS,
  outfitColor: OUTFIT_COLORS,
};

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
    preview.replaceChildren(pixelArt(drawFighter({ appearance: look, classId, originId, level: 1 }), 'big'));
    for (const row of LOOK_ROWS) {
      const v = look[row.key];
      const el = lookValues.get(row.key)!;
      const colors = LOOK_COLORS[row.key];
      // Colours show as a swatch; the hair style shows its name.
      if (colors) el.replaceChildren(h('span', { class: 'look-swatch', style: `background:${colors[v]}`, role: 'img', 'aria-label': `${row.label} ${v + 1}` }));
      else el.textContent = HAIR_STYLE_NAMES[v] ?? '';
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
      h('button', { class: 'btn btn-small btn-icon', onclick: step(-1), 'aria-label': `Previous ${label}` }, icon('left', 'Previous', 'normal')),
      value,
      h('button', { class: 'btn btn-small btn-icon', onclick: step(1), 'aria-label': `Next ${label}` }, icon('right', 'Next', 'normal')),
    );
  };

  const choiceGrid = <T extends string>(
    ids: readonly T[],
    card: (id: T) => HTMLElement,
    onPick: (id: T) => void,
    selected: T,
  ) => {
    const grid = h('div', { class: 'choice-grid' });
    const buttons = ids.map((id) => {
      const btn = h('button', { class: 'choice' }, card(id));
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

  /** Big class cards side by side: swipe to look through them, the one in the middle is picked. */
  const classCarousel = () => {
    const track = h('div', { class: 'carousel' });
    const dots = h('div', { class: 'carousel-dots', 'aria-hidden': 'true' });
    const cards = CLASS_IDS.map((id) =>
      h('button', { class: 'choice carousel-card', style: `--accent:${CLASS_COLORS[id]}`, 'aria-label': CLASSES[id].name }, classCard(id)),
    );
    const pick = (i: number) => {
      const id = CLASS_IDS[i]!;
      cards.forEach((c, j) => c.classList.toggle('selected', j === i));
      [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i));
      if (id !== classId) {
        classId = id;
        refreshPreview();
      }
    };
    const centre = (card: HTMLElement) => track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
    cards.forEach((card, i) => card.addEventListener('click', () => (pick(i), centre(card))));
    dots.append(...cards.map(() => h('span', {})));
    // When a swipe settles, pick the card closest to the middle.
    let settle = 0;
    track.addEventListener('scroll', () => {
      clearTimeout(settle);
      settle = window.setTimeout(() => {
        const mid = track.scrollLeft + track.clientWidth / 2;
        let best = 0;
        cards.forEach((c, i) => {
          if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(cards[best]!.offsetLeft + cards[best]!.offsetWidth / 2 - mid)) best = i;
        });
        pick(best);
      }, 90);
    });
    track.append(...cards);
    pick(CLASS_IDS.indexOf(classId));
    return h('div', {}, track, dots);
  };

  const classCard = (id: ClassId) => {
    const c = CLASSES[id];
    const s = c.baseStats;
    return h(
      'div',
      {},
      h('div', { class: 'choice-title', style: `color:${CLASS_COLORS[id]}` }, c.name),
      h('div', { class: 'choice-desc' }, c.description),
      h('div', { class: 'choice-stats' }, statRow(s.health, s.strength, s.agility, s.speed)),
      h('div', { class: 'choice-stats' }, `Starts with ${SKILLS[c.startSkill]?.name ?? ''}`),
    );
  };

  /** An origin: its name in its colour, its bonus, and the card it starts with (with the card's text, since phones show no tooltips). */
  const originCard = (id: string) => {
    const o = ORIGINS[id]!;
    const cardId = originCardId(id);
    return h(
      'div',
      { class: 'origin-choice' },
      h('div', { class: 'choice-title', style: `color:${ORIGIN_COLORS[id]}` }, o.name),
      h('div', { class: 'choice-desc' }, o.description),
      cardId ? cardSticker(cardId, 1, { size: 'small' }) : '',
      cardId ? h('div', { class: 'choice-desc' }, CARDS[cardId]!.describe(1)) : '',
    );
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
      logo(),
      h('h1', {}, 'New fighter'),
      h('p', { class: 'lede' }, 'Pick a look, a fighting style and where you grew up.'),
      preview,
      nameInput,
      h('h2', {}, 'Look'),
      h(
        'section',
        { class: 'card' },
        ...LOOK_ROWS.map((r) => lookRow(r.key, r.label)),
        h(
          'button',
          { class: 'btn btn-small btn-with-icon', onclick: () => (Object.assign(look, randomLook()), refreshPreview()) },
          icon('dice', 'Random', 'normal'),
          'Random look',
        ),
      ),
      h('h2', {}, 'Class'),
      h('p', { class: 'lede small' }, 'Sets your starting stats and skill, and which upgrades you see most.'),
      classCarousel(),
      h('h2', {}, 'Origin'),
      h('p', { class: 'lede small' }, 'A bonus in every fight, a look and a card of its own.'),
      choiceGrid(ORIGIN_IDS, originCard, (id) => {
        originId = id;
        refreshPreview();
      }, originId),
      actionBar(startBtn),
    ),
  );
  refreshPreview();
}
