// Creating a fighter, in four steps: Look, Class, Origin, Name.
// Your fighter stands on the street at the top the whole time and changes as you pick.
import { CARDS, CLASSES, CLASS_IDS, ORIGINS, ORIGIN_IDS, APPEARANCE_OPTIONS, SKILLS, newGame, originCard as originCardId, type Appearance, type ClassId, type SaveData } from '../../core';
import { CARD_ICONS, cardSticker } from '../cardView';
import { h, pixelArt } from '../dom';
import { icon, statRow } from '../icons';
import { reducedMotion } from '../motion';
import { CLASS_COLORS, HAIR_COLORS, ORIGIN_COLORS, HAIR_STYLE_NAMES, OUTFIT_COLORS, SKIN_TONES } from '../palette';
import { drawFighter } from '../sprites';
import { HOME_STREET_SEED, streetCanvas } from '../street';

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

/** The four steps, in order. The name is the big title shown over the street. */
const STEP_TITLES = ['Look', 'Class', 'Origin', 'Name'];

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
  /** Which step is open: 0 = Look, 1 = Class, 2 = Origin, 3 = Name. */
  let step = 0;

  const preview = h('div', { class: 'spot' });
  const nameInput = h('input', { class: 'name-input', maxLength: 14, placeholder: 'Name your fighter', autocomplete: 'off', enterKeyHint: 'done' });
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
    const change = (d: number) => () => {
      const n = APPEARANCE_OPTIONS[key];
      look[key] = (look[key] + d + n) % n;
      refreshPreview();
    };
    return h(
      'div',
      { class: 'look-row' },
      h('span', { class: 'look-label' }, label),
      h('button', { class: 'btn btn-small btn-icon', onclick: change(-1), 'aria-label': `Previous ${label}` }, icon('left', 'Previous')),
      value,
      h('button', { class: 'btn btn-small btn-icon', onclick: change(1), 'aria-label': `Next ${label}` }, icon('right', 'Next')),
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

  // Big class cards side by side: swipe to look through them, the one in the middle is picked.
  const track = h('div', { class: 'carousel' });
  const classDots = h('div', { class: 'carousel-dots', 'aria-hidden': 'true' });
  const classCards = CLASS_IDS.map((id) =>
    h('button', { class: 'choice carousel-card', style: `--accent:${CLASS_COLORS[id]}`, 'aria-label': CLASSES[id].name }, classCard(id)),
  );
  const pickClass = (i: number) => {
    const id = CLASS_IDS[i]!;
    classCards.forEach((c, j) => c.classList.toggle('selected', j === i));
    [...classDots.children].forEach((d, j) => d.classList.toggle('on', j === i));
    if (id !== classId) {
      classId = id;
      refreshPreview();
    }
  };
  /** Scrolls the carousel so this card sits in the middle. */
  const centre = (card: HTMLElement, behavior: ScrollBehavior) =>
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior });
  classCards.forEach((card, i) => card.addEventListener('click', () => (pickClass(i), centre(card, 'smooth'))));
  classDots.append(...classCards.map(() => h('span', {})));
  // When a swipe settles, pick the card closest to the middle.
  let settle = 0;
  track.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = window.setTimeout(() => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      const distance = (c: HTMLElement) => Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      let best = 0;
      classCards.forEach((c, i) => {
        if (distance(c) < distance(classCards[best]!)) best = i;
      });
      pickClass(best);
    }, 90);
  });
  track.append(...classCards);
  pickClass(CLASS_IDS.indexOf(classId));

  /** A small origin tile: its name in its colour, and its bonus next to the icon of the card it starts with. */
  const originTile = (id: string) => {
    const o = ORIGINS[id]!;
    const cardId = originCardId(id);
    const cardIcon = icon(CARD_ICONS[cardId ?? ''] ?? 'skill', 'Card');
    cardIcon.setAttribute('aria-hidden', 'true');
    return h(
      'div',
      { class: 'origin-tile' },
      h('div', { class: 'choice-title', style: `color:${ORIGIN_COLORS[id]}` }, o.name),
      h('div', { class: 'origin-bonus' }, cardIcon, h('span', {}, o.description)),
    );
  };

  /** Under the tiles: the picked origin's bonus in full, its starting card and what that card does. */
  const originDetail = h('div', { class: 'origin-detail' });
  const refreshOriginDetail = () => {
    const cardId = originCardId(originId);
    originDetail.replaceChildren(
      cardId ? cardSticker(cardId, 1, { size: 'small' }) : '',
      h(
        'div',
        { class: 'origin-detail-text' },
        h('div', { class: 'origin-detail-bonus', style: `color:${ORIGIN_COLORS[originId]}` }, ORIGINS[originId]!.description),
        cardId ? h('div', { class: 'small' }, CARDS[cardId]!.describe(1)) : '',
      ),
    );
  };
  refreshOriginDetail();

  // ---- The four step panels (only the open one is shown) ----

  const panels = [
    h(
      'section',
      { class: 'create-panel' },
      h(
        'div',
        { class: 'card look-card' },
        ...LOOK_ROWS.map((r) => lookRow(r.key, r.label)),
        h(
          'button',
          { class: 'btn btn-small btn-with-icon', onclick: () => (Object.assign(look, randomLook()), refreshPreview()) },
          icon('dice', 'Random', 'normal'),
          'Random look',
        ),
      ),
    ),
    h(
      'section',
      { class: 'create-panel create-centred' },
      h('p', { class: 'lede small' }, 'Your starting stats and skill, and the upgrades you see most.'),
      track,
      classDots,
    ),
    h(
      'section',
      { class: 'create-panel' },
      choiceGrid(ORIGIN_IDS, originTile, (id) => {
        originId = id;
        refreshPreview();
        refreshOriginDetail();
      }, originId),
      originDetail,
    ),
    h('section', { class: 'create-panel create-centred create-name' }, h('p', { class: 'lede small' }, 'What does the street call you?'), nameInput),
  ];

  // ---- The street with the fighter, and the footer with dots, Back and Next ----

  const title = h('h1', { class: 'create-title' });
  const street = streetCanvas(HOME_STREET_SEED).toDataURL();
  const stage = h('div', { class: 'fight-arena create-stage', style: `--street:url(${street})` }, title, preview);
  const body = h('div', { class: 'create-body' }, ...panels);

  const stepDots = h('div', { class: 'step-dots', role: 'img' }, ...STEP_TITLES.map(() => h('span', {})));
  const backBtn = h('button', { class: 'btn btn-icon create-back', type: 'button', 'aria-label': 'Back' }, icon('left', 'Back', 'normal'));
  const nextBtn = h('button', { class: 'btn btn-primary create-next', type: 'button' });
  const nextArrow = icon('right', 'Next', 'normal');
  nextArrow.setAttribute('aria-hidden', 'true');

  const hasName = () => nameInput.value.trim().length > 0;

  /** Opens step `next`; `direction` says which way the new panel slides in (1 = from the right). */
  const showStep = (next: number, direction: number) => {
    step = next;
    panels.forEach((p, i) => p.classList.toggle('hidden', i !== step));
    title.textContent = STEP_TITLES[step]!;
    [...stepDots.children].forEach((d, i) => {
      d.classList.toggle('on', i === step);
      d.classList.toggle('done', i < step);
    });
    stepDots.setAttribute('aria-label', `Step ${step + 1} of ${STEP_TITLES.length}`);
    backBtn.classList.toggle('invisible', step === 0);
    const last = step === STEP_TITLES.length - 1;
    nextBtn.replaceChildren(last ? 'Create fighter' : 'Next', last ? '' : nextArrow);
    nextBtn.disabled = last && !hasName();
    body.scrollTop = 0;
    // The short slide: the panel and the title come in from the side we are heading to.
    if (!reducedMotion()) {
      for (const el of [panels[step]!, title]) {
        el.classList.remove('slide-from-right', 'slide-from-left');
        void el.offsetWidth; // restart the animation
        el.classList.add(direction > 0 ? 'slide-from-right' : 'slide-from-left');
      }
    }
    // The carousel lost its place while hidden: put the picked class back in the middle.
    if (step === 1) centre(classCards[CLASS_IDS.indexOf(classId)]!, 'instant');
    if (last) nameInput.focus({ preventScroll: true });
  };

  const create = () => {
    const name = nameInput.value.trim();
    if (name) onCreated(newGame(name, look, classId, originId, randomSeed()));
  };

  backBtn.addEventListener('click', () => {
    if (step > 0) showStep(step - 1, -1);
  });
  nextBtn.addEventListener('click', () => {
    if (step < STEP_TITLES.length - 1) showStep(step + 1, 1);
    else create();
  });
  nameInput.addEventListener('input', () => {
    nextBtn.disabled = !hasName();
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') create();
  });

  root.append(
    h(
      'main',
      { class: 'screen create' },
      stage,
      body,
      h('footer', { class: 'create-footer' }, backBtn, stepDots, nextBtn),
    ),
  );
  refreshPreview();
  showStep(0, 1);
}
