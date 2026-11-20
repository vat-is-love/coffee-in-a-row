import { installMenuKeyboard, keyActivates, keyDirection } from './keyboard';
import { backupControls, installBackupControls, refreshBackupStatus } from './backup';
import { version as appVersion } from '../../package.json';
import { checkApkUpdate, isAndroidApp, supportsApkUpdates, updateGame } from '../pwa';
import { isStoryMode, loadStory, stories, storyTitle, type StoryMode } from '../game/levels/story';
import { t, getPreferences, getStoryCheckpoint, getStoryStars, hasBlueThirdStar, resetIntroductionProgress, savePreferences, tileStyles, type Language, type Mode } from './preferences';
import type { FallingScene } from '../game/scenes/FallingScene';
import { showGameHelp } from './gameHelp';
import { showStoryIntro } from './storyIntro';
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
  const settings = document.createElement('div');
  installBackupControls(settings);
  const gameMenu = document.createElement('dialog');
  gameMenu.className = 'settings-dialog';
  gameMenu.setAttribute('aria-labelledby', 'game-menu-title');
  document.body.append(screen, dialog, gameMenu);

  let backFromScreen: (() => void) | undefined;
  installMenuKeyboard(screen, () => backFromScreen?.());
  installMenuKeyboard(dialog);
  installMenuKeyboard(gameMenu);

  const usePointer = () => game.registry.set('keyboardInput', false);
  const useKeyboard = (event: KeyboardEvent) => {
    if (keyDirection(event) || keyActivates(event) || event.key === 'Tab') game.registry.set('keyboardInput', true);
  };
  window.addEventListener('pointerdown', usePointer, true);
  window.addEventListener('keydown', useKeyboard, true);

  function startMode(mode: Mode, levelIndex = 0): void {
    savePreferences({ ...getPreferences(), mode });
    game.registry.set('gameMode', mode);
    screen.hidden = true;
    host.inert = false;
    game.scene.stop('GameScene');
    game.scene.stop('FallingScene');
    game.scene.start(mode === 'classic' ? 'GameScene' : 'FallingScene', { levelIndex, skipBriefing: true });
  }

  function showScreen(title: string, back?: () => void): void {
    backFromScreen = back;
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
    addButton(`${t('Zen Mode')} · 8 × 8`, () => startMode('zen'));
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
        index <= completed ? () => previewStoryLevel(mode, index) : undefined, map);
      const stars = document.createElement('span');
      stars.className = 'level-stars';
      const earned = getStoryStars(mode, index);
      const starCount = earned.filter(Boolean).length;
      const blueThird = earned[2] && hasBlueThirdStar(mode, index);
      stars.textContent = (blueThird ? earned.slice(0, 2) : earned).map(star => star ? '★' : '☆').join('');
      if (blueThird) {
        const star = document.createElement('span');
        star.className = 'blue-third-star';
        star.textContent = '★';
        stars.append(star);
      }
      stars.setAttribute('aria-hidden', 'true');
      button.setAttribute('aria-description', `${t('Stars')} ${starCount}/3${blueThird ? ` · ${t('Blue third star')}` : ''}`);
      button.append(stars);
    }
    if (mode === 'story-large') addButton(t('Reset progress'), completed ? () => {
      if (!window.confirm(t('Reset all progress for this campaign?'))) return;
      resetIntroductionProgress();
      storyMap(mode);
    } : undefined);
    map.children[Math.max(0, count - 1 - completed)].scrollIntoView({ block: 'center' });
  }

  function previewStoryLevel(mode: StoryMode, index: number): void {
    let story: ReturnType<typeof loadStory>;
    try {
      story = loadStory(stories[mode]);
    } catch (error) {
      console.error('Unable to load Story levels', error);
      window.CoffeeRecovery?.fail('invalid-falling-level');
      return;
    }
    showStoryIntro(mode, index, story.stages[index], game.textures, () => startMode(mode, index), { mapScreen: screen });
  }

  function renderSettings(inGame: boolean): void {
    settings.innerHTML = `
      ${inGame ? `<button class="settings-close" type="button" data-close-settings aria-label="${t('Close settings')}">×</button>
      <h1 id="settings-title">${t('Settings')}</h1>` : ''}
      <p data-app-version>${t('Version')}: ${appVersion.endsWith('.0-local') ? `${appVersion.slice(0, -8)} (${t('local build')})` : appVersion}</p>
      <label class="preference-option">${t('Language')}
        <select name="language"><option value="en">English</option><option value="ru">Русский</option></select>
      </label>
      <label class="preference-option">${t('Tile style')}
        <select name="tileStyle">
          <option value="beans">${t('Coffee beans')}</option>
          <option value="food">${t('Food sprites')}</option>
          <option value="emoji">${t('Emoji')}</option>
        </select>
      </label>
      <label class="mode-option"><input type="checkbox" name="vibration"><span><strong>${t('Vibration')}</strong><small>${t('Light feedback for matches, stronger feedback on game over.')}</small></span></label>
      <label class="mode-option"><input type="checkbox" name="storyWithoutLives"><span><strong>${t('Story without lives')}</strong><small>${t('From the next attempt, you lose if the next row has no room to land.')}</small></span></label>
      ${isAndroidApp() ? `<button type="button" data-update-game>${t(supportsApkUpdates() ? 'Check for updates' : 'Update game')}</button>
      <small>${t(supportsApkUpdates() ? 'Check for game and Android app updates. A game update restarts the current round.' : 'Download the latest version from GitHub Pages. The game will restart; scores and settings are kept.')}</small>
      <p data-update-status role="status"></p>` : ''}
      ${backupControls()}`;
    const preferences = getPreferences();
    settings.querySelector<HTMLSelectElement>('[name="language"]')!.value = preferences.language;
    settings.querySelector<HTMLSelectElement>('[name="tileStyle"]')!.value = preferences.tileStyle;
    settings.querySelector<HTMLInputElement>('[name="vibration"]')!.checked = preferences.vibration;
    settings.querySelector<HTMLInputElement>('[name="storyWithoutLives"]')!.checked = preferences.storyWithoutLives;
    void refreshBackupStatus();
  }

  let updating = false;
  settings.addEventListener('click', async event => {
    if (!(event.target instanceof Element) || updating) return;
    if (event.target.closest('[data-close-settings]')) {
      dialog.close();
      return;
    }
    if (!event.target.closest('[data-update-game]')) return;
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
  settings.addEventListener('change', event => {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
    const preferences = getPreferences();
    if (field instanceof HTMLSelectElement && field.name === 'language') {
      savePreferences({ ...preferences, language: field.value as Language });
      game.events.emit('language-changed');
      renderSettings(dialog.open);
      if (!dialog.open) {
        panel.querySelector('h1')!.textContent = t('Settings');
        panel.querySelector('.menu-back')!.textContent = t('Back');
      }
      settings.querySelector<HTMLSelectElement>('[name="language"]')!.focus({ preventScroll: true });
    } else if (field instanceof HTMLSelectElement && field.name === 'tileStyle') {
      const tileStyle = tileStyles.find(style => style === field.value);
      if (!tileStyle) return;
      savePreferences({ ...preferences, tileStyle });
      game.events.emit('tile-style-changed');
    } else if (field instanceof HTMLInputElement && (field.name === 'vibration' || field.name === 'storyWithoutLives')) {
      savePreferences({ ...preferences, [field.name]: field.checked });
    }
  });

  let suspended: string | undefined;

  function openSettings(): void {
    dialog.append(settings);
    renderSettings(true);
    dialog.showModal();
  }

  function leaveGame(destination: () => void): void {
    if (suspended) game.scene.stop(suspended);
    suspended = undefined;
    gameMenu.close();
    destination();
  }

  function renderGameMenu(): HTMLButtonElement {
    gameMenu.innerHTML = `
      <h1 id="game-menu-title">${t('Game menu')}</h1>
      <p>${t('Leaving the game ends the current round.')}</p>
      <div class="settings-actions game-menu-actions"></div>`;
    const actions = gameMenu.querySelector<HTMLDivElement>('.game-menu-actions')!;
    const mode: unknown = game.registry.get('gameMode');
    addButton(t('Main menu'), () => leaveGame(mainMenu), actions, '');
    if (isStoryMode(mode)) addButton(t('Choose level'), () => leaveGame(() => storyMap(mode)), actions, '');
    const settingsButton = addButton(t('Settings'), openSettings, actions, '');
    addButton(t('How to play'), () => {
      const rules = suspended === 'FallingScene' ? (game.scene.getScene(suspended) as FallingScene).roundRules : undefined;
      showGameHelp(mode, game.textures, rules);
    }, actions, '');
    addButton(t('Restart level'), () => {
      if (!suspended) return;
      const scene = game.scene.getScene(suspended);
      suspended = undefined;
      gameMenu.close();
      const { levelIndex } = scene.sys.settings.data as { levelIndex?: number };
      scene.scene.restart({ levelIndex, skipBriefing: true });
    }, actions, '');
    const resumeButton = addButton(t('Resume game'), () => gameMenu.close(), actions, 'primary');
    resumeButton.autofocus = true;
    return settingsButton;
  }

  function openGameMenu(): void {
    if (suspended) return;
    suspended = ['GameScene', 'FallingScene'].find(scene => game.scene.isActive(scene));
    if (!suspended) return;
    game.scene.pause(suspended);
    renderGameMenu();
    gameMenu.showModal();
  }

  dialog.addEventListener('cancel', event => { if (updating) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    if (gameMenu.open) renderGameMenu().focus();
  });
  gameMenu.addEventListener('close', () => {
    if (suspended) game.scene.resume(suspended);
    suspended = undefined;
  });

  game.events.once('show-main-menu', () => {
    mainMenu();
    requestAnimationFrame(() => window.CoffeeRecovery?.ready());
  });
  const returnToStoryMap = (mode: StoryMode) => {
    game.scene.stop('FallingScene');
    storyMap(mode);
  };
  game.events.on('return-to-story-map', returnToStoryMap);
  window.addEventListener('game-menu', openGameMenu);
  game.events.once('destroy', () => {
    window.removeEventListener('game-menu', openGameMenu);
    window.removeEventListener('pointerdown', usePointer, true);
    window.removeEventListener('keydown', useKeyboard, true);
    game.events.off('return-to-story-map', returnToStoryMap);
    screen.remove();
    dialog.remove();
    gameMenu.remove();
  });
}
