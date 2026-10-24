import { PETS, WEAPONS, rankOf } from '../core';
import { h, pixelArt } from './dom';
import { drawPet, drawWeapon } from './sprites';

/** Inventory slot showing the item's real sprite, with its name underneath. */
export function slot(canvas: HTMLCanvasElement | null, label: string): HTMLElement {
  return h(
    'div',
    { class: canvas ? 'slot' : 'slot slot-empty' },
    h('div', { class: 'slot-art' }, canvas ? pixelArt(canvas, 'normal') : ''),
    label,
  );
}

export const weaponSlot = (id: string) => slot(drawWeapon(id), WEAPONS[id]?.name ?? id);
export const petSlot = (id: string) => slot(drawPet(id), PETS[id]?.name ?? id);

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
