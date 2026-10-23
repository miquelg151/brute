// Font comparison page (open the game with ?fonts). Shows the same bits of interface in
// every font from fonts.ts, so they can be compared on a real phone.
import { h, pixelArt } from '../dom';
import { FONTS, fontVars, loadFontStylesheet, type FontChoice } from '../fonts';
import { icon, iconValue } from '../icons';
import { CLASS_COLORS } from '../palette';
import { drawFighter } from '../sprites';

const LOOK = { skinTone: 2, hairStyle: 0, hairColor: 1, outfitColor: 1 };

function sample(choice: FontChoice): HTMLElement {
  loadFontStylesheet(choice);
  const style = Object.entries(fontVars(choice))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  const stat = (name: 'health' | 'strength' | 'speed', value: number, label: string) =>
    h('div', { class: 'stat' }, icon(name, label, 'normal'), h('span', { class: 'stat-value' }, String(value)));

  return h(
    'section',
    { class: 'font-sample', style },
    h('h2', {}, choice.name),
    h('p', { class: 'dim small' }, choice.note),
    h(
      'header',
      { class: 'hero' },
      h('div', { class: 'spot' }, pixelArt(drawFighter(LOOK, 'brawler'), 'normal')),
      h(
        'div',
        { class: 'hero-info' },
        h('h1', {}, 'Mango'),
        h('div', {}, 'Level 7 ', h('span', { style: `color:${CLASS_COLORS.brawler}` }, 'Brawler')),
        h('div', { class: 'dim small' }, iconValue('xp', 'Experience', '12 / 20')),
      ),
    ),
    h('div', { class: 'stats' }, stat('health', 84, 'Health'), stat('strength', 9, 'Strength'), stat('speed', 6, 'Speed')),
    h(
      'div',
      { class: 'choice-grid' },
      h(
        'div',
        { class: 'choice selected' },
        h('span', { class: 'choice-title' }, 'Aggressive'),
        h('span', { class: 'choice-desc' }, 'Hits harder, but leaves you open to counters.'),
      ),
      h('div', { class: 'choice' }, h('span', { class: 'choice-title' }, 'Defensive'), h('span', { class: 'choice-desc' }, 'Takes less damage from many small hits.')),
    ),
    h('div', { class: 'result win' }, 'VICTORY! +12 XP'),
    h('div', { class: 'btn btn-primary btn-big' }, 'Fight'),
    h(
      'div',
      { class: 'font-sample-actions' },
      h('a', { class: 'btn btn-small', href: `./?font=${choice.id}` }, 'Try it in the game'),
    ),
  );
}

export function renderFonts(root: HTMLElement): void {
  root.append(
    h(
      'main',
      { class: 'screen fonts' },
      h('h1', {}, 'Fonts'),
      h(
        'p',
        { class: 'lede' },
        'The same screen in every font. "Try it in the game" uses that font everywhere on this device; open the game with ?font=default to go back.',
      ),
      ...FONTS.map(sample),
      h('a', { href: './', class: 'btn' }, 'Back to the game'),
    ),
  );
}
