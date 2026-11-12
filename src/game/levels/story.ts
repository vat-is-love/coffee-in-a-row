import story from '@game/levels/story.json';
import { createFalling, fallingLevel, type FallingLevel } from '../logic/falling';

const messageKeys = ['levelComplete', 'continue', 'victory', 'victoryPrompt', 'restart', 'modeLabel', 'choose'] as const;
export type StoryMessages = Record<typeof messageKeys[number], string>;
type StoryConfig = Omit<typeof story, 'messages'> & { messages: Record<'en' | 'ru', StoryMessages> };

export function loadStory({ board, rowIntervalMs, levels, messages }: StoryConfig = story) {
  if (!Array.isArray(levels) || !levels.length) throw new RangeError('Story must contain at least one level');
  for (const language of ['en', 'ru'] as const) {
    if (messageKeys.some(key => {
      const message = messages?.[language]?.[key];
      return typeof message !== 'string' || !message.trim();
    })) throw new RangeError(`Missing Story text for ${language}`);
  }
  const { rows, cols, filledBottomRows } = board;
  const stages = levels.map(({ tileTypes, targetTiles }) => {
    if (!Number.isSafeInteger(targetTiles) || targetTiles < 1) throw new RangeError('Invalid Story tile target');
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
      }
    };
    createFalling(0, level);
    return { level, targetTiles };
  });
  return { stages, messages };
}
