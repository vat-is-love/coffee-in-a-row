import { createBackup, parseBackup, restoreBackup } from './backupData';
import { t } from './preferences';

type Reply = { enabled?: boolean; warning?: boolean; error?: string; cancelled?: boolean; folder?: string; savedAt?: number; candidates?: string[] };
let serial = 0;
const waiting = new Map<string, (reply: Reply) => void>();
let busy = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let statusText = '';
export const supportsBackup = () => /CoffeeBackup\/[12]/.test(navigator.userAgent);
const automaticBackup = () => /CoffeeBackup\/2/.test(navigator.userAgent);
function status(text: string) {
  statusText = text;
  document.querySelectorAll('[data-backup-status]').forEach(el => { el.textContent = text; });
}
function request(action: string, data?: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${++serial}`;
    // Folder selection is user-paced; other operations have a bounded wait.
    const timeout = (action === 'choose' || action === 'enable') ? undefined : setTimeout(() => {
      waiting.delete(id); reject(Error('Backup timeout'));
    }, 30000);
    waiting.set(id, reply => {
      clearTimeout(timeout); waiting.delete(id);
      if (reply.error) reject(Error(reply.error)); else resolve(reply);
    });
    try {
      if (window.prompt('coffee-backup', JSON.stringify({ id, action, data })) !== 'accepted') throw Error('Bridge unavailable');
    } catch (error) { clearTimeout(timeout); waiting.delete(id); reject(error); }
  });
}
export async function refreshBackupStatus(): Promise<void> {
  if (!supportsBackup()) return;
  try {
    const reply = await request('status');
    document.querySelectorAll<HTMLInputElement>('[data-backup-enabled]').forEach(control => { control.checked = !!reply.enabled; });
    status(reply.warning ? t('Backup could not be saved. Check free space and turn saving off and on to grant access again.') : reply.folder ? `${t('Backup folder')}: ${reply.folder}. ${reply.savedAt ? `${t('Last backup')}: ${new Date(reply.savedAt).toLocaleString()}` : t('No backup saved yet.')}` : t('Backup is not configured.'));
  } catch { status(t(automaticBackup() ? 'Backup could not be saved. Check free space and turn saving off and on to grant access again.' : 'Backup failed. Check folder access and free space; choose the folder again if needed.')); }
}
export async function saveBackup(): Promise<void> {
  if (!supportsBackup() || busy) return;
  try {
    const current = await request('status');
    if (!current.folder || busy) return;
    await request('write', JSON.stringify(createBackup(localStorage)));
    await refreshBackupStatus();
  } catch { status(t(automaticBackup() ? 'Backup could not be saved. Check free space and turn saving off and on to grant access again.' : 'Backup failed. Check folder access and free space; choose the folder again if needed.')); }
}
export async function chooseBackupFolder(): Promise<void> {
  if (busy) return;
  busy = true;
  let restored = false;
  clearTimeout(timer);
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-backup-choose], [data-backup-enabled]').forEach(b => { b.disabled = true; });
  try {
    const reply = await request(automaticBackup() ? 'enable' : 'choose');
    if (reply.cancelled) { await refreshBackupStatus(); status(t('Saving was not enabled. Storage access is required.')); return; }
    const candidates = (reply.candidates ?? []).flatMap(raw => { try { return [parseBackup(raw)]; } catch { return []; } });
    candidates.sort((a, b) => b.savedAt - a.savedAt);
    if ((reply.candidates?.length ?? 0) && !candidates.length) throw Error('Invalid backup');
    const backup = candidates[0];
    if (backup && !window.confirm(t('A saved game was found. Restore records and settings? Current records will be kept. The game will restart.'))) { await refreshBackupStatus(); return; }
    if (backup) { restoreBackup(localStorage, backup); restored = true; }
    await request('activate');
    // Write only after existing backups have been validated and restoration approved.
    await request('write', JSON.stringify(createBackup(localStorage)));
    await refreshBackupStatus();
  } catch {
    if (restored) window.alert(t('Data restored, but backup setup failed. Turn saving off and on in settings to try again.'));
    else {
      await refreshBackupStatus();
      status(t('Could not enable saving. Check storage access and free space, then try again.'));
    }
  }
  finally {
    busy = false;
    if (restored) window.location.reload();
    document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-backup-choose], [data-backup-enabled]').forEach(b => { b.disabled = false; });
  }
}
export async function disableBackup(): Promise<void> {
  if (busy || !automaticBackup()) return;
  busy = true;
  clearTimeout(timer);
  document.querySelectorAll<HTMLInputElement>('[data-backup-enabled]').forEach(control => { control.disabled = true; });
  try {
    await request('disable');
    await refreshBackupStatus();
  } catch {
    await refreshBackupStatus();
    status(t('Could not turn saving off. Try again.'));
  } finally {
    busy = false;
    document.querySelectorAll<HTMLInputElement>('[data-backup-enabled]').forEach(control => { control.disabled = false; });
  }
}
export function backupControls(): string {
  if (!supportsBackup()) return '';
  return `<fieldset><legend>${t('Local backup')}</legend>
    ${automaticBackup() ? `<label class="mode-option"><input type="checkbox" data-backup-enabled><span><strong>${t('Save progress after uninstall')}</strong></span></label>
    <p>${t('Allow storage access when Android asks. Records and settings are saved automatically. After reinstalling, enable this option to restore. The current board is not saved.')}</p>` : `
    <p>${t('Choose or create Documents/CoffeeMatch on your phone. Records and settings are saved automatically. After reinstalling, choose the same folder to restore. The current board is not saved.')}</p>
    <button type="button" data-backup-choose>${t('Choose backup folder / restore')}</button>`}
    <p data-backup-status role="status"></p></fieldset>`;
}
export function installBackupControls(container: HTMLElement): void {
  container.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-backup-choose]')) void chooseBackupFolder();
  });
  container.addEventListener('change', event => {
    if (!(event.target instanceof HTMLInputElement) || !event.target.matches('[data-backup-enabled]')) return;
    if (event.target.checked) void chooseBackupFolder(); else void disableBackup();
  });
}
if (typeof window !== 'undefined' && supportsBackup()) {
  // Native replies contain data only; they never supply executable JavaScript.
  window.addEventListener('coffee-backup-result', ((event: CustomEvent<{ id: string; reply: Reply }>) => {
    waiting.get(event.detail.id)?.(event.detail.reply);
  }) as EventListener);
  window.addEventListener('coffee-data-changed', () => {
    clearTimeout(timer); timer = setTimeout(() => { void saveBackup(); }, 200);
  });
  window.addEventListener('focus', () => { if (statusText) void refreshBackupStatus(); });
  // Refresh a configured backup on launch, including changes saved before an interrupted write.
  void saveBackup();
}
