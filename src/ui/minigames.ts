// Skill minigames. They only measure the player; the score is passed to the
// deterministic fight simulation as an input.
import { h } from './dom';

const SPECIAL_PERIOD_MS = 1100;
const SPECIAL_TIMEOUT_MS = 3500;
/** Half-width of the perfect zone, as a fraction of the bar. */
const PERFECT_ZONE = 0.04;

/** Timing quality for a marker at `pos` (0-1): 100 in the centre zone, falling to 0 at 40% away. */
export function timingQuality(pos: number): number {
  const d = Math.abs(pos - 0.5);
  if (d <= PERFECT_ZONE) return 100;
  return Math.max(0, Math.round(100 * (1 - (d - PERFECT_ZONE) / 0.36)));
}

/**
 * Shows a timing bar over `host` and resolves with the quality of the player's tap.
 * Not tapping in time counts as 0.
 */
export function playSpecialStrike(host: HTMLElement): Promise<number> {
  return new Promise((resolve) => {
    const marker = h('div', { class: 'timing-marker' });
    const bar = h('div', { class: 'timing-bar' }, h('div', { class: 'timing-zone' }), h('div', { class: 'timing-perfect' }), marker);
    const label = h('div', { class: 'timing-label' }, 'SPECIAL STRIKE!');
    const hint = h('div', { class: 'timing-hint' }, 'Tap anywhere when the marker is in the middle');
    const overlay = h('div', { class: 'overlay timing' }, label, bar, hint);
    host.append(overlay);

    const start = performance.now();
    let pos = 0;
    let done = false;
    const frame = (now: number) => {
      if (done) return;
      const t = ((now - start) % SPECIAL_PERIOD_MS) / SPECIAL_PERIOD_MS;
      pos = t < 0.5 ? t * 2 : 2 - t * 2;
      marker.style.left = `${pos * 100}%`;
      if (now - start > SPECIAL_TIMEOUT_MS) finish(0);
      else requestAnimationFrame(frame);
    };
    const finish = (quality: number) => {
      if (done) return;
      done = true;
      label.textContent = quality >= 90 ? 'PERFECT!' : quality > 0 ? `${quality}%` : 'MISSED';
      setTimeout(() => {
        overlay.remove();
        resolve(quality);
      }, 450);
    };
    overlay.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      finish(timingQuality(pos));
    });
    requestAnimationFrame(frame);
  });
}
