// Title style comparison page (open the game with ?styles). Shows the same bits of
// interface in every style from textStyle.ts, so they can be compared on a real phone.
import { h, pixelArt } from '../dom';
import { iconValue } from '../icons';
import { CLASS_COLORS } from '../palette';
import { drawFighter } from '../sprites';
import { TEXT_STYLES, type TextStyle } from '../textStyle';

const ME = { skinTone: 2, hairStyle: 0, hairColor: 1, outfitColor: 1 };
const FOE = { skinTone: 4, hairStyle: 1, hairColor: 4, outfitColor: 6 };

function sample(style: TextStyle): HTMLElement {
  return h(
    'section',
    { class: 'style-sample', 'data-text': style.id },
    h('p', { class: 'dim small' }, h('strong', {}, style.name), ` · ${style.note}`),
    h(
      'header',
      { class: 'hero' },
      h('div', { class: 'spot' }, pixelArt(drawFighter(ME, 'brawler'), 'normal')),
      h(
        'div',
        { class: 'hero-info' },
        h('h1', {}, 'Mango'),
        h('div', {}, 'Level 7 ', h('span', { style: `color:${CLASS_COLORS.brawler}` }, 'Brawler')),
        h('div', { class: 'dim small' }, iconValue('xp', 'Experience', '12 / 20')),
      ),
    ),
    h(
      'div',
      { class: 'poster' },
      h('div', { class: 'poster-side' }, h('div', { class: 'spot' }, pixelArt(drawFighter(ME, 'brawler'), 'normal'))),
      h('div', { class: 'vs' }, 'VS'),
      h('div', { class: 'poster-side' }, h('div', { class: 'spot' }, pixelArt(drawFighter(FOE, 'parkour'), 'normal', true))),
    ),
    h('h2', {}, 'Stance'),
    h('div', { class: 'btn btn-primary btn-big' }, 'Fight'),
    h('a', { class: 'btn btn-small', href: `./?text=${style.id}` }, 'Try it in the game'),
  );
}

export function renderStyles(root: HTMLElement): void {
  root.append(
    h(
      'main',
      { class: 'screen styles' },
      h('h1', {}, 'Title styles'),
      h(
        'p',
        { class: 'lede' },
        'The same titles with every effect. "Try it in the game" uses that style everywhere on this device; open the game with ?text=default to go back.',
      ),
      ...TEXT_STYLES.map(sample),
      h('a', { href: './', class: 'btn' }, 'Back to the game'),
    ),
  );
}
