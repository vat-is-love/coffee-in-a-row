import type { StoryMessages } from '../game/levels/story';
import { t, type Mode } from './preferences';

export function showStoryResult(
  title: string,
  actionLabel: string,
  restartOrContinue: () => void,
  { victory, details, className, closeLabel, onClose, parent = document.body }: {
    victory?: { messages: StoryMessages; chooseMode: (mode: Mode) => void };
    details?: HTMLElement;
    className?: string;
    closeLabel?: string;
    onClose?: () => void;
    parent?: HTMLElement;
  } = {}
): () => void {
  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  if (className) dialog.classList.add(className);
  dialog.setAttribute('aria-labelledby', 'story-result-title');
  dialog.innerHTML = `
    <form method="dialog">
      ${closeLabel ? `<button class="settings-close" value="cancel" aria-label="${closeLabel}">☰</button>` : ''}
      <h1 id="story-result-title"></h1>
      ${victory ? `
      <p></p>
      <fieldset>
        <legend></legend>
        <label class="mode-option"><input type="radio" name="mode" value="classic" required> ${t('Match three')}</label>
        <label class="mode-option"><input type="radio" name="mode" value="falling"> ${t('Falling pieces')}</label>
      </fieldset>` : ''}
      <div class="settings-actions">
        <button value="continue" ${victory ? 'formnovalidate' : 'class="primary"'}></button>
        ${victory ? '<button value="choose" class="primary"></button>' : ''}
      </div>
    </form>`;
  dialog.querySelector('h1')!.textContent = title;
  if (details) dialog.querySelector('h1')!.after(details);
  dialog.querySelector('button[value="continue"]')!.textContent = actionLabel;
  if (victory) {
    const { messages } = victory;
    dialog.querySelector('p')!.textContent = messages.victoryPrompt;
    dialog.querySelector('legend')!.textContent = messages.modeLabel;
    dialog.querySelector('button[value="choose"]')!.textContent = messages.choose;
  }
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (closeLabel) dialog.close('cancel');
  });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('keyup', event => event.stopPropagation());
  dialog.addEventListener('close', () => {
    const mode = dialog.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value;
    dialog.remove();
    if (dialog.returnValue === 'cancel') {
      onClose?.();
      return;
    }
    if (victory && dialog.returnValue === 'choose' && (mode === 'classic' || mode === 'falling')) victory.chooseMode(mode);
    else restartOrContinue();
  }, { once: true });
  parent.append(dialog);
  dialog.showModal();
  return () => dialog.remove();
}
