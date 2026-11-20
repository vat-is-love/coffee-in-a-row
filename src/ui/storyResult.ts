import { installMenuKeyboard } from './keyboard';

export function showStoryResult(
  title: string,
  actionLabel: string,
  restartOrContinue: () => void,
  { secondary, details, className, closeLabel, onClose, parent = document.body }: {
    secondary?: { label: string; action?: () => void };
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
      <div class="settings-actions">
        <button value="continue" class="primary" autofocus></button>
        ${secondary ? '<button value="secondary"></button>' : ''}
      </div>
    </form>`;
  dialog.querySelector('h1')!.textContent = title;
  dialog.querySelector('button[value="continue"]')!.textContent = actionLabel;
  if (secondary) dialog.querySelector('button[value="secondary"]')!.textContent = secondary.label;
  if (details) dialog.querySelector('h1')!.after(details);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (closeLabel) dialog.close('cancel');
    else if (secondary && !secondary.action) dialog.close('secondary');
  });
  installMenuKeyboard(dialog);
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (dialog.returnValue === 'cancel') {
      onClose?.();
      return;
    }
    if (dialog.returnValue === 'secondary') secondary?.action?.();
    else restartOrContinue();
  }, { once: true });
  parent.append(dialog);
  dialog.showModal();
  return () => dialog.remove();
}
