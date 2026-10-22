import { CLASSES, LOADOUT_SIZE, ORIGINS, PETS, SKILLS, STANCES, STANCE_IDS, WEAPONS, loadoutFor, warmupBonus, type SaveData, type Stance } from '../../core';
import { maxHpOf, totalStats } from '../describe';
import { h, pixelArt } from '../dom';
import { playWarmup } from '../minigames';
import { CLASS_COLORS } from '../palette';
import { drawFighter } from '../sprites';

interface PrefightActions {
  onWarmup: (score: number) => void;
  onStart: (stance: Stance, weapons: string[]) => void;
}

const list = (ids: string[], name: (id: string) => string) => (ids.length ? ids.map(name).join(', ') : 'none');

export function renderPrefight(root: HTMLElement, save: SaveData, actions: PrefightActions): void {
  const fight = save.pendingFight!;
  const me = save.character;
  const foe = fight.opponent;
  const foeStats = totalStats(foe);
  let stance: Stance = 'balanced';
  const loadout = new Set(loadoutFor(me));

  // Stance picker
  const stanceButtons = STANCE_IDS.map((id) => {
    const s = STANCES[id];
    const btn = h('button', { class: 'choice' }, h('div', { class: 'choice-title' }, s.name), h('div', { class: 'choice-desc' }, s.description));
    btn.addEventListener('click', () => {
      stance = id;
      stanceButtons.forEach((b) => b.classList.toggle('selected', b === btn));
    });
    if (id === stance) btn.classList.add('selected');
    return btn;
  });

  // Loadout picker, only needed when the fighter owns more weapons than they can bring.
  let loadoutSection: HTMLElement | null = null;
  if (me.weapons.length > LOADOUT_SIZE) {
    const hint = h('div', { class: 'muted small' });
    const refreshHint = () => (hint.textContent = `${loadout.size}/${LOADOUT_SIZE} chosen`);
    const chips = me.weapons.map((id) => {
      const chip = h('button', { class: 'chip toggle' }, WEAPONS[id]?.name ?? id);
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
    loadoutSection = h('section', {}, h('h2', {}, `Weapons to bring (max ${LOADOUT_SIZE})`), h('div', { class: 'chip-row' }, ...chips), hint);
  }

  // Warm-up: one attempt per fight
  const warmupInfo = h('div', { class: 'muted small' });
  const warmupBtn = h('button', { class: 'btn' }, 'Warm up (8s)');
  const refreshWarmup = (score: number | null) => {
    warmupBtn.classList.toggle('hidden', score !== null);
    warmupInfo.textContent =
      score === null ? 'Optional. One try. Up to +5% damage in this fight.' : `Warm-up score ${score}: +${warmupBonus(score)}% damage`;
  };
  refreshWarmup(fight.warmup);
  const screen = h('main', { class: 'screen prefight' });
  warmupBtn.addEventListener('click', async () => {
    warmupBtn.disabled = true;
    const score = await playWarmup(screen);
    actions.onWarmup(score);
    refreshWarmup(score);
  });

  const fightBtn = h('button', { class: 'btn btn-primary btn-big' }, 'Fight!');
  fightBtn.addEventListener('click', () => actions.onStart(stance, [...loadout]));

  screen.append(
    h('h1', {}, 'Next opponent'),
    h(
      'div',
      { class: 'versus-row' },
      h('div', { class: 'preview' }, pixelArt(drawFighter(me.appearance, me.classId), 4)),
      h('div', { class: 'vs' }, 'VS'),
      h('div', { class: 'preview' }, pixelArt(drawFighter(foe.appearance, foe.classId), 4, true)),
    ),
    h(
      'section',
      { class: 'panel foe' },
      h('div', { class: 'choice-title' }, `${foe.name} - Lv ${foe.level}`),
      h('div', { style: `color:${CLASS_COLORS[foe.classId]}` }, `${CLASSES[foe.classId].name}, ${ORIGINS[foe.originId]?.name ?? ''}`),
      h('div', { class: 'small' }, `HP ${maxHpOf(foe)}  STR ${foeStats.strength}  AGI ${foeStats.agility}  SPD ${foeStats.speed}`),
      h('div', { class: 'small' }, `Stance: ${STANCES[fight.opponentStance].name}`),
      h('div', { class: 'small muted' }, `Skills: ${list(foe.skills, (id) => SKILLS[id]?.name ?? id)}`),
      h('div', { class: 'small muted' }, `Weapons: ${list(foe.weapons, (id) => WEAPONS[id]?.name ?? id)}`),
      h('div', { class: 'small muted' }, `Pets: ${list(foe.pets, (id) => PETS[id]?.name ?? id)}`),
    ),
    h('h2', {}, 'Your stance'),
    h('div', { class: 'choice-grid' }, ...stanceButtons),
    loadoutSection ?? '',
    h('h2', {}, 'Warm-up'),
    h('section', { class: 'panel' }, warmupInfo, warmupBtn),
    fightBtn,
  );
  root.append(screen);
}
