import { CLASSES, GEAR, SPELLS, UPGRADES_BY_ID, isCrossClass, rankOf, type SaveData } from '../../core';
import { cardSticker } from '../cardView';
import { upgradeDetail, upgradeKindLabel } from '../describe';
import { h, pixelArt } from '../dom';
import { icon, type IconName } from '../icons';
import { pause } from '../motion';
import { CLASS_COLORS } from '../palette';
import { drawFighter, drawPet, drawWeapon } from '../sprites';
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
    const picture =
      u.kind === 'card' ? cardSticker(u.ref, 1, { size: 'small' }) : art ? slot(art, '') : h('div', { class: 'slot' }, h('div', { class: 'slot-art' }, icon(mainStat, u.name, 'normal')));
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
          // The level-15 slot from another class says so, in that class's colour.
          isCrossClass(c, id)
            ? 'From another class'
            : classPool
              ? `${upgradeKindLabel(id)}, ${CLASSES[classPool].name} only`
              : upgradeKindLabel(id),
        ),
      ),
    );
  });

  // The level being reached now (several level-ups can wait in a row).
  const reached = c.level - save.pendingLevelUps + 1;
  const rank = rankOf(reached);
  // A new rank gets a small celebration: the fighter with their new look, and its name.
  // It slaps on with the screen's entrance (the `.spot` and `.rank-up h2` are in the sticker list in motion.ts).
  const rankUp =
    rank.id !== rankOf(reached - 1).id
      ? h(
          'section',
          { class: 'rank-up' },
          h('div', { class: rank.id === 'legend' ? 'spot spot-big legend' : 'spot spot-big' }, pixelArt(drawFighter({ ...c, level: reached }), 'normal')),
          h('h2', {}, `You are now a ${rank.name}!`),
        )
      : '';

  root.append(
    h(
      'main',
      { class: 'screen levelup' },
      h('h1', {}, `Level ${reached}`),
      rankUp,
      h('p', { class: 'lede' }, 'Pick one upgrade. It is permanent.'),
      h('div', { class: 'choice-list' }, ...cards),
    ),
  );
}
