import { SeededRNG } from './rng';
import type { Position } from './types';
import level from '@game/levels/falling.json';
import { fixedTiles, levelSeed } from '../levels/initial';

type FallingLevel = Omit<typeof level, 'board' | 'random'> & {
  board: Omit<typeof level.board, 'initial'> & {
    initial: { kind: string; filledBottomRows: number; emptyTopRows: number } |
      { kind: string; tiles: number[][] };
  };
  random: Parameters<typeof levelSeed>[0];
};

export const fallingLevel: FallingLevel = level;
export type FallingGrid = number[][];
export interface FallingState {
  grid: FallingGrid;
  nextRow: number[];
  seed: number;
  score: number;
  rowsAdded: number;
}
export interface TileMotion { from: Position; to: Position }

export function rowInterval(rowsAdded: number, { incomingRows }: FallingLevel = fallingLevel): number {
  const { initialIntervalMs, minimumIntervalMs, decreaseEveryRows, decreaseByMs } = incomingRows;
  return Math.max(minimumIntervalMs, initialIntervalMs - Math.floor(rowsAdded / decreaseEveryRows) * decreaseByMs);
}

export function turnDuration(rowsAdded: number, description: FallingLevel = fallingLevel): number {
  return rowInterval(rowsAdded, description) * description.incomingRows.removalDurationFractionOfInterval;
}

export function createFalling(seed?: number, description: FallingLevel = fallingLevel): FallingState {
  const { board, rules, incomingRows, objective, lossCondition } = description;
  const { rows, cols, tileTypes, initial } = board;
  const { initialIntervalMs, minimumIntervalMs, decreaseEveryRows, decreaseByMs, removalDurationFractionOfInterval } = incomingRows;
  if (!Number.isInteger(rows) || rows < 2 || !Number.isInteger(cols) || cols < 1 ||
      !Number.isInteger(tileTypes) || tileTypes < 1 || tileTypes > 6 ||
      incomingRows.tilesPerRow !== cols ||
      ![initialIntervalMs, minimumIntervalMs, decreaseEveryRows, decreaseByMs].every(Number.isSafeInteger) ||
      minimumIntervalMs <= 0 || initialIntervalMs < minimumIntervalMs || decreaseEveryRows <= 0 ||
      decreaseByMs < 0 || !(removalDurationFractionOfInterval > 0 && removalDurationFractionOfInterval <= 1)) {
    throw new RangeError('Invalid Falling Rows board or timing');
  }
  if (description.mode !== 'falling' || rules.minimumGroupSize !== 2 ||
      rules.groupConnectivity !== 'orthogonal' || rules.gravity !== 'down' ||
      rules.afterRemoval !== 'center_nonempty_columns' || incomingRows.kind !== 'generated' ||
      objective.type !== 'survive_until_overflow' || objective.targetRows !== null ||
      lossCondition.type !== 'top_row_occupied_when_next_row_drops') {
    throw new RangeError('Unsupported Falling Rows level rules');
  }
  const rng = new SeededRNG(seed ?? levelSeed(description.random));
  let grid: FallingGrid;
  if (initial.kind === 'generated' && 'filledBottomRows' in initial &&
      Number.isInteger(initial.filledBottomRows) && initial.filledBottomRows >= 0 &&
      initial.emptyTopRows >= 0 && initial.filledBottomRows + initial.emptyTopRows === rows) {
    grid = Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, () => row < initial.emptyTopRows ? -1 : rng.nextInt(tileTypes)));
  } else if (initial.kind === 'fixed' && 'tiles' in initial) {
    grid = fixedTiles(board, initial.tiles, -1);
    if (grid.some((row, r) => r < rows - 1 && row.some((tile, c) => tile >= 0 && grid[r + 1][c] < 0))) {
      throw new RangeError('Falling Rows cannot start with empty cells below tiles');
    }
  } else {
    throw new RangeError('Invalid Falling Rows starting layout');
  }
  const nextRow = Array.from({ length: cols }, () => rng.nextInt(tileTypes));
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
    const { row, col } = pos;
    queue.push({ row: row + 1, col }, { row: row - 1, col }, { row, col: col + 1 }, { row, col: col - 1 });
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
  const rows = state.grid.length;
  const cols = state.grid[0].length;
  const columns: Position[][] = [];
  for (let col = 0; col < cols; col++) {
    const survivors: Position[] = [];
    for (let row = 0; row < rows; row++) {
      if (state.grid[row][col] >= 0 && !keys.has(`${row},${col}`)) survivors.push({ row, col });
    }
    if (survivors.length) columns.push(survivors);
  }
  const grid = Array.from({ length: rows }, () => Array<number>(cols).fill(-1));
  const offset = Math.floor((cols - columns.length) / 2);
  const motions: TileMotion[] = [];
  columns.forEach((column, index) => column.forEach((from, i) => {
    const to = { row: rows - column.length + i, col: offset + index };
    grid[to.row][to.col] = state.grid[from.row][from.col];
    motions.push({ from, to });
  }));
  return { state: { ...state, grid, score: state.score + removed.length * (removed.length - 1) * 50 }, removed, motions };
}

/** Check overflow before mutating anything; the incoming row covers the full board width. */
export function addFallingRow(state: FallingState, { board }: FallingLevel = fallingLevel): { state: FallingState; added: Position[]; overflow: boolean } {
  if (state.grid[0].some(color => color >= 0)) return { state, added: [], overflow: true };
  const grid = state.grid.map(row => [...row]);
  const added: Position[] = [];
  for (let col = 0; col < board.cols; col++) {
    let row = board.rows - 1;
    while (row >= 0 && grid[row][col] >= 0) row--;
    grid[row][col] = state.nextRow[col];
    added.push({ row, col });
  }
  const rng = new SeededRNG(state.seed);
  const nextRow = Array.from({ length: board.cols }, () => rng.nextInt(board.tileTypes));
  return { state: { ...state, grid, nextRow, seed: rng.getSeed(), rowsAdded: state.rowsAdded + 1 }, added, overflow: false };
}
