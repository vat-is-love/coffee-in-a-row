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
  await expect(page.getByRole('heading', { name: 'Выберите режим игры' })).toBeVisible();
  await page.getByRole('button', { name: /Падающие ряды/ }).click();
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(0));
    scene.dropRow();
  });
  await expect(page.getByRole('heading', { name: 'Игра окончена · Топ-10' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).vibrations)).toEqual([]);
});
