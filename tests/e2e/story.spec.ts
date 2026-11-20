import { test, expect } from '@playwright/test';
import { beginStoryLevel, openStoryMap } from './menu';

const STORY_ITEM = 6;
const ROW_CLEAR_ITEM = 7;
const scene = "(window.__GAME__?.scene.getScene('FallingScene'))";

test('Story retries after defeat and requires both the tile goal and a buff when configured', { tag: '@story' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openStoryMap(page, /^Test campaign/);
  await expect(page.getByRole('button', { name: /^Level 2 · Locked/ })).toBeDisabled();
  const level = page.getByRole('button', { name: 'Level 1', exact: true });
  await level.click();
  const briefing = page.getByRole('dialog', { name: 'Level 1', exact: true });
  await expect(briefing.locator('section h2')).toHaveText(['Description', 'Victory conditions', 'Third star']);
  await expect(briefing.locator('section').nth(0).locator('.story-demo-target')).toBeVisible();
  await expect(briefing.locator('section').nth(1)).toContainText('Tiles to clear: 4');
  await expect(briefing.getByText('Clear this level to reveal the hint.')).toBeVisible();
  const hiddenHint = briefing.locator('p[inert]');
  await expect(hiddenHint).toHaveText('Finish with an empty top-left corner.');
  await expect(hiddenHint).toHaveCSS('filter', 'blur(8px)');
  await expect(page.locator('.menu-screen .story-map')).toBeVisible();
  await expect(briefing.locator('xpath=..')).toHaveClass(/menu-screen/);
  expect(await page.evaluate(`Boolean(${scene}.state)`)).toBe(false);
  await briefing.getByRole('button', { name: 'Choose level' }).click();
  await expect(briefing).toBeHidden();
  await expect(level).toBeFocused();
  await level.click();
  await page.keyboard.press('Escape');
  await expect(briefing).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(briefing.getByRole('button', { name: 'Start level' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(briefing.getByRole('button', { name: 'Choose level' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(`${scene}.cursor?.visible`)).toBe(true);

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
  await expect(completed.locator('.story-attempt-stars .blue-third-star')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee-preferences')!))).toMatchObject({
    largeStoryCheckpoint: 1, largeStoryThirdStars: [0]
  });
  await page.keyboard.press('Escape');
  await expect(completed).toBeVisible();
  await completed.getByRole('button', { name: 'Next', exact: true }).click();
  const nextBriefing = page.getByRole('dialog', { name: 'Level 2', exact: true });
  await expect(nextBriefing.locator('section h2')).toHaveText(['Description', 'Victory conditions', 'Third star']);
  await expect(nextBriefing.locator('section').nth(1))
    .toContainText('Tiles to clear: 2 · Use a power-up');
  await expect(nextBriefing.locator('p[inert]')).toHaveCSS('filter', 'blur(8px)');
  await nextBriefing.getByRole('button', { name: 'Choose level' }).click();
  await expect(nextBriefing).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Test campaign' })).toBeVisible();
  await expect.poll(() => page.evaluate("window.__GAME__?.scene.isPaused('FallingScene')")).toBe(false);
  await page.getByRole('button', { name: 'Level 2', exact: true }).click();
  await beginStoryLevel(page, 2);

  await page.evaluate(`${scene}.lifeCharge = 0; ${scene}.state.grid[0][0] = 0; ${scene}.remaining = 0`);
  const defeat = page.getByRole('dialog', { name: 'Board full' });
  await defeat.getByRole('button', { name: 'View board' }).click();
  await expect(defeat).toBeHidden();
  expect(await page.evaluate(`[${scene}.gameOver, ${scene}.state.grid[0][0]]`)).toEqual([true, 0]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Restart level' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
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
  await completed.getByRole('button', { name: 'Next', exact: true }).click();
  await beginStoryLevel(page, 3);
  await expect.poll(() => page.evaluate(`[${scene}.levelIndex, ${scene}.scoreText.text]`)).toEqual([2, 'Items delivered: 0 / 2']);
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Game menu' });
  await expect(menu.getByRole('button')).toHaveText(['Main menu', 'Choose level', 'Settings', 'How to play', 'Restart level', 'Resume game']);
  await page.evaluate(`${scene}.state.delivered = 1`);
  await menu.getByRole('button', { name: 'Restart level' }).click();
  await expect.poll(() => page.evaluate(`[${scene}.levelIndex, ${scene}.state.delivered, ${scene}.state.rowsAdded]`)).toEqual([2, 0, 0]);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await menu.getByRole('button', { name: 'Choose level' }).click();
  await expect(page.getByRole('heading', { name: 'Test campaign' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Level 2 · Completed' })).toBeEnabled();
  await page.getByRole('button', { name: 'Level 3', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Level 3', exact: true })).toBeVisible();
});

test('Story awards the second and third stars independently across attempts', { tag: '@story' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openStoryMap(page, /^Test campaign/);
  await page.getByRole('button', { name: 'Level 1', exact: true }).click();
  await beginStoryLevel(page, 1);
  await page.keyboard.press('Escape');
  const pause = page.getByRole('dialog', { name: 'Game menu' });
  const helpButton = pause.getByRole('button', { name: 'How to play' });
  await helpButton.click();
  const help = page.getByRole('dialog', { name: 'How to play' });
  await expect(help).toContainText('Tiles to clear: 4');
  await expect(help).toContainText('Win without losing a life for the second star.');
  await expect(help).toContainText('Clear this level to reveal the hint.');
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
  await expect(helpButton).toBeFocused();
  await pause.getByRole('button', { name: 'Resume game' }).click();
  await page.waitForFunction("window.__GAME__?.scene.isActive('FallingScene')");

  await page.evaluate(`(async () => {
    const scene = ${scene};
    scene.state.grid.forEach(row => { row.fill(-1); row[0] = 0; });
    scene.renderBoard();
    await scene.dropRow();
    scene.lifeCharge = 60;
    scene.cleared = 4;
    await scene.dropRow();
  })()`);
  const result = page.getByRole('dialog', { name: 'Stage cleared' });
  await expect(result.locator('.story-attempt-stars')).toHaveText('★☆★');
  await result.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('dialog', { name: 'Level 2', exact: true }).getByRole('button', { name: 'Choose level' }).click();
  const completed = page.getByRole('button', { name: 'Level 1 · Completed' });
  await expect(completed.locator('.level-stars')).toHaveText('★☆★');
  await expect(completed.locator('.blue-third-star')).toHaveCount(0);
  await completed.click();
  await beginStoryLevel(page, 1);
  await page.evaluate(`${scene}.cleared = 4; ${scene}.requestDrop()`);
  await expect(result).toBeVisible();
  await result.getByRole('button', { name: 'Replay' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(`[${scene}.gameOver, ${scene}.cleared, ${scene}.levelIndex]`)).toEqual([false, 0, 0]);
  await page.reload();
  await openStoryMap(page, /^Test campaign/);
  await expect(completed.locator('.level-stars')).toHaveText('★★★');
  await expect(completed.locator('.blue-third-star')).toHaveText('★');
});

for (const campaign of ['Test campaign', 'No-lives test campaign']) {
  test(`${campaign} ends a no-lives attempt only when the next row cannot land`, { tag: '@story' }, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    if (campaign === 'Test campaign') {
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.getByRole('checkbox', { name: /^Story without lives/ }).check();
      await page.getByRole('button', { name: 'Back' }).click();
    }
    await openStoryMap(page, new RegExp(`^${campaign}`));
    await page.getByRole('button', { name: 'Level 1', exact: true }).click();
    await expect(page.getByText('Without lives, winning earns two stars. The third star requires a separate challenge.')).toBeVisible();
    await beginStoryLevel(page, 1);
    await page.waitForFunction(`${scene}?.hearts && !${scene}.isProcessing`);
    expect(await page.evaluate(`${scene}.hearts.length`)).toBe(0);
    await page.evaluate(`(async () => {
      const scene = ${scene};
      scene.state.grid.forEach((row, index) => {
        row.fill(-1);
        if (index > 0) row[0] = 0;
      });
      scene.state.nextRow[0] = 0;
      scene.renderBoard();
      await scene.dropRow();
    })()`);
    expect(await page.evaluate(`[${scene}.state.grid[0][0], ${scene}.state.rowsAdded, ${scene}.gameOver]`))
      .toEqual([0, 1, false]);
    await page.evaluate(`${scene}.dropRow()`);
    await expect(page.getByRole('dialog', { name: 'Board full' })).toBeVisible();
    expect(await page.evaluate(`${scene}.state.rowsAdded`)).toBe(1);
  });
}

test('a challenge keeps progress from earlier board events until victory', { tag: '@story' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('coffee-preferences', JSON.stringify({
      language: 'en', vibration: false, largeStoryCheckpoint: 2
    }));
  });
  for (const reachesSecondRow of [true, false]) {
    await page.goto('/');
    await openStoryMap(page, /^Test campaign/);
    await page.getByRole('button', { name: 'Level 3', exact: true }).click();
    await beginStoryLevel(page, 3);
    await page.evaluate(`(async () => {
      const scene = ${scene};
      if (${reachesSecondRow}) {
        scene.state.grid.forEach((row, index) => {
          row.fill(-1);
          if (index >= 2) row[0] = 0;
        });
        scene.renderBoard();
        await scene.dropRow();
      }
      scene.state.grid.forEach(row => row.fill(-1));
      scene.renderBoard();
      scene.state.delivered = 2;
      await scene.dropRow();
    })()`);
    const result = page.getByRole('dialog', { name: 'Story cleared' });
    await expect(result).toBeVisible();
    await expect(result.locator('.blue-third-star')).toHaveCount(reachesSecondRow ? 0 : 1);
    await result.getByRole('button', { name: 'Back to map' }).click();
    await expect(page.getByRole('button', { name: 'Level 3 · Completed' })).toBeVisible();
  }
});

test('Story spends hearts on overflow and restores one after twenty landed rows', { tag: '@story' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('coffee-preferences', JSON.stringify({
      language: 'en', vibration: false, largeStoryCheckpoint: 2
    }));
  });
  await page.goto('/');
  await openStoryMap(page, /^Test campaign/);
  await page.getByRole('button', { name: 'Level 3', exact: true }).click();
  await beginStoryLevel(page, 3);
  const tryDrop = (overflow: boolean, withCup = false, reachesTop = false) => page.evaluate(`(async () => {
    const scene = ${scene};
    scene.state.grid.forEach((row, index) => {
      row.fill(-1);
      if (${overflow} || (${reachesTop} && index > 0)) row[0] = ${withCup} && (index === 1 || index === scene.state.grid.length - 3) ? ${STORY_ITEM} : 0;
    });
    scene.state.nextRow = scene.state.nextRow.map(() => 0);
    scene.renderBoard();
    await scene.dropRow();
    return [scene.lifeCharge, scene.state.rowsAdded, scene.state.delivered];
  })()`);
  expect(await page.evaluate(`${scene}.hearts.map(heart => heart.visible)`)).toEqual([true, true, true]);
  expect(await tryDrop(false, false, true)).toEqual([60, 1, 0]);
  expect(await page.evaluate(`[${scene}.state.grid[0][0], ${scene}.gameOver]`)).toEqual([0, false]);
  expect(await tryDrop(true, true)).toEqual([40, 1, 1]);
  expect(await page.evaluate(`${scene}.state.grid[4][0]`)).toBe(STORY_ITEM);
  await expect.poll(() => page.evaluate(`${scene}.hearts.map(heart => heart.visible)`)).toEqual([true, true, false]);
  for (let row = 1; row <= 20; row++) {
    expect(await tryDrop(false)).toEqual([40 + row, row + 1, 1]);
    if (row === 1) {
      await expect.poll(() => page.evaluate(`${scene}.hearts[2].visible`)).toBe(true);
    }
  }
  for (const charge of [40, 20, 0]) expect(await tryDrop(true)).toEqual([charge, 21, 1]);
  await tryDrop(true);
  await expect(page.getByRole('dialog', { name: 'Board full' })).toBeVisible();
});

test('a larger Story delivers a cup from the preview and joins both groups for one tap', { tag: '@story' }, async ({ page, hasTouch }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('coffee-preferences', JSON.stringify({
      language: 'en', vibration: false, largeStoryCheckpoint: 2
    }));
  });
  await page.goto('/');
  await openStoryMap(page, /^Test campaign/);
  await page.getByRole('button', { name: 'Level 3', exact: true }).click();
  await beginStoryLevel(page, 3);
  await page.waitForFunction(`${scene}?.levelIndex === 2 && ${scene}.dropButton`);
  expect(await page.evaluate(`[${scene}.state.grid.length, ${scene}.preview.length]`)).toEqual([10, 10]);
  await page.evaluate(`${scene}.requestDrop()`);
  await page.waitForFunction(`${scene}.state.rowsAdded === 1 && !${scene}.isProcessing`);
  expect(await page.evaluate(`${scene}.preview.map(tile => tile.texture.key)`)).toContain(`tile-${STORY_ITEM}`);

  const drop = await page.evaluate(`(() => {
    const scene = ${scene};
    scene.state.grid.forEach(row => row.fill(-1));
    scene.renderBoard();
    scene.state.nextRow = [0, 1, 0, 2, 2, ${STORY_ITEM}, 2, 2, 1, 0];
    scene.remaining = 2000;
    const button = scene.dropButton.getBounds();
    return { x: button.centerX, y: button.centerY };
  })()`);
  const tap = ({ x, y }: { x: number; y: number }) => hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  await tap(drop);
  const victory = page.getByRole('dialog', { name: 'Story cleared' });
  await expect.poll(() => page.evaluate(`${scene}.scoreText.text`)).toBe('Items delivered: 1 / 2');
  expect(await page.evaluate(`${scene}.state.grid.at(-1)`)).toEqual([0, 1, 0, 2, 2, 2, 2, 1, 0, -1]);
  expect(await page.evaluate(`${scene}.board.at(-1).map(tile => tile?.sprite.x ?? null)`))
    .toEqual([...Array.from({ length: 9 }, (_, col) => col * 64 + 32), null]);
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
  await victory.getByRole('button', { name: 'Replay' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(`[${scene}.levelIndex, ${scene}.state.delivered]`)).toEqual([2, 0]);
  await page.evaluate(`${scene}.state.delivered = 2; ${scene}.requestDrop()`);
  await victory.getByRole('button', { name: 'Back to map' }).click();
  await expect(page.getByRole('button', { name: 'Level 3 · Completed' })).toBeEnabled();
});

test('Story gives the configured stage a longer row countdown at the same fall speed', { tag: '@story' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await openStoryMap(page, /^Test campaign/);
  await page.getByRole('button', { name: 'Level 1', exact: true }).click();
  await beginStoryLevel(page, 1);
  await page.waitForFunction(`${scene}?.state && ${scene}.dropButton`);

  const drop = () => page.evaluate(`(() => {
    const scene = ${scene};
    scene.requestDrop();
    const tile = scene.board.flat().find(tile => tile?.sprite.y === -52);
    const fall = scene.tweens.getTweensOf(tile.sprite).flatMap(tween => tween.data).find(data => data.key === 'y');
    return { duration: fall.duration, remaining: scene.remaining };
  })()`);
  expect(await drop()).toEqual({ duration: 280, remaining: 4150 });

  // The short Story fixture puts the override on its final stage.
  await page.evaluate(`void ${scene}.scene.restart({ levelIndex: 2 })`);
  await beginStoryLevel(page, 3);
  await page.waitForFunction(`${scene}.levelIndex === 2 && ${scene}.dropButton`);
  expect(await drop()).toEqual({ duration: 280, remaining: 5150 });
});

test('story maps show separate checkpoints and allow replay without losing access', { tag: ['@story', '@smoke'] }, async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('coffee-preferences') === null) {
      localStorage.setItem('coffee-preferences', JSON.stringify({
        language: 'en', vibration: false, storyCheckpoint: 8, largeStoryCheckpoint: 2, shadySoulsCheckpoint: 1,
        shadySoulsThirdStars: [0]
      }));
    }
  });
  await page.goto('/');
  await openStoryMap(page, /^No-lives test campaign/);
  const shadyLevel = page.getByRole('button', { name: 'Level 1 · Completed' });
  await expect(shadyLevel).toBeEnabled();
  await expect(shadyLevel).toHaveAccessibleDescription('Stars 3/3');
  await expect(page.locator('.story-map button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /^Test campaign/ }).click();
  const levels = page.locator('.story-map button');
  await expect(levels).toHaveText(['Level 3☆☆☆', 'Level 2 · Completed★★☆', 'Level 1 · Completed★★☆']);
  await levels.last().click();
  const briefing = page.getByRole('dialog', { name: 'Level 1', exact: true });
  await expect(briefing.getByRole('heading', { name: 'Third star' })).toBeVisible();
  await expect(briefing.getByText('Finish with an empty top-left corner.')).toBeVisible();
  await beginStoryLevel(page, 1);
  await expect.poll(() => page.evaluate(`${scene}?.levelIndex`)).toBe(0);
  await page.evaluate(`${scene}.cleared = 4; ${scene}.requestDrop()`);
  await expect(page.getByRole('dialog', { name: 'Stage cleared' }).locator('.story-attempt-stars .blue-third-star')).toBeVisible();
  await page.reload();
  await openStoryMap(page, /^Test campaign/);
  await expect(page.getByRole('button', { name: 'Level 3', exact: true })).toBeEnabled();
  await expect(levels.last()).toHaveAccessibleDescription('Stars 3/3 · Blue third star');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee-preferences')!))).toMatchObject({
    storyCheckpoint: 8, shadySoulsCheckpoint: 1, largeStoryCheckpoint: 2
  });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await expect(levels).toHaveText(['Level 3 · Locked 🔒☆☆☆', 'Level 2 · Locked 🔒☆☆☆', 'Level 1☆☆☆']);
  await expect(levels.first()).toBeDisabled();
  await expect(levels.last()).toBeEnabled();
  await page.reload();
  await openStoryMap(page, /^Test campaign/);
  await expect(page.getByRole('button', { name: 'Level 1', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee-preferences')!))).toMatchObject({
    storyCheckpoint: 8, shadySoulsCheckpoint: 1, shadySoulsThirdStars: [0]
  });
  await expect(page.getByRole('button', { name: 'Reset progress' })).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee-preferences')!).largeStoryThirdStars)).toBeUndefined();
  await page.getByRole('button', { name: 'Level 1', exact: true }).click();
  await expect(briefing.getByText('Clear this level to reveal the hint.')).toBeVisible();
});

test('story selection shows Russian titles and descriptions', { tag: ['@story', '@preferences'] }, async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('coffee-preferences', JSON.stringify({ language: 'ru', vibration: false, largeStoryCheckpoint: 1 }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Режим истории', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Тестовая кампания Кампания для проверки движка/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Тестовая кампания без жизней Пример без жизней/ })).toBeVisible();
  await page.getByRole('button', { name: /^Тестовая кампания Кампания для проверки движка/ }).click();
  await page.getByRole('button', { name: 'Уровень 1 · Пройден', exact: true }).click();
  const briefing = page.getByRole('dialog', { name: 'Уровень 1', exact: true });
  await expect(briefing.locator('section h2')).toHaveText(['Описание', 'Условия победы', 'Третья звезда']);
  await expect(briefing.getByText('Оставьте верхнюю левую клетку пустой.')).toBeVisible();
  await expect(briefing.getByRole('button', { name: 'Начать уровень' })).toBeVisible();
});

test('a settled tile flips into lightning during a drop and clears its whole row outward', { tag: '@story' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await openStoryMap(page, /^No-lives test campaign/);
  await page.getByRole('button', { name: 'Level 1', exact: true }).click();
  const demo = page.locator('.story-demo');
  await expect(demo).toBeVisible();
  await expect(page.getByText('Items to deliver: 3', { exact: true })).toBeVisible();
  const deliveryFrames = await demo.evaluate(board => {
    const sprites = Array.from(board.querySelectorAll('img'));
    const cup = sprites.find(sprite => sprite.style.top === '40%' && sprite.style.left === '40%')!;
    const bean = sprites.find(sprite => sprite.style.top === '80%' && sprite.style.left === '60%')!;
    const animations = board.getAnimations({ subtree: true });
    return [0, 0.62, 0.7, 0.84].map(progress => {
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = Number(animation.effect!.getTiming().duration) * progress;
      }
      return {
        cupY: cup.getBoundingClientRect().y,
        opacity: Number(getComputedStyle(cup).opacity),
        beanX: bean.getBoundingClientRect().x
      };
    });
  });
  const [start, landed, delivered, settled] = deliveryFrames;
  expect(landed.cupY).toBeGreaterThan(start.cupY);
  expect(landed.opacity).toBe(1);
  expect(delivered).toEqual({ cupY: landed.cupY, opacity: 0, beanX: start.beanX });
  expect(settled.beanX).toBeLessThan(delivered.beanX);
  await beginStoryLevel(page, 1);
  await page.waitForFunction(`${scene}?.state`);
  await expect.poll(() => page.evaluate(`[
    ${scene}.level.board.rows, ${scene}.level.board.cols, ${scene}.level.board.tileTypes, ${scene}.scoreText.text
  ]`)).toEqual([7, 8, 5, 'Items delivered: 0 / 3']);
  await page.evaluate(`(() => {
    const scene = ${scene};
    const settled = scene.board.flat().filter(Boolean);
    const turning = new Set();
    const checks = { flipped: false, duringFall: false };
    window.lightningSpawn = checks;
    scene.state.rowsAdded = 8;
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
  await page.waitForFunction(`${scene}.state.rowsAdded === 9 && !${scene}.isProcessing`);
  expect(await page.evaluate('window.lightningSpawn')).toEqual({ flipped: true, duringFall: true });
  expect(await page.evaluate(`${scene}.board.flat().find(tile => tile?.sprite.texture.key === 'tile-${ROW_CLEAR_ITEM}').sprite.scaleX`)).toBe(1);
  const point = await page.evaluate(`(() => {
    const scene = ${scene};
    scene.state.grid.forEach(row => row.fill(-1));
    scene.state.grid[6] = [0, 1, 2, ${ROW_CLEAR_ITEM}, 0, 1, ${ROW_CLEAR_ITEM}, ${STORY_ITEM}];
    scene.state.grid[5][0] = 2;
    scene.state.grid[5][7] = 2;
    scene.renderBoard();
    const [left, , , center, , , , right] = scene.board[6].map(tile => tile.sprite);
    const above = scene.board[5][0].sprite;
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
  await page.waitForFunction(`${scene}.state.score > 0 && !${scene}.isProcessing`);
  expect(await page.evaluate('window.lightningChecks')).toEqual({ wave: true, fell: true, fellTooSoon: false });
  expect(await page.evaluate(`${scene}.state.grid[6]`)).toEqual([-1, -1, -1, 2, 2, -1, -1, -1]);
  expect(await page.evaluate(`${scene}.board[6].filter(Boolean).map(tile => tile.sprite.x)`)).toEqual([3 * 64 + 32, 4 * 64 + 32]);
  expect(await page.evaluate(`${scene}.state.delivered`)).toBe(0);
});
