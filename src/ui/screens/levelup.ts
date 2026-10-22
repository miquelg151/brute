import { CLASSES, UPGRADES_BY_ID, type SaveData } from '../../core';
import { upgradeDetail, upgradeKindLabel } from '../describe';
import { h } from '../dom';
import { CLASS_COLORS } from '../palette';

export function renderLevelUp(root: HTMLElement, save: SaveData, onPick: (upgradeId: string) => void): void {
  const c = save.character;
  const cards = (save.offer ?? []).map((id) => {
    const u = UPGRADES_BY_ID[id]!;
    const poolLabel = u.pool === 'general' ? 'General' : CLASSES[u.pool].name;
    const poolColor = u.pool === 'general' ? 'var(--muted)' : CLASS_COLORS[u.pool];
    return h(
      'button',
      { class: 'choice upgrade', onclick: () => onPick(id) },
      h('div', { class: 'choice-meta', style: `color:${poolColor}` }, `${upgradeKindLabel(id)} - ${poolLabel}`),
      h('div', { class: 'choice-title' }, u.name),
      h('div', { class: 'choice-desc' }, upgradeDetail(id)),
    );
  });

  root.append(
    h(
      'main',
      { class: 'screen levelup' },
      h('h1', {}, `Level ${c.level - save.pendingLevelUps + 1}!`),
      h('p', { class: 'muted' }, 'Choose one upgrade.'),
      h('div', { class: 'choice-list' }, ...cards),
    ),
  );
}
