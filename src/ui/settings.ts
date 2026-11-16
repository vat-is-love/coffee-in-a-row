import { backupControls, installBackupControls, refreshBackupStatus } from './backup';
import { version as appVersion } from '../../package.json';
import { checkApkUpdate, isAndroidApp, supportsApkUpdates, updateGame } from '../pwa';
import { stories, storyTitle, type StoryMode } from '../game/levels/story';
import { t, getPreferences, getStoryCheckpoint, getStoryStars, resetIntroductionProgress, savePreferences, type Language, type Mode } from './preferences';
import type { Game } from 'phaser';

export function installSettings(game: Game): void {
  const host = document.getElementById('game-container')!;
  const screen = document.createElement('main');
  screen.className = 'menu-screen settings-actions';
  screen.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'menu-panel mode-picker';
  screen.append(panel);

  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  dialog.setAttribute('aria-labelledby', 'settings-title');
  const settings = document.createElement('form');
  installBackupControls(settings);
  const confirmExit = document.createElement('dialog');
  confirmExit.className = 'settings-dialog';
  confirmExit.setAttribute('aria-labelledby', 'exit-title');
  document.body.append(screen, dialog, confirmExit);

  for (const modal of [dialog, confirmExit]) {
    modal.addEventListener('keydown', event => event.stopPropagation());
    modal.addEventListener('keyup', event => event.stopPropagation());
  }

  function startMode(mode: Mode, levelIndex = 0): void {
    savePreferences({ ...getPreferences(), mode });
    game.registry.set('gameMode', mode);
    screen.hidden = true;
    host.inert = false;
    game.scene.stop('GameScene');
    game.scene.stop('FallingScene');
    game.scene.start(mode === 'classic' ? 'GameScene' : 'FallingScene', { levelIndex });
  }

  function showScreen(title: string, back?: () => void): void {
    screen.hidden = false;
    host.inert = true;
    screen.scrollTop = 0;
    panel.replaceChildren();
    if (back) addButton(t('Back'), back, panel, 'menu-back');
    const heading = document.createElement('h1');
    heading.textContent = title;
    heading.tabIndex = -1;
    panel.append(heading);
    heading.focus();
  }

  function addButton(label: string, action?: () => void, parent = panel, className = 'mode-option'): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.disabled = !action;
    if (action) button.addEventListener('click', action);
    parent.append(button);
    return button;
  }

  function mainMenu(): void {
    showScreen('Coffee Match');
    addButton(t('Competitive mode'), competitiveMenu);
    addButton(t('Story mode'), storyMenu);
    addButton(t('Settings'), () => {
      showScreen(t('Settings'), mainMenu);
      panel.append(settings);
      renderSettings(false);
    });
    addButton(t('Achievements'));
    addButton(t('About the authors'));
    if (/\bCoffeeExit\/1\b/.test(navigator.userAgent)) {
      addButton(t('Exit'), () => window.prompt('coffee-exit'));
    }
  }

  function competitiveMenu(): void {
    showScreen(t('Competitive mode'), mainMenu);
    addButton(`${t('Match three')} · 8 × 8`, () => startMode('classic'));
    addButton(`${t('Falling pieces')} · 8 × 8`, () => startMode('falling'));
  }

  function storyMenu(): void {
    showScreen(t('Story mode'), mainMenu);
    for (const mode of ['shady-souls', 'story-large'] as const) {
      const button = addButton(storyTitle(mode, getPreferences().language), () => storyMap(mode));
      const description = document.createElement('small');
      description.textContent = stories[mode].messages[getPreferences().language].description ?? '';
      button.append(description);
    }
  }

  function storyMap(mode: StoryMode): void {
    showScreen(storyTitle(mode, getPreferences().language), storyMenu);
    const count = stories[mode].levels.length;
    const completed = getStoryCheckpoint(mode);
    const map = document.createElement('div');
    map.className = 'story-map';
    panel.append(map);
    for (let index = count - 1; index >= 0; index--) {
      const state = index < completed ? t('Completed') : index > completed ? t('Locked') : '';
      const label = `${t('Level')} ${index + 1}`;
      const button = addButton(state ? `${label} · ${state}${index > completed ? ' 🔒' : ''}` : label,
        index <= completed ? () => startMode(mode, index) : undefined, map);
      const stars = document.createElement('span');
      stars.className = 'level-stars';
      const starCount = getStoryStars(mode, index);
      stars.textContent = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);
      stars.setAttribute('aria-hidden', 'true');
      button.setAttribute('aria-description', `${t('Stars')} ${starCount}/3`);
      button.append(stars);
    }
    if (mode === 'story-large') addButton(t('Reset progress'), completed ? () => {
      if (!window.confirm(t('Reset all progress for Getting to know the game?'))) return;
      resetIntroductionProgress();
      storyMap(mode);
    } : undefined);
    map.children[Math.max(0, count - 1 - completed)].scrollIntoView({ block: 'center' });
  }

  function renderSettings(inGame: boolean): void {
    settings.innerHTML = `
      ${inGame ? `<button class="settings-close" type="submit" value="cancel" aria-label="${t('Close settings')}">×</button>
      <h1 id="settings-title">${t('Settings')}</h1>` : ''}
      <p data-app-version>${t('Version')}: ${appVersion.endsWith('.0-local') ? `${appVersion.slice(0, -8)} (${t('local build')})` : appVersion}</p>
      <label class="preference-option">${t('Language')}
        <select name="language"><option value="en">English</option><option value="ru">Русский</option></select>
      </label>
      <label class="mode-option"><input type="checkbox" name="vibration"><span><strong>${t('Vibration')}</strong><small>${t('Light feedback for matches, stronger feedback on game over.')}</small></span></label>
      ${isAndroidApp() ? `<button type="button" data-update-game>${t(supportsApkUpdates() ? 'Check for updates' : 'Update game')}</button>
      <small>${t(supportsApkUpdates() ? 'Check for game and Android app updates. A game update restarts the current round.' : 'Download the latest version from GitHub Pages. The game will restart; scores and settings are kept.')}</small>
      <p data-update-status role="status"></p>` : ''}
      ${backupControls()}
      <div class="settings-actions">
        ${inGame ? `<button type="submit" value="cancel">${t('Cancel')}</button>` : ''}
        <button type="submit" value="apply" class="primary">${t('Apply')}</button>
      </div>`;
    const preferences = getPreferences();
    settings.querySelector<HTMLSelectElement>('[name="language"]')!.value = preferences.language;
    settings.querySelector<HTMLInputElement>('[name="vibration"]')!.checked = preferences.vibration;
    void refreshBackupStatus();
  }

  let updating = false;
  settings.addEventListener('click', async event => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-update-game]') || updating) return;
    updating = true;
    const container = dialog.open ? dialog : panel;
    const controls = [...container.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button, input, select')];
    controls.forEach(control => { control.disabled = true; });
    const status = settings.querySelector('[data-update-status]')!;
    status.textContent = t('Checking and downloading update…');
    const apkUpdates = supportsApkUpdates();
    const apkStatus = apkUpdates && !checkApkUpdate(getPreferences().language)
      ? t('Could not check for an Android app update.') : '';
    let webStatus: string;
    try {
      const result = await updateGame();
      const currentMessage = apkUpdates ? 'The game is up to date.' : 'The latest version is already installed.';
      webStatus = t(result === 'current' ? currentMessage : 'Restarting…');
    } catch {
      webStatus = t(apkUpdates ? 'Could not update the game. Check your connection and try again.'
        : 'Update failed. Check your connection and try again.');
    } finally {
      updating = false;
      controls.forEach(control => { control.disabled = false; });
    }
    status.textContent = [webStatus, apkStatus].filter(Boolean).join(' ');
  });
  settings.addEventListener('submit', event => {
    event.preventDefault();
    if (updating) return;
    if (event.submitter?.getAttribute('value') === 'apply') {
      savePreferences({
        language: settings.querySelector<HTMLSelectElement>('[name="language"]')!.value as Language,
        vibration: settings.querySelector<HTMLInputElement>('[name="vibration"]')!.checked
      });
      game.events.emit('language-changed');
    }
    if (dialog.open) dialog.close();
    else mainMenu();
  });

  let suspended: string | undefined;
  function suspend(): boolean {
    if (suspended) return false;
    suspended = ['GameScene', 'FallingScene'].find(scene => game.scene.isActive(scene));
    if (!suspended) return false;
    game.scene.pause(suspended);
    return true;
  }

  function openSettings(): void {
    if (updating || !suspend()) return;
    dialog.append(settings);
    renderSettings(true);
    dialog.showModal();
  }

  function openExit(): void {
    if (!suspend()) return;
    confirmExit.innerHTML = `
      <form method="dialog">
        <h1 id="exit-title">${t('Return to main menu?')}</h1>
        <p>${t('The current round will end.')}</p>
        <div class="settings-actions">
          <button value="cancel" autofocus>${t('Cancel')}</button>
          <button value="exit" class="primary">${t('Main menu')}</button>
        </div>
      </form>`;
    confirmExit.returnValue = '';
    confirmExit.showModal();
  }

  function resume(): void {
    if (suspended) game.scene.resume(suspended);
    suspended = undefined;
  }

  dialog.addEventListener('cancel', event => { if (updating) event.preventDefault(); });
  dialog.addEventListener('close', resume);
  confirmExit.addEventListener('close', () => {
    if (confirmExit.returnValue !== 'exit') {
      resume();
      return;
    }
    if (suspended) game.scene.stop(suspended);
    suspended = undefined;
    mainMenu();
  });

  game.events.once('show-main-menu', () => {
    mainMenu();
    requestAnimationFrame(() => window.CoffeeRecovery?.ready());
  });
  const selectAfterStory = (mode: Mode) => startMode(mode);
  game.events.on('select-mode-after-story', selectAfterStory);
  window.addEventListener('game-settings', openSettings);
  window.addEventListener('game-exit', openExit);
  game.events.once('destroy', () => {
    window.removeEventListener('game-settings', openSettings);
    window.removeEventListener('game-exit', openExit);
    game.events.off('select-mode-after-story', selectAfterStory);
    screen.remove();
    dialog.remove();
    confirmExit.remove();
  });
}
