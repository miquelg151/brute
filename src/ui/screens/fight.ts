import Phaser from 'phaser';
import { finishFight, simulateFight, type SaveData } from '../../core';
import { ARENA_H, ARENA_W, ARENA_ZOOM, ReplayScene } from '../../fight/ReplayScene';
import { h } from '../dom';
import { iconValue } from '../icons';
import { playSpecialStrike } from '../minigames';

const SPEEDS = [1, 2, 4];
const SKIP_SPEED = 40;

/** Plays the started pending fight. `onSaved` is called once the result is applied to the save. */
export function renderFight(root: HTMLElement, save: SaveData, onSaved: () => void, onDone: () => void): void {
  const opponent = save.pendingFight!.opponent;
  const arena = h('div', { class: 'arena' });
  const speedBtn = h('button', { class: 'btn btn-small' }, 'x1');
  const skipBtn = h('button', { class: 'btn btn-small' }, 'Skip');
  const controls = h('div', { class: 'fight-controls' }, speedBtn, skipBtn);
  const summary = h('div', { class: 'card fight-summary hidden' });
  const continueBtn = h('button', { class: 'btn btn-primary hidden' }, 'Continue');

  root.append(
    h(
      'main',
      { class: 'screen fight' },
      h('div', { class: 'versus' }, `${save.character.name} vs ${opponent.name}, level ${opponent.level}`),
      arena,
      controls,
      summary,
      continueBtn,
    ),
  );

  // Created after the arena is in the DOM: Phaser sizes the canvas from its parent.
  const scene = new ReplayScene(simulateFight(save, []), {
    requestSpecial: () => playSpecialStrike(arena),
    resimulate: (specials) => simulateFight(save, specials),
    onFinished: (_log, specials) => {
      const result = finishFight(save, specials);
      onSaved();
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
    speedBtn.textContent = `x${SPEEDS[speedIndex]}`;
    scene.setSpeed(SPEEDS[speedIndex]!);
  });
  skipBtn.addEventListener('click', () => scene.setSpeed(SKIP_SPEED));
  continueBtn.addEventListener('click', () => {
    game.destroy(true);
    onDone();
  });
}
