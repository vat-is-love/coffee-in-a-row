import { createBackup, parseBackup, restoreBackup } from './backupData';
import { t } from './preferences';

const filename = 'coffee-match-backup.json';
const picker = () => (window as Window & {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<FileSystemFileHandle>;
}).showSaveFilePicker;
let file: FileSystemFileHandle | undefined;
let selecting = false;
let pending = false;
let writing: Promise<void> | undefined;
let savedAt: number | undefined;
let message = '';

export function refreshBrowserBackup(): void {
  const checkbox = document.querySelector<HTMLInputElement>('[data-browser-backup-enabled]');
  if (checkbox) {
    checkbox.checked = selecting || !!file;
    checkbox.disabled = selecting || (!!writing && !file);
  }
  const status = document.querySelector('[data-browser-backup-status]');
  if (status) status.textContent = message ? t(message) : savedAt
    ? `${t('Last backup')}: ${new Date(savedAt).toLocaleString()}` : '';
}

function save(): Promise<void> | undefined {
  if (!file) return;
  pending = true;
  writing ??= writePending().finally(() => {
    writing = undefined;
    refreshBrowserBackup();
  });
  return writing;
}

async function writePending(): Promise<void> {
  while (file && pending) {
    pending = false;
    try {
      const backup = createBackup(localStorage);
      const stream = await file.createWritable();
      try {
        await stream.write(JSON.stringify(backup));
        await stream.close();
      } catch (error) {
        await stream.abort().catch(() => {});
        throw error;
      }
      savedAt = backup.savedAt;
      message = '';
      refreshBrowserBackup();
    } catch {
      file = undefined;
      message = 'Could not update the backup file. Enable autosave again or download a copy.';
    }
  }
}

async function toggle(checked: boolean): Promise<void> {
  if (!checked) {
    file = undefined;
    pending = false;
    refreshBrowserBackup();
    return;
  }
  const choose = picker();
  if (!choose || selecting || writing) return;
  selecting = true;
  message = '';
  refreshBrowserBackup();
  try {
    const chosen = await choose.call(window, { suggestedName: filename });
    if ((await chosen.getFile()).size && !window.confirm(t('Overwrite the selected file with your current progress?'))) return;
    file = chosen;
    savedAt = undefined;
    await save();
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      message = 'Could not update the backup file. Enable autosave again or download a copy.';
    }
  } finally {
    selecting = false;
    refreshBrowserBackup();
  }
}

function download(): void {
  try {
    const backup = createBackup(localStorage);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    message = 'Could not download a backup.';
    refreshBrowserBackup();
  }
}

async function restore(input: HTMLInputElement): Promise<void> {
  const selected = input.files?.[0];
  input.value = '';
  if (!selected) return;
  try {
    if (selected.size > 4 * 1024 * 1024) throw Error('Backup too large');
    const backup = parseBackup(await selected.text());
    if (!window.confirm(t('Replace story progress and settings with this copy? Records will be merged and the game will restart.'))) return;
    restoreBackup(localStorage, backup);
    await save();
    window.location.reload();
  } catch {
    message = 'Could not restore progress from this file.';
    refreshBrowserBackup();
  }
}

export function browserBackupControls(): string {
  return `<fieldset><legend>${t('Local backup')}</legend>
    ${picker() ? `<label class="mode-option"><input type="checkbox" data-browser-backup-enabled><span><strong>${t('Save progress to a file')}</strong></span></label>
    <p>${t('Choose a file for this tab. The game updates it as you play. After reopening the game, enable autosave again.')}</p>`
    : `<p>${t('This browser supports manual backups. Download a copy before closing a private window.')}</p>`}
    <button type="button" data-browser-backup-download>${t('Download a copy')}</button>
    <button type="button" data-browser-backup-import>${t('Restore from file')}</button>
    <input type="file" accept=".json,application/json" data-browser-backup-file hidden>
    <p data-browser-backup-status role="status"></p></fieldset>`;
}

export function installBrowserBackup(container: HTMLElement): void {
  container.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-browser-backup-download]')) download();
    if (event.target.closest('[data-browser-backup-import]')) {
      container.querySelector<HTMLInputElement>('[data-browser-backup-file]')?.click();
    }
  });
  container.addEventListener('change', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.matches('[data-browser-backup-enabled]')) void toggle(input.checked);
    if (input.matches('[data-browser-backup-file]')) void restore(input);
  });
  window.addEventListener('coffee-data-changed', () => { void save(); });
}

