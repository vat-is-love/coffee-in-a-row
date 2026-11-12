import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { match3Level, startMatch3 } from '../../../src/game/levels/match3';
import { addFallingRow, createFalling, fallingLevel, rowInterval, turnDuration } from '../../../src/game/logic/falling';

describe('JSON level configuration', () => {
  const levelsDir = process.env.COFFEE_LEVELS_DIR;
  if (levelsDir) {
    it('loads release levels with the game rules', () => {
      const match3 = JSON.parse(readFileSync(join(levelsDir, 'match3.json'), 'utf8'));
      const falling = JSON.parse(readFileSync(join(levelsDir, 'falling.json'), 'utf8'));
      startMatch3(match3);
      createFalling(undefined, falling);
    });
  }

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
