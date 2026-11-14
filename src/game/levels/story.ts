import story from '@game/levels/story.json';
import { createFalling, fallingLevel, type FallingLevel } from '../logic/falling';

const messageKeys = ['levelComplete', 'continue', 'victory', 'victoryPrompt', 'restart', 'modeLabel', 'choose'] as const;
export type StoryMessages = Record<typeof messageKeys[number], string>;
type Buffs = NonNullable<FallingLevel['buffs']>;
export type StoryConfig = {
  board: { rows: number; cols: number; filledBottomRows: number };
  rowIntervalMs: number;
  messages: Record<'en' | 'ru', StoryMessages>;
  levels: {
    tileTypes: number; targetTiles?: number; targetItems?: number; rowClear?: boolean;
    buffs?: Omit<Buffs, 'schedule'> & { schedule?: Buffs['schedule'] };
  }[];
  delivery?: FallingLevel['delivery'];
  buffSchedule?: Buffs['schedule'];
  rowClear?: Buffs['schedule'];
};

export const storyLevelCount = Array.isArray(story?.levels) ? story.levels.length : 0;
export const stories = { story, 'story-large': { ...story, board: story.largeBoard } };
export type StoryMode = keyof typeof stories;

export function isStoryMode(mode: unknown): mode is StoryMode {
  return mode === 'story' || mode === 'story-large';
}

export function loadStory({ board, rowIntervalMs, levels, messages, delivery, rowClear, buffSchedule = rowClear }: StoryConfig) {
  if (!Array.isArray(levels) || !levels.length) throw new RangeError('Story must contain at least one level');
  for (const language of ['en', 'ru'] as const) {
    if (messageKeys.some(key => {
      const message = messages?.[language]?.[key];
      return typeof message !== 'string' || !message.trim();
    })) throw new RangeError(`Missing Story text for ${language}`);
  }
  const { rows, cols, filledBottomRows } = board;
  const stages = levels.map(({ tileTypes, targetTiles, targetItems, rowClear: usesRowClear, buffs }) => {
    const target = targetItems === undefined ? targetTiles : targetItems;
    if (target === undefined || !Number.isSafeInteger(target) || target < 1 ||
        (targetItems !== undefined && (targetTiles !== undefined || !delivery))) {
      throw new RangeError('Invalid Story level target');
    }
    const stageBuffs = buffs ?? (usesRowClear ? { types: ['horizontal'] as Buffs['types'] } : undefined);
    const schedule = stageBuffs?.schedule ?? buffSchedule;
    if (stageBuffs && !schedule) throw new RangeError('Missing Story buff schedule');
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
      buffs: stageBuffs && schedule ? { ...stageBuffs, schedule } : undefined
    };
    createFalling(0, level);
    return { level, target };
  });
  return { stages, messages };
}
