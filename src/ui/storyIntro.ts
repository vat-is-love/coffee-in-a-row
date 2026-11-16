import { BOMB_ITEM, clearAt, COLUMN_CLEAR_ITEM, ROW_CLEAR_ITEM, STORY_ITEM, type FallingState } from '../game/logic/falling';
import type { StoryBriefing } from '../game/levels/story';
import { getPreferences, t } from './preferences';
import { showStoryResult } from './storyResult';

const demoTiles = new Map([
  ['group', 0], ['horizontal', ROW_CLEAR_ITEM], ['vertical', COLUMN_CLEAR_ITEM],
  ['bomb', BOMB_ITEM], ['delivery', 0]
]);

function makeDemo(demo: string, state: FallingState, tileImage: (tile: number) => string): HTMLElement | undefined {
  const tile = demoTiles.get(demo);
  if (tile === undefined) return;
  const row = demo === 'delivery' ? 4 : 3;
  const col = 2;
  const grid = [
    [-1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1],
    [-1,  1, demo === 'delivery' ? STORY_ITEM : 2, -1, -1],
    [ 1,  2, demo === 'delivery' ? 0 : tile,  2,  1],
    [ 2,  0, demo === 'delivery' ? tile : 1,  1,  2]
  ];
  if (demo === 'group') grid[3][1] = 0;
  const { removed, motions, deliveries } = clearAt({ ...state, grid }, { row, col });
  const board = document.createElement('div');
  board.className = 'story-demo';
  board.setAttribute('aria-hidden', 'true');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  grid.forEach((cells, r) => cells.forEach((value, c) => {
    if (value < 0) return;
    const sprite = document.createElement('img');
    sprite.alt = '';
    sprite.src = tileImage(value);
    sprite.style.top = `${r * 20}%`;
    sprite.style.left = `${c * 20}%`;
    if (r === row && c === col) sprite.className = 'story-demo-target';
    board.append(sprite);
    if (reducedMotion) return;
    const matches = ({ row, col }: { row: number; col: number }) => row === r && col === c;
    const disappears = removed.some(matches);
    const delivery = deliveries.find(move => matches(move.from));
    const to = (delivery ?? motions.find(move => matches(move.from)))?.to;
    const transform = to ? `translate(${(to.col - c) * 100}%, ${(to.row - r) * 100}%)` : 'none';
    const fall = demo === 'delivery' && to ? `translateY(${(to.row - r) * 100}%)` : transform;
    sprite.animate([
      { offset: 0, opacity: 1, transform: 'none' },
      { offset: 0.32, opacity: 1, transform: 'none' },
      { offset: 0.43, opacity: disappears ? 0 : 1, transform: 'none' },
      { offset: 0.62, opacity: disappears ? 0 : 1, transform: fall },
      { offset: 0.7, opacity: disappears || delivery ? 0 : 1, transform: fall },
      { offset: 0.84, opacity: disappears || delivery ? 0 : 1, transform },
      { offset: 1, opacity: disappears || delivery ? 0 : 1, transform }
    ], { duration: 2800, iterations: Infinity, easing: 'linear' });
  }));
  return board;
}

export function showStoryIntro(
  title: string, briefing: StoryBriefing | undefined, goal: string, challengeHint: string | undefined,
  state: FallingState, tileImage: (tile: number) => string, start: () => void
): () => void {
  const details = document.createElement('div');
  details.className = 'story-intro';
  const addSection = (label: string, text: string) => {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = label;
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    section.append(heading, paragraph);
    details.append(section);
    return section;
  };
  const description = addSection(t('Description'), briefing?.[getPreferences().language] ?? '');
  if (briefing?.demo) {
    const demo = makeDemo(briefing.demo, state, tileImage);
    if (demo) description.append(demo);
  }
  addSection(t('Victory conditions'), goal);
  addSection(t('Third star'), challengeHint ?? t('This level has no third-star challenge.'));
  return showStoryResult(title, t('Next'), start, { details });
}
