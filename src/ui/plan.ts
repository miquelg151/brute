// Pickers for the strategy choices, shared by the pre-fight screen and the breaks.
import {
  GEAR,
  CARDS,
  DECK_SIZE,
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
import { cardSticker, levelOf } from './cardView';
import { gearEffects } from './describe';
import { h, pixelArt } from './dom';
import { draggable } from './drag';
import { TRAIT_ICONS, icon, iconValue, type IconName } from './icons';
import { drawWeapon } from './sprites';

/**
 * One row of buttons (a ✓ on those strong against the opponent) and, under it, what the
 * selected option does.
 */
export function optionGroup<Id extends string>(
  ids: readonly Id[],
  defs: Record<Id, TacticOption<Id>>,
  foeTraits: Trait[],
  selected: Id,
  onPick: (id: Id) => void,
): HTMLElement {
  const matches = (id: Id) => defs[id].strongVs !== null && foeTraits.includes(defs[id].strongVs!);
  const detail = h('div', { class: 'option-detail' });

  const showDetail = (id: Id) => {
    const def = defs[id];
    detail.replaceChildren(
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
            { class: matches(id) ? 'strong-vs match' : 'strong-vs' },
            matches(id) ? '✓ ' : '',
            'Strong against ',
            icon(TRAIT_ICONS[def.strongVs] ?? 'skill', TRAITS[def.strongVs].name),
            ` ${TRAITS[def.strongVs].name.toLowerCase()}`,
          )
        : '',
    );
  };

  const buttons = ids.map((id) => {
    const btn = h('button', { class: 'segment', 'aria-pressed': id === selected ? 'true' : 'false' }, defs[id].name, matches(id) ? h('span', { class: 'segment-tick' }, ' ✓') : '');
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      showDetail(id);
      onPick(id);
    });
    return btn;
  });
  showDetail(selected);
  return h('div', { class: 'option-group' }, h('div', { class: 'segments', role: 'group', 'data-count': ids.length, style: `--count:${ids.length}` }, ...buttons), detail);
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

interface PickItem {
  id: string;
  name: string;
  detail: string;
  /** A fresh picture each call (a canvas can only be in one place). */
  art: () => HTMLElement;
  /** The art already shows the name, so the text lines under it are left out. */
  plain?: boolean;
}

/**
 * Stickers you can drag (or tap) into a row of `capacity` slots. Tap or drag a sticker out
 * of a slot to take it back. With one slot, a new sticker replaces the old one.
 * Edits `chosen` in place and calls `onChange` after every change.
 */
function stickerPicker(items: PickItem[], chosen: string[], capacity: number, onChange: () => void, onTap: (id: string) => void = () => {}): HTMLElement {
  const slots = h('div', { class: 'pick-slots drop-zone' });
  const bag = h('div', { class: 'pick-bag drop-zone' });
  const hint = h('div', { class: 'dim small' });

  const add = (id: string) => {
    if (chosen.includes(id)) return;
    if (chosen.length >= capacity) {
      if (capacity > 1) {
        // Full: wiggle the slots instead of silently doing nothing.
        slots.classList.remove('full');
        void slots.offsetWidth;
        slots.classList.add('full');
        return;
      }
      chosen.splice(0, 1);
    }
    chosen.push(id);
    render();
  };
  const remove = (id: string) => {
    const i = chosen.indexOf(id);
    if (i >= 0) chosen.splice(i, 1);
    render();
  };

  const sticker = (item: PickItem, inSlot: boolean) => {
    const el = h(
      'div',
      { class: 'pick-item', role: 'button', tabindex: '0', 'aria-label': `${item.name}: ${inSlot ? 'take out' : 'bring'}` },
      h('div', { class: 'pick-art' }, item.art()),
      ...(item.plain ? [] : [h('span', { class: 'pick-name' }, item.name), h('span', { class: 'pick-detail' }, item.detail)]),
    );
    draggable(el, {
      onTap: () => {
        onTap(item.id);
        if (inSlot) remove(item.id);
        else add(item.id);
      },
      onDrop: (zone) => {
        if (inSlot && zone !== slots) remove(item.id);
        else if (!inSlot && zone === slots) add(item.id);
      },
    });
    return el;
  };

  const render = () => {
    slots.replaceChildren(
      ...Array.from({ length: capacity }, (_, i) => {
        const item = items.find((it) => it.id === chosen[i]);
        return item ? sticker(item, true) : h('div', { class: 'pick-empty', 'aria-hidden': 'true' });
      }),
    );
    // The bag only shows what is not in a slot yet.
    bag.replaceChildren(...items.filter((item) => !chosen.includes(item.id)).map((item) => sticker(item, false)));
    hint.textContent = capacity > 1 ? `${chosen.length} of ${capacity} · drag or tap` : 'Drag one in or tap it · empty means none';
    onChange();
  };
  render();
  return h('div', { class: 'picker' }, slots, hint, bag);
}

/** Choose up to DECK_SIZE of the owned cards. Edits `chosen` in place. */
export function deckPicker(owned: string[], chosen: string[], uses: Record<string, number>): HTMLElement {
  const items: PickItem[] = owned.map((id) => ({
    id,
    name: CARDS[id]!.name,
    detail: '',
    plain: true,
    art: () => cardSticker(id, levelOf(uses, id), { size: 'small' }),
  }));
  // Tapping a card (which also moves it) says what it does, since tooltips never show on a phone.
  const info = h('p', { class: 'trait-info small' }, 'Tap a card to see what it does.');
  const show = (id: string) => (info.textContent = `${CARDS[id]!.name}: ${CARDS[id]!.describe(levelOf(uses, id))}`);
  return h('div', { class: 'card-box' }, stickerPicker(items, chosen, DECK_SIZE, () => {}, show), info);
}

/** Bring up to LOADOUT_SIZE of the owned weapons. Edits `chosen` in place. */
export function weaponPicker(owned: string[], chosen: Set<string>): HTMLElement {
  const picked = [...chosen].filter((id) => owned.includes(id));
  const items: PickItem[] = owned.map((id) => {
    const w = WEAPONS[id];
    return {
      id,
      name: w?.name ?? id,
      detail: w ? `${w.damage} dmg${w.accuracy ? ` ${w.accuracy > 0 ? '+' : ''}${w.accuracy}% aim` : ''}` : '',
      art: () => pixelArt(drawWeapon(id), 'normal'),
    };
  });
  return stickerPicker(items, picked, LOADOUT_SIZE, () => {
    chosen.clear();
    picked.forEach((id) => chosen.add(id));
  });
}

/** One armor and one accessory (or none) from the owned gear. Edits `worn` in place. */
export function gearPicker(owned: string[], worn: GearChoice): HTMLElement {
  const row = (slot: GearSlot, label: string, iconName: IconName) => {
    const pieces = owned.filter((g) => GEAR[g]?.slot === slot);
    if (pieces.length === 0) return '';
    const picked = worn[slot] ? [worn[slot]] : [];
    const items: PickItem[] = pieces.map((id) => ({
      id,
      name: GEAR[id]!.name,
      detail: gearEffects(GEAR[id]!),
      art: () => icon(iconName, label, 'normal'),
    }));
    return h(
      'div',
      { class: 'gear-row' },
      h('div', { class: 'section-icon' }, icon(iconName, label, 'normal'), h('span', {}, label)),
      stickerPicker(items, picked, 1, () => (worn[slot] = picked[0] ?? null)),
    );
  };
  return h('div', { class: 'gear-picker' }, row('armor', 'Armor', 'armor'), row('accessory', 'Accessory', 'accessory'));
}
