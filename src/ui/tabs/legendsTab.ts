// The Legends tab: every fighter who graduated, as a wall of little cards. Tap one to read
// their medals, bosses and record. Legends are snapshots, so this tab never changes them.
import { BOSSES, BRANCHES_BY_ID, CLASSES, ORIGINS, medalName, type Legend, type SaveData } from '../../core';
import { h, pixelArt } from '../dom';
import { icon } from '../icons';
import { CLASS_COLORS } from '../palette';
import { drawFighter } from '../sprites';
import { openSheet } from '../widgets';

/** "Brawler · Bruiser" or just "Brawler". */
function classLine(legend: Legend): string {
  const c = legend.character;
  return c.branch ? `${CLASSES[c.classId].name} · ${BRANCHES_BY_ID[c.branch].name}` : CLASSES[c.classId].name;
}

function dateText(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** The fighter's picture on a gold-edged sticker. */
function portrait(legend: Legend): HTMLElement {
  return h('div', { class: 'spot legend' }, pixelArt(drawFighter(legend.character), 'small'));
}

export function renderLegendsTab(body: HTMLElement, save: SaveData): void {
  const page = h('div', { class: 'tab-page legends-tab' });
  body.append(page);

  if (save.legends.length === 0) {
    const crown = icon('medal', 'Medal', 'big');
    crown.setAttribute('aria-hidden', 'true');
    page.append(h('div', { class: 'legends-empty' }, crown, h('p', { class: 'legends-empty-text' }, 'Reach level 20 and beat the Champion to graduate. Your legends will stand here.')));
    return;
  }

  const cards = save.legends.map((legend) => {
    const c = legend.character;
    const medals = icon('medal', 'Medals', 'small');
    medals.setAttribute('aria-hidden', 'true');
    const button = h(
      'button',
      { class: 'legend-card', type: 'button', 'aria-label': `${c.name}, open details` },
      portrait(legend),
      h('span', { class: 'sticker-sm legend-name' }, c.name),
      c.title ? h('span', { class: 'legend-title' }, c.title) : '',
      h('span', { class: 'legend-class', style: `color:${CLASS_COLORS[c.classId]}` }, classLine(legend)),
      h('span', { class: 'legend-origin dim' }, ORIGINS[c.originId]?.name ?? ''),
      h('span', { class: 'legend-medals' }, medals, String(c.medals?.length ?? 0)),
    );
    button.addEventListener('click', () => openDetail(legend));
    return button;
  });
  page.append(h('div', { class: 'legend-grid' }, ...cards));
}

/** The sheet with everything about one legend. */
function openDetail(legend: Legend): void {
  const c = legend.character;
  const stats = c.stats;
  const medals = c.medals ?? [];

  const bossRows = Object.values(BOSSES).map((boss) => {
    const state = c.bosses?.[boss.id];
    return h('li', { class: `legend-boss ${state ?? 'none'}` }, h('span', {}, boss.name), h('span', { class: 'legend-boss-state' }, state === 'beaten' ? 'Beaten' : state === 'skipped' ? 'Skipped' : '-'));
  });

  const record = (label: string, value: number) => h('div', { class: 'legend-stat' }, h('span', { class: 'legend-stat-value' }, String(value)), h('span', { class: 'dim' }, label));

  const closeBtn = h('button', { class: 'btn btn-big', type: 'button' }, 'Close');
  const close = openSheet(
    `${c.name}, a legend`,
    h(
      'div',
      { class: 'legend-head' },
      portrait(legend),
      h(
        'div',
        { class: 'legend-head-text' },
        h('h2', { class: 'legend-detail-name' }, c.name),
        c.title ? h('p', { class: 'legend-title' }, c.title) : '',
        h('p', { class: 'legend-class', style: `color:${CLASS_COLORS[c.classId]}` }, classLine(legend)),
        h('p', { class: 'dim' }, `from ${ORIGINS[c.originId]?.name ?? ''}`),
        h('p', { class: 'dim' }, `Graduated ${dateText(legend.graduatedAt)}`),
      ),
    ),
    stats ? h('div', { class: 'legend-stats' }, record('Fights', stats.fights), record('Wins', stats.wins), record('KOs', stats.kos), record('Best streak', stats.bestStreak)) : '',
    h('h2', { class: 'section-icon' }, icon('medal', 'Medals', 'normal'), `Medals (${medals.length})`),
    medals.length ? h('ul', { class: 'legend-medal-list' }, ...medals.map((id) => h('li', {}, icon('medal', '', 'small'), medalName(id)))) : h('p', { class: 'dim' }, 'No medals.'),
    h('h2', {}, 'Bosses'),
    h('ul', { class: 'legend-boss-list' }, ...bossRows),
    h('div', { class: 'sheet-actions' }, closeBtn),
  );
  closeBtn.addEventListener('click', close);
}
