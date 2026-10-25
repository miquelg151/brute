// The screen before a fight, all on one phone screen: a small poster (you VS the opponent),
// what stands out about the opponent, three mini tabs (Plan · Gear · Cards) and Start fight.
// Only the open mini tab scrolls, inside its own area, when its content is too tall.
import {
  BRANCHES_BY_ID,
  CLASSES,
  DECK_SIZE,
  DEFAULT_PLAN,
  GEAR,
  LOADOUT_SIZE,
  ORIGINS,
  PETS,
  SKILLS,
  STANCES,
  TARGETS,
  TRAITS,
  WEAPONS,
  WEAPON_STYLES,
  defaultTactics,
  gearFor,
  loadoutFor,
  rankOf,
  traitsOf,
  type GearChoice,
  type Plan,
  type SaveData,
} from '../../core';
import { cardList } from '../cardView';
import { maxHpOf, maxManaOf, totalStats } from '../describe';
import { h, pixelArt } from '../dom';
import type { PixelSize } from '../theme';
import { TRAIT_ICONS, icon, iconValue, statRow, type IconName } from '../icons';
import { CLASS_COLORS } from '../palette';
import { deckPicker, gearPicker, planEditor, weaponPicker } from '../plan';
import { drawFighter } from '../sprites';
import { actionBar, rankBadge } from '../widgets';

interface PrefightActions {
  onStart: (plan: Plan, weapons: string[], gear: GearChoice, deck: string[]) => void;
}

/** The mini tabs under the poster, in the order they appear. */
const MINI_TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'plan', label: 'Plan', icon: 'stance' },
  { id: 'gear', label: 'Gear', icon: 'weapon' },
  { id: 'cards', label: 'Cards', icon: 'skill' },
];

const names = (ids: string[], name: (id: string) => string | undefined) => (ids.length ? ids.map((id) => name(id) ?? id).join(', ') : 'None');

export function renderPrefight(root: HTMLElement, save: SaveData, actions: PrefightActions): void {
  const fight = save.pendingFight!;
  const me = save.character;
  const foe = fight.opponent;
  const foeStats = totalStats(foe);
  const foeTraits = traitsOf(foe);
  const foeGear = gearFor(foe);
  const foeMana = maxManaOf(foe);
  const plan: Plan = { ...DEFAULT_PLAN };
  const loadout = new Set(loadoutFor(me));
  const worn: GearChoice = gearFor(me);
  // Starts as the fighter's preferred deck (the one set on the Cards tab).
  const deck = [...defaultTactics(me).deck];

  const screen = h('main', { class: 'screen prefight' });

  const fightBtn = h('button', { class: 'btn btn-primary btn-big' }, 'Start fight');
  fightBtn.addEventListener('click', () => actions.onStart({ ...plan }, [...loadout], { ...worn }, [...deck]));

  // ---- The poster: both fighters, each with the name and, under it, level and rank ----

  // A Legend's sticker gets a gold edge (see `.spot.legend` in style.css).
  const side = (canvas: HTMLCanvasElement, name: string, level: number) =>
    h(
      'div',
      { class: 'poster-side' },
      h('div', { class: rankOf(level).id === 'legend' ? 'spot legend' : 'spot' }, canvas),
      h('div', { class: 'poster-name' }, name),
      h('div', { class: 'poster-level small' }, `Lv ${level} `, rankBadge(level)),
    );

  // On short phones the fighters are drawn a size smaller, so the mini tabs get more room.
  const fighterSize: PixelSize = window.matchMedia('(max-height: 700px)').matches ? 'small' : 'normal';
  const poster = h(
    'div',
    { class: 'poster taped' },
    side(pixelArt(drawFighter(me), fighterSize), me.name, me.level),
    h('div', { class: 'vs' }, 'VS'),
    side(pixelArt(drawFighter(foe), fighterSize, true), foe.name, foe.level),
  );

  // ---- Everything about the opponent, in a sheet opened by the "i" button ----

  const foePlan = fight.opponentPlan;
  const foeWorn = [foeGear.armor, foeGear.accessory].filter((g): g is string => !!g);

  const openFoeSheet = () => {
    const closeBtn = h('button', { class: 'btn btn-big' }, 'Close');
    const sheet = h(
      'section',
      { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Everything about ${foe.name}` },
      h('div', { class: 'sheet-handle', 'aria-hidden': 'true' }),
      h('h2', {}, foe.name),
      h(
        'dl',
        { class: 'card intel' },
        h('dt', {}, 'Class'),
        h(
          'dd',
          { class: 'intel-class', style: `color:${CLASS_COLORS[foe.classId]}` },
          foe.branch ? `${CLASSES[foe.classId].name} · ${BRANCHES_BY_ID[foe.branch].name}` : CLASSES[foe.classId].name,
        ),
        h('dt', {}, icon('stance', 'Plan')),
        // In live fights the opponent chooses at the same time, so their plan stays a mystery.
        h(
          'dd',
          {},
          fight.live
            ? 'Hidden: they choose at the same time as you'
            : `${STANCES[foePlan.stance].name}, ${TARGETS[foePlan.target].name.toLowerCase()}, ${WEAPON_STYLES[foePlan.weaponStyle].name.toLowerCase()} weapons`,
        ),
        h('dt', { class: 'sr-only' }, 'Stats'),
        h(
          'dd',
          { class: 'span-2' },
          statRow(maxHpOf(foe), foeStats.strength, foeStats.agility, foeStats.speed),
          foeStats.magic > 0 || foeMana > 0 ? h('span', { class: 'icon-row' }, iconValue('magic', 'Magic', foeStats.magic), iconValue('mana', 'Mana', foeMana)) : '',
        ),
        h('dt', {}, icon('origin', 'Origin')),
        h('dd', {}, ORIGINS[foe.originId]?.name ?? ''),
        h('dt', {}, icon('skill', 'Skills')),
        h('dd', {}, names(foe.skills, (id) => SKILLS[id]?.name)),
        h('dt', {}, icon('weapon', 'Weapons')),
        h('dd', {}, names(foe.weapons, (id) => WEAPONS[id]?.name)),
        h('dt', {}, icon('pet', 'Pets')),
        h('dd', {}, names(foe.pets, (id) => PETS[id]?.name)),
        h('dt', {}, icon('armor', 'Gear')),
        h('dd', {}, names(foeWorn, (id) => GEAR[id]?.name)),
      ),
      // The button stays at the bottom of the sheet while its content scrolls.
      h('div', { class: 'sheet-actions' }, closeBtn),
    );
    const backdrop = h('div', { class: 'sheet-backdrop' }, sheet);
    // If the screen is replaced while the sheet is open, the sheet goes away with it.
    const watch = new MutationObserver(() => {
      if (!screen.isConnected) close();
    });
    const close = () => {
      watch.disconnect();
      backdrop.remove();
      document.body.classList.remove('sheet-open');
    };
    watch.observe(root, { childList: true });
    closeBtn.addEventListener('click', close);
    // Tapping the dark area around the sheet closes it too.
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
    document.body.classList.add('sheet-open');
    document.body.append(backdrop);
  };

  const infoBtn = h('button', { class: 'info-btn', 'aria-label': `Everything about ${foe.name}`, title: `Everything about ${foe.name}` }, 'i');
  infoBtn.addEventListener('click', openFoeSheet);
  // Stuck on the poster's top-right corner, next to the opponent.
  poster.append(infoBtn);

  // ---- What stands out about the opponent, as stickers: tap one to read what it means ----

  // With three or more traits the stickers show only their icon, so they stay on one row.
  const iconsOnly = foeTraits.length >= 3;
  const info = h('p', { class: 'trait-info small' }, foeTraits.length ? 'Tap a sticker to learn more.' : 'Nothing stands out.');
  const chips = foeTraits.map((t) => {
    const trait = TRAITS[t];
    const chip = h(
      'button',
      { class: iconsOnly ? 'trait-chip icon-only' : 'trait-chip', 'aria-pressed': 'false' },
      icon(TRAIT_ICONS[t] ?? 'skill', trait.name, 'small'),
      iconsOnly ? '' : trait.name,
    );
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
      info.textContent = iconsOnly ? `${trait.name}: ${trait.description}` : trait.description;
    });
    return chip;
  });
  const scouting = h('div', { class: 'traits-box' }, h('div', { class: 'scouting' }, ...chips), info);

  // ---- The three mini tabs and what each one shows ----

  const planPane = h(
    'div',
    { class: 'mini-pane' },
    h('p', { class: 'lede small' }, '✓ = strong vs this foe. Change it at each break.'),
    ...planEditor(plan, foeTraits),
  );

  const gearPane = h('div', { class: 'mini-pane' });
  if (me.weapons.length > LOADOUT_SIZE) {
    gearPane.append(
      h('h2', {}, `Bring up to ${LOADOUT_SIZE} weapons`),
      h('p', { class: 'lede small' }, 'Accurate weapons are better against fighters who dodge a lot.'),
      weaponPicker(me.weapons, loadout),
    );
  }
  if (me.gear.length > 0) gearPane.append(h('h2', {}, 'Gear'), gearPicker(me.gear, worn));
  if (gearPane.childElementCount === 0) gearPane.append(h('p', { class: 'lede' }, 'Nothing to choose yet.'));

  const cardsPane =
    me.cards.length > DECK_SIZE
      ? h('div', { class: 'mini-pane' }, h('p', { class: 'lede small' }, `Bring ${DECK_SIZE} cards. Cards level up as you play them.`), deckPicker(me.cards, deck, me.cardUses))
      : h('div', { class: 'mini-pane' }, cardList(me.cards, me.cardUses));

  // Every pane is built once and only hidden, so choices stay put when switching tabs.
  const panes = [planPane, gearPane, cardsPane];
  const body = h('div', { class: 'prefight-body' }, ...panes);

  const tabButtons = MINI_TABS.map((tab, i) => {
    const btn = h('button', { class: `mini-tab mini-tab-${tab.id}`, role: 'tab', 'aria-selected': 'false' }, icon(tab.icon, tab.label, 'small'), h('span', {}, tab.label));
    btn.addEventListener('click', () => openTab(i));
    return btn;
  });
  const openTab = (index: number) => {
    tabButtons.forEach((b, i) => b.setAttribute('aria-selected', i === index ? 'true' : 'false'));
    panes.forEach((p, i) => p.classList.toggle('hidden', i !== index));
    body.scrollTop = 0;
  };
  openTab(0);

  screen.append(poster, scouting, h('div', { class: 'mini-tabs', role: 'tablist' }, ...tabButtons), body, actionBar(fightBtn));
  root.append(screen);
}
