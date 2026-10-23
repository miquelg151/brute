// Pickers for the strategy choices, shared by the pre-fight screen and the breaks.
import {
  GEAR,
  LOADOUT_SIZE,
  STANCES,
  STANCE_IDS,
  TARGETS,
  TARGET_IDS,
  TRAITS,
  WEAPONS,
  WEAPON_STYLES,
  WEAPON_STYLE_IDS,
  type GearChoice,
  type GearSlot,
  type Plan,
  type TacticOption,
  type Trait,
} from '../core';
import { gearEffects } from './describe';
import { h } from './dom';
import { TRAIT_ICONS, icon, iconValue } from './icons';

/** A card per option: effects with arrows, and the trait it is strong against (ticked if the opponent has it). */
export function optionGroup<Id extends string>(
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
          ? def.effects.map((e) =>
              h(
                'li',
                { class: e.good ? 'up' : 'down' },
                h('span', { 'aria-hidden': 'true' }, e.good ? '▲ ' : '▼ '),
                e.stat ? iconValue(e.stat.name, e.text, e.stat.value) : e.text,
              ),
            )
          : [h('li', { class: 'flat' }, 'No bonus, no weakness')]),
      ),
      def.strongVs
        ? h(
            'div',
            { class: matches ? 'strong-vs match' : 'strong-vs' },
            matches ? '✓ ' : '',
            'Strong against ',
            icon(TRAIT_ICONS[def.strongVs] ?? 'skill', TRAITS[def.strongVs].name),
            ` ${TRAITS[def.strongVs].name.toLowerCase()}`,
          )
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

/** Stance, target and weapon-use pickers. Edits `plan` in place. */
export function planEditor(plan: Plan, foeTraits: Trait[]): HTMLElement[] {
  return [
    h('h2', {}, 'Stance'),
    optionGroup(STANCE_IDS, STANCES, foeTraits, plan.stance, (id) => (plan.stance = id)),
    h('h2', {}, 'Target'),
    optionGroup(TARGET_IDS, TARGETS, foeTraits, plan.target, (id) => (plan.target = id)),
    h('h2', {}, 'Weapon use'),
    optionGroup(WEAPON_STYLE_IDS, WEAPON_STYLES, foeTraits, plan.weaponStyle, (id) => (plan.weaponStyle = id)),
  ];
}

/** Toggle chips to bring up to LOADOUT_SIZE of the owned weapons. Edits `chosen` in place. */
export function weaponPicker(owned: string[], chosen: Set<string>): HTMLElement {
  const hint = h('div', { class: 'dim small' });
  const refreshHint = () => (hint.textContent = `${chosen.size} of ${LOADOUT_SIZE} chosen`);
  const chips = owned.map((id) => {
    const w = WEAPONS[id];
    const chip = h(
      'button',
      { class: 'chip-toggle' },
      w?.name ?? id,
      w ? h('span', { class: 'dim small' }, ` ${w.damage} dmg${w.accuracy ? `, ${w.accuracy > 0 ? '+' : ''}${w.accuracy}% aim` : ''}`) : '',
    );
    chip.classList.toggle('selected', chosen.has(id));
    chip.addEventListener('click', () => {
      if (chosen.has(id)) chosen.delete(id);
      else if (chosen.size < LOADOUT_SIZE) chosen.add(id);
      chip.classList.toggle('selected', chosen.has(id));
      refreshHint();
    });
    return chip;
  });
  refreshHint();
  return h('div', {}, h('div', { class: 'slots' }, ...chips), hint);
}

/** One armor and one accessory (or none) from the owned gear. Edits `worn` in place. */
export function gearPicker(owned: string[], worn: GearChoice): HTMLElement {
  const row = (slot: GearSlot, label: string, iconName: 'armor' | 'accessory') => {
    const pieces = owned.filter((g) => GEAR[g]?.slot === slot);
    if (pieces.length === 0) return '';
    const options = [null, ...pieces];
    const chips = options.map((id) => {
      const g = id ? GEAR[id] : undefined;
      const chip = h('button', { class: 'chip-toggle gear-chip' }, g ? g.name : 'None', g ? h('span', { class: 'dim small' }, gearEffects(g)) : '');
      chip.addEventListener('click', () => {
        worn[slot] = id;
        chips.forEach((c) => c.classList.toggle('selected', c === chip));
      });
      chip.classList.toggle('selected', worn[slot] === id);
      return chip;
    });
    return h('div', { class: 'gear-row' }, h('div', { class: 'section-icon' }, icon(iconName, label, 'normal'), h('span', {}, label)), h('div', { class: 'slots' }, ...chips));
  };
  return h('div', { class: 'gear-picker' }, row('armor', 'Armor', 'armor'), row('accessory', 'Accessory', 'accessory'));
}
