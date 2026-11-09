import { test, expect } from '@playwright/test';

test('language and vibration apply without resetting the board and persist on reload', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).vibrations = [];
    navigator.vibrate = pattern => { (window as any).vibrations.push(pattern); return true; };
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Falling pieces/ }).click();
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.score = 123;
    window.dispatchEvent(new Event('game-settings'));
  });
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ru');
  await page.getByRole('checkbox', { name: /Vibration/ }).uncheck();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__GAME__.scene.getScene('FallingScene').state.score)).toBe(123);
  await page.evaluate(() => window.dispatchEvent(new Event('game-settings')));
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Вибрация/ })).not.toBeChecked();
  await page.getByRole('combobox', { name: 'Язык' }).selectOption('en');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Выберите режим игры' })).not.toBeVisible();
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(0));
    scene.dropRow();
  });
  await expect(page.getByRole('heading', { name: 'Игра окончена · Топ-10' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).vibrations)).toEqual([]);
});

test('first launch language and mode are remembered; settings can change the saved mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language / Язык' }).selectOption('ru');
  await page.getByRole('button', { name: /Falling pieces/ }).click();
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.evaluate(() => window.dispatchEvent(new Event('game-settings')));
  await page.locator('input[name="mode"][value="classic"]').check();
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('GameScene'));
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('GameScene'));
});

test('update control is exclusive to APK and handles a failed check', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Falling pieces/ }).click();
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.evaluate(() => window.dispatchEvent(new Event('game-settings')));
  await expect(page.locator('[data-update-game]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { value: navigator.userAgent + ' CoffeeAPK/1.0.3' });
    Object.defineProperty(navigator, 'onLine', { value: false });
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.evaluate(() => window.dispatchEvent(new Event('game-settings')));
  await page.getByRole('button', { name: 'Update game', exact: true }).click();
  await expect(page.locator('[data-update-status]')).toHaveText('Update failed. Check your connection and try again.');
  await expect(page.getByRole('button', { name: 'Update game', exact: true })).toBeEnabled();
});
