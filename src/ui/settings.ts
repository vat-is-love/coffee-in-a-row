import { t, getPreferences, savePreferences, type Language } from './preferences';
import type { Game } from 'phaser';

type Mode = 'classic' | 'falling';

/** Native controls keep settings usable with touch, keyboard, and screen readers. */
export function installSettings(game: Game): void {
  let mode: Mode = 'classic';
  game.registry.set('gameMode', mode);
  const modePicker = document.createElement('dialog');
  modePicker.className = 'settings-dialog mode-picker';
  modePicker.setAttribute('aria-labelledby', 'mode-picker-title');
  modePicker.setAttribute('aria-describedby', 'mode-picker-hint');
  const renderModePicker = () => { modePicker.innerHTML = `
    <form method="dialog">
      <h1 id="mode-picker-title">${t('Choose game mode')}</h1>
      <button class="mode-option" value="falling">
        <strong>${t('Falling pieces')}</strong>
        <small>${t('Tap connected groups of 2+ before the next row arrives.')}</small>
      </button>
      <button class="mode-option" value="classic">
        <strong>${t('Match three')}</strong>
        <small>${t('Swap tiles to make lines of 3.')}</small>
      </button>
      <p id="mode-picker-hint">${t('You can change the mode in settings.')}</p>
    </form>`; };
  renderModePicker();
  document.body.append(modePicker);
  // A mode must be chosen before gameplay starts, including with Escape.
  modePicker.addEventListener('cancel', event => event.preventDefault());
  modePicker.addEventListener('close', () => {
    if (modePicker.returnValue !== 'classic' && modePicker.returnValue !== 'falling') return;
    mode = modePicker.returnValue;
    game.registry.set('gameMode', mode);
    game.events.emit('game-mode-selected');
  });
  const chooseMode = () => {
    modePicker.returnValue = '';
    modePicker.showModal();
    requestAnimationFrame(() => window.CoffeeRecovery?.ready());
  };
  game.events.once('choose-game-mode', chooseMode);

  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  dialog.setAttribute('aria-labelledby', 'settings-title');
  const renderSettings = () => { dialog.innerHTML = `
    <form method="dialog">
      <h1 id="settings-title">${t('Settings')}</h1>
      <label class="preference-option">${t('Language')}
        <select name="language"><option value="en">English</option><option value="ru">Русский</option></select>
      </label>
      <label class="mode-option"><input type="checkbox" name="vibration"><span><strong>${t('Vibration')}</strong><small>${t('Light feedback for matches, stronger feedback on game over.')}</small></span></label>
      <fieldset>
        <legend>${t('Game mode')}</legend>
        <label class="mode-option">
          <input type="radio" name="mode" value="classic">
          <span><strong>${t('Match three')}</strong><small>${t('Swap tiles to make lines of 3. New tiles refill the board.')}</small></span>
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
  };
  // Keep dialog keyboard events out of Phaser's global keyboard handler.
  const stopKey = (event: KeyboardEvent) => event.stopPropagation();
  modePicker.addEventListener('keydown', stopKey);
  modePicker.addEventListener('keyup', stopKey);
  dialog.addEventListener('keydown', stopKey);
  dialog.addEventListener('keyup', stopKey);
  dialog.addEventListener('close', () => {
    const selected = (dialog.querySelector('input[name="mode"]:checked') as HTMLInputElement).value as Mode;
    if (dialog.returnValue === 'apply') {
      savePreferences({
        language: dialog.querySelector<HTMLSelectElement>('select[name="language"]')!.value as Language,
        vibration: dialog.querySelector<HTMLInputElement>('input[name="vibration"]')!.checked
      });
      renderModePicker();
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
