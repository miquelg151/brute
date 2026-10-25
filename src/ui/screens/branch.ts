// Choosing a path at level 5: the fighter stands on the street (like in creation) and the
// class's two branches wait under them as big paper choices. Pick one, then confirm.
import { BRANCHES, CLASSES, type BranchId, type SaveData } from '../../core';
import { h, pixelArt } from '../dom';
import { drawIcon, icon, type IconName } from '../icons';
import { CLASS_COLORS } from '../palette';
import { drawFighter } from '../sprites';
import { HOME_STREET_SEED, streetCanvas } from '../street';

/** An icon's name in plain words for screen readers, e.g. 'manyHits' -> 'many hits'. */
function iconWords(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').toLowerCase();
}

/** One of a branch's three icons. Wide ones (the fist) are drawn smaller, so all three look the same size. */
function branchIcon(name: IconName): HTMLElement {
  const art = drawIcon(name);
  const label = iconWords(name);
  return h('span', { class: 'icon', role: 'img', 'aria-label': label, title: label }, pixelArt(art, art.width > 9 ? 'small' : 'normal'));
}

export function renderBranch(root: HTMLElement, save: SaveData, onChoose: (id: BranchId) => void): void {
  const c = save.character;
  const color = CLASS_COLORS[c.classId];
  let picked: BranchId | null = null;

  const confirmBtn = h('button', { class: 'btn btn-primary create-next branch-confirm', type: 'button', disabled: true }, 'Confirm');

  // The two branches: the name in the class colour, one line, and three icons of what is inside.
  const choices = BRANCHES[c.classId].map((b, i) => {
    const icons = b.icons.map((name) => branchIcon(name as IconName));
    const choice = h(
      'button',
      { class: 'choice branch-choice', type: 'button', style: `--accent:${color};--tilt:${i ? 0.6 : -0.6}deg`, 'aria-pressed': 'false' },
      h('div', { class: 'branch-head' }, h('div', { class: 'choice-title', style: `color:${color}` }, b.name), h('div', { class: 'branch-icons' }, ...icons)),
      h('div', { class: 'choice-desc' }, b.description),
    );
    choice.addEventListener('click', () => {
      picked = b.id;
      for (const other of choices) {
        other.classList.toggle('selected', other === choice);
        other.setAttribute('aria-pressed', String(other === choice));
      }
      confirmBtn.disabled = false;
      confirmBtn.textContent = `Be a ${b.name}`;
    });
    return choice;
  });

  confirmBtn.addEventListener('click', () => {
    if (picked) onChoose(picked);
  });

  const lock = icon('lock', 'Final');
  lock.setAttribute('aria-hidden', 'true');

  const street = streetCanvas(HOME_STREET_SEED).toDataURL();
  root.append(
    h(
      'main',
      { class: 'screen branch' },
      h(
        'div',
        { class: 'fight-arena create-stage', style: `--street:url(${street})` },
        h('h1', { class: 'create-title' }, 'Choose your path'),
        h('div', { class: 'spot' }, pixelArt(drawFighter(c), 'big')),
      ),
      h(
        'div',
        { class: 'create-body' },
        h(
          'section',
          { class: 'create-panel create-centred' },
          h('p', { class: 'lede small' }, h('span', { style: `color:${color}` }, CLASSES[c.classId].name), `, level ${c.level}. Pick your style.`),
          h('div', { class: 'branch-choices' }, ...choices),
          h('p', { class: 'branch-final small' }, lock, 'This choice is for good.'),
        ),
      ),
      h('footer', { class: 'create-footer branch-footer' }, confirmBtn),
    ),
  );
}
