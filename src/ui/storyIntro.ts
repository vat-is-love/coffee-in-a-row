import { BOMB_ITEM, clearAt, COLUMN_CLEAR_ITEM, createFalling, ROW_CLEAR_ITEM, STORY_ITEM } from '../game/logic/falling';
import { getStoryConfig, type loadStory, type StoryMode } from '../game/levels/story';
import type { Textures } from 'phaser';
import { getPreferences, getStoryCheckpoint, t } from './preferences';
import { showStoryResult } from './storyResult';

const demoTiles = new Map([
  ['group', 0], ['horizontal', ROW_CLEAR_ITEM], ['vertical', COLUMN_CLEAR_ITEM],
  ['bomb', BOMB_ITEM], ['delivery', 0]
]);

function makeDemo(demo: string, textures: Textures.TextureManager): HTMLElement | undefined {
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
  const { removed, motions, deliveries } = clearAt({ ...createFalling(0), grid }, { row, col });
  const board = document.createElement('div');
  board.className = 'story-demo';
  board.setAttribute('aria-hidden', 'true');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  grid.forEach((cells, r) => cells.forEach((value, c) => {
    if (value < 0) return;
    const sprite = document.createElement('img');
    sprite.alt = '';
    const image = textures.get(`tile-${value}`).getSourceImage();
    sprite.src = image instanceof HTMLCanvasElement ? image.toDataURL() : (image as HTMLImageElement).src;
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

export function storyLevelDetails(
  mode: StoryMode, levelIndex: number, stage: ReturnType<typeof loadStory>['stages'][number],
  textures: Textures.TextureManager, withoutLives: boolean, includeDescription = true
): HTMLElement {
  const { briefing, level, thirdStar, target } = stage;
  const { language } = getPreferences();
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
  if (includeDescription) {
    const description = addSection(t('Description'), briefing?.[language] ?? '');
    if (briefing?.demo) {
      const demo = makeDemo(briefing.demo, textures);
      if (demo) description.append(demo);
    }
  }
  const objective = `${t(level.delivery ? 'Items to deliver' : 'Tiles to clear')}: ${target}`;
  const conditions = addSection(t('Victory conditions'), level.buffs && !level.delivery ? `${objective} · ${t('Use a power-up')}` : objective);
  const stars = document.createElement('p');
  stars.textContent = t(withoutLives
    ? 'Without lives, winning earns two stars. The third star requires a separate challenge.'
    : 'Win the level for the first star. Win without losing a life for the second star.');
  conditions.append(stars);
  const completed = levelIndex < getStoryCheckpoint(mode);
  if (completed || thirdStar) {
    const section = addSection(t('Third star'), thirdStar?.hint[language] ?? t('This level has no third-star challenge.'));
    if (!completed) {
      const hint = section.querySelector('p')!;
      hint.inert = true;
      const overlay = document.createElement('p');
      overlay.textContent = t('Clear this level to reveal the hint.');
      const locked = document.createElement('div');
      locked.className = 'story-hint-locked';
      hint.replaceWith(locked);
      locked.append(hint, overlay);
    }
  }
  return details;
}

export function showStoryIntro(
  mode: StoryMode, levelIndex: number, stage: ReturnType<typeof loadStory>['stages'][number],
  textures: Textures.TextureManager, start: () => void,
  { mapScreen, returnToMap }: { mapScreen?: HTMLElement; returnToMap?: () => void }
): () => void {
  const withoutLives = getStoryConfig(mode)?.withoutLives === true || getPreferences().storyWithoutLives;
  const details = storyLevelDetails(mode, levelIndex, stage, textures, withoutLives);
  return showStoryResult(`${t('Level')} ${levelIndex + 1}`, t(mapScreen ? 'Start level' : 'Next'), start, {
    details,
    className: mapScreen ? undefined : 'story-briefing',
    closeLabel: t('Choose level'),
    onClose: returnToMap,
    parent: mapScreen
  });
}
