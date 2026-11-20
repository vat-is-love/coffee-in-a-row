import type { Textures } from 'phaser';
import type { FallingScene } from '../game/scenes/FallingScene';
import { isStoryMode } from '../game/levels/story';
import { rowsPerLife } from '../game/render/storyLives';
import { installMenuKeyboard } from './keyboard';
import { t } from './preferences';
import { storyLevelDetails } from './storyIntro';

export function showGameHelp(mode: unknown, textures: Textures.TextureManager, rules?: FallingScene['roundRules']): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  dialog.setAttribute('aria-labelledby', 'game-help-title');
  dialog.innerHTML = `
    <h1 id="game-help-title" tabindex="-1" autofocus></h1>
    <div class="story-intro"></div>
    <form method="dialog" class="settings-actions"><button></button></form>`;
  dialog.querySelector('h1')!.textContent = t('How to play');
  dialog.querySelector('button')!.textContent = t('Back');
  const content = dialog.querySelector('.story-intro')!;
  const section = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = t('Controls');
  section.append(heading);
  content.append(section);

  const addRule = (text: string) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    section.append(paragraph);
  };
  if (!rules) {
    addRule(t('Swap neighboring tiles with a swipe or by selecting two tiles. Match three or more in a line to clear their cells. Clear every shaded cell to win.'));
    addRule(t('Use the arrow keys or WASD to move and Enter or Space to select a tile.'));
  } else {
    addRule(t('Tap a group of two or more matching tiles that touch along an edge. After a clear, the remaining columns move toward the center.'));
    addRule(t('Use the arrow keys or WASD to move and Enter or Space to clear a group.'));
    addRule(t('New rows arrive from above when the timer runs out.'));
    if (rules.level.incomingRows.allowEarlyDrop) addRule(t('Drop the next row early with the button below the board or the E key.'));
    addRule(t(rules.hasLives
      ? 'When a new row cannot fit, you spend a life to make room at the top. If you are out of lives, the round ends.'
      : 'The round ends when a new row cannot fit.'));
    if (rules.hasLives) addRule(t('Every {rows} new rows restore one life.').replace('{rows}', String(rowsPerLife)));
    if (rules.level.delivery) addRule(t('Clear tiles below an item so it reaches the bottom and is delivered.'));
    const buffs = rules.level.buffs?.types;
    if (buffs?.includes('horizontal')) addRule(t('Tap horizontal lightning to clear its row.'));
    if (buffs?.includes('vertical')) addRule(t('Tap vertical lightning to clear its column.'));
    if (buffs?.includes('bomb')) addRule(t('Tap a bomb to clear nearby tiles.'));
    if (rules.stage && isStoryMode(mode)) {
      content.after(storyLevelDetails(mode, rules.levelIndex, rules.stage, textures, !rules.hasLives, false));
    }
  }
  installMenuKeyboard(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}
