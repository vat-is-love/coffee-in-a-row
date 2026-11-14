import { test, expect, type Page } from '@playwright/test';

const STORY_ITEM = 6;
const ROW_CLEAR_ITEM = 7;
const scene = "(window.__GAME__?.scene.getScene('FallingScene'))";

async function selectMode(page: Page, value: 'story' | 'story-large' | 'falling') {
  await page.evaluate(() => window.dispatchEvent(new Event('game-settings')));
  await page.locator(`dialog[open] input[name="mode"][value="${value}"]`).check();
  await page.getByRole('button', { name: 'Apply' }).click();
}

test('Story retries after defeat and requires both the tile goal and a buff when configured', { tag: '@story' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('button[value="story"]').click();
  await page.waitForFunction(`${scene}?.state`);

  const completed = page.getByRole('dialog', { name: 'Stage cleared' });
  const removePair = async () => {
    await page.evaluate(`(() => {
      const scene = ${scene};
      scene.remaining = 4000;
      scene.state.grid.forEach(row => row.fill(-1));
      scene.state.grid.at(-1).splice(0, 2, 0, 0);
      scene.renderBoard();
      scene.selected = { row: scene.state.grid.length - 1, col: 0 };
    })()`);
    await page.keyboard.press('Enter');
  };
  await removePair();
  await expect.poll(() => page.evaluate(`${scene}.scoreText.text`)).toBe('Tiles cleared: 2 / 4');
  await removePair();
  await expect(completed).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(completed).toBeVisible();
  await completed.getByRole('button', { name: 'Next stage' }).click();
  await page.waitForFunction(`${scene}.levelIndex === 1`);

  await page.evaluate(`${scene}.state.grid[0][0] = 0; ${scene}.remaining = 0`);
  const defeat = page.getByRole('dialog', { name: 'Board full' });
  await defeat.getByRole('button', { name: 'Retry level' }).click();
  await expect.poll(() => page.evaluate(`[${scene}.levelIndex, ${scene}.gameOver, ${scene}.scoreText.text]`))
    .toEqual([1, false, 'Tiles cleared: 0 / 2 · Buffs used: 0 / 1']);
  await removePair();
  await expect.poll(() => page.evaluate(`${scene}.scoreText.text`)).toBe('Tiles cleared: 2 / 2 · Buffs used: 0 / 1');
  await expect(completed).not.toBeVisible();

  await page.evaluate(`(() => {
    const scene = ${scene};
    scene.state.grid.at(-1)[0] = ${ROW_CLEAR_ITEM};
    scene.renderBoard();
  })()`);
  await page.keyboard.press('Enter');
  await completed.getByRole('button', { name: 'Next stage' }).click();
  await expect.poll(() => page.evaluate(`[${scene}.levelIndex, ${scene}.scoreText.text]`)).toEqual([2, 'Items delivered: 0 / 2']);
});

test('a larger Story delivers a cup from the preview and joins both groups for one tap', { tag: '@story' }, async ({ page, hasTouch }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('coffee-preferences', JSON.stringify({
      language: 'en', vibration: false, largeStoryCheckpoint: 2
    }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Story mode (12×12)' }).click();
  await page.getByRole('button', { name: 'Continue Level 3' }).click();
  await page.waitForFunction(`${scene}?.levelIndex === 2 && ${scene}.dropButton`);
  expect(await page.evaluate(`[${scene}.state.grid.length, ${scene}.preview.length]`)).toEqual([12, 12]);
  await page.evaluate(`${scene}.requestDrop()`);
  await page.waitForFunction(`${scene}.state.rowsAdded === 1 && !${scene}.isProcessing`);
  expect(await page.evaluate(`${scene}.preview.map(tile => tile.texture.key)`)).toContain(`tile-${STORY_ITEM}`);

  const drop = await page.evaluate(`(() => {
    const scene = ${scene};
    scene.state.grid.forEach(row => row.fill(-1));
    scene.renderBoard();
    scene.state.nextRow = [0, 1, 0, 1, 2, 2, ${STORY_ITEM}, 2, 2, 1, 0, 1];
    scene.remaining = 2000;
    const button = scene.dropButton.getBounds();
    return { x: button.centerX, y: button.centerY };
  })()`);
  const tap = ({ x, y }: { x: number; y: number }) => hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  await tap(drop);
  const victory = page.getByRole('dialog', { name: 'Story cleared' });
  await expect.poll(() => page.evaluate(`${scene}.scoreText.text`)).toBe('Items delivered: 1 / 2');
  expect(await page.evaluate(`${scene}.state.grid.at(-1)`)).toEqual([0, 1, 0, 1, 2, 2, 2, 2, 1, 0, 1, -1]);
  expect(await page.evaluate(`${scene}.board.at(-1).map(tile => tile?.sprite.x ?? null)`))
    .toEqual([...Array.from({ length: 11 }, (_, col) => col * 64 + 32), null]);
  const bean = await page.evaluate(`(() => {
    const scene = ${scene};
    const board = scene.boardContainer;
    const sprite = scene.board.at(-1)[4].sprite;
    return { x: board.x + sprite.x * board.scaleX, y: board.y + sprite.y * board.scaleY };
  })()`);
  await tap(bean);
  await page.waitForFunction(`!${scene}.isProcessing && ${scene}.state.score > 0`);
  expect(await page.evaluate(`${scene}.state.grid.at(-1).filter(tile => tile === 2)`)).toEqual([]);

  await page.evaluate(`${scene}.state.delivered = 2; ${scene}.requestDrop()`);
  await victory.getByRole('button', { name: 'Replay story' }).click();
  await expect.poll(() => page.evaluate(`[${scene}.levelIndex, ${scene}.level.board.cols]`)).toEqual([0, 12]);
  await page.evaluate(`void ${scene}.scene.restart({ levelIndex: 2 })`);
  await page.waitForFunction(`${scene}.levelIndex === 2`);
  await page.evaluate(`${scene}.state.delivered = 2; ${scene}.requestDrop()`);
  await victory.getByRole('button', { name: 'Choose' }).click();
  await expect(victory).toBeVisible();
  await victory.getByRole('radio', { name: 'Falling pieces' }).check();
  await victory.getByRole('button', { name: 'Choose' }).click();
  await expect.poll(() => page.evaluate(`${scene}.scoreText.text`)).toContain('Score:');
});

test('switching modes keeps separate Story checkpoints until the player starts a new game', { tag: ['@story', '@smoke'] }, async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('coffee-preferences') === null) {
      localStorage.setItem('coffee-preferences', JSON.stringify({
        language: 'en', vibration: false, mode: 'falling', storyMode: true, storyCheckpoint: 1, largeStoryCheckpoint: 2
      }));
    }
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(`${scene}?.scoreText?.text`)).toContain('Score:');
  await selectMode(page, 'story');
  const storyPicker = page.getByRole('dialog', { name: 'Story mode', exact: true });
  await storyPicker.getByRole('button', { name: 'Continue Level 2' }).click();
  const level = (index: number, size: number) => expect.poll(() =>
    page.evaluate(`[${scene}?.levelIndex, ${scene}?.level?.board.cols]`)).toEqual([index, size]);
  await level(1, 8);

  await selectMode(page, 'story-large');
  const largePicker = page.getByRole('dialog', { name: 'Story mode (12×12)', exact: true });
  await largePicker.getByRole('button', { name: 'Continue Level 3' }).click();
  await level(2, 12);
  await page.reload();
  await expect.poll(() => page.evaluate(`${scene}?.scoreText?.text`)).toContain('Score:');
  await selectMode(page, 'story-large');
  await largePicker.getByRole('button', { name: 'New game' }).click();
  await level(0, 12);
  await selectMode(page, 'story');
  await storyPicker.getByRole('button', { name: 'Continue Level 2' }).click();
  await level(1, 8);
  await selectMode(page, 'story-large');
  await level(0, 12);
});

test('a settled tile flips into lightning during a drop and clears its whole row outward', { tag: '@story' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('button[value="story"]').click();
  await page.waitForFunction(`${scene}?.state`);
  await page.evaluate(`void ${scene}.scene.restart({ levelIndex: 1 })`);
  await page.waitForFunction(`${scene}.levelIndex === 1`);
  await page.evaluate(`(() => {
    const scene = ${scene};
    const settled = scene.board.flat().filter(Boolean);
    const turning = new Set();
    const checks = { flipped: false, duringFall: false };
    window.lightningSpawn = checks;
    scene.state.rowsAdded = 1;
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
  await page.waitForFunction(`${scene}.state.rowsAdded === 2 && !${scene}.isProcessing`);
  expect(await page.evaluate('window.lightningSpawn')).toEqual({ flipped: true, duringFall: true });
  expect(await page.evaluate(`${scene}.board.flat().find(tile => tile?.sprite.texture.key === 'tile-${ROW_CLEAR_ITEM}').sprite.scaleX`)).toBe(1);
  const point = await page.evaluate(`(() => {
    const scene = ${scene};
    scene.state.grid.forEach(row => row.fill(-1));
    scene.state.grid[7] = [0, 1, 2, ${ROW_CLEAR_ITEM}, 0, 1, ${ROW_CLEAR_ITEM}, ${STORY_ITEM}];
    scene.state.grid[6][0] = 2;
    scene.state.grid[6][7] = 2;
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
  await page.waitForFunction(`${scene}.buffUsed && !${scene}.isProcessing`);
  expect(await page.evaluate('window.lightningChecks')).toEqual({ wave: true, fell: true, fellTooSoon: false });
  expect(await page.evaluate(`${scene}.state.grid[7]`)).toEqual([-1, -1, -1, 2, 2, -1, -1, -1]);
  expect(await page.evaluate(`${scene}.board[7].filter(Boolean).map(tile => tile.sprite.x)`)).toEqual([3 * 64 + 32, 4 * 64 + 32]);
  expect(await page.evaluate(`${scene}.state.delivered`)).toBe(0);
});
