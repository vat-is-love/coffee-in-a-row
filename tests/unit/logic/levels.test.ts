import { describe, expect, it } from 'vitest';
import story from '@game/levels/story.json';
import { match3Level, startMatch3 } from '../../../src/game/levels/match3';
import { loadStory } from '../../../src/game/levels/story';
import { addFallingRow, createFalling, fallingLevel, rowInterval, BUFF_TILES, ROW_CLEAR_ITEM, STORY_ITEM, turnDuration } from '../../../src/game/logic/falling';

describe('JSON level configuration', () => {
  it('loads configured levels with the game rules', () => {
    startMatch3();
    createFalling();
    loadStory();
  });

  it('keeps the story in JSON order with a fixed pace and the configured palette', () => {
    const { stages } = loadStory({
      messages: story.messages,
      board: { rows: 4, cols: 5, filledBottomRows: 1 },
      rowIntervalMs: 3000,
      delivery: { firstRow: 2, everyRows: 3 },
      rowClear: { firstRow: 3, everyRows: 2 },
      levels: [{ tileTypes: 5, targetTiles: 20 }, { tileTypes: 3, targetItems: 3, rowClear: true }]
    });
    expect(stages.map(({ level }) => level.board.tileTypes)).toEqual([5, 3]);
    expect(stages.map(({ target }) => target)).toEqual([20, 3]);
    for (const [i, { level }] of stages.entries()) {
      let state = createFalling(42, level);
      expect(state.grid.flat().every(tile => tile < level.board.tileTypes)).toBe(true);
      expect([rowInterval(0, level), rowInterval(60, level), turnDuration(60, level)])
        .toEqual([3000, 3000, 300]);
      for (let row = 1; row <= 8; row++) {
        const expectedItems = i === 1 && row % 3 === 2 ? [STORY_ITEM] : [];
        expect(state.nextRow).toHaveLength(level.board.cols);
        expect(state.nextRow.filter(tile => tile >= level.board.tileTypes)).toEqual(expectedItems);
        // Leave one settled tile in a column where it won't block a cup.
        const col = state.nextRow.findIndex(tile => tile !== STORY_ITEM);
        state.grid.forEach(cells => cells.fill(-1));
        state.grid.at(-1)![col] = 0;
        const drop = addFallingRow(state, level);
        expect(drop.buff).toEqual(i === 1 && row >= 3 && row % 2 === 1
          ? { row: level.board.rows - 1, col, tile: ROW_CLEAR_ITEM } : undefined);
        expect(drop.motions.filter(({ from }) => drop.added.some(({ row, col }) => row === from.row && col === from.col))
          .map(({ to }) => drop.state.grid[to.row][to.col])).not.toContain(ROW_CLEAR_ITEM);
        state = drop.state;
      }
      expect(state.delivered).toBe(i === 1 ? 3 : 0);
    }
  });

  it('unlocks Story buffs in order and caps the level nine acceleration at five rows', () => {
    const { stages } = loadStory();
    expect(stages.slice(3, 6).map(({ target }) => target)).toEqual([200, 150, 120]);
    for (const [index, { level }] of stages.slice(3).entries()) {
      let state = createFalling(42, level);
      const drops = [];
      for (let row = 1; row <= 80; row++) {
        state.grid.forEach(cells => cells.fill(-1));
        state.grid.at(-1)![0] = 0;
        const drop = addFallingRow(state, level);
        state = drop.state;
        if (drop.buff) {
          drops.push({ row, tile: drop.buff.tile });
          expect(state.grid.at(-1)![0]).toBe(drop.buff.tile);
        }
      }
      const types = Object.values(BUFF_TILES).slice(0, index + 1);
      expect(new Set(drops.map(({ tile }) => tile))).toEqual(new Set(types));
      if (index < 3) expect(drops[0]).toEqual({ row: 7, tile: types.at(-1) });
      if (index === 5) {
        expect(drops.map(({ row }) => row)).toEqual([10, 20, 29, 37, 44, 50, 55, 60, 65, 70, 75, 80]);
      }
    }
  });

  it('loads the exact Match-3 layout, with the configured seed for future refills', () => {
    const tiles = [[0, 1, 0], [2, 0, 2]];
    const level = {
      ...match3Level,
      board: { ...match3Level.board, rows: 2, cols: 3, tileTypes: 3, initial: { kind: 'fixed', tiles } },
      objective: { ...match3Level.objective, targetCells: 6 },
      random: { seedPolicy: 'fixed', seed: 42 }
    };
    const { config, state } = startMatch3(level);
    expect(config).toMatchObject({ rows: 2, cols: 3, tileTypes: 3 });
    expect(state.grid.map(row => row.map(tile => tile.type))).toEqual(tiles);
    expect(state.rngSeed).toBe(42);
    tiles[0][0] = -1;
    expect(state.grid[0][0].type).toBe(0);
    expect(() => startMatch3(level)).toThrow(/dimensions and palette/);
  });

  it('uses the Falling Rows layout and timing through the next row', () => {
    const tiles = [[-1, -1, -1], [-1, -1, 1]];
    const level = {
      ...fallingLevel,
      board: { rows: 2, cols: 3, tileTypes: 2, initial: { kind: 'fixed', tiles } },
      incomingRows: { ...fallingLevel.incomingRows, tilesPerRow: 3, initialIntervalMs: 2000, minimumIntervalMs: 1000, decreaseEveryRows: 2, decreaseByMs: 200 },
      random: { seedPolicy: 'fixed', seed: 42 }
    };
    const state = createFalling(undefined, level);
    expect(state.grid).toEqual(tiles);
    expect(state).toEqual(createFalling(undefined, level));
    const result = addFallingRow(state, level);
    expect(result.added).toEqual([{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 0, col: 2 }]);
    expect(result.added.map(({ row, col }) => result.state.grid[row][col])).toEqual(state.nextRow);
    expect(result.state.nextRow).toHaveLength(3);
    expect(rowInterval(2, level)).toBe(1800);
    expect(turnDuration(2, level)).toBe(180);
  });
});
