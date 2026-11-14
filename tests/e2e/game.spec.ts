/**
 * E2E tests for Coffee Match game
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Coffee Match: Match-3 Demo', () => {
  test('loads the playable board without errors', { tag: ['@classic', '@smoke'] }, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error' && !/font|preload/.test(message.text())) {
        errors.push(message.text());
      }
    });
    await ready(page);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
    expect(box?.height).toBeGreaterThan(200);
    expect(errors).toHaveLength(0);
  });

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1280, height: 720 }
  ]) {
    test(`restores the board and fits a ${viewport.width}×${viewport.height} viewport`, { tag: '@classic' }, async ({ page }) => {
      await ready(page);
      await page.setViewportSize(viewport);
      await page.reload();
      await waitForBoard(page);
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
      await expect.poll(async () => (await canvas.boundingBox())?.width).toBeLessThanOrEqual(viewport.width);
    });
  }

  test('keeps the board below the HUD and maps clicks after resizing', { tag: '@classic' }, async ({ page }) => {
    await ready(page);
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
async function ready(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Match three/ }).click();
  await waitForBoard(page);
}

async function waitForBoard(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.scene.isActive('GameScene'));
}

async function candidate(page: Page, valid = true) {
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
        return { a: point(a), b: point(b), expected: result.boardState, cascades: result.cascades, cleared: result.frames.flatMap((frame: any) => frame.matches.flatMap((match: any) => match.tiles.map((p: any) => `${p.row},${p.col}`))) };
      }
    }
    throw new Error('No candidate swap');
  }, valid);
}

async function settled(page: Page) {
  await page.waitForFunction(() => !(window as any).__GAME__.scene.getScene('GameScene').isProcessing);
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('GameScene');
    return { state: scene.state, moves: scene.movesPlayed, score: scene.scoreText.text,
      sprites: scene.board.flat().map((t: any) => ({ row: t.row, col: t.col, x: t.sprite.x, y: t.sprite.y, key: t.sprite.texture.key })) };
  });
}

test('two taps resolve cascades, reject overlapping input, and revert invalid swaps', { tag: '@classic' }, async ({ page }) => {
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

test('native touch swipe resolves a move after resizing', { tag: '@classic' }, async ({ page, context }) => {
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

test('endless board remains playable through 40 moves and pause blocks input', { tag: ['@classic', '@slow'] }, async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.evaluate(async () => {
    const logic = await import('/src/game/logic/index.ts' as string);
    const scene = (window as any).__GAME__.scene.getScene('GameScene');
    scene.state = logic.initializeGame(scene.config, 0);
    scene.renderBoard();
  });
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

test('keyboard swap and resize during animation finish without losing input', { tag: '@classic' }, async ({ page }) => {
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

test('matches clean fixed cells, completion saves once and restart resets progress', { tag: '@classic' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const move = await candidate(page);
  const expectedCells = [...new Set(move.cleared)].sort();
  await page.mouse.click(move.a.x, move.a.y);
  await page.mouse.click(move.b.x, move.b.y);
  await settled(page);
  expect(await page.evaluate(() => [...(window as any).__GAME__.scene.getScene('GameScene').clearedCells].sort())).toEqual(expectedCells);
  // Leave only one cell uncleared; a real successful move must finish the game.
  const last = await candidate(page);
  await page.evaluate((uncleared) => {
    const scene = (window as any).__GAME__.scene.getScene('GameScene');
    scene.clearedCells = new Set(Array.from({ length: 64 }, (_, i) => `${Math.floor(i / 8)},${i % 8}`).filter(cell => cell !== uncleared));
    scene.drawCoating();
  }, last.cleared[0]);
  await page.mouse.click(last.a.x, last.a.y);
  await page.mouse.click(last.b.x, last.b.y);
  const dialog = page.getByRole('dialog', { name: 'Board cleared · Top 10' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.current-result td')).toHaveText(['1', /\d+:\d{2}\.\d/, String(last.expected.score), /.+/]);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('coffee-classic-records')!));
  expect(stored).toHaveLength(1);
  const frozen = await page.evaluate(() => (window as any).__GAME__.scene.getScene('GameScene').elapsed);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).__GAME__.scene.getScene('GameScene').elapsed)).toBe(frozen);
  await dialog.getByRole('button', { name: 'Start again' }).click();
  expect(await page.evaluate(() => (window as any).__GAME__.scene.getScene('GameScene').clearedCells.size)).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee-classic-records')!).length)).toBe(1);
});

test('classic timer stops during pause and settings', { tag: '@classic' }, async ({ page }) => {
  await ready(page);
  const readElapsed = () => page.evaluate(() => (window as any).__GAME__.scene.getScene('GameScene').elapsed);
  expect(await readElapsed()).toBe(0);
  await page.waitForTimeout(200);
  expect(await readElapsed()).toBe(0);

  const move = await candidate(page, false);
  await page.mouse.click(move.a.x, move.a.y);
  await page.mouse.click(move.b.x, move.b.y);
  await settled(page);
  await expect.poll(readElapsed).toBeGreaterThan(0);

  await page.keyboard.press('Escape');
  const elapsed = await readElapsed();
  await page.waitForTimeout(200);
  expect(await readElapsed()).toBe(elapsed);
  await page.keyboard.press('Escape');
  await expect.poll(readElapsed).toBeGreaterThan(elapsed);

  await page.evaluate(() => window.dispatchEvent(new Event('game-settings')));
  const paused = await readElapsed();
  await page.waitForTimeout(200);
  expect(await readElapsed()).toBe(paused);
});
