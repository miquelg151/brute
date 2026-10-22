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

const names = (ids: string[], name: (id: string) => string | undefined) => (ids.length ? ids.map((id) => name(id) ?? id).join(', ') : 'None');

export function renderPrefight(root: HTMLElement, save: SaveData, actions: PrefightActions): void {
  const fight = save.pendingFight!;
  const me = save.character;
  const foe = fight.opponent;
  const foeStats = totalStats(foe);
  let stance: Stance = 'balanced';
  const loadout = new Set(loadoutFor(me));

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
  let loadoutSection: HTMLElement | string = '';
  if (me.weapons.length > LOADOUT_SIZE) {
    const hint = h('div', { class: 'dim small' });
    const refreshHint = () => (hint.textContent = `${loadout.size} of ${LOADOUT_SIZE} chosen`);
    const chips = me.weapons.map((id) => {
      const chip = h('button', { class: 'chip-toggle' }, WEAPONS[id]?.name ?? id);
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
    loadoutSection = h('section', {}, h('h2', {}, `Bring up to ${LOADOUT_SIZE} weapons`), h('div', { class: 'slots' }, ...chips), hint);
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
  fightBtn.addEventListener('click', () => actions.onStart(stance, [...loadout]));

  const side = (canvas: HTMLCanvasElement, name: string, sub: HTMLElement) =>
    h('div', { class: 'poster-side' }, h('div', { class: 'spot' }, canvas), h('div', { class: 'poster-name' }, name), sub);

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
    h('h2', {}, `What you know about ${foe.name}`),
    h(
      'dl',
      { class: 'card intel' },
      h('dt', {}, 'Stance'),
      h('dd', {}, STANCES[fight.opponentStance].name),
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
    h('h2', {}, 'Your stance'),
    h('div', { class: 'choice-grid' }, ...stanceButtons),
    loadoutSection,
    h('h2', {}, 'Warm-up'),
    h('section', { class: 'card' }, warmupInfo, warmupBtn),
    fightBtn,
  );
  root.append(screen);
}
