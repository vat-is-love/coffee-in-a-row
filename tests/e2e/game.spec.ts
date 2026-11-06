/**
 * E2E tests for Coffee Match game
 */

import { test, expect } from '@playwright/test';

test.describe('Coffee Match: Match-3 Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for Phaser to initialize
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.getByRole('button', { name: /Match three/ }).click();
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
    await page.getByRole('button', { name: /Match three/ }).click();
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
    await page.getByRole('button', { name: /Match three/ }).click();
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should be responsive on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload();
    await page.getByRole('button', { name: /Match three/ }).click();
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('keeps the board below the HUD and maps clicks after resizing', async ({ page }) => {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
      { width: 667, height: 375 }
    ]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.evaluate(() => {
        const game = (window as any).__GAME__;
        return { active: game?.scene.isActive('GameScene'), width: game?.scale.width, inner: innerWidth };
      }), { timeout: 5000 }).toEqual({ active: true, width: viewport.width, inner: viewport.width });
      const canvasBounds = await page.locator('canvas').boundingBox();
      expect(canvasBounds!.x).toBeGreaterThanOrEqual(0);
      expect(canvasBounds!.x + canvasBounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      const layout = await page.evaluate(() => {
        const scene = (window as any).__GAME__.scene.getScene('GameScene');
        const board = scene.boardContainer;
        const bounds = board.getBounds();
        return {
          left: bounds.left, right: bounds.right,
          top: bounds.top, bottom: bounds.bottom,
          hudBottom: scene.hudContainer.getBounds().bottom,
          x: board.x + 32 * board.scaleX,
          y: board.y + 32 * board.scaleY,
          rows: scene.board.length,
          columns: scene.board[0].length
        };
      });
      expect(layout.rows).toBe(8);
      expect(layout.columns).toBe(8);
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(viewport.width);
      expect(layout.top).toBeGreaterThan(layout.hudBottom + 8);
      expect(layout.bottom).toBeLessThanOrEqual(viewport.height);
      await page.mouse.click(layout.x, layout.y);
      expect(await page.evaluate(() => {
        const tile = (window as any).__GAME__.scene.getScene('GameScene').selectedTile;
        return tile ? [tile.row, tile.col] : null;
      })).toEqual([0, 0]);
      await page.mouse.click(layout.x, layout.y);
    }
  });

});
async function ready(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Match three/ }).click();
  await page.waitForFunction(() => (window as any).__GAME__?.scene.isActive('GameScene'));
}

async function candidate(page: import('@playwright/test').Page, valid = true) {
  return page.evaluate(async (wantValid) => {
    const path = '/src/game/logic/index.ts';
    const logic = await import(path);
    const scene = (window as any).__GAME__.scene.getScene('GameScene');
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const a = { row, col }, b = { row: row + dr, col: col + dc };
        if (b.row >= 8 || b.col >= 8) continue;
        const result = logic.simulateMove(scene.config, scene.state, a, b, { endless: true });
        if (result.valid !== wantValid) continue;
        const point = (p: typeof a) => ({
          x: scene.boardContainer.x + (p.col * 64 + 32) * scene.boardContainer.scaleX,
          y: scene.boardContainer.y + (p.row * 64 + 32) * scene.boardContainer.scaleY
        });
        return { a: point(a), b: point(b), expected: result.boardState, cascades: result.cascades };
      }
    }
    throw new Error('No candidate swap');
  }, valid);
}

async function settled(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => !(window as any).__GAME__.scene.getScene('GameScene').isProcessing);
}

async function snapshot(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('GameScene');
    return { state: scene.state, moves: scene.movesPlayed, score: scene.scoreText.text,
      sprites: scene.board.flat().map((t: any) => ({ row: t.row, col: t.col, x: t.sprite.x, y: t.sprite.y, key: t.sprite.texture.key })) };
  });
}

test('two taps resolve cascades, reject overlapping input, and revert invalid swaps', async ({ page }) => {
  await ready(page);
  const invalid = await candidate(page, false);
  const before = await snapshot(page);
  await page.mouse.click(invalid.a.x, invalid.a.y);
  await page.mouse.click(invalid.b.x, invalid.b.y);
  await settled(page);
  expect((await snapshot(page)).state).toEqual(before.state);
  expect((await snapshot(page)).moves).toBe(0);

  for (let i = 0; i < 3; i++) {
    const move = await candidate(page);
    await page.mouse.click(move.a.x, move.a.y);
    await page.mouse.click(move.b.x, move.b.y);
    await page.mouse.click(move.a.x, move.a.y);
    await settled(page);
    const after = await snapshot(page);
    expect(after.state).toEqual(move.expected);
    expect(after.moves).toBe(i + 1);
    expect(after.score).toBe(`Score: ${move.expected.score}`);
    for (const sprite of after.sprites) {
      expect(sprite.x).toBe(sprite.col * 64 + 32);
      expect(sprite.y).toBe(sprite.row * 64 + 32);
      expect(sprite.key).toBe(`tile-${move.expected.grid[sprite.row][sprite.col].type}`);
    }
  }
});

test('native touch swipe resolves a move after resizing', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await ready(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForFunction(() => (window as any).__GAME__.scale.width === 320);
  const move = await candidate(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...move.a, id: 0 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...move.b, id: 0 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => (window as any).__GAME__.scene.getScene('GameScene').movesPlayed === 1);
  await settled(page);
  expect((await snapshot(page)).state).toEqual(move.expected);
});

test('endless board remains playable through 40 moves and pause blocks input', async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.keyboard.press('Escape');
  const frozen = await snapshot(page);
  const move = await candidate(page);
  await page.mouse.click(move.a.x, move.a.y);
  await page.mouse.click(move.b.x, move.b.y);
  expect((await snapshot(page)).state).toEqual(frozen.state);
  await page.keyboard.press('Escape');
  let cascadeSeen = false;
  for (let i = 0; i < 40; i++) {
    const next = await candidate(page);
    cascadeSeen ||= next.cascades > 1;
    if (i < 2) {
      await page.mouse.move(next.a.x, next.a.y);
      await page.mouse.down();
      await page.mouse.move(next.b.x, next.b.y, { steps: 3 });
      await page.mouse.up();
    } else {
      await page.mouse.click(next.a.x, next.a.y);
      await page.mouse.click(next.b.x, next.b.y);
    }
    await settled(page);
    const current = await snapshot(page);
    expect(current.state).toEqual(next.expected);
    expect(current.moves).toBe(i + 1);
  }
  expect(cascadeSeen).toBe(true);
});

test('keyboard swap and resize during animation finish without losing input', async ({ page }) => {
  await ready(page);
  const move = await candidate(page);
  await page.mouse.click(move.a.x, move.a.y);
  const direction = Math.abs(move.b.x - move.a.x) > Math.abs(move.b.y - move.a.y) ? 'ArrowRight' : 'ArrowDown';
  await page.keyboard.press(`Shift+${direction}`);
  await page.setViewportSize({ width: 667, height: 375 });
  await settled(page);
  expect((await snapshot(page)).state).toEqual(move.expected);
  const next = await candidate(page);
  await page.mouse.click(next.a.x, next.a.y);
  await page.mouse.click(next.b.x, next.b.y);
  await settled(page);
  expect((await snapshot(page)).moves).toBe(2);
});
