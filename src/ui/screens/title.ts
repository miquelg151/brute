// Title screen, shown when the game is opened for the first time (no fighter yet).
import type { Appearance } from '../../core';
import { h, pixelArt } from '../dom';
import { logo } from '../logo';
import { drawFighter } from '../sprites';
import { actionBar } from '../widgets';

const LOOK: Appearance = { skinTone: 2, hairStyle: 1, hairColor: 4, outfitColor: 1 };

export function renderTitle(root: HTMLElement, onStart: () => void): void {
  const startBtn = h('button', { class: 'btn btn-primary btn-big' }, 'Start');
  const screen = h(
    'main',
    { class: 'screen title' },
    logo(),
    h('div', { class: 'spot spot-big' }, pixelArt(drawFighter({ appearance: LOOK, classId: 'brawler' }), 'big')),
    h('p', { class: 'title-tagline' }, 'Street fights with your friends.'),
    actionBar(startBtn),
  );
  // Tapping anywhere starts, not only the button.
  screen.addEventListener('click', onStart, { once: true });
  root.append(screen);
}
