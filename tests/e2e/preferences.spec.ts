import { test, expect } from '@playwright/test';
import { chooseCompetitive } from './menu';

test('language and vibration apply without resetting the board and persist on reload', { tag: '@preferences' }, async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).vibrations = [];
    navigator.vibrate = pattern => { (window as any).vibrations.push(pattern); return true; };
  });
  await page.goto('/');
  await chooseCompetitive(page, /Falling pieces/);
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
  await chooseCompetitive(page, /Падающие ряды/);
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(0));
    scene.dropRow();
  });
  await expect(page.getByRole('heading', { name: 'Игра окончена · Топ-10' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).vibrations)).toEqual([]);
});

test('main menu settings apply on a separate screen and persist after reload', { tag: ['@preferences', '@smoke'] }, async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ru');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: 'Настройки' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Настройки' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Match' })).toBeVisible();
});

test('update control is exclusive to APK and handles a failed check', { tag: '@preferences' }, async ({ page }) => {
  await page.goto('/');
  await chooseCompetitive(page, /Falling pieces/);
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.evaluate(() => window.dispatchEvent(new Event('game-settings')));
  await expect(page.locator('[data-update-game]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { value: navigator.userAgent + ' CoffeeAPK/1.0.3' });
    Object.defineProperty(navigator, 'onLine', { value: false });
  });
  await page.reload();
  await chooseCompetitive(page, /Falling pieces/);
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.evaluate(() => window.dispatchEvent(new Event('game-settings')));
  await page.getByRole('button', { name: 'Update game', exact: true }).click();
  await expect(page.locator('[data-update-status]')).toHaveText('Update failed. Check your connection and try again.');
  await expect(page.getByRole('button', { name: 'Update game', exact: true })).toBeEnabled();
});

test('the Android update button starts both checks even if the web check fails', { tag: '@preferences' }, async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: navigator.userAgent + ' CoffeeUpdater/1 CoffeeAPK/1.0.10'
    });
    Object.defineProperty(navigator, 'onLine', { value: false });
    window.prompt = (message, value) => {
      document.documentElement.dataset.updateRequest = `${message}:${value}`;
      return 'accepted';
    };
  });
  await page.goto('/');
  await chooseCompetitive(page, /Falling pieces/);
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.evaluate(() => window.dispatchEvent(new Event('game-settings')));
  const button = page.getByRole('button', { name: 'Check for updates', exact: true });
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-update-request', 'coffee-apk-update:en');
  await expect(page.locator('[data-update-status]')).toHaveText('Could not update the game. Check your connection and try again.');
  await expect(button).toBeEnabled();
});

test('the main menu exit uses the Android wrapper when it advertises support', { tag: ['@preferences', '@smoke'] }, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Coffee Match' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exit', exact: true })).toHaveCount(0);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { value: navigator.userAgent + ' CoffeeExit/1 CoffeeAPK/1.0.11' });
    window.prompt = message => {
      document.documentElement.dataset.nativeRequest = message;
      return 'accepted';
    };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-native-request', 'coffee-exit');
});
