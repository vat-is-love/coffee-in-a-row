import story from '@game/levels/story.json';
import { createFalling, fallingLevel, type FallingLevel } from '../logic/falling';

const messageKeys = ['levelComplete', 'continue', 'victory', 'victoryPrompt', 'restart', 'modeLabel', 'choose'] as const;
export type StoryMessages = Record<typeof messageKeys[number], string>;
export type StoryConfig = {
  board: { rows: number; cols: number; filledBottomRows: number };
  rowIntervalMs: number;
  messages: Record<'en' | 'ru', StoryMessages>;
  levels: { tileTypes: number; targetTiles?: number; targetItems?: number; rowClear?: boolean }[];
  delivery?: FallingLevel['delivery'];
  rowClear?: FallingLevel['rowClear'];
};

export const storyLevelCount = Array.isArray(story?.levels) ? story.levels.length : 0;

export function loadStory({ board, rowIntervalMs, levels, messages, delivery, rowClear }: StoryConfig = story) {
  if (!Array.isArray(levels) || !levels.length) throw new RangeError('Story must contain at least one level');
  for (const language of ['en', 'ru'] as const) {
    if (messageKeys.some(key => {
      const message = messages?.[language]?.[key];
      return typeof message !== 'string' || !message.trim();
    })) throw new RangeError(`Missing Story text for ${language}`);
  }
  const { rows, cols, filledBottomRows } = board;
  const stages = levels.map(({ tileTypes, targetTiles, targetItems, rowClear: usesRowClear }) => {
    const target = targetItems === undefined ? targetTiles : targetItems;
    if (target === undefined || !Number.isSafeInteger(target) || target < 1 ||
        (targetItems !== undefined && (targetTiles !== undefined || !delivery))) {
      throw new RangeError('Invalid Story level target');
    }
    if (usesRowClear && !rowClear) throw new RangeError('Missing Story row clear schedule');
    const level: FallingLevel = {
      ...fallingLevel,
      board: {
        rows, cols, tileTypes,
        initial: { kind: 'generated', filledBottomRows, emptyTopRows: rows - filledBottomRows }
      },
      random: { seedPolicy: 'fresh_per_game' },
      incomingRows: {
        kind: 'generated', tilesPerRow: cols, previewNextRow: true, allowEarlyDrop: true,
        initialIntervalMs: rowIntervalMs, minimumIntervalMs: rowIntervalMs, decreaseEveryRows: 1, decreaseByMs: 0,
        removalDurationFractionOfInterval: 0.1
      },
      delivery: targetItems === undefined ? undefined : delivery,
      rowClear: usesRowClear ? rowClear : undefined
    };
    createFalling(0, level);
    return { level, target };
  });
  return { stages, messages };
}
