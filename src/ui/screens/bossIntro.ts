// The boss steps out before the fight: the boss on the street, the line that introduces
// them, and what their trick does. One button goes on to the normal pre-fight screen.
import { BOSSES, type SaveData } from '../../core';
import { h, pixelArt } from '../dom';
import { icon, skillIcon } from '../icons';
import { drawFighter } from '../sprites';
import { HOME_STREET_SEED, streetCanvas } from '../street';

export function renderBossIntro(root: HTMLElement, save: SaveData, onContinue: () => void): void {
  const fight = save.pendingFight!;
  const boss = BOSSES[fight.bossId!];
  const street = streetCanvas(HOME_STREET_SEED).toDataURL();

  const goBtn = h('button', { class: 'btn btn-primary create-next branch-confirm', type: 'button' }, 'Face them');
  goBtn.addEventListener('click', onContinue);

  const trickIcon = icon(skillIcon(boss.trick), 'Trick', 'normal');
  trickIcon.setAttribute('aria-hidden', 'true');

  root.append(
    h(
      'main',
      { class: 'screen branch boss-intro' },
      h(
        'div',
        { class: 'fight-arena create-stage', style: `--street:url(${street})` },
        h('h1', { class: 'create-title' }, boss.name),
        h('div', { class: 'spot boss-spot' }, pixelArt(drawFighter(fight.opponent), 'big')),
      ),
      h(
        'div',
        { class: 'create-body' },
        h(
          'section',
          { class: 'create-panel create-centred' },
          h('p', { class: 'boss-level sticker-sm' }, `Boss · Level ${boss.level}`),
          h('p', { class: 'lede boss-line' }, boss.intro),
          h('div', { class: 'paper-note boss-trick' }, h('strong', { class: 'note-name' }, trickIcon, 'Trick'), h('p', { class: 'note-text' }, boss.trickText)),
        ),
      ),
      h('footer', { class: 'create-footer branch-footer' }, goBtn),
    ),
  );
}
