import { CLASSES, GEAR, ORIGINS, SKILLS, xpToNext, type SaveData } from '../../core';
import { cardSticker, levelOf } from '../cardView';
import { gearEffects, maxHpOf, maxManaOf, totalStats } from '../describe';
import { h, pixelArt } from '../dom';
import { icon, iconHeading, iconValue } from '../icons';
import { CLASS_COLORS } from '../palette';
import { drawFighter } from '../sprites';
import { actionBar, petSlot, slot, weaponSlot } from '../widgets';

interface HomeActions {
  onFight: () => void;
  onReset: () => void;
}

export function renderHome(root: HTMLElement, save: SaveData, actions: HomeActions): void {
  const c = save.character;
  const stats = totalStats(c);
  const need = xpToNext(c.level);

  const fightBtn = h('button', { class: 'btn btn-primary btn-big', onclick: actions.onFight }, 'Fight');

  // Two taps to delete, so a stray tap never wipes the save.
  const resetBtn = h('button', { class: 'btn btn-ghost btn-small' }, 'Delete fighter');
  let armed = false;
  resetBtn.addEventListener('click', () => {
    if (armed) return actions.onReset();
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

  root.append(
    h(
      'main',
      { class: 'screen home' },
      h(
        'header',
        { class: 'hero' },
        h('div', { class: 'spot' }, pixelArt(drawFighter(c.appearance, c.classId), 'big')),
        h(
          'div',
          { class: 'hero-info' },
          h('h1', {}, c.name),
          h('div', {}, `Level ${c.level} `, h('span', { class: 'sticker-sm', style: `color:${CLASS_COLORS[c.classId]}` }, CLASSES[c.classId].name)),
          h('div', { class: 'dim small' }, `From ${ORIGINS[c.originId]?.name ?? ''}`),
          h('div', { class: 'bar', role: 'img', 'aria-label': `${c.xp} of ${need} XP` }, h('div', { class: 'bar-fill', style: `width:${(100 * c.xp) / need}%` })),
          h('div', { class: 'dim small' }, iconValue('xp', 'Experience', `${c.xp} / ${need}`)),
        ),
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
      iconHeading('skill', 'Cards'),
      h('div', { class: 'card-list' }, ...c.cards.map((id) => cardSticker(id, levelOf(c.cardUses, id), { uses: c.cardUses[id] ?? 0 }))),
      resetBtn,
      actionBar(fightBtn),
    ),
  );
}
