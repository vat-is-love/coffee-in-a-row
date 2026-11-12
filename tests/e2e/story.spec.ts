import { test, expect } from '@playwright/test';

test('Story pauses at each completed level and offers replay or another mode after victory', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Story mode/ }).click();
  const scene = "(window.__GAME__?.scene.getScene('FallingScene'))";
  const expectLevel = async (tileTypes: number) => {
    await expect.poll(() => page.evaluate(`${scene}?.level?.board.tileTypes`)).toBe(tileTypes);
    expect(await page.evaluate(`${scene}.scoreText.text`)).toBe('Tiles cleared: 0 / 100');
  };
  const removePair = async (cleared: number) => {
    const point = await page.evaluate(cleared => {
      const scene = (window as any).__GAME__.scene.getScene('FallingScene');
      scene.cleared = cleared;
      scene.remaining = 4000;
      scene.state.grid = Array.from({ length: 8 }, () => Array(8).fill(-1));
      scene.state.grid[7].splice(0, 2, 0, 0);
      scene.renderBoard();
      const board = scene.boardContainer;
      return { x: board.x + 32 * board.scaleX, y: board.y + 480 * board.scaleY };
    }, cleared);
    await page.mouse.click(point.x, point.y);
  };
  const restart = async () => {
    const point = await page.evaluate(`(() => {
      const button = ${scene}.hudContainer.list.at(-3).getBounds();
      return { x: button.centerX, y: button.centerY };
    })()`);
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => page.evaluate(`${scene}.gameOver`)).toBe(false);
  };
  await expectLevel(3);
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
  await expectLevel(4);

  await page.evaluate(`${scene}.state.grid[0][0] = 0; ${scene}.remaining = 0`);
  await expect.poll(() => page.evaluate(`${scene}.statusText.text`)).toContain('Board full');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await restart();
  await expectLevel(4);
  await removePair(98);
  await completed.getByRole('button', { name: 'Continue' }).click();
  await expectLevel(5);
  await removePair(98);
  await victory.getByRole('button', { name: 'Start again' }).click();
  await expectLevel(3);

  await page.evaluate(`void ${scene}.scene.restart({ levelIndex: 2 })`);
  await expectLevel(5);
  await removePair(98);
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
  await expectLevel(3);
  await page.reload();
  await expectLevel(3);
});
