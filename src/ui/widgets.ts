import { rankOf } from '../core';
import { h, pixelArt } from './dom';
import { icon } from './icons';

/** Inventory slot showing the item's real sprite, with its name underneath. */
export function slot(canvas: HTMLCanvasElement, label: string): HTMLElement {
  return h('div', { class: 'slot' }, h('div', { class: 'slot-art' }, pixelArt(canvas, 'normal')), label);
}

/** A padlocked square with a short line next to it, for an inventory group that is still empty. */
export function lockedSlot(label: string): HTMLElement {
  const lock = icon('lock', 'Locked', 'normal');
  lock.setAttribute('aria-hidden', 'true');
  return h('div', { class: 'locked-slot' }, h('span', { class: 'inv-square' }, lock), h('span', { class: 'locked-text' }, label));
}

/** A row of squares, `on` of them filled. */
export function pips(on: number, total: number, label: string): HTMLElement {
  return h(
    'div',
    { class: 'pips', role: 'img', 'aria-label': label },
    ...Array.from({ length: total }, (_, i) => h('span', { class: i < on ? 'pip on' : 'pip' })),
  );
}

/** The screen's main action, kept at the bottom of the screen within reach of the thumb. */
export function actionBar(...children: (Node | string)[]): HTMLElement {
  return h('div', { class: 'action-bar' }, ...children);
}

/** A small sticker with the fighter's rank, e.g. "Veteran". Its colour grows with the rank. */
export function rankBadge(level: number): HTMLElement {
  const rank = rankOf(level);
  return h('span', { class: `rank-badge rank-${rank.id}` }, rank.name);
}
