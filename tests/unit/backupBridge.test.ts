import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
async function setup(candidates: string[] = [], approve = true, version = 1, denied = false) {
  const values = new Map<string, string>();
  const calls: { action: string; data?: string }[] = [];
  let enabled = false;
  const win = new EventTarget() as EventTarget & { prompt: ReturnType<typeof vi.fn>; confirm: ReturnType<typeof vi.fn>; location: { reload: ReturnType<typeof vi.fn> } };
  win.confirm = vi.fn(() => approve);
  win.location = { reload: vi.fn() };
  win.prompt = vi.fn((_message: string, raw: string) => {
    const req = JSON.parse(raw);
    calls.push(req);
    let reply = {};
    if (req.action === 'choose' || req.action === 'enable') reply = denied ? { cancelled: true } : { candidates };
    if (req.action === 'activate') enabled = true;
    if (req.action === 'disable') enabled = false;
    if (req.action === 'status') reply = { folder: enabled ? 'Documents/CoffeeMatch' : '', enabled };
    queueMicrotask(() => win.dispatchEvent(new CustomEvent('coffee-backup-result', { detail: { id: req.id, reply } })));
    return 'accepted';
  });
  vi.stubGlobal('navigator', { userAgent: `CoffeeBackup/${version} CoffeeAPK/1.0.99` });
  vi.stubGlobal('document', { documentElement: { lang: '' }, querySelectorAll: () => [] });
  vi.stubGlobal('window', win);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, raw: string) => values.set(key, raw),
    removeItem: (key: string) => values.delete(key)
  });
  const api = await import('../../src/ui/backup');
  return { api, values, calls, win };
}
const rawBackup = JSON.stringify({ format: 'coffee-match-backup', version: 1, savedAt: 1000,
  data: { 'coffee-preferences': JSON.stringify({ language: 'ru', vibration: false, mode: 'falling' }) } });

test('folder setup activates only after validation and writes an initial snapshot', async () => {
  const { api, calls } = await setup();
  await api.chooseBackupFolder();
  expect(calls.filter(r => r.action !== 'status').map(r => r.action)).toEqual(['choose', 'activate', 'write']);
  expect(JSON.parse(calls.find(r => r.action === 'write')!.data!).format).toBe('coffee-match-backup');
});
test('a corrupt main copy falls back to the previous valid copy and reloads with restored data', async () => {
  const { api, calls, values, win } = await setup(['broken', rawBackup]);
  await api.chooseBackupFolder();
  expect(JSON.parse(values.get('coffee-preferences')!)).toMatchObject({ language: 'ru', mode: 'falling' });
  expect(win.confirm).toHaveBeenCalledOnce();
  expect(win.location.reload).toHaveBeenCalledOnce();
  expect(calls.some(r => r.action === 'write')).toBe(true);
});
test('damaged backups and rejected restoration cannot activate the folder or overwrite files', async () => {
  for (const [candidates, approve] of [[['broken'], true], [[rawBackup], false]] as const) {
    vi.resetModules();
    const { api, calls, win, values } = await setup([...candidates], approve);
    await api.chooseBackupFolder();
    expect(calls.some(r => ['activate', 'write'].includes(r.action))).toBe(false);
    expect(values.size).toBe(0);
    expect(win.location.reload).not.toHaveBeenCalled();
  }
});

test('automatic mode requests access without choosing a folder; disabling stops writes and keeps existing data', async () => {
  const { api, calls, values } = await setup([], true, 2);
  await api.chooseBackupFolder();
  expect(calls.filter(r => r.action !== 'status').map(r => r.action)).toEqual(['enable', 'activate', 'write']);
  values.set('coffee-preferences', JSON.stringify({ language: 'ru', vibration: true }));
  await api.saveBackup();
  const writes = calls.filter(r => r.action === 'write').length;
  await api.disableBackup();
  await api.saveBackup();
  expect(calls.filter(r => r.action === 'write')).toHaveLength(writes);
  expect(values.has('coffee-preferences')).toBe(true);
});
test('denied filesystem access leaves automatic saving off and never writes or activates', async () => {
  const { api, calls, values } = await setup([], true, 2, true);
  await api.chooseBackupFolder();
  expect(calls.some(r => ['choose', 'activate', 'write'].includes(r.action))).toBe(false);
  expect(values.size).toBe(0);
});
test('automatic mode discovers an existing copy and restores without a folder request', async () => {
  const { api, calls, values, win } = await setup([rawBackup], true, 2);
  await api.chooseBackupFolder();
  expect(calls.some(r => r.action === 'choose')).toBe(false);
  expect(JSON.parse(values.get('coffee-preferences')!)).toMatchObject({ language: 'ru' });
  expect(win.location.reload).toHaveBeenCalledOnce();
});
