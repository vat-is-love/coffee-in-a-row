import { test, expect, type Page } from '@playwright/test';

async function sceneValue(page: Page, expression: string) {
  return page.evaluate(expression);
}
async function openSettings(page: Page, key = 'GameScene') {
  const point = await page.evaluate(key => {
    const scene = (window as any).__GAME__.scene.getScene(key);
    const label = scene.hudContainer.list.find((item: any) => item.text?.includes('Settings'));
    const b = label.getBounds();
    return { x: b.centerX, y: b.centerY };
  }, key);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function startFalling(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Falling pieces/ }).click();
  await page.waitForFunction(() => (window as any).__GAME__?.scene.isActive('FallingScene'));
}
const falling = `(window.__GAME__.scene.getScene('FallingScene'))`;

test('mode selection repeats on reload, settings pause the timer, cancel and switch back', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('coffee-game-mode', 'falling'));
  await startFalling(page);
  await openSettings(page, 'FallingScene');
  const frozen = await sceneValue(page, `${falling}.remaining`);
  await page.waitForTimeout(300);
  expect(await sceneValue(page, `${falling}.remaining`)).toBe(frozen);
  await page.getByRole('radio', { name: /Match three/ }).check();
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await sceneValue(page, `window.__GAME__.scene.isActive('FallingScene')`)).toBe(true);
  await openSettings(page, 'FallingScene');
  await page.getByRole('radio', { name: /Match three/ }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await sceneValue(page, `window.__GAME__.scene.isActive('FallingScene')`)).toBe(true);
  await page.reload();
  const picker = page.getByRole('dialog', { name: 'Choose game mode' });
  await expect(picker).toBeVisible();
  await expect(picker.getByText('You can change the mode in settings.')).toBeVisible();
  expect(await sceneValue(page, `window.__GAME__.scene.isActive('FallingScene')`)).toBe(false);
  expect(await sceneValue(page, `window.__GAME__.scene.isActive('GameScene')`)).toBe(false);
  await page.keyboard.press('Escape');
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: /Falling pieces/ }).click();
  await page.waitForFunction(() => (window as any).__GAME__?.scene.isActive('FallingScene'));
  await openSettings(page, 'FallingScene');
  await page.getByRole('radio', { name: /Match three/ }).check();
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.waitForFunction(() => (window as any).__GAME__?.scene.isActive('GameScene'));
  expect(await sceneValue(page, `(window.__GAME__.scene.getScene('GameScene')).state.grid.flat().length`)).toBe(64);
});

test('group removal locks rapid input for one tenth of the row interval even with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startFalling(page);
  const point = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(-1));
    scene.state.grid[7] = [0, 0, 1, 1, 2, 2, 3, 3];
    scene.renderBoard();
    return { x: scene.boardContainer.x + 32 * scene.boardContainer.scaleX, y: scene.boardContainer.y + 480 * scene.boardContainer.scaleY };
  });
  const started = Date.now();
  await page.mouse.click(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(150);
  expect(await sceneValue(page, `${falling}.isProcessing`)).toBe(true);
  await page.waitForFunction(() => !(window as any).__GAME__.scene.getScene('FallingScene').isProcessing);
  expect(Date.now() - started).toBeGreaterThanOrEqual(480);
  expect(await sceneValue(page, `${falling}.state.score`)).toBe(100);
  expect(await sceneValue(page, `${falling}.state.grid.flat().filter(n=>n>=0).length`)).toBe(6);
});

test('row waits for resolution, lands from preview, overflows and restarts on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startFalling(page);
  const preview = await sceneValue(page, `${falling}.state.nextRow`);
  await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.isProcessing = true;
    scene.remaining = 1;
  });
  await page.waitForTimeout(150);
  expect(await sceneValue(page, `${falling}.state.rowsAdded`)).toBe(0);
  await page.evaluate(() => { (window as any).__GAME__.scene.getScene('FallingScene').isProcessing = false; });
  await page.waitForFunction(() => (window as any).__GAME__.scene.getScene('FallingScene').state.rowsAdded === 1);
  await page.waitForFunction(() => !(window as any).__GAME__.scene.getScene('FallingScene').isProcessing);
  expect(await sceneValue(page, `${falling}.state.grid[4]`)).toEqual(preview);
  const bounds = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    return { board: scene.boardContainer.getBounds(), hud: scene.hudContainer.getBounds() };
  });
  expect(bounds.board.y).toBeGreaterThan(bounds.hud.y + bounds.hud.height);
  expect(bounds.board.y + bounds.board.height).toBeLessThanOrEqual(667);
  await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid[0][0] = 1;
    scene.remaining = 0;
  });
  await page.waitForFunction(() => (window as any).__GAME__.scene.getScene('FallingScene').gameOver);
  await expect(page.getByRole('dialog', { name: 'Game over · Top 10' })).toBeVisible();
  await page.getByRole('button', { name: 'Start again', exact: true }).click();
  await page.waitForFunction(() => !(window as any).__GAME__.scene.getScene('FallingScene').gameOver);
  expect(await sceneValue(page, `${falling}.state.score`)).toBe(0);
});


test('preview builds left to right, survives resize, and early drop releases exactly one row', async ({ page }) => {
  await startFalling(page);
  const preview = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.remaining = 3750;
    scene.updateHUD();
    return { colors: scene.state.nextRow, alphas: scene.preview.map((s: any) => s.alpha) };
  });
  expect(preview.alphas).toEqual([1, 1, 0, 0, 0, 0, 0, 0]);
  await page.setViewportSize({ width: 667, height: 375 });
  const button = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    const board = scene.boardContainer.getBounds();
    const b = scene.dropButton.getBounds();
    return { x: b.centerX, y: b.centerY, top: b.top, bottom: b.bottom, boardBottom: board.bottom,
      alphas: scene.preview.map((s: any) => s.alpha) };
  });
  expect(button.alphas[0]).toBe(1);
  expect(button.alphas[7]).toBe(0);
  expect(button.top).toBeGreaterThan(button.boardBottom);
  expect(button.bottom).toBeLessThanOrEqual(375);
  await page.mouse.click(button.x, button.y);
  await page.mouse.click(button.x, button.y);
  await page.waitForFunction(() => !(window as any).__GAME__.scene.getScene('FallingScene').isProcessing);
  expect(await sceneValue(page, `${falling}.state.rowsAdded`)).toBe(1);
  expect(await sceneValue(page, `${falling}.state.grid[4]`)).toEqual(preview.colors);
  expect(await sceneValue(page, `${falling}.remaining`)).toBeGreaterThan(3500);
});

test('early drop completes the preview and waits for the current spinning removal', async ({ page }) => {
  await startFalling(page);
  const points = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(-1));
    scene.state.grid[7] = [0, 0, 1, 1, 2, 2, 3, 3];
    scene.renderBoard();
    const tile = scene.board[7][0].sprite;
    const b = scene.dropButton.getBounds();
    return { tile: { x: scene.boardContainer.x + tile.x * scene.boardContainer.scaleX,
      y: scene.boardContainer.y + tile.y * scene.boardContainer.scaleY }, button: { x: b.centerX, y: b.centerY } };
  });
  await page.mouse.click(points.tile.x, points.tile.y);
  await page.waitForTimeout(90);
  const spin = await page.evaluate(() => {
    const tile = (window as any).__GAME__.scene.getScene('FallingScene').board[7][0].sprite;
    return { x: tile.scaleX, y: tile.scaleY };
  });
  expect(spin.y).toBe(1);
  expect(spin.x).toBeLessThan(0.9);
  await page.mouse.click(points.button.x, points.button.y);
  expect(await sceneValue(page, `${falling}.state.rowsAdded`)).toBe(0);
  expect(await sceneValue(page, `${falling}.preview.map(s=>s.alpha)`)).toEqual(Array(8).fill(1));
  await page.waitForFunction(() => (window as any).__GAME__.scene.getScene('FallingScene').state.rowsAdded === 1);
  await page.waitForFunction(() => !(window as any).__GAME__.scene.getScene('FallingScene').isProcessing);
  expect(await sceneValue(page, `${falling}.state.grid.flat().filter(n=>n>=0).length`)).toBe(14);
});


test('leaderboard keeps top ten, shows a lower current rank, and persists across games', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('coffee-falling-records', JSON.stringify(Array.from({ length: 12 }, (_, i) => ({
      score: 1200 - i * 100, rows: 20 - i, playedAt: 1700000000000 + i * 1000
    }))));
  });
  await startFalling(page);
  const lose = async (score: number, rows: number) => {
    await page.evaluate(({ score, rows }) => {
      const scene = (window as any).__GAME__.scene.getScene('FallingScene');
      scene.state.score = score;
      scene.state.rowsAdded = rows;
      scene.state.grid[0][0] = 1;
      scene.remaining = 0;
    }, { score, rows });
    await expect(page.getByRole('dialog', { name: 'Game over · Top 10' })).toBeVisible();
  };
  await lose(50, 3);
  const dialog = page.getByRole('dialog', { name: 'Game over · Top 10' });
  await expect(dialog.locator('tbody tr')).toHaveCount(12);
  await expect(dialog.locator('.leaderboard-gap')).toHaveText('···');
  await expect(dialog.locator('.current-result td')).toHaveText(['13', '3', '50', /.+/]);
  await page.getByRole('button', { name: 'Start again', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await lose(2000, 30);
  await expect(dialog.locator('tbody tr')).toHaveCount(10);
  await expect(dialog.locator('.leaderboard-gap')).toHaveCount(0);
  await expect(dialog.locator('tbody tr').first().locator('td')).toHaveText(['1', '30', '2000', /.+/]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee-falling-records')!).length)).toBe(14);
});

test('buffers only the last tapped tile and follows it as columns move', async ({ page }) => {
  await startFalling(page);
  const points = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(-1));
    scene.state.grid[7] = [0, 0, 1, 1, 2, 2, 3, 3];
    scene.renderBoard();
    return [0, 4, 6].map(col => ({
      x: scene.boardContainer.x + (col * 64 + 32) * scene.boardContainer.scaleX,
      y: scene.boardContainer.y + 480 * scene.boardContainer.scaleY
    }));
  });
  for (const point of points) await page.mouse.click(point.x, point.y);
  expect(await sceneValue(page, `${falling}.pendingOutline.commandBuffer.length`)).toBeGreaterThan(0);
  await page.waitForFunction(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    return scene.state.score === 200 && !scene.isProcessing;
  });
  expect(await sceneValue(page, `${falling}.state.grid.flat().filter(n=>n>=0).sort()`)).toEqual([1, 1, 2, 2]);
  expect(await sceneValue(page, `${falling}.pendingTile`)).toBe(null);
  expect(await sceneValue(page, `${falling}.pendingOutline.commandBuffer.length`)).toBe(0);
});


test('pending outline skips singletons and moves with the last selected group', async ({ page }) => {
  await startFalling(page);
  const result = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(-1));
    scene.state.grid[7] = [0, 0, 1, 2, 2, 3, 3, -1];
    scene.renderBoard();
    void scene.remove({ row: 7, col: 0 });
    const tap = (col: number) => {
      scene.click({
        x: scene.boardContainer.x + (col * 64 + 32) * scene.boardContainer.scaleX,
        y: scene.boardContainer.y + 480 * scene.boardContainer.scaleY
      });
      return scene.pendingOutline.commandBuffer.length;
    };
    const singleton = tap(2);
    const group = tap(3);
    const first = scene.pendingTile;
    const replacement = tap(5);
    const changed = first !== scene.pendingTile;
    tap(7);
    return { singleton, group, replacement, changed, empty: scene.pendingOutline.commandBuffer.length };
  });
  expect(result.singleton).toBe(0);
  expect(result.group).toBeGreaterThan(0);
  expect(result.replacement).toBeGreaterThan(0);
  expect(result.changed).toBe(true);
  expect(result.empty).toBe(0);
});
