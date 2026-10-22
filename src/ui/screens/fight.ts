import Phaser from 'phaser';
import {
  STANCES,
  TARGETS,
  WEAPON_STYLES,
  finishFight,
  recordBreak,
  recordSpecial,
  simulateFight,
  traitsOf,
  type BreakChoice,
  type Plan,
  type SaveData,
} from '../../core';
import { ARENA_H, ARENA_W, ARENA_ZOOM, ReplayScene, type BreakEvent, type FighterState } from '../../fight/ReplayScene';
import { h } from '../dom';
import { icon, iconValue } from '../icons';
import { playSpecialStrike } from '../minigames';
import { planEditor, weaponPicker } from '../plan';

const SPEEDS = [1, 2, 4];
const SKIP_SPEED = 40;

const planText = (c: BreakChoice) =>
  `${STANCES[c.stance].name}, ${TARGETS[c.target].name.toLowerCase()}, ${WEAPON_STYLES[c.weaponStyle].name.toLowerCase()} weapons${c.recover ? ', and they will recover' : ''}.`;

function fighterLine(f: FighterState): HTMLElement {
  return h(
    'div',
    { class: 'break-fighter' },
    h('strong', {}, f.name),
    h(
      'span',
      { class: 'icon-row' },
      iconValue('health', 'Health', `${f.hp}/${f.maxHp}`),
      iconValue('stamina', 'Stamina', f.stamina),
      f.maxMana > 0 ? iconValue('mana', 'Mana', f.mana) : '',
    ),
  );
}

/**
 * The break panel. Resolves with the player's choice for the next round.
 * In live fights the opponent's choice is not shown.
 */
function breakPanel(host: HTMLElement, save: SaveData, event: BreakEvent, fighters: [FighterState, FighterState]): Promise<BreakChoice> {
  const fight = save.pendingFight!;
  const previous: Plan = fight.inputs.breaks.at(-1) ?? fight.tactics!;
  const plan: Plan = { stance: previous.stance, target: previous.target, weaponStyle: previous.weaponStyle };
  const weapons = new Set(fight.inputs.breaks.at(-1)?.weapons ?? fight.tactics!.weapons);
  let recover = false;
  const foeChoice = event.choices[1];

  return new Promise((resolve) => {
    const recoverBtns = [false, true].map((value) => {
      const btn = h(
        'button',
        { class: 'choice option' },
        h('div', { class: 'choice-title' }, value ? 'Recover' : 'Keep going'),
        h(
          'ul',
          { class: 'effects' },
          ...(value
            ? [h('li', { class: 'up' }, '▲ Much more stamina and mana'), h('li', { class: 'down' }, '▼ Start the round late')]
            : [h('li', { class: 'flat' }, 'Normal rest between rounds')]),
        ),
      );
      btn.classList.toggle('selected', value === recover);
      btn.addEventListener('click', () => {
        recover = value;
        recoverBtns.forEach((b, i) => b.classList.toggle('selected', (i === 1) === recover));
      });
      return btn;
    });

    const nextBtn = h('button', { class: 'btn btn-primary btn-big' }, `Start round ${event.round + 1}`);
    const panel = h(
      'section',
      { class: 'break-panel' },
      h('h2', { class: 'section-icon' }, icon('round', 'Break', 3), `Round ${event.round} is over`),
      h('div', { class: 'card' }, fighterLine(fighters[0]), fighterLine(fighters[1])),
      h(
        'p',
        { class: 'lede small' },
        fight.live
          ? `${fighters[1].name} is choosing too. You won't know their plan until the round starts.`
          : foeChoice
            ? `${fighters[1].name} will go ${planText(foeChoice)}`
            : '',
      ),
      ...planEditor(plan, traitsOf(fight.opponent)),
      save.character.weapons.length > 0
        ? h(
            'section',
            {},
            h('h2', {}, 'Weapons'),
            h('p', { class: 'lede small' }, 'Thrown weapons are gone for the rest of this fight.'),
            weaponPicker(save.character.weapons, weapons),
          )
        : '',
      h('h2', {}, 'Rest'),
      h('div', { class: 'choice-grid' }, ...recoverBtns),
      nextBtn,
    );
    nextBtn.addEventListener('click', () => {
      panel.remove();
      resolve({ ...plan, weapons: [...weapons], recover });
    });
    host.append(panel);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/** Plays the started pending fight. Every input is saved as soon as it is made. */
export function renderFight(root: HTMLElement, save: SaveData, store: () => void, onDone: () => void): void {
  const opponent = save.pendingFight!.opponent;
  const arena = h('div', { class: 'arena' });
  const speedBtn = h('button', { class: 'btn btn-small' }, 'x1');
  const skipBtn = h('button', { class: 'btn btn-small' }, 'Skip');
  const controls = h('div', { class: 'fight-controls' }, speedBtn, skipBtn);
  const summary = h('div', { class: 'card fight-summary hidden' });
  const continueBtn = h('button', { class: 'btn btn-primary hidden' }, 'Continue');
  const below = h('div', {});

  root.append(
    h(
      'main',
      { class: 'screen fight' },
      h('div', { class: 'versus' }, `${save.character.name} vs ${opponent.name}, level ${opponent.level}`),
      arena,
      controls,
      below,
      summary,
      continueBtn,
    ),
  );

  let speed = 1;
  // Created after the arena is in the DOM: Phaser sizes the canvas from its parent.
  const scene = new ReplayScene(simulateFight(save), {
    requestSpecial: async () => {
      recordSpecial(save, await playSpecialStrike(arena));
      store();
    },
    requestBreak: async (event, fighters) => {
      controls.classList.add('hidden');
      const choice = await breakPanel(below, save, event, fighters);
      recordBreak(save, choice);
      store();
      controls.classList.remove('hidden');
      arena.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    resimulate: () => simulateFight(save),
    onFinished: () => {
      const result = finishFight(save);
      store();
      summary.append(
        h('div', { class: `result ${result.won ? 'win' : 'loss'}` }, result.won ? `You beat ${opponent.name}` : `${opponent.name} won`),
        h('div', { class: 'dim' }, iconValue('xp', 'Experience', `+${result.xpGained}`), result.levelsGained > 0 ? ' Level up!' : ''),
      );
      controls.classList.add('hidden');
      summary.classList.remove('hidden');
      continueBtn.classList.remove('hidden');
    },
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: arena,
    width: ARENA_W * ARENA_ZOOM,
    height: ARENA_H * ARENA_ZOOM,
    pixelArt: true,
    backgroundColor: '#0b0c10',
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    scene,
  });

  let speedIndex = 0;
  speedBtn.addEventListener('click', () => {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    speed = SPEEDS[speedIndex]!;
    speedBtn.textContent = `x${speed}`;
    scene.setSpeed(speed);
  });
  // Skip races to the next decision (special or break) and stops there, since those need the player.
  skipBtn.addEventListener('click', () => scene.setSpeed(SKIP_SPEED));
  continueBtn.addEventListener('click', () => {
    game.destroy(true);
    onDone();
  });
}
