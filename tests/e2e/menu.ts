import type { Page } from '@playwright/test';

export async function chooseCompetitive(page: Page, board: RegExp) {
  await page.getByRole('button', { name: /^(Competitive mode|Соревновательный режим)$/ }).click();
  await page.getByRole('button', { name: board }).click();
}

export async function openStoryMap(page: Page, story: RegExp) {
  await page.getByRole('button', { name: 'Story mode', exact: true }).click();
  await page.getByRole('button', { name: story }).click();
}
