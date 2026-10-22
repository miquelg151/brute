import { CLASSES, FIGHTS_PER_DAY, ORIGINS, SKILLS, fightsLeft, xpToNext, type SaveData } from '../../core';
import { maxHpOf, totalStats } from '../describe';
import { h, pixelArt } from '../dom';
import { CLASS_COLORS } from '../palette';
import { drawFighter } from '../sprites';
import { petSlot, pips, slot, weaponSlot } from '../widgets';

interface HomeActions {
  onFight: () => void;
  onReset: () => void;
}

export function renderHome(root: HTMLElement, save: SaveData, today: number, actions: HomeActions): void {
  const c = save.character;
  const stats = totalStats(c);
  const need = xpToNext(c.level);
  const left = fightsLeft(save.daily, today);

  const fightBtn = h('button', { class: 'btn btn-primary btn-big', disabled: left === 0, onclick: actions.onFight }, left > 0 ? 'Fight' : 'Back tomorrow');

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

  const stat = (value: number, label: string) =>
    h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, String(value)), h('span', { class: 'stat-label' }, label));

  root.append(
    h(
      'main',
      { class: 'screen home' },
      h(
        'header',
        { class: 'hero' },
        h('div', { class: 'spot' }, pixelArt(drawFighter(c.appearance, c.classId), 6)),
        h(
          'div',
          { class: 'hero-info' },
          h('h1', {}, c.name),
          h('div', {}, `Level ${c.level} `, h('span', { style: `color:${CLASS_COLORS[c.classId]}` }, CLASSES[c.classId].name)),
          h('div', { class: 'dim small' }, `From ${ORIGINS[c.originId]?.name ?? ''}`),
          h('div', { class: 'bar', role: 'img', 'aria-label': `${c.xp} of ${need} XP` }, h('div', { class: 'bar-fill', style: `width:${(100 * c.xp) / need}%` })),
          h('div', { class: 'dim small' }, `${c.xp} / ${need} XP to level ${c.level + 1}`),
        ),
      ),
      h('div', { class: 'stats' }, stat(maxHpOf(c), 'Health'), stat(stats.strength, 'Strength'), stat(stats.agility, 'Agility'), stat(stats.speed, 'Speed')),
      h('h2', {}, 'Weapons'),
      h('div', { class: 'slots' }, ...(c.weapons.length ? c.weapons.map(weaponSlot) : [slot(null, 'Fists only')])),
      h('h2', {}, 'Pets'),
      h('div', { class: 'slots' }, ...(c.pets.length ? c.pets.map(petSlot) : [slot(null, 'None yet')])),
      h('h2', {}, 'Skills'),
      h(
        'ul',
        { class: 'skill-list' },
        ...c.skills.map((id) => h('li', {}, h('strong', {}, SKILLS[id]?.name ?? id), ' ', h('span', {}, SKILLS[id]?.description ?? ''))),
      ),
      h(
        'div',
        { class: 'today' },
        h('span', {}, left > 0 ? `${left} fights left today` : 'No fights left today'),
        pips(left, FIGHTS_PER_DAY, `${left} of ${FIGHTS_PER_DAY} fights left`),
      ),
      fightBtn,
      resetBtn,
    ),
  );
}
