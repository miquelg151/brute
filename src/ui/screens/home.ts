import { CLASSES, FIGHTS_PER_DAY, ORIGINS, PETS, SKILLS, WEAPONS, fightsLeft, xpToNext, type SaveData } from '../../core';
import { maxHpOf, totalStats } from '../describe';
import { h, pixelArt } from '../dom';
import { CLASS_COLORS } from '../palette';
import { drawFighter } from '../sprites';

interface HomeActions {
  onFight: () => void;
  onReset: () => void;
}

const chips = (label: string, items: { name: string; title?: string }[]) =>
  h(
    'div',
    { class: 'chip-row' },
    h('span', { class: 'chip-label' }, label),
    ...(items.length ? items.map((i) => h('span', { class: 'chip', title: i.title ?? '' }, i.name)) : [h('span', { class: 'muted' }, 'none')]),
  );

export function renderHome(root: HTMLElement, save: SaveData, today: number, actions: HomeActions): void {
  const c = save.character;
  const stats = totalStats(c);
  const need = xpToNext(c.level);
  const left = fightsLeft(save.daily, today);

  const fightBtn = h('button', { class: 'btn btn-primary btn-big', disabled: left === 0, onclick: actions.onFight }, left > 0 ? 'Fight!' : 'Come back tomorrow');

  // Two taps to reset, so a stray tap never wipes the save.
  const resetBtn = h('button', { class: 'btn btn-small btn-ghost' }, 'Delete fighter');
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

  root.append(
    h(
      'main',
      { class: 'screen home' },
      h(
        'header',
        { class: 'hero' },
        h('div', { class: 'preview' }, pixelArt(drawFighter(c.appearance, c.classId), 6)),
        h(
          'div',
          { class: 'hero-info' },
          h('h1', {}, c.name),
          h('div', { style: `color:${CLASS_COLORS[c.classId]}` }, `${CLASSES[c.classId].name} - Level ${c.level}`),
          h('div', { class: 'muted' }, ORIGINS[c.originId]?.name ?? ''),
          h('div', { class: 'bar', title: `${c.xp}/${need} XP` }, h('div', { class: 'bar-fill xp', style: `width:${(100 * c.xp) / need}%` })),
          h('div', { class: 'muted small' }, `XP ${c.xp}/${need}`),
        ),
      ),
      h(
        'section',
        { class: 'panel stats' },
        h('div', {}, `HP ${maxHpOf(c)}`),
        h('div', {}, `STR ${stats.strength}`),
        h('div', {}, `AGI ${stats.agility}`),
        h('div', {}, `SPD ${stats.speed}`),
      ),
      h(
        'section',
        { class: 'panel' },
        chips('Skills', c.skills.map((id) => ({ name: SKILLS[id]?.name ?? id, title: SKILLS[id]?.description }))),
        chips('Weapons', c.weapons.map((id) => ({ name: WEAPONS[id]?.name ?? id }))),
        chips('Pets', c.pets.map((id) => ({ name: PETS[id]?.name ?? id }))),
      ),
      h('div', { class: 'fights-left' }, `Fights today: ${left}/${FIGHTS_PER_DAY}`),
      fightBtn,
      resetBtn,
    ),
  );
}
