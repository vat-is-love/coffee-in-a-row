import { getThirdStarChallenge } from '@game/levels/story-challenges.mjs';
import story from '@game/levels/story.json';
import shadySouls from '@game/levels/shady-souls.json';
import { createFalling, fallingLevel, type FallingLevel } from '../logic/falling';

const messageKeys = ['title', 'levelComplete', 'continue', 'victory', 'victoryPrompt', 'restart', 'modeLabel', 'choose'] as const;
export type StoryGrid = readonly (readonly number[])[];
type PowerUp = keyof typeof import('../logic/falling').BUFF_TILES;
export type StoryChallengeEvent = {
  type: 'beforeDrop';
  hasAvailableMove(): boolean;
} | {
  type: 'clear';
  grid: StoryGrid;
  count: number;
  clearedTiles: number;
  color?: number;
  powerUp?: PowerUp;
  removedPowerUps: readonly PowerUp[];
  destroyedItems: number;
  deliveredItems: number;
};
export type StoryChallenge = {
  hint: Record<'en' | 'ru', string>;
  advance?(progress: number, event: StoryChallengeEvent): number;
  qualifies(grid: StoryGrid, progress: number): boolean;
};
export type StoryMessages = Record<typeof messageKeys[number], string> & { description?: string };
export type StoryBriefing = {
  en: string;
  ru: string;
  demo?: string;
};
export type StoryConfig = {
  messages: Record<'en' | 'ru', StoryMessages>;
  thirdStar?: string;
  levels: {
    board: { rows: number; cols: number; filledBottomRows: number };
    tileTypes: number;
    rowIntervalMs: number;
    removalDurationMs: number;
    targetTiles?: number;
    targetItems?: number;
    delivery?: FallingLevel['delivery'];
    buffs?: FallingLevel['buffs'];
    thirdStar?: string;
    briefing?: StoryBriefing;
  }[];
};

export const stories = { 'story-large': story, 'shady-souls': shadySouls };
export type StoryMode = keyof typeof stories;

export function storyTitle(mode: StoryMode, language: 'en' | 'ru'): string {
  const introductionTitles = { en: 'Getting to know the game', ru: 'Знакомство с игрой' };
  return mode === 'story-large' ? introductionTitles[language] : stories[mode].messages[language].title;
}

export function isStoryMode(mode: unknown): mode is StoryMode {
  return typeof mode === 'string' && Object.prototype.hasOwnProperty.call(stories, mode);
}

export function loadStory({ levels, messages, thirdStar }: StoryConfig) {
  if (!Array.isArray(levels) || !levels.length) throw new RangeError('Story must contain at least one level');
  for (const language of ['en', 'ru'] as const) {
    if (messageKeys.some(key => {
      const message = messages?.[language]?.[key];
      return typeof message !== 'string' || !message.trim();
    })) throw new RangeError(`Missing Story text for ${language}`);
  }
  const stages = levels.map(({ board, tileTypes, targetTiles, targetItems, rowIntervalMs, removalDurationMs, delivery, buffs, briefing, thirdStar: stageChallenge }) => {
    const { rows, cols, filledBottomRows } = board;
    const target = targetItems ?? targetTiles;
    if (target === undefined || !Number.isSafeInteger(target) || target < 1 ||
        (targetItems !== undefined && (targetTiles !== undefined || !delivery)) ||
        (targetItems === undefined && delivery !== undefined)) {
      throw new RangeError('Invalid Story level target');
    }
    if (buffs && !buffs.schedule) throw new RangeError('Missing Story buff schedule');
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
        removalDurationFractionOfInterval: removalDurationMs / rowIntervalMs
      },
      delivery,
      buffs
    };
    createFalling(0, level);
    return { level, target, briefing, thirdStar: getThirdStarChallenge(stageChallenge ?? thirdStar) };
  });
  return { stages, messages };
}
