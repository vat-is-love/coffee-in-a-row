import type { StoryMessages } from '../game/levels/story';
import { t, type Mode } from './preferences';

export function showStoryResult(
  messages: StoryMessages,
  restartOrContinue: () => void,
  chooseMode?: (mode: Mode) => void
): () => void {
  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  dialog.setAttribute('aria-labelledby', 'story-result-title');
  dialog.innerHTML = `
    <form method="dialog">
      <h1 id="story-result-title"></h1>
      ${chooseMode ? `
      <p></p>
      <fieldset>
        <legend></legend>
        <label class="mode-option"><input type="radio" name="mode" value="classic" required> ${t('Match three')}</label>
        <label class="mode-option"><input type="radio" name="mode" value="falling"> ${t('Falling pieces')}</label>
      </fieldset>` : ''}
      <div class="settings-actions">
        <button value="continue" ${chooseMode ? 'formnovalidate' : 'class="primary"'}></button>
        ${chooseMode ? '<button value="choose" class="primary"></button>' : ''}
      </div>
    </form>`;
  dialog.querySelector('h1')!.textContent = chooseMode ? messages.victory : messages.levelComplete;
  dialog.querySelector('button[value="continue"]')!.textContent = chooseMode ? messages.restart : messages.continue;
  if (chooseMode) {
    dialog.querySelector('p')!.textContent = messages.victoryPrompt;
    dialog.querySelector('legend')!.textContent = messages.modeLabel;
    dialog.querySelector('button[value="choose"]')!.textContent = messages.choose;
  }
  dialog.addEventListener('cancel', event => event.preventDefault());
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('keyup', event => event.stopPropagation());
  dialog.addEventListener('close', () => {
    const mode = dialog.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value;
    dialog.remove();
    if (dialog.returnValue === 'choose' && (mode === 'classic' || mode === 'falling')) chooseMode?.(mode);
    else restartOrContinue();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return () => dialog.remove();
}
