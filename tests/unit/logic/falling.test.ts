import { describe, it, expect } from 'vitest';
import { createFalling, clearGroup, addFallingRow, findGroup, rowInterval, turnDuration, type FallingState } from '../../../src/game/logic/falling';

function empty(): FallingState {
  return { ...createFalling(42), grid: Array.from({ length: 8 }, () => Array(8).fill(-1)) };
}
const count = (state: FallingState) => state.grid.flat().filter(n => n >= 0).length;

describe('Falling rows', () => {
  it('starts with three rows, four colors and a reproducible preview', () => {
    const state = createFalling(42);
    expect(state).toEqual(createFalling(42));
    expect(count(state)).toBe(24);
    expect(state.grid.slice(0, 5).flat().every(n => n === -1)).toBe(true);
    expect([...state.grid.flat(), ...state.nextRow].every(n => n >= -1 && n < 4)).toBe(true);
  });

  it('uses connected orthogonal groups, rejecting singletons and empty cells', () => {
    const state = empty();
    state.grid[7][0] = 1;
    state.grid[6][1] = 1;
    expect(findGroup(state.grid, { row: 7, col: 0 })).toHaveLength(1);
    expect(clearGroup(state, { row: 7, col: 0 }).state).toBe(state);
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
    const result = clearGroup(state, { row: 7, col: 0 });
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
    const result = clearGroup(state, { row: 7, col: 2 });
    expect(count(result.state)).toBe(0);
    expect(result.motions).toEqual([]);
    expect(result.state.score).toBeGreaterThan(4 * 100);
  });

  it('drops the exact preview across the full width at different heights', () => {
    const state = empty();
    state.grid[7][3] = 1;
    state.grid[6][3] = 2;
    const before = structuredClone(state);
    const result = addFallingRow(state);
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
    const full = addFallingRow(state);
    expect(full.overflow).toBe(false);
    expect(full.state.grid[0][2]).toBe(state.nextRow[2]);
    const overflow = addFallingRow(full.state);
    expect(overflow.overflow).toBe(true);
    expect(overflow.state).toBe(full.state);
    expect(overflow.added).toEqual([]);
    expect(rowInterval(0)).toBe(5000);
    expect(rowInterval(10)).toBe(4750);
    expect(rowInterval(50)).toBe(3750);
    expect(rowInterval(59)).toBe(3750);
    expect(rowInterval(60)).toBe(3500);
    expect(rowInterval(1000)).toBe(3500);
    expect(turnDuration(0)).toBe(500);
    expect(turnDuration(40)).toBe(400);
    expect(turnDuration(60)).toBe(350);
    for (const rows of [0, 10, 20, 40, 50, 60, 1000]) expect(turnDuration(rows) * 10).toBe(rowInterval(rows));
  });
});
