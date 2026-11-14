import { test, expect } from '@playwright/test';

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
  await page.getByRole('checkbox', { name: 'Save progress after uninstall' }).check();
  await expect(page.locator('.mode-picker [data-backup-status]')).toContainText('Last backup');
  await page.getByRole('button', { name: /Falling pieces/ }).click();
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
  await page.getByRole('checkbox', { name: 'Save progress after uninstall' }).check();
  await page.waitForFunction(() => (window as any).__GAME__?.scene.isActive('FallingScene'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee-falling-records')!))).toEqual(records);
});

test('invalid copies do not activate or overwrite backup', { tag: '@backup' }, async ({ page }) => {
  await bridge(page, ['broken']);
  await page.goto('/');
  const checkbox = page.getByRole('checkbox', { name: 'Save progress after uninstall' });
  const status = page.locator('.mode-picker [data-backup-status]');
  await expect(status).toHaveText('Backup is not configured.');
  await checkbox.click();
  await expect(status).toContainText('Could not enable');
  await expect(checkbox).not.toBeChecked();
  expect(await page.evaluate(() => (window as any).backupCalls.some((r: any) => ['activate', 'write'].includes(r.action)))).toBe(false);
});
