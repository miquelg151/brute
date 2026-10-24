// Small animations shared by every screen. The movements themselves are CSS (search
// style.css for "Motion"); this file only says which elements play them and in what order.

/** Things that "slap on" like stickers when a screen appears, one after another. */
const STICKERS = '.logo, .spot, .stats, .poster, .card, .choice, .carousel, .trait-chip, .segments, .option-detail, .rank-up, .action-bar';
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
