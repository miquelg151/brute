import '@fontsource-variable/shantell-sans/full.css';
import './style.css';
import { chooseUpgrade, dayNumber, prepareFight, recordWarmup, startFight, type SaveData } from './core';
import { loadArt } from './ui/art';
import { applyTheme } from './ui/theme';
import { renderCreate } from './ui/screens/create';
import { renderFight } from './ui/screens/fight';
import { renderGallery } from './ui/screens/gallery';
import { renderHome } from './ui/screens/home';
import { renderLevelUp } from './ui/screens/levelup';
import { renderPrefight } from './ui/screens/prefight';
import { clearSave, loadSave, storeSave } from './ui/storage';

applyTheme();

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
      onStart: (plan, weapons, gear) => {
        // Locked and saved before the replay, so reloading cannot change the choices.
        startFight(current, plan, weapons, gear);
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

// Phaser draws text with the game font, so wait for it (briefly) and for custom art before the first render.
const fontTimeout = new Promise((resolve) => setTimeout(resolve, 1500));
const fontsReady = Promise.race([document.fonts.load('16px "Shantell Sans Variable"'), fontTimeout]);
void Promise.all([fontsReady, loadArt()]).finally(() => {
  if (new URLSearchParams(location.search).has('gallery')) renderGallery(root);
  else show();
});
