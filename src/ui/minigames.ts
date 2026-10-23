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

const WARMUP_MS = 8000;
const TARGET_EVERY_MS = 600;
const TARGET_LIFE_MS = 950;

/**
 * Warm-up: tap the targets as they pop up. Resolves with the share of targets
 * hit (0-100).
 */
export function playWarmup(host: HTMLElement): Promise<number> {
  return new Promise((resolve) => {
    const field = h('div', { class: 'warmup-field' });
    const status = h('div', { class: 'warmup-status' }, 'Hit the targets!');
    const overlay = h('div', { class: 'overlay warmup' }, status, field);
    host.append(overlay);

    let spawned = 0;
    let hits = 0;
    const spawn = () => {
      spawned++;
      const target = h('button', { class: 'warmup-target', 'aria-label': 'Target' });
      target.style.left = `${5 + Math.random() * 80}%`;
      target.style.top = `${5 + Math.random() * 75}%`;
      target.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        hits++;
        status.textContent = `Hits: ${hits}`;
        target.remove();
      });
      field.append(target);
      setTimeout(() => target.remove(), TARGET_LIFE_MS);
    };
    spawn();
    const timer = setInterval(spawn, TARGET_EVERY_MS);
    setTimeout(() => {
      clearInterval(timer);
      const score = spawned === 0 ? 0 : Math.round((100 * hits) / spawned);
      field.replaceChildren();
      status.textContent = `Score: ${score}`;
      setTimeout(() => {
        overlay.remove();
        resolve(score);
      }, 900);
    }, WARMUP_MS);
  });
}
