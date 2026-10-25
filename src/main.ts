import '@fontsource-variable/shantell-sans/full.css';
import './style.css';
import { chooseFighterBranch, chooseUpgrade, needsBranch, prepareFight, prepareLevelUp, startFight, type SaveData } from './core';
import { loadArt } from './ui/art';
import { animateIn } from './ui/motion';
import { applyTheme } from './ui/theme';
import { renderBranch } from './ui/screens/branch';
import { renderCreate } from './ui/screens/create';
import { renderFight } from './ui/screens/fight';
import { renderGallery } from './ui/screens/gallery';
import { renderLevelUp } from './ui/screens/levelup';
import { renderPrefight } from './ui/screens/prefight';
import { renderTitle } from './ui/screens/title';
import { renderShell } from './ui/shell';
import { clearSave, loadSave, storeSave } from './ui/storage';

applyTheme();

const root = document.getElementById('app')!;
let save: SaveData | null = loadSave();
/** The title screen is shown once, before creating the first fighter. */
let titleShown = false;

/** Draws the screen that fits the current save, with its entrance animation. */
function show(): void {
  root.replaceChildren();
  window.scrollTo(0, 0);
  render();
  // The shell, creation, the branch choice and pre-fight use the whole screen, so #app drops its padding (see style.css).
  root.classList.toggle('full-screen', !!root.querySelector(':scope > .shell, :scope > .create, :scope > .branch, :scope > .prefight'));
  animateIn(root);
}

function render(): void {
  const current = save;

  if (!current && !titleShown) {
    renderTitle(root, () => {
      titleShown = true;
      show();
    });
    return;
  }

  if (!current) {
    renderCreate(root, (created) => {
      save = created;
      storeSave(created);
      show();
    });
    return;
  }

  // A fight already locked in plays first, so reloading never skips or changes it.
  const fight = current.pendingFight;
  if (fight?.tactics) {
    renderFight(root, current, () => storeSave(current), show);
    return;
  }

  // At level 5 the fighter picks a path, before the level-up choice (so the offer can hold its items).
  if (needsBranch(current.character)) {
    renderBranch(root, current, (branchId) => {
      chooseFighterBranch(current, branchId);
      storeSave(current);
      show();
    });
    return;
  }

  if (current.offer) {
    renderLevelUp(root, current, (upgradeId) => {
      chooseUpgrade(current, upgradeId);
      storeSave(current);
      show();
    });
    return;
  }

  if (fight) {
    renderPrefight(root, current, {
      onStart: (plan, weapons, gear, deck) => {
        // Locked and saved before the replay, so reloading cannot change the choices.
        startFight(current, plan, weapons, gear, deck);
        storeSave(current);
        show();
      },
    });
    return;
  }

  renderShell(root, current, {
    onFight: () => {
      prepareFight(current);
      storeSave(current);
      show();
    },
    // Level-ups normally get their offer when the fight ends; this covers a save without one.
    onLevelUp: () => {
      prepareLevelUp(current);
      storeSave(current);
      show();
    },
    onReset: () => {
      clearSave();
      save = null;
      show();
    },
    onSave: () => storeSave(current),
  });
}

// Every game button gives a tiny buzz when pressed, on phones that can (iPhones cannot).
document.addEventListener('click', (event) => {
  const button = (event.target as Element | null)?.closest?.('.btn');
  if (!button || (button as HTMLButtonElement).disabled) return;
  try {
    navigator.vibrate?.(8);
  } catch {
    // Some browsers refuse; the press still works.
  }
});

// Phaser draws text with the game font, so wait for it (briefly) and for custom art before the first render.
const fontTimeout = new Promise((resolve) => setTimeout(resolve, 1500));
const fontsReady = Promise.race([document.fonts.load('16px "Shantell Sans Variable"'), fontTimeout]);
void Promise.all([fontsReady, loadArt()]).finally(() => {
  const params = new URLSearchParams(location.search);
  if (params.has('gallery')) renderGallery(root);
  else show();
});
