// The Fighter tab: who your fighter is, their stats, and everything they own laid out like
// an inventory. Tap any square to read what it does.
import { CLASSES, GEAR, ORIGINS, PETS, SKILLS, SPELLS, WEAPONS, type SaveData } from '../../core';
import { gearEffects, maxHpOf, maxManaOf, petDetail, totalStats, weaponDetail } from '../describe';
import { h, pixelArt } from '../dom';
import { icon, type IconName } from '../icons';
import { reducedMotion } from '../motion';
import { CLASS_COLORS } from '../palette';
import type { TabActions } from '../shell';
import { drawPet, drawWeapon } from '../sprites';
import { PIXEL } from '../theme';
import { lockedSlot } from '../widgets';

/** Room for a picture inside an inventory square, in screen pixels. */
const SQUARE_ART = 56;

/** Draws a sprite at the game's normal pixel size, or the small one if it would not fit a square. */
function fitted(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const side = Math.max(canvas.width, canvas.height);
  return pixelArt(canvas, side * PIXEL.normal <= SQUARE_ART ? 'normal' : 'small');
}

/** One thing the fighter owns, ready to show in a square. */
interface Item {
  name: string;
  /** What it does, in plain words. */
  detail: string;
  /** The picture in the square: the real sprite, or an icon when there is none. */
  art: () => HTMLElement;
}

/** A row of the inventory: an icon on the left, the squares on the right. */
interface Group {
  icon: IconName;
  label: string;
  items: Item[];
}

export function renderFighterTab(body: HTMLElement, save: SaveData, actions: TabActions): void {
  const c = save.character;
  const stats = totalStats(c);
  const mana = maxManaOf(c);

  const stat = (name: IconName, value: number, label: string) =>
    h('div', { class: 'stat', title: label }, icon(name, label, 'normal'), h('span', { class: 'stat-value' }, String(value)));

  const gearItems = (slot: 'armor' | 'accessory'): Item[] =>
    c.gear
      .filter((id) => GEAR[id]?.slot === slot)
      .map((id) => ({ name: GEAR[id]!.name, detail: `${gearEffects(GEAR[id]!)}. Choose what to wear before each fight.`, art: () => icon(slot, GEAR[id]!.name, 'normal') }));

  const groups: Group[] = [
    {
      icon: 'weapon',
      label: 'Weapons',
      items: c.weapons.map((id) => ({ name: WEAPONS[id]?.name ?? id, detail: weaponDetail(id), art: () => fitted(drawWeapon(id)) })),
    },
    {
      icon: 'pet',
      label: 'Pets',
      items: c.pets.map((id) => ({ name: PETS[id]?.name ?? id, detail: petDetail(id), art: () => fitted(drawPet(id)) })),
    },
    { icon: 'armor', label: 'Armor', items: gearItems('armor') },
    { icon: 'accessory', label: 'Accessory', items: gearItems('accessory') },
    {
      icon: 'skill',
      label: 'Skills',
      items: c.skills.map((id) => ({
        name: SKILLS[id]?.name ?? id,
        detail: SKILLS[id]?.description ?? '',
        // Spells get the magic icon so they stand out from the other skills.
        art: () => icon(SPELLS[id] ? 'magic' : 'skill', SKILLS[id]?.name ?? id, 'normal'),
      })),
    },
  ];

  // The paper note that explains the tapped square (it starts under the inventory as a hint).
  const noteName = h('strong', { class: 'note-name' });
  const noteText = h('p', { class: 'note-text dim' }, 'Tap anything to see what it does.');
  const note = h('div', { class: 'paper-note inv-note', 'aria-live': 'polite' }, noteName, noteText);

  const squares: HTMLButtonElement[] = [];
  function pick(square: HTMLButtonElement, item: Item): void {
    for (const s of squares) s.setAttribute('aria-pressed', String(s === square));
    // The note moves right under the row of the tapped square, so it is read in place.
    square.closest('.inv-row')?.after(note);
    noteName.textContent = item.name;
    noteText.textContent = item.detail;
    noteText.classList.remove('dim');
    note.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  const rows = groups.map((group) => {
    const heading = icon(group.icon, group.label, 'normal');
    const content = group.items.length
      ? group.items.map((item) => {
          // The name under the square already labels the button, so the picture stays silent.
          const art = item.art();
          art.setAttribute('aria-hidden', 'true');
          const square = h(
            'button',
            { class: 'inv-item', type: 'button', 'aria-pressed': 'false' },
            h('span', { class: 'inv-square' }, art),
            h('span', { class: 'inv-name' }, item.name),
          );
          square.addEventListener('click', () => pick(square, item));
          squares.push(square);
          return square;
        })
      : [lockedSlot('Level up to get one')];
    return h('section', { class: 'inv-row', 'aria-label': group.label }, h('div', { class: 'inv-heading' }, heading), h('div', { class: 'inv-items' }, ...content));
  });

  // Two taps to delete, so a stray tap never wipes the save.
  const resetBtn = h('button', { class: 'btn btn-ghost btn-small delete-fighter', type: 'button' }, 'Delete fighter');
  let armed = false;
  resetBtn.addEventListener('click', () => {
    if (armed) return actions.onReset();
    armed = true;
    resetBtn.textContent = 'Tap again to delete';
    setTimeout(() => {
      armed = false;
      resetBtn.textContent = 'Delete fighter';
    }, 3000);
  });

  body.append(
    h(
      'div',
      { class: 'tab-page fighter-tab' },
      h(
        'p',
        { class: 'fighter-id' },
        h('span', { class: 'sticker-sm', style: `color:${CLASS_COLORS[c.classId]}` }, CLASSES[c.classId].name),
        ' ',
        h('span', { class: 'dim' }, `from ${ORIGINS[c.originId]?.name ?? ''}`),
      ),
      // One paper strip of stats; magic and mana only join when the fighter has some.
      h(
        'div',
        { class: 'stats' },
        stat('health', maxHpOf(c), 'Health'),
        stat('strength', stats.strength, 'Strength'),
        stat('agility', stats.agility, 'Agility'),
        stat('speed', stats.speed, 'Speed'),
        stats.magic > 0 ? stat('magic', stats.magic, 'Magic') : '',
        mana > 0 ? stat('mana', mana, 'Mana') : '',
      ),
      h('div', { class: 'inventory' }, ...rows),
      note,
      resetBtn,
    ),
  );
}
