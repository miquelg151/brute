// The League tab: pick a legend and play league matches for trophies. Under it, the trophy
// road with every stop and its reward. Shown only once there is at least one legend.
import { ARENAS, BRANCHES_BY_ID, CARDS, CLASSES, COSMETICS, GEAR, type CosmeticKind, ROAD, arenaIndex, leagueTitle, type RoadReward, type SaveData } from '../../core';
import { CARD_ICONS } from '../cardView';
import { h, pixelArt } from '../dom';
import { gearIcon, icon, type IconName } from '../icons';
import { CLASS_COLORS } from '../palette';
import { drawFighter } from '../sprites';
import type { TabActions } from '../shell';

const PICK_KEY = 'brute.leagueLegend';

/** What each kind of cosmetic is called on screen. */
export const COSMETIC_LABEL: Record<CosmeticKind, string> = {
  hat: 'Hat',
  hairStyle: 'Hair',
  hairColor: 'Hair colour',
  outfitColor: 'Outfit colour',
  celebration: 'Celebration',
};

/** A road reward in plain words, e.g. 'Card: Cheap Shot' or 'Title: Alley Cat'. */
export function roadRewardText(r: RoadReward): string {
  if (r.kind === 'title') return `Title: ${r.title}`;
  if (r.kind === 'cosmetic') return `${COSMETIC_LABEL[COSMETICS[r.id]?.kind ?? 'hat']}: ${COSMETICS[r.id]?.name ?? r.id}`;
  return CARDS[r.item] ? `Card: ${CARDS[r.item]!.name}` : `Gear: ${GEAR[r.item]?.name ?? r.item}`;
}

/** The picture of a road reward: the item's own icon, or a medal for a title. */
function rewardIcon(r: RoadReward): IconName {
  if (r.kind === 'title') return 'medal';
  if (r.kind === 'cosmetic') return 'look';
  return CARDS[r.item] ? (CARD_ICONS[r.item] ?? 'skill') : gearIcon(r.item, GEAR[r.item]?.slot ?? 'armor');
}

/** The legend picked last time (the first one if none, or if storage is blocked). */
function loadPick(count: number): number {
  try {
    const stored = Number(localStorage.getItem(PICK_KEY));
    if (Number.isInteger(stored) && stored >= 0 && stored < count) return stored;
  } catch {
    // Storage blocked: start with the first legend.
  }
  return 0;
}

function storePick(index: number): void {
  try {
    localStorage.setItem(PICK_KEY, String(index));
  } catch {
    // Storage blocked: the pick is only kept until the tab is drawn again.
  }
}

export function renderLeagueTab(body: HTMLElement, save: SaveData, actions: TabActions): void {
  const league = save.league;
  const arena = arenaIndex(league.trophies);
  const title = leagueTitle(league);
  let pick = loadPick(save.legends.length);

  // ---- Trophies, arena and title ----
  const head = h(
    'div',
    { class: 'league-head' },
    h('div', { class: 'league-trophies' }, icon('trophy', 'Trophies', 'normal'), h('span', { class: 'league-trophy-count' }, String(league.trophies))),
    h('div', { class: 'league-arena' }, h('span', { class: 'dim small' }, `Arena ${arena + 1}`), h('span', { class: 'league-arena-name' }, ARENAS[arena]!.name)),
    title ? h('span', { class: 'tag league-title', style: '--tag:var(--yellow)' }, title) : '',
  );

  // ---- The legend picker ----
  const portrait = h('div', { class: 'spot legend league-portrait' });
  const name = h('div', { class: 'league-legend-name' });
  const classLine = h('div', { class: 'league-legend-class small' });
  const show = () => {
    const c = save.legends[pick]!.character;
    portrait.replaceChildren(pixelArt(drawFighter(c), 'normal'));
    name.textContent = c.name;
    classLine.textContent = c.branch ? `${CLASSES[c.classId].name} · ${BRANCHES_BY_ID[c.branch].name}` : CLASSES[c.classId].name;
    classLine.style.color = CLASS_COLORS[c.classId];
  };
  const step = (by: number) => () => {
    pick = (pick + by + save.legends.length) % save.legends.length;
    storePick(pick);
    show();
  };
  const several = save.legends.length > 1;
  const picker = h(
    'div',
    { class: 'league-picker' },
    several ? h('button', { class: 'btn btn-small btn-icon', type: 'button', 'aria-label': 'Previous legend', onclick: step(-1) }, icon('left', 'Previous')) : '',
    h('div', { class: 'league-legend' }, portrait, name, classLine),
    several ? h('button', { class: 'btn btn-small btn-icon', type: 'button', 'aria-label': 'Next legend', onclick: step(1) }, icon('right', 'Next')) : '',
  );
  show();

  const playBtn = h('button', { class: 'btn btn-primary btn-big league-play', type: 'button' }, 'Play match');
  playBtn.addEventListener('click', () => actions.onLeague(pick));

  // ---- The trophy road ----
  const next = ROAD.find((s) => !league.rewards.includes(s.id));
  const stops = ROAD.map((stop) => {
    const reached = league.rewards.includes(stop.id);
    const arenaHere = ARENAS.find((a) => a.trophies === stop.trophies);
    return h(
      'li',
      { class: `road-stop${reached ? ' reached' : ''}${stop === next ? ' next' : ''}` },
      h('span', { class: 'road-trophies' }, reached ? '✓' : String(stop.trophies)),
      h(
        'span',
        { class: 'road-rewards' },
        arenaHere ? h('span', { class: 'road-arena' }, arenaHere.name) : '',
        ...stop.rewards.map((r) => h('span', { class: 'road-reward' }, icon(rewardIcon(r), roadRewardText(r), 'small'), roadRewardText(r))),
      ),
    );
  });

  body.append(
    h(
      'div',
      { class: 'tab-page league-tab' },
      head,
      picker,
      playBtn,
      h('h2', { class: 'section-icon road-heading' }, icon('trophy', 'Road', 'small'), 'Trophy road'),
      h('p', { class: 'dim small' }, 'Unlocked items can be found by fighters you create from then on.'),
      h('ol', { class: 'road' }, ...stops),
    ),
  );
}
