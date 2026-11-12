import { test, expect } from '@playwright/test';

const STORY_ITEM = 6;
const ROW_CLEAR_ITEM = 7;
const scene = "(window.__GAME__?.scene.getScene('FallingScene'))";

test('Story offers a retry after defeat, advances after each level and offers replay or another mode after victory', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Story mode/ }).click();
  const expectLevel = async (index: number, tileTypes: number) => {
    const score = index < 3 ? 'Tiles cleared: 0 / 100' :
      index < 6 ? 'Tiles cleared: 0 / 100 · Row clear: 0 / 1' : 'Items delivered: 0 / 5';
    await expect.poll(() => page.evaluate(`[${scene}?.levelIndex, ${scene}?.level?.board.tileTypes, ${scene}?.scoreText?.text]`))
      .toEqual([index, tileTypes, score]);
  };
  const removePair = async (cleared: number, delivered?: number) => {
    const point = await page.evaluate(({ cleared, delivered, item }) => {
      const scene = (window as any).__GAME__.scene.getScene('FallingScene');
      scene.cleared = cleared;
      scene.remaining = 4000;
      scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(-1));
      scene.state.grid[7].splice(0, 2, 0, 0);
      if (delivered !== undefined) {
        scene.state.delivered = delivered;
        scene.state.grid[6][0] = item;
      }
      scene.renderBoard();
      const board = scene.boardContainer;
      return { x: board.x + 32 * board.scaleX, y: board.y + 480 * board.scaleY };
    }, { cleared, delivered, item: STORY_ITEM });
    await page.mouse.click(point.x, point.y);
  };
  await expectLevel(0, 3);
  const drop = await page.evaluate(`(() => {
    const scene = ${scene};
    scene.remaining = 3000;
    const button = scene.dropButton.getBounds();
    return { x: button.centerX, y: button.centerY, row: scene.state.nextRow };
  })()`);
  await page.mouse.click(drop.x, drop.y);
  await page.waitForFunction(`${scene}.state.rowsAdded === 1 && !${scene}.isProcessing`);
  expect(await page.evaluate(`${scene}.state.grid[4]`)).toEqual(drop.row);
  expect(await page.evaluate(`${scene}.remaining`)).toBeGreaterThan(3000);

  const completed = page.getByRole('dialog', { name: 'Level complete!' });
  const victory = page.getByRole('dialog', { name: 'You won!' });
  await removePair(97);
  await expect.poll(() => page.evaluate(`${scene}.scoreText.text`)).toBe('Tiles cleared: 99 / 100');
  await removePair(99);
  await expect(completed).toBeVisible();
  expect(await page.evaluate(`${scene}.levelIndex`)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(completed).toBeVisible();
  await completed.getByRole('button', { name: 'Continue' }).click();
  await expectLevel(1, 4);

  await page.evaluate(`${scene}.cleared = 50; ${scene}.state.grid[0][0] = 0; ${scene}.remaining = 0`);
  const defeat = page.getByRole('dialog', { name: 'Board full' });
  await expect(defeat).toBeVisible();
  expect(await page.evaluate(`${scene}.scoreText.text`)).toBe('Tiles cleared: 50 / 100');
  await defeat.getByRole('button', { name: 'Retry level' }).click();
  await expect(defeat).not.toBeVisible();
  await expect.poll(() => page.evaluate(`${scene}.gameOver`)).toBe(false);
  await expectLevel(1, 4);
  await removePair(98);
  await completed.getByRole('button', { name: 'Continue' }).click();
  await expectLevel(2, 5);
  await removePair(98);
  await completed.getByRole('button', { name: 'Continue' }).click();
  for (const [index, colors] of [[3, 3], [4, 4], [5, 5]]) {
    await expectLevel(index, colors);
    await removePair(98);
    await expect.poll(() => page.evaluate(`${scene}.scoreText.text`)).toBe('Tiles cleared: 100 / 100 · Row clear: 0 / 1');
    await expect(completed).not.toBeVisible();

    await page.evaluate(`${scene}.state.rowsAdded = 5; ${scene}.requestDrop()`);
    await page.waitForFunction(`${scene}.state.rowsAdded === 6 && !${scene}.isProcessing`);
    expect(await page.evaluate(`${scene}.preview.map(sprite => sprite.texture.key)`)).not.toContain(`tile-${ROW_CLEAR_ITEM}`);
    await page.evaluate(`${scene}.requestDrop()`);
    await page.waitForFunction(`${scene}.state.rowsAdded === 7 && !${scene}.isProcessing`);
    const lightning = await page.evaluate(`(() => {
      const scene = ${scene};
      const row = scene.state.grid.findIndex(row => row.includes(${ROW_CLEAR_ITEM}));
      const col = scene.state.grid[row].indexOf(${ROW_CLEAR_ITEM});
      const board = scene.boardContainer;
      return { x: board.x + (col * 64 + 32) * board.scaleX, y: board.y + (row * 64 + 32) * board.scaleY };
    })()`);
    await page.mouse.click(lightning.x, lightning.y);
    await completed.getByRole('button', { name: 'Continue' }).click();
  }

  await expectLevel(6, 3);
  await removePair(0, 3);
  await expect.poll(() => page.evaluate(`${scene}.scoreText.text`)).toBe('Items delivered: 4 / 5');
  await expect(completed).not.toBeVisible();
  await removePair(0, 4);
  await completed.getByRole('button', { name: 'Continue' }).click();
  await expectLevel(7, 4);

  // Advance to the preview for row five, then let its item fall into an empty column.
  await page.evaluate(`${scene}.state.rowsAdded = 3; ${scene}.requestDrop()`);
  await page.waitForFunction(`${scene}.state.rowsAdded === 4 && !${scene}.isProcessing`);
  expect(await page.evaluate(`${scene}.preview.map(sprite => sprite.texture.key)`)).toContain(`tile-${STORY_ITEM}`);
  await page.evaluate(`(() => {
    const scene = ${scene};
    scene.state.grid.forEach(row => row.fill(-1));
    scene.renderBoard();
    scene.state.delivered = 4;
    scene.requestDrop();
  })()`);
  await completed.getByRole('button', { name: 'Continue' }).click();
  await expectLevel(8, 5);
  await removePair(0, 4);
  await victory.getByRole('button', { name: 'Start again' }).click();
  await expectLevel(0, 3);

  await page.evaluate(`void ${scene}.scene.restart({ levelIndex: 8 })`);
  await expectLevel(8, 5);
  await removePair(0, 4);
  await victory.getByRole('button', { name: 'Choose' }).click();
  await expect(victory).toBeVisible();
  await victory.getByRole('radio', { name: 'Falling pieces' }).check();
  await victory.getByRole('button', { name: 'Choose' }).click();
  await expect.poll(() => page.evaluate(`${scene}.scoreText.text`)).toContain('Score:');
  await page.reload();
  await expect.poll(() => page.evaluate(`${scene}?.scoreText?.text`)).toContain('Score:');
  await page.evaluate(() => window.dispatchEvent(new Event('game-settings')));
  await expect(page.getByRole('radio', { name: /Falling pieces/ })).toBeChecked();
  await page.getByRole('radio', { name: /Story mode/ }).check();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expectLevel(0, 3);
  await page.reload();
  await expectLevel(0, 3);
});

test('a settled tile flips into lightning during a drop and clears its whole row outward', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: /Story mode/ }).click();
  await page.waitForFunction(`${scene}?.state`);
  await page.evaluate(`void ${scene}.scene.restart({ levelIndex: 3 })`);
  await page.waitForFunction(`${scene}.levelIndex === 3`);
  await page.evaluate(`(() => {
    const scene = ${scene};
    const settled = scene.board.flat().filter(Boolean);
    const turning = new Set();
    const checks = { flipped: false, duringFall: false };
    window.lightningSpawn = checks;
    scene.state.rowsAdded = 6;
    scene.events.on('postupdate', () => {
      for (const tile of settled) {
        if (!tile.sprite.active || tile.sprite.scaleX >= 0.9) continue;
        if (tile.sprite.texture.key !== 'tile-${ROW_CLEAR_ITEM}') turning.add(tile);
        else if (turning.has(tile)) checks.flipped = true;
      }
      if (checks.flipped && scene.board.flat().some(tile => tile && !settled.includes(tile) && tile.sprite.y < tile.row * 64 + 32)) {
        checks.duringFall = true;
      }
    });
    scene.requestDrop();
  })()`);
  await page.waitForFunction(`${scene}.state.rowsAdded === 7 && !${scene}.isProcessing`);
  expect(await page.evaluate('window.lightningSpawn')).toEqual({ flipped: true, duringFall: true });
  expect(await page.evaluate(`${scene}.board.flat().find(tile => tile?.sprite.texture.key === 'tile-${ROW_CLEAR_ITEM}').sprite.scaleX`)).toBe(1);
  const point = await page.evaluate(`(() => {
    const scene = ${scene};
    scene.state.grid.forEach(row => row.fill(-1));
    scene.state.grid[7] = [0, 1, 2, ${ROW_CLEAR_ITEM}, 0, 1, ${ROW_CLEAR_ITEM}, ${STORY_ITEM}];
    scene.state.grid[6][0] = 2;
    scene.renderBoard();
    const [left, , , center, , , , right] = scene.board[7].map(tile => tile.sprite);
    const above = scene.board[6][0].sprite;
    const startY = above.y;
    const checks = { wave: false, fell: false, fellTooSoon: false };
    window.lightningChecks = checks;
    scene.events.on('postupdate', () => {
      if (center.active && center.alpha < left.alpha && center.alpha < right.alpha) checks.wave = true;
      if (above.y > startY) {
        checks.fell = true;
        if (left.active || right.active) checks.fellTooSoon = true;
      }
    });
    const board = scene.boardContainer;
    return { x: board.x + center.x * board.scaleX, y: board.y + center.y * board.scaleY };
  })()`);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(`${scene}.rowClearUsed && !${scene}.isProcessing`);
  expect(await page.evaluate('window.lightningChecks')).toEqual({ wave: true, fell: true, fellTooSoon: false });
  expect(await page.evaluate(`${scene}.state.grid[7]`)).toEqual([2, -1, -1, -1, -1, -1, -1, -1]);
  expect(await page.evaluate(`${scene}.state.delivered`)).toBe(0);
});
