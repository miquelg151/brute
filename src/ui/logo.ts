// The game logo: the fist sticker and the word BRUTE in sticker lettering.
import { h, pixelArt } from './dom';
import { drawIcon } from './icons';

export function logo(): HTMLElement {
  return h(
    'div',
    { class: 'logo', role: 'img', 'aria-label': 'Brute' },
    h('span', { class: 'logo-mark' }, pixelArt(drawIcon('fist'), 'normal')),
    h('span', { class: 'logo-word', 'aria-hidden': 'true' }, 'BRUTE'),
  );
}
