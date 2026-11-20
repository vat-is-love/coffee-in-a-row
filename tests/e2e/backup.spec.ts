import { test, expect } from '@playwright/test';
import { chooseCompetitive } from './menu';

// Emulates only the native protocol; SAF/grants/file durability need a real Android device.
async function bridge(page: import('@playwright/test').Page, candidates: string[] = []) {
  await page.addInitScript(({ candidates }) => {
    Object.defineProperty(navigator, 'userAgent', { value: navigator.userAgent + ' CoffeeBackup/2 CoffeeAPK/1.0.99' });
    let active = false;
    let last = 0;
    const calls: { action: string; data?: string }[] = [];
    (window as unknown as { backupCalls: typeof calls }).backupCalls = calls;
    window.prompt = (message, raw) => {
      if (message !== 'coffee-backup') return null;
      const req = JSON.parse(raw!);
      calls.push(req);
      let reply = {};
      if (req.action === 'status') reply = { folder: active ? 'Documents/CoffeeMatch' : '', savedAt: last, enabled: active };
      if (req.action === 'enable') reply = { candidates };
      if (req.action === 'activate') active = true;
      if (req.action === 'disable') active = false;
      if (req.action === 'write') last = JSON.parse(req.data).savedAt;
      setTimeout(() => window.dispatchEvent(new CustomEvent('coffee-backup-result', { detail: { id: req.id, reply } })), 0);
      return 'accepted';
    };
  }, { candidates });
}

test('setup works on first launch and changes automatically save records and settings', { tag: '@backup' }, async ({ page }) => {
  await bridge(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('checkbox', { name: 'Save progress after uninstall' }).check();
  await expect(page.locator('.menu-screen [data-backup-status]')).toContainText('Last backup');
  await page.getByRole('button', { name: 'Back' }).click();
  await chooseCompetitive(page, /Falling pieces/);
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.waitForFunction(() => (window as any).backupCalls.some((r: any) => r.action === 'write' && JSON.parse(r.data).data['coffee-preferences']));
  await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(0));
    scene.dropRow();
  });
  await page.waitForFunction(() => (window as any).backupCalls.some((r: any) => r.action === 'write' && JSON.parse(r.data).data['coffee-falling-records']));
});

test('first launch restores a valid previous generation if main is damaged', { tag: '@backup' }, async ({ page }) => {
  const records = [{ score: 123, rows: 2, playedAt: 1000 }];
  await bridge(page, ['broken', JSON.stringify({ format: 'coffee-match-backup', version: 1, savedAt: 1000, data: {
    'coffee-preferences': JSON.stringify({ language: 'ru', vibration: false, mode: 'falling', version: 1 }),
    'coffee-falling-records': JSON.stringify(records)
  } })]);
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('checkbox', { name: 'Save progress after uninstall' }).check();
  await expect(page.getByRole('button', { name: 'Соревновательный режим' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee-falling-records')!))).toEqual(records);
});

test('invalid copies do not activate or overwrite backup', { tag: '@backup' }, async ({ page }) => {
  await bridge(page, ['broken']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const checkbox = page.getByRole('checkbox', { name: 'Save progress after uninstall' });
  const status = page.locator('.menu-screen [data-backup-status]');
  await expect(status).toHaveText('Backup is not configured.');
  await checkbox.click();
  await expect(status).toContainText('Could not enable');
  await expect(checkbox).not.toBeChecked();
  expect(await page.evaluate(() => (window as any).backupCalls.some((r: any) => ['activate', 'write'].includes(r.action)))).toBe(false);
});

test('browser autosave updates the selected file and stops when disabled', { tag: '@backup' }, async ({ page }) => {
  await page.addInitScript(() => {
    const writes: string[] = [];
    Object.assign(window, {
      writes,
      showSaveFilePicker: async () => ({
        getFile: async () => new File([], 'coffee-match-backup.json'),
        createWritable: async () => ({
          write: async (data: string) => { writes.push(data); },
          close: async () => {}
        })
      })
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const autosave = page.getByRole('checkbox', { name: 'Save progress to a file' });
  await autosave.check();
  await expect(page.locator('[data-browser-backup-status]')).toContainText('Last backup');
  await page.getByRole('checkbox', { name: /Vibration/ }).uncheck();
  await expect.poll(() => page.evaluate(() => {
    const writes = (window as unknown as { writes: string[] }).writes;
    return JSON.parse(JSON.parse(writes.at(-1)!).data['coffee-preferences']).vibration;
  })).toBe(false);
  await autosave.uncheck();
  await page.getByRole('checkbox', { name: /Vibration/ }).check();
  expect(await page.evaluate(() => (window as unknown as { writes: string[] }).writes.length)).toBe(2);
});

test('browser backup restores story progress and records after site data is cleared', { tag: '@backup' }, async ({ page }) => {
  await page.goto('/');
  const records = [{ score: 123, rows: 2, playedAt: 1000 }];
  await page.evaluate(records => {
    localStorage.setItem('coffee-preferences', JSON.stringify({ language: 'en', vibration: true, shadySoulsCheckpoint: 4 }));
    localStorage.setItem('coffee-falling-records', JSON.stringify(records));
  }, records);
  await page.getByRole('button', { name: 'Settings' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download a copy' }).click()
  ]);
  const file = (await download.path())!;
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  const input = page.locator('[data-browser-backup-file]');
  await input.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.locator('[data-browser-backup-status]')).toContainText('Could not restore');
  page.once('dialog', dialog => dialog.accept());
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Restore from file' }).click()
  ]);
  await chooser.setFiles(file);
  await expect(page.getByRole('button', { name: 'Competitive mode' })).toBeVisible();
  const restored = await page.evaluate(() => ({
    checkpoint: JSON.parse(localStorage.getItem('coffee-preferences')!).shadySoulsCheckpoint,
    records: JSON.parse(localStorage.getItem('coffee-falling-records')!)
  }));
  expect(restored).toEqual({ checkpoint: 4, records });
});
