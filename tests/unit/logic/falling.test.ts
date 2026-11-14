import { describe, it, expect } from 'vitest';
import { createFalling, clearAt, addFallingRow, fallingLevel, findGroup, findRemoval, rowInterval, BOMB_ITEM, COLUMN_CLEAR_ITEM, ROW_CLEAR_ITEM, STORY_ITEM, turnDuration, type FallingLevel, type FallingState } from '../../../src/game/logic/falling';

const testLevel: FallingLevel = {
  ...fallingLevel,
  delivery: undefined,
  board: { rows: 8, cols: 8, tileTypes: 4, initial: { kind: 'generated', filledBottomRows: 3, emptyTopRows: 5 } },
  incomingRows: {
    ...fallingLevel.incomingRows, tilesPerRow: 8, initialIntervalMs: 5000, minimumIntervalMs: 3500,
    decreaseEveryRows: 10, decreaseByMs: 250, removalDurationFractionOfInterval: 0.1
  }
};

function empty(): FallingState {
  return { ...createFalling(42, testLevel), grid: Array.from({ length: 8 }, () => Array(8).fill(-1)) };
}
const count = (state: FallingState) => state.grid.flat().filter(n => n >= 0).length;

describe('Falling rows', () => {
  it('starts with three rows, four colors and a reproducible preview', () => {
    const state = createFalling(42, testLevel);
    expect(state).toEqual(createFalling(42, testLevel));
    expect(count(state)).toBe(24);
    expect(state.grid.slice(0, 5).flat().every(n => n === -1)).toBe(true);
    expect([...state.grid.flat(), ...state.nextRow].every(n => n >= -1 && n < 4)).toBe(true);
  });

  it('uses connected orthogonal groups, rejecting singletons and empty cells', () => {
    const state = empty();
    state.grid[7][0] = 1;
    state.grid[6][1] = 1;
    expect(findGroup(state.grid, { row: 7, col: 0 })).toHaveLength(1);
    expect(clearAt(state, { row: 7, col: 0 }).state).toBe(state);
    expect(findGroup(state.grid, { row: 0, col: 0 })).toEqual([]);
    state.grid[7][1] = 1;
    expect(findGroup(state.grid, { row: 7, col: 0 })).toHaveLength(3);
  });

  it('applies gravity, removes empty columns, preserves tile order and centers survivors', () => {
    const state = empty();
    state.grid[7][0] = 0;
    state.grid[6][0] = 0;
    state.grid[5][0] = 2;
    state.grid[7][3] = 3;
    state.grid[6][3] = 1;
    state.grid[7][7] = 2;
    const before = structuredClone(state);
    const result = clearAt(state, { row: 7, col: 0 });
    expect(state).toEqual(before);
    expect(count(result.state)).toBe(4);
    expect(result.state.grid[7]).toEqual([-1, -1, 2, 3, 2, -1, -1, -1]);
    expect(result.state.grid[6][3]).toBe(1);
    expect(result.motions).toContainEqual({ from: { row: 5, col: 0 }, to: { row: 7, col: 2 } });
    expect(result.state.score).toBe(100);
  });

  it('can clear the whole board and rewards larger groups', () => {
    const state = empty();
    state.grid[7].fill(2);
    const result = clearAt(state, { row: 7, col: 2 });
    expect(count(result.state)).toBe(0);
    expect(result.motions).toEqual([]);
    expect(result.state.score).toBeGreaterThan(4 * 100);
  });

  it('activates a row clearer by itself and joins groups across gaps after clearing the bottom row', () => {
    const state = empty();
    state.grid[7][3] = ROW_CLEAR_ITEM;
    expect(findGroup(state.grid, { row: 7, col: 3 })).toEqual([]);
    expect(clearAt(state, { row: 7, col: 3 }).removed).toEqual([{ row: 7, col: 3 }]);

    state.grid[7][0] = 0;
    state.grid[7][7] = 1;
    state.grid[6][0] = 2;
    state.grid[6][7] = 2;
    const result = clearAt(state, { row: 7, col: 3 });
    expect(result.removed).toEqual([0, 3, 7].map(col => ({ row: 7, col })));
    expect(result.motions).toEqual([0, 7].map((col, index) => ({ from: { row: 6, col }, to: { row: 7, col: 3 + index } })));
    expect(result.state.grid[7]).toEqual([-1, -1, -1, 2, 2, -1, -1, -1]);
    expect(clearAt(result.state, { row: 7, col: 3 }).removed).toHaveLength(2);
  });

  it('joins separated columns after clearing a row above the bottom', () => {
    const state = empty();
    state.grid[6][1] = ROW_CLEAR_ITEM;
    state.grid[7][1] = state.grid[7][6] = 2;
    const result = clearAt(state, { row: 6, col: 1 });
    expect(result.state.grid[7]).toEqual([-1, -1, -1, 2, 2, -1, -1, -1]);
  });

  it('joins the tiles on either side of a cup delivered directly from the incoming row', () => {
    const state = empty();
    state.nextRow = [0, 2, 2, STORY_ITEM, 2, 2, 0, 1];
    const result = addFallingRow(state, testLevel);
    expect(result.deliveries).toEqual([{ from: { row: 7, col: 3 }, to: { row: 7, col: 3 } }]);
    expect(result.state.delivered).toBe(1);
    expect(result.state.grid[7]).toEqual([0, 2, 2, 2, 2, 0, 1, -1]);
    expect(findRemoval(result.state.grid, { row: 7, col: 1 })).toHaveLength(4);
    expect(result.motions).toContainEqual({ from: { row: 7, col: 4 }, to: { row: 7, col: 3 } });
  });

  it('does not substitute an incoming tile when no normal tile was already on the board', () => {
    const level: FallingLevel = { ...testLevel, buffs: { types: ['horizontal'], schedule: { firstRow: 7, everyRows: 8 } } };
    const state = { ...empty(), rowsAdded: 6, nextBuffRow: 7 };
    state.grid[7][0] = ROW_CLEAR_ITEM;
    const drop = addFallingRow(state, level);
    expect(drop.buff).toBeUndefined();
    expect(drop.added.map(({ row, col }) => drop.state.grid[row][col])).toEqual(state.nextRow);
  });

  it('spawns the configured first buff and accelerates up to the minimum gap', () => {
    const level: FallingLevel = {
      ...testLevel,
      buffs: { types: ['horizontal', 'vertical'], first: 'vertical', schedule: { firstRow: 2, everyRows: 4, minimumEveryRows: 2 } }
    };
    let state = createFalling(42, level);
    const drops = [];
    for (let row = 1; row <= 16; row++) {
      state.grid.forEach(cells => cells.fill(-1));
      state.grid[7][0] = 0;
      const drop = addFallingRow(state, level);
      if (drop.buff) drops.push({ row, tile: drop.buff.tile });
      state = drop.state;
    }
    expect(drops[0]).toEqual({ row: 2, tile: COLUMN_CLEAR_ITEM });
    expect(drops.map(({ row }) => row)).toEqual([2, 6, 9, 11, 13, 15]);
  });

  it('clears the entire column, including other special tiles, with vertical lightning', () => {
    const state = empty();
    state.grid[4][2] = STORY_ITEM;
    state.grid[5][2] = COLUMN_CLEAR_ITEM;
    state.grid[6][2] = ROW_CLEAR_ITEM;
    state.grid[7][2] = 0;
    state.grid[7][3] = 1;
    const result = clearAt(state, { row: 5, col: 2 });
    expect(result.removed).toEqual([4, 5, 6, 7].map(row => ({ row, col: 2 })));
    expect(result.deliveries).toEqual([]);
    expect(result.state.grid[7][3]).toBe(1);
  });

  it('clears a 3×3 area with the bomb, including diagonals and clipping at board edges', () => {
    const state = empty();
    state.grid[6].fill(0);
    state.grid[7].fill(1);
    state.grid[7][1] = BOMB_ITEM;
    expect(clearAt(state, { row: 7, col: 1 }).removed).toEqual([
      { row: 6, col: 0 }, { row: 6, col: 1 }, { row: 6, col: 2 },
      { row: 7, col: 0 }, { row: 7, col: 1 }, { row: 7, col: 2 }
    ]);
  });

  it('removes cups and other lightning in the cleared row and delivers cups that fall from above', () => {
    const state = empty();
    state.grid[6][3] = STORY_ITEM;
    state.grid[7].splice(0, 4, STORY_ITEM, ROW_CLEAR_ITEM, ROW_CLEAR_ITEM, 2);
    const result = clearAt(state, { row: 7, col: 1 });
    expect(result.removed).toEqual([0, 1, 2, 3].map(col => ({ row: 7, col })));
    expect(result.deliveries).toEqual([{ from: { row: 6, col: 3 }, to: { row: 7, col: 3 } }]);
    expect(result.state.delivered).toBe(1);
    expect(count(result.state)).toBe(0);
  });

  it('keeps items on top of remaining tiles and delivers them only once they reach the bottom', () => {
    const state = empty();
    state.grid[7].splice(0, 3, 1, 1, 2);
    state.grid[6].splice(0, 3, 0, 0, 2);
    state.nextRow[0] = STORY_ITEM;
    state.nextRow[1] = STORY_ITEM;
    const dropped = addFallingRow(state, testLevel).state;
    expect(dropped.delivered).toBe(0);
    expect(clearAt(dropped, { row: 5, col: 0 }).state).toBe(dropped);

    const partial = clearAt(dropped, { row: 6, col: 0 });
    expect(partial.state.delivered).toBe(0);
    expect(partial.state.grid[6].slice(0, 2)).toEqual([STORY_ITEM, STORY_ITEM]);
    const delivery = clearAt(partial.state, { row: 7, col: 0 });
    expect(delivery.removed).toHaveLength(2);
    expect(delivery.deliveries).toEqual([0, 1].map(col => ({ from: { row: 6, col }, to: { row: 7, col } })));
    expect(delivery.state.delivered).toBe(2);
    expect(delivery.state.grid.flat()).not.toContain(STORY_ITEM);
    expect(delivery.state.grid[7]).toEqual([-1, 2, ...state.nextRow.slice(3), -1]);
  });

  it('drops the exact preview across the full width at different heights', () => {
    const state = empty();
    state.grid[7][3] = 1;
    state.grid[6][3] = 2;
    const before = structuredClone(state);
    const result = addFallingRow(state, testLevel);
    expect(state).toEqual(before);
    expect(result.overflow).toBe(false);
    expect(count(result.state)).toBe(10);
    expect(result.added[3]).toEqual({ row: 5, col: 3 });
    result.added.forEach(p => expect(result.state.grid[p.row][p.col]).toBe(state.nextRow[p.col]));
    expect(result.state.rowsAdded).toBe(1);
    expect(result.state.seed).not.toBe(state.seed);
  });

  it('allows filling the top cell but rejects the next row atomically', () => {
    const state = empty();
    for (let r = 1; r < 8; r++) state.grid[r][2] = 1;
    const full = addFallingRow(state, testLevel);
    expect(full.overflow).toBe(false);
    expect(full.state.grid[0][2]).toBe(state.nextRow[2]);
    const overflow = addFallingRow(full.state, testLevel);
    expect(overflow.overflow).toBe(true);
    expect(overflow.state).toBe(full.state);
    expect(overflow.added).toEqual([]);
    expect(rowInterval(0, testLevel)).toBe(5000);
    expect(rowInterval(10, testLevel)).toBe(4750);
    expect(rowInterval(50, testLevel)).toBe(3750);
    expect(rowInterval(59, testLevel)).toBe(3750);
    expect(rowInterval(60, testLevel)).toBe(3500);
    expect(rowInterval(1000, testLevel)).toBe(3500);
    expect(turnDuration(0, testLevel)).toBe(500);
    expect(turnDuration(40, testLevel)).toBe(400);
    expect(turnDuration(60, testLevel)).toBe(350);
    for (const rows of [0, 10, 20, 40, 50, 60, 1000]) expect(turnDuration(rows, testLevel) * 10).toBe(rowInterval(rows, testLevel));
  });
});
