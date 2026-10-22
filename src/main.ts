import '@fontsource/press-start-2p/400.css';
import './style.css';
import { chooseUpgrade, dayNumber, prepareFight, recordWarmup, startFight, type SaveData } from './core';
import { renderCreate } from './ui/screens/create';
import { renderFight } from './ui/screens/fight';
import { renderHome } from './ui/screens/home';
import { renderLevelUp } from './ui/screens/levelup';
import { renderPrefight } from './ui/screens/prefight';
import { clearSave, loadSave, storeSave } from './ui/storage';

const root = document.getElementById('app')!;
let save: SaveData | null = loadSave();

function show(): void {
  root.replaceChildren();
  window.scrollTo(0, 0);
  const current = save;

  if (!current) {
    renderCreate(root, (created) => {
      save = created;
      storeSave(created);
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

  const fight = current.pendingFight;
  if (fight?.tactics) {
    renderFight(root, current, () => storeSave(current), show);
    return;
  }
  if (fight) {
    renderPrefight(root, current, {
      onWarmup: (score) => {
        recordWarmup(current, score);
        storeSave(current);
      },
      onStart: (stance, weapons) => {
        // Locked and saved before the replay, so reloading cannot change the choices.
        startFight(current, stance, weapons);
        storeSave(current);
        show();
      },
    });
    return;
  }

  const today = dayNumber(new Date());
  renderHome(root, current, today, {
    onFight: () => {
      prepareFight(current, today);
      storeSave(current);
      show();
    },
    onReset: () => {
      clearSave();
      save = null;
      show();
    },
  });
}

// Phaser draws text with the pixel font, so wait for it (briefly) before the first render.
const fontTimeout = new Promise((resolve) => setTimeout(resolve, 1500));
void Promise.race([document.fonts.load('8px "Press Start 2P"'), fontTimeout]).finally(show);
