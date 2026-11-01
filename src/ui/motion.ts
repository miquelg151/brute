// Small animations shared by every screen. The movements themselves are CSS (search
// style.css for "Motion"); this file only says which elements play them and in what order.
import { h } from './dom';
import { PAL } from './theme';

/** Things that "slap on" like stickers when a screen appears, one after another. */
const STICKERS = '.logo, .spot, .stats, .poster, .card, .choice, .carousel, .trait-chip, .segments, .option-detail, .rank-up h2, .action-bar';
/** After this many, the rest appear together (so long screens don't take ages). */
const MAX_STAGGER = 8;

/** Plays the entrance of a freshly drawn screen. */
export function animateIn(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(STICKERS).forEach((el, i) => {
    el.style.setProperty('--i', String(Math.min(i, MAX_STAGGER)));
    el.classList.add('slap');
  });
}

/** True when the player asked their phone for less motion. */
export function reducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Waits `ms` so an animation can finish, or not at all when motion is reduced. */
export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));
}

/** Plays the short entrance of a tab's content after switching tabs (CSS: .tab-in). */
export function tabIn(el: HTMLElement): void {
  el.classList.remove('tab-in');
  void el.offsetWidth; // restart the animation if it was still playing
  el.classList.add('tab-in');
}

/** Colours of the confetti: the bright spray-paint colours of the palette, plus paper. */
const CONFETTI_COLORS = [PAL.yellow, PAL.pink, PAL.teal, PAL.coral, PAL.sky, PAL.lime, PAL.paper];
/** How many bits of paper fall. */
const CONFETTI_COUNT = 36;

/** Gold Rain: shades of gold. Hearts: pinks and reds. */
const GOLD_COLORS = [PAL.yellow, PAL.amber, PAL.sand, PAL.white];
const HEART_COLORS = [PAL.pink, PAL.red, PAL.coral, PAL.magenta];

/**
 * The victory celebration over the whole screen (CSS: .confetti): 'confetti' (paper),
 * 'gold_rain', 'hearts' or 'fireworks' (see COSMETICS). Nothing at all when the player
 * asked for less motion.
 */
export function confetti(style = 'confetti'): void {
  if (reducedMotion()) return;
  const layer = h('div', { class: `confetti confetti-${style}`, 'aria-hidden': 'true' });
  if (style === 'fireworks') {
    fireworks(layer);
    document.body.append(layer);
    setTimeout(() => layer.remove(), 2200);
    return;
  }
  const colors = style === 'gold_rain' ? GOLD_COLORS : style === 'hearts' ? HEART_COLORS : CONFETTI_COLORS;
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const bit = h('span', {}, style === 'hearts' ? '♥' : '');
    if (style === 'hearts') bit.style.color = colors[i % colors.length]!;
    // Each bit gets its own place, colour, delay, speed and spin.
    bit.style.left = `${Math.random() * 100}%`;
    if (style !== 'hearts') bit.style.background = colors[i % colors.length]!;
    bit.style.setProperty('--delay', `${Math.round(Math.random() * 350)}ms`);
    bit.style.setProperty('--fall', `${Math.round(1100 + Math.random() * 400)}ms`);
    bit.style.setProperty('--drift', `${Math.round(Math.random() * 60 - 30)}px`);
    bit.style.setProperty('--spin', `${Math.round(Math.random() * 720 - 360)}deg`);
    layer.append(bit);
  }
  document.body.append(layer);
  // Gone once the last bit has landed.
  setTimeout(() => layer.remove(), 2000);
}

/** Three bursts of sparks, one after another, high on the screen. */
function fireworks(layer: HTMLElement): void {
  const sparks = 14;
  [
    [25, 22],
    [70, 16],
    [48, 34],
  ].forEach(([x, y], burst) => {
    for (let i = 0; i < sparks; i++) {
      const angle = (i / sparks) * Math.PI * 2;
      const spark = h('span');
      spark.style.left = `${x}%`;
      spark.style.top = `${y}%`;
      spark.style.background = CONFETTI_COLORS[(i + burst) % CONFETTI_COLORS.length]!;
      spark.style.setProperty('--dx', `${Math.round(Math.cos(angle) * 70)}px`);
      spark.style.setProperty('--dy', `${Math.round(Math.sin(angle) * 70)}px`);
      spark.style.setProperty('--delay', `${burst * 350}ms`);
      layer.append(spark);
    }
  });
}
