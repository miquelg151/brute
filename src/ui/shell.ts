// The game's main frame once a fighter exists: a top bar with the fighter, the open tab in
// the middle, and the tab bar at the bottom (Fighter · Fight · Cards).
// Full-screen moments (creation, level-up, pre-fight, the fight) are drawn by main.ts instead.
import { rankOf, xpToNext, type SaveData } from '../core';
import { h, pixelArt } from './dom';
import { icon, type IconName } from './icons';
import { tabIn } from './motion';
import { drawFighter } from './sprites';
import { renderFightTab } from './tabs/fightTab';
import { renderHomeCards, renderHomeFighter } from './screens/home';
import { rankBadge } from './widgets';

export type TabId = 'fighter' | 'fight' | 'cards';

/** What the shell asks main.ts to do. */
export interface ShellActions {
  onFight(): void;
  onLevelUp(): void;
  onReset(): void;
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
];

const TAB_KEY = 'brute.tab';

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

/** Draws the top bar, the open tab and the tab bar into `root`. */
export function renderShell(root: HTMLElement, save: SaveData, actions: ShellActions): void {
  const body = h('main', { class: 'shell-body' });
  const tabButtons = new Map<TabId, HTMLButtonElement>();

  const tabActions: TabActions = { ...actions, openTab: (id) => open(id, true) };

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
    else if (id === 'fighter') renderHomeFighter(body, save, actions.onReset);
    else renderHomeCards(body, save);
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
  return h(
    'header',
    { class: 'top-bar' },
    h('div', { class: legend ? 'top-portrait legend' : 'top-portrait' }, pixelArt(drawFighter(c), 'small')),
    h(
      'div',
      { class: 'top-info' },
      h('div', { class: 'top-line' }, h('span', { class: 'top-name sticker-sm' }, c.name), rankBadge(c.level)),
      h(
        'div',
        { class: 'top-line' },
        h('span', { class: 'top-level' }, `Level ${c.level}`),
        h('div', { class: 'bar top-xp', role: 'img', 'aria-label': `${c.xp} of ${need} XP` }, h('div', { class: 'bar-fill', style: `width:${(100 * c.xp) / need}%` })),
        h('span', { class: 'top-xp-text' }, `${c.xp}/${need}`),
      ),
    ),
  );
}
