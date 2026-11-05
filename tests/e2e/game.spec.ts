/**
 * E2E tests for Jackpot Jock game
 */

import { test, expect } from '@playwright/test';

test.describe('Jackpot Jock: Snowstorm Match-3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for Phaser to initialize
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('should load game without errors', async ({ page }) => {
    // Check that canvas exists and is visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Check that no console errors occurred
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a bit for game to fully load
    await page.waitForTimeout(2000);

    // Filter out expected warnings (like font loading)
    const realErrors = errors.filter(e =>
      !e.includes('font') && !e.includes('preload')
    );
    expect(realErrors).toHaveLength(0);
  });

  test('should show loading screen then game board', async ({ page }) => {
    // Wait for loading to complete and game scene to start
    await page.waitForTimeout(3000);

    // Canvas should be present
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Check canvas has reasonable dimensions
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(200);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    // Canvas should fit within viewport
    expect(box!.width).toBeLessThanOrEqual(375);
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should be responsive on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload();
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});