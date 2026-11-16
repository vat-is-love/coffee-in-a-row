import type { Page } from '@playwright/test';

export async function chooseCompetitive(page: Page, board: RegExp) {
  await page.getByRole('button', { name: /^(Competitive mode|Соревновательный режим)$/ }).click();
  await page.getByRole('button', { name: board }).click();
}

export async function openStoryMap(page: Page, story: RegExp) {
  await page.getByRole('button', { name: 'Story mode', exact: true }).click();
  await page.getByRole('button', { name: story }).click();
}

export async function beginStoryLevel(page: Page, level: number) {
  await page.getByRole('dialog', { name: `Level ${level}`, exact: true }).getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForFunction("window.__GAME__?.scene.isActive('FallingScene')");
}

export async function openGameSettings(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Game menu' }).getByRole('button', { name: 'Settings' }).click();
}
