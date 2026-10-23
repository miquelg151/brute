import {
  CLASSES,
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
  gearFor,
  loadoutFor,
  traitsOf,
  warmupBonus,
  type GearChoice,
  type Plan,
  type SaveData,
} from '../../core';
import { maxHpOf, maxManaOf, totalStats } from '../describe';
import { h, pixelArt } from '../dom';
import { TRAIT_ICONS, icon, iconValue, statRow } from '../icons';
import { playWarmup } from '../minigames';
import { CLASS_COLORS } from '../palette';
import { gearPicker, planEditor, weaponPicker } from '../plan';
import { drawFighter } from '../sprites';

interface PrefightActions {
  onWarmup: (score: number) => void;
  onStart: (plan: Plan, weapons: string[], gear: GearChoice) => void;
}

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
  fightBtn.addEventListener('click', () => actions.onStart({ ...plan }, [...loadout], { ...worn }));

  const side = (canvas: HTMLCanvasElement, name: string, sub: HTMLElement) =>
    h('div', { class: 'poster-side' }, h('div', { class: 'spot' }, canvas), h('div', { class: 'poster-name' }, name), sub);
  const foePlan = fight.opponentPlan;
  const foeWorn = [foeGear.armor, foeGear.accessory].filter((g): g is string => !!g);

  screen.append(
    h('h1', {}, 'Next fight'),
    h(
      'div',
      { class: 'poster taped' },
      side(pixelArt(drawFighter(me.appearance, me.classId), 'normal'), me.name, h('div', { class: 'dim small' }, `Level ${me.level}`)),
      h('div', { class: 'vs' }, 'VS'),
      side(
        pixelArt(drawFighter(foe.appearance, foe.classId), 'normal', true),
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
          ? foeTraits.map((t) =>
              h(
                'li',
                { class: 'trait-row' },
                icon(TRAIT_ICONS[t] ?? 'skill', TRAITS[t].name),
                h('span', {}, h('span', { class: 'trait' }, TRAITS[t].name), ' ', h('span', { class: 'dim small' }, TRAITS[t].description)),
              ),
            )
          : [h('li', { class: 'dim' }, 'Nothing stands out.')]),
      ),
      h(
        'dl',
        { class: 'intel' },
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
    ),
    h('p', { class: 'lede small' }, 'Options marked ✓ are strong against something this opponent has. You can change them at each break.'),
    ...planEditor(plan, foeTraits),
    me.weapons.length > LOADOUT_SIZE
      ? h('section', {}, h('h2', {}, `Bring up to ${LOADOUT_SIZE} weapons`), h('p', { class: 'lede small' }, 'Accurate weapons are better against fighters who dodge a lot.'), weaponPicker(me.weapons, loadout))
      : '',
    me.gear.length > 0 ? h('section', {}, h('h2', {}, 'Gear'), gearPicker(me.gear, worn)) : '',
    h('h2', {}, 'Warm-up'),
    h('section', { class: 'card' }, warmupInfo, warmupBtn),
    fightBtn,
  );
  root.append(screen);
}
