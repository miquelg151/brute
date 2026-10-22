import { PETS, WEAPONS } from '../core';
import { h, pixelArt } from './dom';
import { drawPet, drawWeapon } from './sprites';

/** Inventory slot showing the item's real sprite, with its name underneath. */
export function slot(canvas: HTMLCanvasElement | null, label: string): HTMLElement {
  return h(
    'div',
    { class: canvas ? 'slot' : 'slot slot-empty' },
    h('div', { class: 'slot-art' }, canvas ? pixelArt(canvas, canvas.width > 12 ? 3 : 4) : ''),
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
