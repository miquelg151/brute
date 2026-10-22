import {
  CLASSES,
  DEFAULT_PLAN,
  LOADOUT_SIZE,
  ORIGINS,
  PETS,
  SKILLS,
  STANCES,
  STANCE_IDS,
  TARGETS,
  TARGET_IDS,
  TRAITS,
  WEAPONS,
  WEAPON_STYLES,
  WEAPON_STYLE_IDS,
  loadoutFor,
  traitsOf,
  warmupBonus,
  type Plan,
  type SaveData,
  type TacticOption,
  type Trait,
} from '../../core';
import { maxHpOf, totalStats } from '../describe';
import { h, pixelArt } from '../dom';
import { playWarmup } from '../minigames';
import { CLASS_COLORS } from '../palette';
import { drawFighter } from '../sprites';

interface PrefightActions {
  onWarmup: (score: number) => void;
  onStart: (plan: Plan, weapons: string[]) => void;
}

const names = (ids: string[], name: (id: string) => string | undefined) => (ids.length ? ids.map((id) => name(id) ?? id).join(', ') : 'None');

/** A card per option: effects with arrows, and the trait it is strong against (ticked if the opponent has it). */
function optionGroup<Id extends string>(
  ids: readonly Id[],
  defs: Record<Id, TacticOption<Id>>,
  foeTraits: Trait[],
  selected: Id,
  onPick: (id: Id) => void,
): HTMLElement {
  const buttons = ids.map((id) => {
    const def = defs[id];
    const matches = def.strongVs !== null && foeTraits.includes(def.strongVs);
    const btn = h(
      'button',
      { class: 'choice option', 'aria-pressed': id === selected ? 'true' : 'false' },
      h('div', { class: 'choice-title' }, def.name),
      h(
        'ul',
        { class: 'effects' },
        ...(def.effects.length
          ? def.effects.map((e) => h('li', { class: e.good ? 'up' : 'down' }, h('span', { 'aria-hidden': 'true' }, e.good ? '▲ ' : '▼ '), e.text))
          : [h('li', { class: 'flat' }, 'No bonus, no weakness')]),
      ),
      def.strongVs
        ? h('div', { class: matches ? 'strong-vs match' : 'strong-vs' }, matches ? '✓ ' : '', `Strong against ${TRAITS[def.strongVs].name.toLowerCase()}`)
        : '',
    );
    btn.addEventListener('click', () => {
      buttons.forEach((b) => {
        b.classList.toggle('selected', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      onPick(id);
    });
    if (id === selected) btn.classList.add('selected');
    return btn;
  });
  return h('div', { class: ids.length === 3 ? 'choice-grid cols-3' : 'choice-grid' }, ...buttons);
}

export function renderPrefight(root: HTMLElement, save: SaveData, actions: PrefightActions): void {
  const fight = save.pendingFight!;
  const me = save.character;
  const foe = fight.opponent;
  const foeStats = totalStats(foe);
  const foeTraits = traitsOf(foe);
  const plan: Plan = { ...DEFAULT_PLAN };
  const loadout = new Set(loadoutFor(me));

  // Loadout picker, only needed when the fighter owns more weapons than they can bring.
  let loadoutSection: HTMLElement | string = '';
  if (me.weapons.length > LOADOUT_SIZE) {
    const hint = h('div', { class: 'dim small' });
    const refreshHint = () => (hint.textContent = `${loadout.size} of ${LOADOUT_SIZE} chosen`);
    const chips = me.weapons.map((id) => {
      const w = WEAPONS[id];
      const chip = h('button', { class: 'chip-toggle' }, w?.name ?? id, w ? h('span', { class: 'dim small' }, ` ${w.damage} dmg${w.accuracy ? `, ${w.accuracy > 0 ? '+' : ''}${w.accuracy}% aim` : ''}`) : '');
      chip.classList.toggle('selected', loadout.has(id));
      chip.addEventListener('click', () => {
        if (loadout.has(id)) loadout.delete(id);
        else if (loadout.size < LOADOUT_SIZE) loadout.add(id);
        chip.classList.toggle('selected', loadout.has(id));
        refreshHint();
      });
      return chip;
    });
    refreshHint();
    loadoutSection = h(
      'section',
      {},
      h('h2', {}, `Bring up to ${LOADOUT_SIZE} weapons`),
      h('p', { class: 'lede small' }, 'Accurate weapons are better against fighters who dodge a lot.'),
      h('div', { class: 'slots' }, ...chips),
      hint,
    );
  }

  const warmupInfo = h('p', { class: 'dim small' });
  const warmupBtn = h('button', { class: 'btn' }, 'Warm up');
  const refreshWarmup = (score: number | null) => {
    warmupBtn.classList.toggle('hidden', score !== null);
    warmupInfo.textContent =
      score === null
        ? 'Optional. Tap targets for 8 seconds, once per fight. Worth up to +5% damage.'
        : `You scored ${score}: +${warmupBonus(score)}% damage this fight.`;
  };
  refreshWarmup(fight.warmup);

  const screen = h('main', { class: 'screen prefight' });
  warmupBtn.addEventListener('click', async () => {
    warmupBtn.disabled = true;
    const score = await playWarmup(screen);
    actions.onWarmup(score);
    refreshWarmup(score);
  });

  const fightBtn = h('button', { class: 'btn btn-primary btn-big' }, 'Start fight');
  fightBtn.addEventListener('click', () => actions.onStart({ ...plan }, [...loadout]));

  const side = (canvas: HTMLCanvasElement, name: string, sub: HTMLElement) =>
    h('div', { class: 'poster-side' }, h('div', { class: 'spot' }, canvas), h('div', { class: 'poster-name' }, name), sub);
  const foePlan = fight.opponentPlan;

  screen.append(
    h('h1', {}, 'Next fight'),
    h(
      'div',
      { class: 'poster' },
      side(pixelArt(drawFighter(me.appearance, me.classId), 4), me.name, h('div', { class: 'dim small' }, `Level ${me.level}`)),
      h('div', { class: 'vs' }, 'VS'),
      side(
        pixelArt(drawFighter(foe.appearance, foe.classId), 4, true),
        foe.name,
        h('div', { class: 'small', style: `color:${CLASS_COLORS[foe.classId]}` }, `Level ${foe.level} ${CLASSES[foe.classId].name}`),
      ),
    ),
    h('h2', {}, `Scouting ${foe.name}`),
    h(
      'section',
      { class: 'card' },
      h(
        'ul',
        { class: 'traits' },
        ...(foeTraits.length
          ? foeTraits.map((t) => h('li', {}, h('span', { class: 'trait' }, TRAITS[t].name), ' ', h('span', { class: 'dim small' }, TRAITS[t].description)))
          : [h('li', { class: 'dim' }, 'Nothing stands out.')]),
      ),
      h(
        'dl',
        { class: 'intel' },
        h('dt', {}, 'Plan'),
        h('dd', {}, `${STANCES[foePlan.stance].name}, ${TARGETS[foePlan.target].name.toLowerCase()}, ${WEAPON_STYLES[foePlan.weaponStyle].name.toLowerCase()} weapons`),
        h('dt', {}, 'Stats'),
        h('dd', {}, `HP ${maxHpOf(foe)}, STR ${foeStats.strength}, AGI ${foeStats.agility}, SPD ${foeStats.speed}`),
        h('dt', {}, 'Origin'),
        h('dd', {}, ORIGINS[foe.originId]?.name ?? ''),
        h('dt', {}, 'Skills'),
        h('dd', {}, names(foe.skills, (id) => SKILLS[id]?.name)),
        h('dt', {}, 'Weapons'),
        h('dd', {}, names(foe.weapons, (id) => WEAPONS[id]?.name)),
        h('dt', {}, 'Pets'),
        h('dd', {}, names(foe.pets, (id) => PETS[id]?.name)),
      ),
    ),
    h('p', { class: 'lede small' }, 'Options marked ✓ are strong against something this opponent has.'),
    h('h2', {}, 'Stance'),
    optionGroup(STANCE_IDS, STANCES, foeTraits, plan.stance, (id) => (plan.stance = id)),
    h('h2', {}, 'Target'),
    optionGroup(TARGET_IDS, TARGETS, foeTraits, plan.target, (id) => (plan.target = id)),
    h('h2', {}, 'Weapon use'),
    optionGroup(WEAPON_STYLE_IDS, WEAPON_STYLES, foeTraits, plan.weaponStyle, (id) => (plan.weaponStyle = id)),
    loadoutSection,
    h('h2', {}, 'Warm-up'),
    h('section', { class: 'card' }, warmupInfo, warmupBtn),
    fightBtn,
  );
  root.append(screen);
}
