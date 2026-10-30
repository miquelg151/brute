// The game's main frame once a fighter exists: a top bar with the fighter, the open tab in
// the middle, and the tab bar at the bottom (Fighter · Fight · Cards · Legends).
// Full-screen moments (creation, level-up, pre-fight, the fight) are drawn by main.ts instead.
import { rankOf, xpToNext, type SaveData } from '../core';
import { h, pixelArt } from './dom';
import { icon, type IconName } from './icons';
import { reducedMotion, tabIn } from './motion';
import { drawFighter } from './sprites';
import { renderCardsTab } from './tabs/cardsTab';
import { renderFightTab } from './tabs/fightTab';
import { renderFighterTab } from './tabs/fighterTab';
import { renderLegendsTab } from './tabs/legendsTab';
import { rankBadge } from './widgets';

export type TabId = 'fighter' | 'fight' | 'cards' | 'legends';

/** What the shell asks main.ts to do. */
export interface ShellActions {
  onFight(): void;
  onLevelUp(): void;
  onReset(): void;
  /** The fighter graduated: main.ts keeps the legends and goes to creation. */
  onGraduate(): void;
  /** Stores the save after a tab changed it (for example the deck). */
  onSave(): void;
}

/** What a tab can do: everything the shell can, plus open another tab. */
export interface TabActions extends ShellActions {
  openTab(id: TabId): void;
}

/** The tabs in the order they appear in the bar. Fight sits in the middle and is the biggest. */
const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'fighter', label: 'Fighter', icon: 'strength' },
  { id: 'fight', label: 'Fight', icon: 'fist' },
  { id: 'cards', label: 'Cards', icon: 'skill' },
  { id: 'legends', label: 'Legends', icon: 'medal' },
];

const TAB_KEY = 'brute.tab';

/** How long the XP bar takes to fill after a fight (ms). */
const XP_FILL_MS = 600;

/**
 * The level and XP the top bar showed last time, kept in memory only. When the shell is
 * drawn again with more XP (back from a fight), the bar fills from the old value.
 */
let shownXp: { name: string; level: number; xp: number } | null = null;

/** The tab that was open last time (Fight if none, or if storage is blocked). */
function loadTab(): TabId {
  try {
    const stored = localStorage.getItem(TAB_KEY);
    if (TABS.some((t) => t.id === stored)) return stored as TabId;
  } catch {
    // Storage blocked: just open the Fight tab.
  }
  return 'fight';
}

function storeTab(id: TabId): void {
  try {
    localStorage.setItem(TAB_KEY, id);
  } catch {
    // The tab just won't be remembered.
  }
}

/** Forgets the open tab, so the next fighter starts on the Fight tab. */
function forgetTab(): void {
  try {
    localStorage.removeItem(TAB_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** Draws the top bar, the open tab and the tab bar into `root`. */
export function renderShell(root: HTMLElement, save: SaveData, actions: ShellActions): void {
  const body = h('main', { class: 'shell-body' });
  const tabButtons = new Map<TabId, HTMLButtonElement>();

  const tabActions: TabActions = {
    ...actions,
    // Deleting the fighter also forgets the open tab.
    onReset: () => {
      forgetTab();
      shownXp = null;
      actions.onReset();
    },
    // Graduating also forgets the open tab: the next fighter starts on Fight.
    onGraduate: () => {
      forgetTab();
      shownXp = null;
      actions.onGraduate();
    },
    openTab: (id) => open(id, true),
  };

  /** Shows a tab: only the middle is drawn again. */
  function open(id: TabId, animate: boolean): void {
    storeTab(id);
    for (const [tabId, button] of tabButtons) {
      if (tabId === id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    body.dataset.tab = id;
    body.replaceChildren();
    body.scrollTop = 0;
    if (id === 'fight') renderFightTab(body, save, tabActions);
    else if (id === 'fighter') renderFighterTab(body, save, tabActions);
    else if (id === 'legends') renderLegendsTab(body, save);
    else renderCardsTab(body, save, tabActions);
    if (animate) tabIn(body);
  }

  const tabBar = h(
    'nav',
    { class: 'tab-bar', 'aria-label': 'Tabs' },
    ...TABS.map((tab) => {
      // The label already names the tab, so screen readers skip the icon.
      const picture = icon(tab.icon, tab.label, tab.id === 'fight' ? 'normal' : 'small');
      picture.setAttribute('aria-hidden', 'true');
      const button = h('button', { class: `tab tab-${tab.id}`, type: 'button', onclick: () => open(tab.id, true) }, picture, h('span', { class: 'tab-label' }, tab.label));
      tabButtons.set(tab.id, button);
      return button;
    }),
  );

  root.append(h('div', { class: 'shell' }, topBar(save), body, tabBar));
  open(loadTab(), false);
}

/** The strip at the top: small fighter, name, level, rank and how far to the next level. */
function topBar(save: SaveData): HTMLElement {
  const c = save.character;
  const need = xpToNext(c.level);
  const legend = rankOf(c.level).id === 'legend';
  const fill = h('div', { class: 'bar-fill', style: `width:${percentOf(c.xp, need)}%` });
  const bar = h('div', { class: 'bar top-xp', role: 'img', 'aria-label': `${c.xp} of ${need} XP` }, fill);

  // Back from a fight with the same fighter: the bar grows from where it was.
  const before = shownXp;
  shownXp = { name: c.name, level: c.level, xp: c.xp };
  if (before && before.name === c.name && (c.level > before.level || (c.level === before.level && c.xp > before.xp))) {
    fillXp(bar, fill, before, c.level, c.xp).catch(() => {
      // The screen changed before the bar finished: nothing to do.
    });
  }

  return h(
    'header',
    { class: 'top-bar' },
    h('div', { class: legend ? 'top-portrait legend' : 'top-portrait' }, pixelArt(drawFighter(c), 'small')),
    h(
      'div',
      { class: 'top-info' },
      h('div', { class: 'top-line' }, h('span', { class: 'top-name sticker-sm' }, c.name), rankBadge(c.level)),
      h('div', { class: 'top-line' }, h('span', { class: 'top-level' }, `Level ${c.level}`), bar, h('span', { class: 'top-xp-text' }, `${c.xp}/${need}`)),
    ),
  );
}

/** How full the bar is, from 0 to 100. */
function percentOf(xp: number, need: number): number {
  return Math.max(0, Math.min(100, (100 * xp) / need));
}

/**
 * Fills the XP bar from the old value to the new one. On a level-up it fills to the end,
 * jumps a little and starts again from 0. Nothing moves when the player asked for less motion.
 */
async function fillXp(bar: HTMLElement, fill: HTMLElement, before: { level: number; xp: number }, level: number, xp: number): Promise<void> {
  if (reducedMotion()) return;
  // The bar's usual "grow in" (CSS: .bar-fill) would fight with this one, so it is switched off.
  fill.classList.add('xp-filling');
  const from = `${percentOf(before.xp, xpToNext(before.level))}%`;
  const to = `${percentOf(xp, xpToNext(level))}%`;
  const grow = async (start: string, end: string, delay: number) => {
    fill.style.width = start;
    await fill.animate([{ width: start }, { width: end }], { duration: XP_FILL_MS, delay, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }).finished;
    fill.style.width = end;
  };
  // The short wait lets the screen's entrance finish first.
  if (level === before.level) {
    await grow(from, to, 350);
    return;
  }
  // Level-up: to the end, a small jump, then from 0 to the new XP.
  await grow(from, '100%', 350);
  await bar.animate([{ transform: 'none' }, { transform: 'translateY(-4px) scale(1.06)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' }).finished;
  await grow('0%', to, 0);
}
