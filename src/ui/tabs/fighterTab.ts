// The Fighter tab: who your fighter is, their stats, and everything they own laid out like
// an inventory. Tap any square to read what it does.
import { BOSSES, BRANCHES_BY_ID, CLASSES, GEAR, ORIGINS, PETS, SKILLS, SPELLS, WEAPONS, availableTitles, canGraduate, featsFor, setTitle, type SaveData } from '../../core';
import { STAT_NOTES, gearEffects, maxHpOf, maxManaOf, petDetail, totalStats, weaponDetail } from '../describe';
import { h, pixelArt } from '../dom';
import { icon, type IconName } from '../icons';
import { reducedMotion } from '../motion';
import { CLASS_COLORS } from '../palette';
import type { TabActions } from '../shell';
import { drawPet, drawWeapon } from '../sprites';
import { PIXEL } from '../theme';
import { lockedSlot, openSheet, showTopTitle } from '../widgets';

/** Size of an inventory square in screen pixels (style.css reads it as --inv-square). */
const SQUARE = 52;
/** Room for a picture inside a square: the square minus its border and a little air. */
const SQUARE_ART = SQUARE - 8;

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

/** A group of the inventory: a small heading, then its squares in the grid. */
interface Group {
  icon: IconName;
  label: string;
  items: Item[];
}

/** One row of the feats list: a medal (grey until earned), the goal, and the progress. */
function featRow(name: string, description: string, done: boolean, progress: string, title?: string): HTMLElement {
  const medal = icon('medal', done ? 'Medal earned' : 'Not earned yet', 'normal');
  return h(
    'li',
    { class: done ? 'feat done' : 'feat' },
    h('span', { class: 'feat-medal' }, medal),
    h(
      'span',
      { class: 'feat-text' },
      h('strong', { class: 'feat-name' }, name),
      h('span', { class: 'feat-desc' }, description),
      title ? h('span', { class: 'feat-title' }, `Title: ${title}`) : '',
    ),
    h('span', { class: 'feat-progress' }, progress),
  );
}

/** The title picker (only once a title is earned) and the list of feats with their progress. */
function featsSection(save: SaveData, actions: TabActions): HTMLElement {
  const c = save.character;
  const medals = c.medals ?? [];
  const feats = featsFor(c);

  const rows = feats.map((feat) => {
    const done = medals.includes(feat.id);
    // A secret stays hidden until it is earned.
    if (feat.secret && !done) return featRow('???', 'A secret feat. Keep fighting to find it.', false, '?');
    const target = feat.target ?? 1;
    const progress = done ? 'Done' : target > 1 ? `${c.featProgress?.[feat.id] ?? 0}/${target}` : '';
    return featRow(feat.name, feat.description, done, progress, feat.title);
  });
  // Bosses beaten earn a medal too; they are not feats, so they get their own rows.
  for (const boss of Object.values(BOSSES)) {
    if (medals.includes(`boss_${boss.id}`)) rows.push(featRow(`Beat ${boss.name}`, `Win against ${boss.name} at level ${boss.level}.`, true, 'Done'));
  }

  const titles = availableTitles(c);
  const picker = titles.length
    ? h('div', { class: 'title-picker' }, h('p', { class: 'title-label' }, 'Your title'), titleButtons(c, titles, actions))
    : '';

  const medalIcon = icon('medal', 'Medals', 'normal');
  return h(
    'section',
    { class: 'feats', 'aria-label': 'Feats' },
    h('h2', { class: 'section-icon' }, medalIcon, `Feats (${medals.length})`),
    picker,
    h('ul', { class: 'feat-list' }, ...rows),
  );
}

/** "None" plus one button per earned title. The chosen one is pressed; it shows in the top bar at once. */
function titleButtons(c: SaveData['character'], titles: string[], actions: TabActions): HTMLElement {
  const options: (string | undefined)[] = [undefined, ...titles];
  const buttons = options.map((title) => {
    const button = h('button', { class: 'segment', type: 'button', 'aria-pressed': String(c.title === title) }, title ?? 'No title');
    button.addEventListener('click', () => {
      setTitle(c, title);
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
      showTopTitle(title);
      actions.onSave();
    });
    return button;
  });
  return h('div', { class: 'segments title-segments', role: 'group', 'data-count': options.length, style: `--count:${Math.min(options.length, 2)}` }, ...buttons);
}

export function renderFighterTab(body: HTMLElement, save: SaveData, actions: TabActions): void {
  const c = save.character;
  const stats = totalStats(c);
  const mana = maxManaOf(c);

  // Tap a stat to read what it does; tap it again to hide the note.
  const statNote = h('p', { class: 'stat-note hidden', 'aria-live': 'polite' });
  const statButtons: HTMLElement[] = [];
  const stat = (name: keyof typeof STAT_NOTES, value: number, label: string) => {
    const btn = h('button', { class: 'stat', type: 'button', 'aria-pressed': 'false', 'aria-label': `${label} ${value}` }, icon(name, label, 'normal'), h('span', { class: 'stat-value' }, String(value)));
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-pressed') !== 'true';
      for (const b of statButtons) b.setAttribute('aria-pressed', String(open && b === btn));
      statNote.textContent = STAT_NOTES[name];
      statNote.classList.toggle('hidden', !open);
    });
    statButtons.push(btn);
    return btn;
  };

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
    // Armor and accessories share one group; each piece keeps its slot's icon.
    { icon: 'armor', label: 'Gear', items: [...gearItems('armor'), ...gearItems('accessory')] },
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
    const headingIcon = icon(group.icon, '', 'small');
    headingIcon.setAttribute('aria-hidden', 'true');
    const content = group.items.length
      ? group.items.map((item) => {
          // The name under the square already labels the button, so the picture stays silent.
          const art = item.art();
          art.setAttribute('aria-hidden', 'true');
          const square = h(
            'button',
            { class: 'inv-item', type: 'button', 'aria-pressed': 'false' },
            h('span', { class: 'inv-square' }, art),
            // A long single word (Switchblade) shrinks a little instead of breaking in two.
            h('span', { class: 'inv-name', style: `--name-fit:${Math.min(1, 9 / Math.max(9, ...item.name.split(' ').map((w) => w.length))).toFixed(2)}` }, item.name),
          );
          square.addEventListener('click', () => pick(square, item));
          squares.push(square);
          return square;
        })
      : [lockedSlot('Level up to get one')];
    return h('section', { class: 'inv-row', 'aria-label': group.label }, h('h3', { class: 'inv-heading' }, headingIcon, group.label), h('div', { class: 'inv-items' }, ...content));
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

  // Level 20 and the Champion beaten: the fighter can retire as a legend (after a confirm sheet).
  const graduateBtn = canGraduate(save) ? h('button', { class: 'btn btn-primary btn-big graduate', type: 'button' }, icon('medal', '', 'normal'), 'Graduate') : '';
  if (graduateBtn) {
    graduateBtn.addEventListener('click', () => {
      const yes = h('button', { class: 'btn btn-primary btn-big', type: 'button' }, 'Graduate');
      const no = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Not yet');
      const close = openSheet(
        `Graduate ${c.name}`,
        h('h2', {}, `Graduate ${c.name}?`),
        h('p', { class: 'lede' }, 'They retire as a legend and keep their medals forever. Then you start a new fighter.'),
        h('div', { class: 'sheet-actions' }, yes, no),
      );
      no.addEventListener('click', close);
      yes.addEventListener('click', () => {
        close();
        actions.onGraduate();
      });
    });
  }

  body.append(
    h(
      'div',
      { class: 'tab-page fighter-tab' },
      graduateBtn,
      h(
        'p',
        { class: 'fighter-id' },
        h('span', { class: 'sticker-sm', style: `color:${CLASS_COLORS[c.classId]}` }, CLASSES[c.classId].name),
        // The branch (from level 5) follows the class, in a softer shade of the class colour.
        c.branch ? h('span', { class: 'fighter-branch', style: `--branch:${CLASS_COLORS[c.classId]}` }, ` · ${BRANCHES_BY_ID[c.branch].name}`) : '',
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
      statNote,
      h('div', { class: 'inventory', style: `--inv-square:${SQUARE}px` }, ...rows),
      note,
      featsSection(save, actions),
      resetBtn,
    ),
  );
}
