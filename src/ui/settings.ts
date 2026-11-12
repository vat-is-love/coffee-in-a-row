import { backupControls, installBackupControls, refreshBackupStatus } from './backup';
import { version as appVersion } from '../../package.json';
import { checkApkUpdate, isAndroidApp, supportsApkUpdates, updateGame } from '../pwa';
import { t, getPreferences, getStartupPreferences, savePreferences, type Language, type Mode } from './preferences';
import type { Game } from 'phaser';

/** Native controls keep settings usable with touch, keyboard, and screen readers. */
export function installSettings(game: Game): void {
  const startup = getStartupPreferences();
  let mode: Mode = startup.mode ?? 'classic';
  game.registry.set('gameMode', mode);
  const modePicker = document.createElement('dialog');
  modePicker.className = 'settings-dialog mode-picker';
  modePicker.setAttribute('aria-labelledby', 'mode-picker-title');
  modePicker.setAttribute('aria-describedby', 'mode-picker-hint');
  modePicker.innerHTML = `
    <form method="dialog">
      <h1 id="mode-picker-title">${t('Choose game mode')}</h1>
      ${!startup.languageChosen ? `<label class="preference-option">Language / Язык
        <select name="startup-language"><option value="en">English</option><option value="ru">Русский</option></select>
      </label>` : ''}
      ${startup.mode ? `<button class="mode-option" value="${startup.mode}">${t('Continue')}</button>` : `
      <button class="mode-option" value="falling">
        <strong>${t('Falling pieces')}</strong>
        <small>${t('Tap connected groups of 2+ before the next row arrives.')}</small>
      </button>
      <button class="mode-option" value="classic">
        <strong>${t('Match three')}</strong>
        <small>${t("Match lines of 3 to clear every cell's pale background.")}</small>
      </button>
      `}
      ${backupControls()}
      <p id="mode-picker-hint">${t('You can change the mode in settings.')}</p>
    </form>`;
  document.body.append(modePicker);
  installBackupControls(modePicker);
  // A mode must be chosen before gameplay starts, including with Escape.
  modePicker.addEventListener('cancel', event => event.preventDefault());
  modePicker.addEventListener('close', () => {
    if (modePicker.returnValue !== 'classic' && modePicker.returnValue !== 'falling') return;
    mode = modePicker.returnValue;
    savePreferences({ ...getPreferences(), mode,
      language: (modePicker.querySelector<HTMLSelectElement>('[name="startup-language"]')?.value as Language | undefined) ?? getPreferences().language
    });
    game.registry.set('gameMode', mode);
    game.events.emit('game-mode-selected');
  });
  const chooseMode = () => {
    window.CoffeeRecovery?.stage('choose-game-mode');
    if (startup.mode && startup.languageChosen) {
      game.events.emit('game-mode-selected');
      return;
    }
    modePicker.returnValue = '';
    modePicker.showModal();
    void refreshBackupStatus();
    requestAnimationFrame(() => window.CoffeeRecovery?.ready());
  };
  game.events.once('choose-game-mode', chooseMode);

  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  dialog.setAttribute('aria-labelledby', 'settings-title');
  const renderSettings = () => { dialog.innerHTML = `
    <form method="dialog">
      <h1 id="settings-title">${t('Settings')}</h1>
      <p data-app-version>${t('Version')}: ${appVersion.endsWith('.0-local') ? `${appVersion.slice(0, -8)} (${t('local build')})` : appVersion}</p>
      <label class="preference-option">${t('Language')}
        <select name="language"><option value="en">English</option><option value="ru">Русский</option></select>
      </label>
      <label class="mode-option"><input type="checkbox" name="vibration"><span><strong>${t('Vibration')}</strong><small>${t('Light feedback for matches, stronger feedback on game over.')}</small></span></label>
      ${isAndroidApp() ? `<button type="button" data-update-game>${t(supportsApkUpdates() ? 'Check for updates' : 'Update game')}</button>
      <small>${t(supportsApkUpdates() ? 'Check for game and Android app updates. A game update restarts the current round.' : 'Download the latest version from GitHub Pages. The game will restart; scores and settings are kept.')}</small>
      <p data-update-status role="status"></p>` : ''}
      ${backupControls()}
      <fieldset>
        <legend>${t('Game mode')}</legend>
        <label class="mode-option">
          <input type="radio" name="mode" value="classic">
          <span><strong>${t('Match three')}</strong><small>${t("Match lines of 3 to clear every cell's pale background.")}</small></span>
        </label>
        <label class="mode-option">
          <input type="radio" name="mode" value="falling">
          <span><strong>${t('Falling pieces')}</strong><small>${t('Tap connected groups of 2+. Columns gather in the center. Clear space before the next row arrives.')}</small></span>
        </label>
      </fieldset>
      <p>${t('Changing mode starts a new game.')}</p>
      <div class="settings-actions"><button value="cancel">${t('Cancel')}</button><button value="apply" class="primary">${t('Apply')}</button></div>
    </form>`; };
  renderSettings();
  document.body.append(dialog);
  installBackupControls(dialog);
  let updating = false;
  dialog.addEventListener('cancel', event => { if (updating) event.preventDefault(); });
  dialog.addEventListener('click', async event => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-update-game]') || updating) return;
    updating = true;
    const controls = [...dialog.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button, input, select')];
    controls.forEach(control => { control.disabled = true; });
    const status = dialog.querySelector('[data-update-status]')!;
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
  let suspended: string | null = null;
  const open = () => {
    if (dialog.open) return;
    suspended = game.scene.isActive('FallingScene') ? 'FallingScene' : game.scene.isActive('GameScene') ? 'GameScene' : null;
    if (!suspended) return;
    renderSettings();
    const preferences = getPreferences();
    dialog.querySelector<HTMLSelectElement>('select[name="language"]')!.value = preferences.language;
    dialog.querySelector<HTMLInputElement>('input[name="vibration"]')!.checked = preferences.vibration;
    (dialog.querySelector(`input[value="${mode}"]`) as HTMLInputElement).checked = true;
    game.scene.pause(suspended);
    dialog.returnValue = '';
    dialog.showModal();
    void refreshBackupStatus();
  };
  // Keep dialog keyboard events out of Phaser's global keyboard handler.
  const stopKey = (event: KeyboardEvent) => event.stopPropagation();
  for (const modal of [modePicker, dialog]) {
    modal.addEventListener('keydown', stopKey);
    modal.addEventListener('keyup', stopKey);
  }
  dialog.addEventListener('close', () => {
    const selected = (dialog.querySelector('input[name="mode"]:checked') as HTMLInputElement).value as Mode;
    if (dialog.returnValue === 'apply') {
      savePreferences({
        language: dialog.querySelector<HTMLSelectElement>('select[name="language"]')!.value as Language,
        vibration: dialog.querySelector<HTMLInputElement>('input[name="vibration"]')!.checked,
        mode: selected
      });
      game.events.emit('language-changed');
    }
    if (dialog.returnValue === 'apply' && selected !== mode && suspended) {
      mode = selected;
      game.registry.set('gameMode', mode);
      game.scene.stop(suspended);
      game.scene.start(mode === 'falling' ? 'FallingScene' : 'GameScene');
    } else if (suspended) game.scene.resume(suspended);
    suspended = null;
  });
  window.addEventListener('game-settings', open);
  game.events.once('destroy', () => {
    window.removeEventListener('game-settings', open);
    game.events.off('choose-game-mode', chooseMode);
    modePicker.remove();
    dialog.remove();
  });
}
