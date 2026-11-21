import { expect, test } from '@playwright/test';
import { beginStoryLevel, openStoryMap } from './menu';

test('a promo code unlocks a hidden story and survives a reload', { tag: ['@preferences', '@story'] }, async ({ page }) => {
  const downloads: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/on-demand/')) downloads.push(new URL(request.url()).search);
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Story mode', exact: true }).click();
  const hiddenStory = /^Promo test campaign/;
  await expect(page.getByRole('button', { name: hiddenStory })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const code = page.getByLabel('Promo code');
  const status = page.locator('[data-promo-status]');
  expect(downloads).toEqual([]);
  await code.fill('0'.repeat(32));
  await code.press('Enter');
  await expect(status).toHaveText('Invalid promo code.');
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem('coffee-preferences') ?? '{}').campaignPromoCode
  )).toBeUndefined();
  await code.fill('  B0783D914560EE2A1B64B1DAB15F375B  ');
  await page.getByRole('button', { name: 'Redeem' }).click();
  await expect(status).toHaveText('Campaign unlocked.');
  await expect(code).toBeEmpty();
  expect(downloads).toEqual(['', '']);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Coffee Match' })).toBeVisible();
  expect(downloads).toHaveLength(2);
  await openStoryMap(page, hiddenStory);
  await page.getByRole('button', { name: 'Level 1', exact: true }).click();
  await beginStoryLevel(page, 1);
  expect(await page.evaluate("window.__GAME__.registry.get('gameMode')")).toBe('bonus-story');
  expect(downloads).toEqual(['', '', '']);
});
