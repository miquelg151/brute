import { CLASSES, GEAR, SPELLS, UPGRADES_BY_ID, type SaveData } from '../../core';
import { upgradeDetail, upgradeKindLabel } from '../describe';
import { h } from '../dom';
import { icon, type IconName } from '../icons';
import { pause } from '../motion';
import { CLASS_COLORS } from '../palette';
import { drawPet, drawWeapon } from '../sprites';
import { slot } from '../widgets';

export function renderLevelUp(root: HTMLElement, save: SaveData, onPick: (upgradeId: string) => void): void {
  const c = save.character;
  let picked = false;
  // The chosen card gets stamped, the others fall away, then the game moves on.
  const pick = async (id: string, card: HTMLElement) => {
    if (picked) return;
    picked = true;
    cards.forEach((other) => other.classList.add(other === card ? 'stamped' : 'dropped'));
    await pause(450);
    onPick(id);
  };
  const cards = (save.offer ?? []).map((id) => {
    const u = UPGRADES_BY_ID[id]!;
    const classPool = u.pool === 'general' ? null : u.pool;
    const art = u.kind === 'weapon' ? drawWeapon(u.ref) : u.kind === 'pet' ? drawPet(u.ref) : null;
    // Stat upgrades show the icon of the stat they raise most; skills show the skill icon.
    const mainStat = (
      u.kind === 'stat'
        ? Object.entries(u.stats).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0]
        : u.kind === 'gear'
          ? GEAR[u.ref]?.slot
          : SPELLS[u.ref]
            ? 'magic'
            : 'skill'
    ) as IconName;
    const picture = art ? slot(art, '') : h('div', { class: 'slot' }, h('div', { class: 'slot-art' }, icon(mainStat, u.name, 'normal')));
    return h(
      'button',
      { class: 'choice upgrade', onclick: (e: Event) => void pick(id, e.currentTarget as HTMLElement) },
      picture,
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
