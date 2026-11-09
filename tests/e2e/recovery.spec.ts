import { test, expect } from '@playwright/test';

test('successful interface hides recovery', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose game mode' })).toBeVisible();
  await expect(page.locator('#recovery')).toBeHidden();
});

test('missing main script exposes independent recovery and clipboard fallback', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
  await page.route('**/src/main.ts', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#recovery-actions')).toBeVisible();
  await page.locator('#recovery-copy').click();
  await expect(page.locator('#recovery-text')).toBeVisible();
  await expect(page.locator('#recovery-text')).toHaveValue(/resource-error/);
});

test('startup exception and hung startup recover', async ({ page }) => {
  await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("secret-payload")' }));
  await page.goto('/');
  await expect(page.locator('#recovery-actions')).toBeVisible();
  await page.locator('#recovery-copy').evaluate((button: HTMLElement) => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); button.click(); });
  await expect(page.locator('#recovery-text')).not.toHaveValue(/secret-payload/);
  await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.reload();
  await expect(page.locator('#recovery-actions')).toBeVisible({ timeout: 25000 });
});

test('unavailable storage and vibration do not block startup', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('denied'); };
    Storage.prototype.setItem = () => { throw new Error('denied'); };
    navigator.vibrate = () => { throw new Error('denied'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Falling pieces/ }).click();
  await expect(page.locator('#recovery')).toBeHidden();
});

test('syntax error in main module recovers independently', async ({ page }) => {
  await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'text/javascript', body: 'const = ;' }));
  await page.goto('/');
  await expect(page.locator('#recovery-actions')).toBeVisible();
});

test('corrupt preferences fall back without blocking the interface', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('coffee-preferences', '{broken'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose game mode' })).toBeVisible();
});

test('APK starts with Canvas and remains ready after restoring the selected mode', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { value: navigator.userAgent + ' CoffeeAPK/1.0.5' });
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.includes('webgl')) throw new Error('WebGL unavailable');
      return getContext.apply(this, [type, ...args] as Parameters<typeof getContext>);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose game mode' })).toBeVisible();
  await page.getByRole('button', { name: /Falling pieces/ }).click();
  await expect.poll(() => page.evaluate(() => window.CoffeeRecovery?.isReady())).toBe(true);
  await page.reload();
  await expect(page.locator('#recovery')).toBeHidden();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.CoffeeRecovery?.isReady())).toBe(true);
});
