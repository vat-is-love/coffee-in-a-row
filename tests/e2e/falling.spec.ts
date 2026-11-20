import { test, expect, type Page } from '@playwright/test';
import { chooseCompetitive } from './menu';

async function sceneValue(page: Page, expression: string) {
  return page.evaluate(expression);
}
async function startFalling(page: Page) {
  await page.goto('/');
  await chooseCompetitive(page, /Falling pieces/);
  await page.waitForFunction(() => (window as any).__GAME__?.scene.isActive('FallingScene'));
}
const falling = `(window.__GAME__.scene.getScene('FallingScene'))`;

test('Zen Mode restores lives after twenty rows and keeps separate rankings', { tag: '@falling' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('coffee-preferences', JSON.stringify({ language: 'en', vibration: false, storyWithoutLives: true }));
    localStorage.setItem('coffee-falling-records', JSON.stringify([{ score: 999, rows: 99, playedAt: 1 }]));
  });
  await page.goto('/');
  await chooseCompetitive(page, /Zen Mode/);
  await page.waitForFunction(`${falling}?.hearts.length === 3`);

  const drop = (overflow: boolean) => page.evaluate(`(async () => {
    const scene = ${falling};
    scene.state.grid.forEach(row => {
      row.fill(-1);
      if (${overflow}) row[0] = 0;
    });
    scene.renderBoard();
    await scene.dropRow();
    return scene.lifeCharge;
  })()`);
  expect(await sceneValue(page, `${falling}.lifeCharge`)).toBe(60);
  expect(await drop(true)).toBe(40);
  for (let row = 1; row <= 20; row++) expect(await drop(false)).toBe(40 + row);
  for (const charge of [40, 20, 0]) expect(await drop(true)).toBe(charge);
  await drop(true);

  const leaderboard = page.getByRole('dialog', { name: 'Game over · Top 10' });
  await expect(leaderboard.locator('tbody tr')).toHaveCount(1);
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem('coffee-falling-records')!));
  expect(records).toEqual([
    { score: 0, rows: 20, playedAt: expect.any(Number), zen: true },
    { score: 999, rows: 99, playedAt: 1 }
  ]);
});

test('game menu and settings suspend the round and can resume it', { tag: ['@falling', '@smoke'] }, async ({ page, hasTouch }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await startFalling(page);
  expect(await sceneValue(page, `${falling}.hearts.length`)).toBe(0);
  const openMenu = async () => {
    const point = await page.evaluate(`(() => {
      const hud = ${falling}.hudContainer;
      const button = hud.getByName('game-menu');
      return { x: hud.x + button.x + 22, y: hud.y + button.y + 22 };
    })()`);
    if (hasTouch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  };
  const textures = () => sceneValue(page, `[
    ...${falling}.board.flat().filter(Boolean).map(tile => tile.sprite.texture.key),
    ...${falling}.preview.map(sprite => sprite.texture.key)
  ]`) as Promise<string[]>;
  const originalTextures = await textures();
  const maskedTextures = originalTextures.map(() => 'tile-paused');
  const watchTurn = (texture: string) => page.evaluate(`(() => {
    const sprite = ${falling}.board.flat().find(Boolean).sprite;
    let previous = sprite.scaleX;
    const directions = [];
    let minWidth = previous;
    window.pauseTurn = new Promise(resolve => {
      function sample() {
        const width = sprite.scaleX;
        const direction = Math.sign(width - previous);
        if (direction && direction !== directions.at(-1)) directions.push(direction);
        minWidth = Math.min(minWidth, width);
        previous = width;
        if (sprite.texture.key === ${JSON.stringify(texture)} && width === 1) {
          resolve({ directions, minWidth, scaleY: sprite.scaleY, rotation: sprite.rotation });
        } else {
          requestAnimationFrame(sample);
        }
      }
      sample();
    });
  })()`);
  const expectOneTurn = async () => {
    const { minWidth, ...turn } = await sceneValue(page, 'window.pauseTurn');
    expect(turn).toEqual({ directions: [-1, 1], scaleY: 1, rotation: 0 });
    expect(minWidth).toBeGreaterThanOrEqual(0);
    expect(minWidth).toBeLessThan(0.5);
  };
  await watchTurn('tile-paused');
  await openMenu();
  const menu = page.getByRole('dialog', { name: 'Game menu' });
  await expect(menu.getByRole('button')).toHaveText(['Main menu', 'Settings', 'How to play', 'Restart level', 'Resume game']);
  await menu.getByRole('button', { name: 'How to play' }).click();
  const help = page.getByRole('dialog', { name: 'How to play' });
  await expect(help).toContainText('Tap a group of two or more matching tiles');
  await expect(help).toContainText('The round ends when a new row cannot fit.');
  await help.getByRole('button', { name: 'Back' }).click();
  await expect(help).toBeHidden();
  await menu.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('radio')).toHaveCount(0);
  await expect.poll(textures).toEqual(maskedTextures);
  await expectOneTurn();
  await page.setViewportSize({ width: 390, height: 700 });
  await expect.poll(textures).toEqual(maskedTextures);
  const frozen = await sceneValue(page, `${falling}.remaining`);
  await page.waitForTimeout(300);
  expect(await sceneValue(page, `${falling}.remaining`)).toBe(frozen);
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await expect(menu).toBeVisible();
  expect(await sceneValue(page, `${falling}.remaining`)).toBe(frozen);
  await watchTurn(originalTextures[0]);
  await menu.getByRole('button', { name: 'Resume game' }).click();
  await expect.poll(() => sceneValue(page, `${falling}.remaining`)).toBeLessThan(Number(frozen));

  await expect.poll(textures).toEqual(originalTextures);
  await expectOneTurn();
  await openMenu();
  await expect(menu).toBeVisible();
  await expect.poll(textures).toEqual(maskedTextures);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('FallingScene'));
  await openMenu();
  await menu.getByRole('button', { name: 'Main menu' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee Match' })).toBeVisible();
  await expect.poll(() => sceneValue(page, "window.__GAME__.scene.isActive('FallingScene')")).toBe(false);
  await chooseCompetitive(page, /Match three/);
  await page.waitForFunction(() => (window as any).__GAME__.scene.isActive('GameScene'));
});

test('group removal locks rapid input for one tenth of the row interval even with reduced motion', { tag: '@falling' }, async ({ page }) => {
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

test('row waits for resolution, lands from preview, overflows and restarts on mobile', { tag: ['@falling', '@smoke'] }, async ({ page }) => {
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
  await page.getByRole('button', { name: 'Close results' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await sceneValue(page, `${falling}.gameOver`)).toBe(true);
  const restart = await page.evaluate(`(() => {
    const hud = ${falling}.hudContainer;
    const button = hud.getByName('restart');
    return { x: hud.x + button.x + 22, y: hud.y + button.y + 22 };
  })()`);
  await page.mouse.click(restart.x, restart.y);
  await page.waitForFunction(() => !(window as any).__GAME__.scene.getScene('FallingScene').gameOver);
  expect(await sceneValue(page, `${falling}.state.score`)).toBe(0);
});


test('the complete preview stays visible for 150 ms before automatic drop', { tag: '@falling' }, async ({ page }) => {
  await startFalling(page);
  const samples = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    const sample = () => [scene.remaining, scene.preview.at(-1).alpha, scene.state.rowsAdded];
    scene.remaining = 166;
    scene.updateHUD();
    const revealing = sample();
    scene.update(0, 17);
    const revealed = sample();
    scene.update(0, 149);
    const waiting = sample();
    scene.update(0, 1);
    return { revealing, revealed, waiting, dropped: scene.state.rowsAdded };
  });
  expect(samples.revealing[1]).toBeLessThan(1);
  expect(samples.revealed).toEqual([150, 1, 0]);
  expect(samples.waiting).toEqual([1, 1, 0]);
  expect(samples.dropped).toBe(1);
});

test('preview builds left to right, survives resize, and early drop releases exactly one row', { tag: '@falling' }, async ({ page }) => {
  await startFalling(page);
  const preview = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.remaining = 3900;
    scene.updateHUD();
    return { colors: scene.state.nextRow, alphas: scene.preview.map((s: any) => s.alpha) };
  });
  expect(preview.alphas).toEqual([1, 1, 0, 0, 0, 0, 0, 0]);
  await page.setViewportSize({ width: 667, height: 375 });
  await page.waitForFunction(`${falling}.dropButton.getBounds().bottom <= 375`);
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

test('E completes the row preview and waits for the current spinning removal', { tag: '@falling' }, async ({ page }) => {
  await startFalling(page);
  const point = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(-1));
    scene.state.grid[7] = [0, 0, 1, 1, 2, 2, 3, 3];
    scene.renderBoard();
    const tile = scene.board[7][0].sprite;
    return { x: scene.boardContainer.x + tile.x * scene.boardContainer.scaleX,
      y: scene.boardContainer.y + tile.y * scene.boardContainer.scaleY };
  });
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(90);
  const spin = await page.evaluate(() => {
    const tile = (window as any).__GAME__.scene.getScene('FallingScene').board[7][0].sprite;
    return { x: tile.scaleX, y: tile.scaleY };
  });
  expect(spin.y).toBe(1);
  expect(spin.x).toBeLessThan(0.9);
  await page.keyboard.down('KeyE');
  expect(await sceneValue(page, `${falling}.state.rowsAdded`)).toBe(0);
  expect(await sceneValue(page, `${falling}.preview.map(s=>s.alpha)`)).toEqual(Array(8).fill(1));
  await page.waitForFunction(() => (window as any).__GAME__.scene.getScene('FallingScene').state.rowsAdded === 1);
  const row = await sceneValue(page, `${falling}.selected.row`) as number;
  await page.keyboard.press('ArrowDown');
  expect(await sceneValue(page, `[${falling}.droppingRow, ${falling}.cursor.visible, ${falling}.cursor.y / 64]`))
    .toEqual([true, true, (row + 1) % 8]);
  await page.waitForFunction(() => !(window as any).__GAME__.scene.getScene('FallingScene').isProcessing);
  expect(await sceneValue(page, `${falling}.state.grid.flat().filter(n=>n>=0).length`)).toBe(14);
  await page.keyboard.down('KeyE');
  await page.keyboard.up('KeyE');
  expect(await sceneValue(page, `${falling}.state.rowsAdded`)).toBe(1);

  for (const [index, key] of ['E', 'у', 'У'].entries()) {
    await page.evaluate(key => {
      const init = { code: 'KeyE', key, bubbles: true, modifierCapsLock: key !== 'у' };
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', init));
      document.activeElement!.dispatchEvent(new KeyboardEvent('keyup', init));
    }, key);
    await page.waitForFunction(`${falling}.state.rowsAdded === ${index + 2} && !${falling}.isProcessing`);
  }
});


test('leaderboard keeps top ten, shows a lower current rank, and persists across games', { tag: '@falling' }, async ({ page }) => {
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

test('shares the last buffered tile between pointer and keyboard and follows it as columns move', { tag: '@falling' }, async ({ page }) => {
  await startFalling(page);
  const points = await page.evaluate(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(-1));
    scene.state.grid[7] = [0, 0, 1, 1, 2, 2, 3, 3];
    scene.renderBoard();
    scene.selected = { row: 7, col: 7 };
    return [0, 4].map(col => ({
      x: scene.boardContainer.x + (col * 64 + 32) * scene.boardContainer.scaleX,
      y: scene.boardContainer.y + 480 * scene.boardContainer.scaleY
    }));
  });
  for (const point of points) await page.mouse.click(point.x, point.y);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  expect(await sceneValue(page, `[${falling}.isProcessing, ${falling}.pendingTile?.col]`)).toEqual([true, 6]);
  expect(await sceneValue(page, `${falling}.pendingOutline.commandBuffer.length`)).toBeGreaterThan(0);
  await page.waitForFunction(() => {
    const scene = (window as any).__GAME__.scene.getScene('FallingScene');
    return scene.state.score === 200 && !scene.isProcessing;
  });
  expect(await sceneValue(page, `${falling}.state.grid.flat().filter(n=>n>=0).sort()`)).toEqual([1, 1, 2, 2]);
  expect(await sceneValue(page, `${falling}.pendingTile`)).toBe(null);
  expect(await sceneValue(page, `${falling}.pendingOutline.commandBuffer.length`)).toBe(0);
});


test('pending outline skips singletons and moves with the last selected group', { tag: '@falling' }, async ({ page }) => {
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

test('keyboard cursor wraps across empty cells and stays visible while removing groups', { tag: '@falling' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startFalling(page);
  expect(await sceneValue(page, `${falling}.cursor.visible`)).toBe(false);

  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Game menu' });
  await expect(menu.getByRole('button', { name: 'Resume game' })).toBeFocused();
  await page.keyboard.press('KeyW');
  await expect(menu.getByRole('button', { name: 'Restart level' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneValue(page, `(() => {
    const { board, cursor, selected } = ${falling};
    return [cursor.visible, selected.row === board.findIndex(row => row.some(Boolean)),
      selected.col === Math.floor(board[0].length / 2)];
  })()`)).toEqual([true, true, true]);

  await page.evaluate(`(() => {
    const scene = ${falling};
    scene.remaining = 5000;
    scene.state.grid.forEach(row => row.fill(-1));
    scene.state.grid.at(-1).splice(0, 8, 1, 1, -1, -1, -1, -1, 0, 0);
    scene.renderBoard();
    scene.selected = { row: 0, col: 0 };
  })()`);
  const cursor = () => sceneValue(page, `(() => {
    const { cursor, selected } = ${falling};
    return [cursor.visible, cursor.y / 64, cursor.x / 64, selected.row, selected.col];
  })()`);
  for (const [key, row, col] of [
    ['KeyA', 0, 7], ['ArrowRight', 0, 0], ['ArrowUp', 7, 0],
    ['KeyS', 0, 0], ['Enter', 0, 0], ['ArrowUp', 7, 0]
  ] as const) {
    await page.keyboard.press(key);
    await expect.poll(cursor).toEqual([true, row, col, row, col]);
  }
  expect(await sceneValue(page, `${falling}.state.score`)).toBe(0);

  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  expect(await sceneValue(page, `[${falling}.isProcessing, ${falling}.cursor.visible, ${falling}.cursor.x / 64]`))
    .toEqual([true, true, 1]);
  await expect.poll(() => sceneValue(page, `${falling}.isProcessing`)).toBe(false);
  expect(await cursor()).toEqual([true, 7, 1, 7, 1]);
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneValue(page, `${falling}.board.flat().filter(Boolean).length`)).toBe(0);
  expect(await cursor()).toEqual([true, 7, 3, 7, 3]);
});
