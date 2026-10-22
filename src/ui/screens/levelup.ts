import { CLASSES, UPGRADES_BY_ID, type SaveData } from '../../core';
import { upgradeDetail, upgradeKindLabel } from '../describe';
import { h } from '../dom';
import { CLASS_COLORS } from '../palette';
import { drawPet, drawWeapon } from '../sprites';
import { slot } from '../widgets';

export function renderLevelUp(root: HTMLElement, save: SaveData, onPick: (upgradeId: string) => void): void {
  const c = save.character;
  const cards = (save.offer ?? []).map((id) => {
    const u = UPGRADES_BY_ID[id]!;
    const classPool = u.pool === 'general' ? null : u.pool;
    const icon = u.kind === 'weapon' ? drawWeapon(u.ref) : u.kind === 'pet' ? drawPet(u.ref) : null;
    return h(
      'button',
      { class: 'choice upgrade', onclick: () => onPick(id) },
      slot(icon, ''),
      h(
        'div',
        { class: 'upgrade-text' },
        h('div', { class: 'choice-title' }, u.name),
        h('div', { class: 'choice-desc' }, upgradeDetail(id)),
        h(
          'div',
          { class: 'tag', style: classPool ? `--tag:${CLASS_COLORS[classPool]}` : '' },
          classPool ? `${upgradeKindLabel(id)}, ${CLASSES[classPool].name} only` : upgradeKindLabel(id),
        ),
      ),
    );
  });

  root.append(
    h(
      'main',
      { class: 'screen levelup' },
      h('h1', {}, `Level ${c.level - save.pendingLevelUps + 1}`),
      h('p', { class: 'lede' }, 'Pick one upgrade. It is permanent.'),
      h('div', { class: 'choice-list' }, ...cards),
    ),
  );
}
