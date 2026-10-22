import '@fontsource/press-start-2p/400.css';
import './style.css';
import { chooseUpgrade, dayNumber, playFight, type SaveData } from './core';
import { renderCreate } from './ui/screens/create';
import { renderFight } from './ui/screens/fight';
import { renderHome } from './ui/screens/home';
import { renderLevelUp } from './ui/screens/levelup';
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

  const today = dayNumber(new Date());
  renderHome(root, current, today, {
    onFight: () => {
      const result = playFight(current, today);
      if (!result) return show();
      // Saved before the replay, so closing the app mid-fight cannot reroll the result.
      storeSave(current);
      root.replaceChildren();
      renderFight(root, result, show);
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
