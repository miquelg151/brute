import Phaser from 'phaser';
import {
  CARDS,
  MAX_ENERGY,
  START_ENERGY,
  STANCES,
  TARGETS,
  WEAPON_STYLES,
  finishFight,
  recordBreak,
  recordPlay,
  simulateFight,
  traitsOf,
  type BreakChoice,
  type Plan,
  type SaveData,
} from '../../core';
import { ARENA_H, ARENA_W, ARENA_ZOOM, ReplayScene, type BreakEvent, type FighterState } from '../../fight/ReplayScene';
import { cardSticker, levelOf } from '../cardView';
import { h } from '../dom';
import { icon, iconValue } from '../icons';
import { playSpecialStrike } from '../minigames';
import { planEditor, weaponPicker } from '../plan';
import { PAL } from '../theme';

const SPEEDS = [1, 2, 4];
const SKIP_SPEED = 40;
const ROUNDS = 3;
/** How long the enemy's card sticker stays up (ms). */
const ENEMY_CARD_MS = 1500;
/** Below this much stamina the bar turns orange. */
const LOW_STAMINA = 25;

const planText = (c: BreakChoice) =>
  `${STANCES[c.stance].name}, ${TARGETS[c.target].name.toLowerCase()}, ${WEAPON_STYLES[c.weaponStyle].name.toLowerCase()} weapons${c.recover ? ', and they will recover' : ''}.`;

const percent = (value: number, max: number) => `${max > 0 ? Math.max(0, Math.min(100, (100 * value) / max)) : 0}%`;

/** One fighter's name, health, stamina and mana above the arena. */
function fighterHud(side: 'left' | 'right') {
  const name = h('span', { class: 'hud-name' });
  const hpValue = h('span', { class: 'hud-hp' });
  const hp = h('div', { class: 'meter-fill' });
  const hpMeter = h('div', { class: 'meter meter-hp', role: 'img' }, hp);
  const stamina = h('div', { class: 'meter-fill' });
  const staminaMeter = h('div', { class: 'meter meter-stamina', role: 'img' }, stamina);
  const mana = h('div', { class: 'meter-fill' });
  const manaMeter = h('div', { class: 'meter meter-mana hidden', role: 'img' }, mana);
  const el = h('div', { class: `hud-side ${side}` }, h('div', { class: 'hud-top' }, name, hpValue), hpMeter, staminaMeter, manaMeter);

  const update = (f: FighterState) => {
    name.textContent = f.name;
    hpValue.textContent = String(Math.max(0, f.hp));
    hp.style.width = percent(f.hp, f.maxHp);
    hpMeter.setAttribute('aria-label', `${f.name}: ${Math.max(0, f.hp)} of ${f.maxHp} health`);
    stamina.style.width = percent(f.stamina, f.maxStamina);
    staminaMeter.classList.toggle('low', f.stamina < LOW_STAMINA);
    staminaMeter.setAttribute('aria-label', `Stamina ${f.stamina}`);
    manaMeter.classList.toggle('hidden', f.maxMana <= 0);
    mana.style.width = percent(f.mana, f.maxMana);
    manaMeter.setAttribute('aria-label', `Mana ${f.mana}`);
  };
  return { el, update };
}

function fighterLine(f: FighterState): HTMLElement {
  return h(
    'div',
    { class: 'break-fighter' },
    h('strong', {}, f.name),
    h(
      'span',
      { class: 'icon-row' },
      iconValue('health', 'Health', `${f.hp}/${f.maxHp}`),
      iconValue('stamina', 'Stamina', f.stamina),
      f.maxMana > 0 ? iconValue('mana', 'Mana', f.mana) : '',
    ),
  );
}

/**
 * The break between rounds, as a sheet that slides up over the arena.
 * Resolves with the player's choice for the next round.
 * In live fights the opponent's choice is not shown.
 */
function breakSheet(save: SaveData, event: BreakEvent, fighters: [FighterState, FighterState]): Promise<BreakChoice> {
  const fight = save.pendingFight!;
  const previous: Plan = fight.inputs.breaks.at(-1) ?? fight.tactics!;
  const plan: Plan = { stance: previous.stance, target: previous.target, weaponStyle: previous.weaponStyle };
  const weapons = new Set(fight.inputs.breaks.at(-1)?.weapons ?? fight.tactics!.weapons);
  let recover = false;
  const foeChoice = event.choices[1];

  return new Promise((resolve) => {
    const recoverBtns = [false, true].map((value) => {
      const btn = h(
        'button',
        { class: 'choice option' },
        h('div', { class: 'choice-title' }, value ? 'Recover' : 'Keep going'),
        h(
          'ul',
          { class: 'effects' },
          ...(value
            ? [h('li', { class: 'up' }, '▲ Much more stamina and mana'), h('li', { class: 'down' }, '▼ Start the round late')]
            : [h('li', { class: 'flat' }, 'Normal rest between rounds')]),
        ),
      );
      btn.classList.toggle('selected', value === recover);
      btn.addEventListener('click', () => {
        recover = value;
        recoverBtns.forEach((b, i) => b.classList.toggle('selected', (i === 1) === recover));
      });
      return btn;
    });

    const nextBtn = h('button', { class: 'btn btn-primary btn-big' }, `Start round ${event.round + 1}`);
    const sheet = h(
      'section',
      { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Round ${event.round} is over` },
      h('div', { class: 'sheet-handle', 'aria-hidden': 'true' }),
      h('h2', { class: 'section-icon' }, icon('round', 'Break', 'normal'), `Round ${event.round} is over`),
      h('div', { class: 'card' }, fighterLine(fighters[0]), fighterLine(fighters[1])),
      h(
        'p',
        { class: 'lede small' },
        fight.live
          ? `${fighters[1].name} is choosing too. You won't know their plan until the round starts.`
          : foeChoice
            ? `${fighters[1].name} will go ${planText(foeChoice)}`
            : '',
      ),
      ...planEditor(plan, traitsOf(fight.opponent)),
      save.character.weapons.length > 0
        ? h(
            'section',
            {},
            h('h2', {}, 'Weapons'),
            h('p', { class: 'lede small' }, 'Thrown weapons are gone for the rest of this fight.'),
            weaponPicker(save.character.weapons, weapons),
          )
        : '',
      h('h2', {}, 'Rest'),
      h('div', { class: 'choice-grid' }, ...recoverBtns),
      // The button stays at the bottom of the sheet while its content scrolls.
      h('div', { class: 'sheet-actions' }, nextBtn),
    );
    const backdrop = h('div', { class: 'sheet-backdrop' }, sheet);
    nextBtn.addEventListener('click', () => {
      backdrop.remove();
      document.body.classList.remove('sheet-open');
      resolve({ ...plan, weapons: [...weapons], recover });
    });
    document.body.classList.add('sheet-open');
    document.body.append(backdrop);
  });
}

/** Plays the started pending fight. Every input is saved as soon as it is made. */
export function renderFight(root: HTMLElement, save: SaveData, store: () => void, onDone: () => void): void {
  const opponent = save.pendingFight!.opponent;
  const huds = [fighterHud('left'), fighterHud('right')] as const;
  const roundText = h('span', {}, `1/${ROUNDS}`);
  const hud = h(
    'header',
    { class: 'hud' },
    huds[0].el,
    h('div', { class: 'hud-round', title: 'Round' }, icon('round', 'Round', 'small'), roundText),
    huds[1].el,
  );
  const arena = h('div', { class: 'arena', style: `aspect-ratio:${ARENA_W} / ${ARENA_H}` });

  const speedLabel = h('span', {}, 'x1');
  const speedBtn = h('button', { class: 'btn btn-small btn-with-icon', 'aria-label': 'Speed' }, icon('fast', 'Speed', 'normal'), speedLabel);
  const skipBtn = h('button', { class: 'btn btn-small btn-icon', 'aria-label': 'Skip to the next decision' }, icon('skip', 'Skip', 'normal'));
  const controls = h('div', { class: 'fight-controls' }, speedBtn, skipBtn);
  // Energy bar and the cards of the deck: tap a card to play it at the next tick.
  const energyFill = h('div', { class: 'meter-fill' });
  const energyText = h('span', { class: 'energy-text' }, `${START_ENERGY}/${MAX_ENERGY}`);
  const energyBar = h('div', { class: 'energy' }, icon('speed', 'Energy', 'normal'), h('div', { class: 'meter meter-energy' }, energyFill), energyText);
  energyFill.style.width = `${(START_ENERGY * 100) / MAX_ENERGY}%`;
  let energy = START_ENERGY;
  const deck = save.pendingFight!.tactics!.deck;
  const cardButtons = deck.map((id) => {
    const btn = h('button', { class: 'card-button', 'aria-label': `${CARDS[id]!.name}, costs ${CARDS[id]!.cost} energy` }, cardSticker(id, levelOf(save.character.cardUses, id)));
    btn.addEventListener('click', () => {
      // One card waits at a time.
      if (cardButtons.some((b) => b.classList.contains('queued'))) return;
      btn.classList.add('queued');
      scene.queuePlay(id, id === 'special' ? specialQuality : undefined);
    });
    return btn;
  });
  const cardRow = h('div', { class: 'card-row' }, ...cardButtons);
  const refreshCards = () => deck.forEach((id, i) => (cardButtons[i]!.disabled = energy < CARDS[id]!.cost));
  const clearQueued = () => cardButtons.forEach((b) => b.classList.remove('queued'));
  refreshCards();
  const summary = h('div', { class: 'card fight-summary hidden' });
  const continueBtn = h('button', { class: 'btn btn-primary btn-big hidden' }, 'Continue');
  // Everything under the arena. The special strike uses all of it as its tap area.
  const zone = h('section', { class: 'fight-zone' }, controls, energyBar, cardRow, summary, continueBtn);

  /** The timing bar of the Special Strike card: hides the cards while it is up. */
  const specialQuality = async () => {
    cardRow.classList.add('hidden');
    const quality = await playSpecialStrike(zone);
    cardRow.classList.remove('hidden');
    return quality;
  };

  /** The enemy's card, slapped on their side for a moment. */
  const enemyCardSticker = (card: string) => {
    const el = h('div', { class: 'enemy-card' }, CARDS[card]?.name ?? card);
    setTimeout(() => el.remove(), ENEMY_CARD_MS);
    return el;
  };

  root.append(h('main', { class: 'screen fight' }, hud, arena, zone));

  let speedIndex = 0;
  // After a decision the fight goes on at the chosen speed, even if Skip brought it there.
  const resumeSpeed = () => scene.setSpeed(SPEEDS[speedIndex]!);

  // Created after the arena is in the DOM: Phaser sizes the canvas from its parent.
  const scene = new ReplayScene(simulateFight(save), {
    requestBreak: async (event, fighters) => {
      const choice = await breakSheet(save, event, fighters);
      recordBreak(save, choice);
      store();
      resumeSpeed();
    },
    resimulate: () => simulateFight(save),
    onFighter: (team, state) => huds[team].update(state),
    onRound: (round) => (roundText.textContent = `${round}/${ROUNDS}`),
    recordPlay: (play) => {
      recordPlay(save, play);
      store();
      // The play is saved; if the simulation could not afford it, nothing stays marked.
      clearQueued();
    },
    onEnergy: (team, value) => {
      if (team !== 0) return;
      energy = value;
      energyFill.style.width = `${(value * 100) / MAX_ENERGY}%`;
      energyText.textContent = `${value}/${MAX_ENERGY}`;
      refreshCards();
    },
    onCard: (team, card) => {
      if (team === 1) huds[1].el.append(enemyCardSticker(card));
      else clearQueued();
    },
    onFinished: () => {
      const result = finishFight(save);
      store();
      summary.append(
        h('div', { class: `result ${result.won ? 'win' : 'loss'}` }, result.won ? `You beat ${opponent.name}` : `${opponent.name} won`),
        h('div', { class: 'dim' }, iconValue('xp', 'Experience', `+${result.xpGained}`), result.levelsGained > 0 ? ' Level up!' : ''),
      );
      for (const [card, count] of Object.entries(result.cardsPlayed)) {
        summary.append(h('div', { class: 'small' }, `${CARDS[card]?.name ?? card} +${count} use${count > 1 ? 's' : ''}`));
      }
      for (const up of result.cardLevelUps) summary.append(h('div', { class: 'result win' }, `${CARDS[up.card]?.name ?? up.card} → level ${up.level}!`));
      controls.classList.add('hidden');
      energyBar.classList.add('hidden');
      cardRow.classList.add('hidden');
      for (const el of [summary, continueBtn]) {
        el.classList.remove('hidden');
        el.classList.add('slap');
      }
    },
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: arena,
    width: ARENA_W * ARENA_ZOOM,
    height: ARENA_H * ARENA_ZOOM,
    pixelArt: true,
    backgroundColor: PAL.night,
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    scene,
  });

  speedBtn.addEventListener('click', () => {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    const speed = SPEEDS[speedIndex]!;
    speedLabel.textContent = `x${speed}`;
    scene.setSpeed(speed);
  });
  // Skip races to the next decision (special or break) and stops there, since those need the player.
  skipBtn.addEventListener('click', () => scene.setSpeed(SKIP_SPEED));
  continueBtn.addEventListener('click', () => {
    game.destroy(true);
    onDone();
  });
}
