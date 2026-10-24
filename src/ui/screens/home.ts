import { CLASSES, GEAR, ORIGINS, SKILLS, type SaveData } from '../../core';
import { cardList } from '../cardView';
import { gearEffects, maxHpOf, maxManaOf, totalStats } from '../describe';
import { h } from '../dom';
import { icon, iconHeading } from '../icons';
import { CLASS_COLORS } from '../palette';
import { petSlot, slot, weaponSlot } from '../widgets';

// The old home screen's content, shown in the Fighter and Cards tabs until those tabs get
// their own design (the fighter's name, level and XP now live in the shell's top bar).

/** Fighter tab content for now: class and origin, stats, weapons, pets, gear, skills, delete. */
export function renderHomeFighter(body: HTMLElement, save: SaveData, onReset: () => void): void {
  const c = save.character;
  const stats = totalStats(c);

  // Two taps to delete, so a stray tap never wipes the save.
  const resetBtn = h('button', { class: 'btn btn-ghost btn-small' }, 'Delete fighter');
  let armed = false;
  resetBtn.addEventListener('click', () => {
    if (armed) return onReset();
    armed = true;
    resetBtn.textContent = 'Tap again to delete';
    setTimeout(() => {
      armed = false;
      resetBtn.textContent = 'Delete fighter';
    }, 3000);
  });

  const mana = maxManaOf(c);
  const stat = (name: 'health' | 'strength' | 'agility' | 'speed' | 'magic' | 'mana', value: number, label: string) =>
    h('div', { class: 'stat', title: label }, icon(name, label, 'normal'), h('span', { class: 'stat-value' }, String(value)));

  body.append(
    h(
      'div',
      { class: 'tab-page' },
      h(
        'div',
        { class: 'hero-info' },
        h('div', {}, h('span', { class: 'sticker-sm', style: `color:${CLASS_COLORS[c.classId]}` }, CLASSES[c.classId].name), ' ', h('span', { class: 'dim' }, `from ${ORIGINS[c.originId]?.name ?? ''}`)),
      ),
      h(
        'div',
        { class: 'stats' },
        stat('health', maxHpOf(c), 'Health'),
        stat('strength', stats.strength, 'Strength'),
        stat('agility', stats.agility, 'Agility'),
        stat('speed', stats.speed, 'Speed'),
      ),
      stats.magic > 0 || mana > 0 ? h('div', { class: 'stats stats-2' }, stat('magic', stats.magic, 'Magic'), stat('mana', mana, 'Mana')) : '',
      iconHeading('weapon', 'Weapons'),
      h('div', { class: 'slots' }, ...(c.weapons.length ? c.weapons.map(weaponSlot) : [slot(null, 'Fists only')])),
      iconHeading('pet', 'Pets'),
      h('div', { class: 'slots' }, ...(c.pets.length ? c.pets.map(petSlot) : [slot(null, 'None yet')])),
      c.gear.length
        ? h(
            'section',
            {},
            iconHeading('armor', 'Gear'),
            h(
              'ul',
              { class: 'skill-list' },
              ...c.gear.map((id) => h('li', {}, h('strong', {}, GEAR[id]?.name ?? id), ' ', h('span', {}, GEAR[id] ? gearEffects(GEAR[id]) : ''))),
            ),
          )
        : '',
      iconHeading('skill', 'Skills'),
      h(
        'ul',
        { class: 'skill-list' },
        ...c.skills.map((id) => h('li', {}, h('strong', {}, SKILLS[id]?.name ?? id), ' ', h('span', {}, SKILLS[id]?.description ?? ''))),
      ),
      resetBtn,
    ),
  );
}

/** Cards tab content for now: every card the fighter owns, tap one to read it. */
export function renderHomeCards(body: HTMLElement, save: SaveData): void {
  const c = save.character;
  body.append(h('div', { class: 'tab-page' }, iconHeading('skill', 'Cards'), cardList(c.cards, c.cardUses)));
}
