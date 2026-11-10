import { SeededRNG, createRandomSeed } from './rng';
import type { Position } from './types';

export const FALLING = { rows: 8, cols: 8, colors: 4, initialRows: 3, turnsPerRow: 10 } as const;
export type FallingGrid = number[][];
export interface FallingState {
  grid: FallingGrid;
  nextRow: number[];
  seed: number;
  score: number;
  rowsAdded: number;
}
export interface TileMotion { from: Position; to: Position }

export function rowInterval(rowsAdded: number): number {
  return Math.max(3500, 5000 - Math.floor(rowsAdded / 10) * 250);
}

export function turnDuration(rowsAdded: number): number {
  return rowInterval(rowsAdded) / FALLING.turnsPerRow;
}

export function createFalling(seed: number = createRandomSeed()): FallingState {
  const rng = new SeededRNG(seed);
  const grid = Array.from({ length: FALLING.rows }, (_, row) =>
    Array.from({ length: FALLING.cols }, () => row < FALLING.rows - FALLING.initialRows ? -1 : rng.nextInt(FALLING.colors)));
  const nextRow = Array.from({ length: FALLING.cols }, () => rng.nextInt(FALLING.colors));
  return { grid, nextRow, seed: rng.getSeed(), score: 0, rowsAdded: 0 };
}

export function findGroup(grid: FallingGrid, start: Position): Position[] {
  const color = grid[start.row]?.[start.col];
  if (color === undefined || color < 0) return [];
  const visited = new Set<string>();
  const group: Position[] = [];
  const queue = [start];
  while (queue.length) {
    const pos = queue.pop()!;
    const key = `${pos.row},${pos.col}`;
    if (visited.has(key) || grid[pos.row]?.[pos.col] !== color) continue;
    visited.add(key);
    group.push(pos);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push({ row: pos.row + dr, col: pos.col + dc });
  }
  return group;
}

/** Motion records preserve each surviving tile's identity through gravity and centering. */
export function clearGroup(state: FallingState, start: Position): {
  state: FallingState; removed: Position[]; motions: TileMotion[];
} {
  const removed = findGroup(state.grid, start);
  if (removed.length < 2) return { state, removed: [], motions: [] };
  const keys = new Set(removed.map(p => `${p.row},${p.col}`));
  const columns: Position[][] = [];
  for (let col = 0; col < FALLING.cols; col++) {
    const survivors: Position[] = [];
    for (let row = 0; row < FALLING.rows; row++) {
      if (state.grid[row][col] >= 0 && !keys.has(`${row},${col}`)) survivors.push({ row, col });
    }
    if (survivors.length) columns.push(survivors);
  }
  const grid = Array.from({ length: FALLING.rows }, () => Array<number>(FALLING.cols).fill(-1));
  const offset = Math.floor((FALLING.cols - columns.length) / 2);
  const motions: TileMotion[] = [];
  columns.forEach((column, index) => column.forEach((from, i) => {
    const to = { row: FALLING.rows - column.length + i, col: offset + index };
    grid[to.row][to.col] = state.grid[from.row][from.col];
    motions.push({ from, to });
  }));
  return { state: { ...state, grid, score: state.score + removed.length * (removed.length - 1) * 50 }, removed, motions };
}

/** Check overflow before mutating anything; the incoming row covers the full board width. */
export function addFallingRow(state: FallingState): { state: FallingState; added: Position[]; overflow: boolean } {
  if (state.grid[0].some(color => color >= 0)) return { state, added: [], overflow: true };
  const grid = state.grid.map(row => [...row]);
  const added: Position[] = [];
  for (let col = 0; col < FALLING.cols; col++) {
    let row = FALLING.rows - 1;
    while (row >= 0 && grid[row][col] >= 0) row--;
    grid[row][col] = state.nextRow[col];
    added.push({ row, col });
  }
  const rng = new SeededRNG(state.seed);
  const nextRow = Array.from({ length: FALLING.cols }, () => rng.nextInt(FALLING.colors));
  return { state: { ...state, grid, nextRow, seed: rng.getSeed(), rowsAdded: state.rowsAdded + 1 }, added, overflow: false };
}
