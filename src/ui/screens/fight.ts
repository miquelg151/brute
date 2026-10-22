import Phaser from 'phaser';
import type { FightResult } from '../../core';
import { ARENA_H, ARENA_W, ReplayScene } from '../../fight/ReplayScene';
import { h } from '../dom';

const SPEEDS = [1, 2, 4];
const SKIP_SPEED = 40;

export function renderFight(root: HTMLElement, result: FightResult, onDone: () => void): void {
  const arena = h('div', { class: 'arena' });
  const speedBtn = h('button', { class: 'btn btn-small' }, 'x1');
  const skipBtn = h('button', { class: 'btn btn-small' }, 'Skip');
  const controls = h('div', { class: 'fight-controls' }, speedBtn, skipBtn);
  const summary = h(
    'div',
    { class: 'fight-summary hidden' },
    h('div', { class: result.won ? 'win' : 'loss' }, result.won ? `You beat ${result.opponent.name}!` : `${result.opponent.name} won this time.`),
    h('div', { class: 'muted' }, `+${result.xpGained} XP${result.levelsGained > 0 ? ' - LEVEL UP!' : ''}`),
  );
  const continueBtn = h('button', { class: 'btn btn-primary hidden' }, 'Continue');

  root.append(
    h(
      'main',
      { class: 'screen fight' },
      h('div', { class: 'versus' }, `${result.log.roster[0]?.name} vs ${result.opponent.name} (Lv ${result.opponent.level})`),
      arena,
      controls,
      summary,
      continueBtn,
    ),
  );

  // Created after the arena is in the DOM: Phaser sizes the canvas from its parent.
  const scene = new ReplayScene(result.log, () => {
    controls.classList.add('hidden');
    summary.classList.remove('hidden');
    continueBtn.classList.remove('hidden');
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: arena,
    width: ARENA_W,
    height: ARENA_H,
    pixelArt: true,
    backgroundColor: '#1e1b2e',
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
