import { SeededRNG } from './rng';
import type { Position } from './types';
import level from '@game/levels/falling.json';
import { fixedTiles, levelSeed } from '../levels/initial';

type ItemSchedule = { firstRow: number; everyRows: number };
type BuffType = keyof typeof BUFF_TILES;
type BuffSchedule = ItemSchedule & { minimumEveryRows?: number };

export type FallingLevel = {
  mode: string;
  board: {
    rows: number;
    cols: number;
    tileTypes: number;
    initial: { kind: string; filledBottomRows: number; emptyTopRows: number } |
      { kind: string; tiles: number[][] };
  };
  random: Parameters<typeof levelSeed>[0];
  rules: { minimumGroupSize: number; groupConnectivity: string; gravity: string; afterRemoval: string };
  incomingRows: {
    kind: string;
    tilesPerRow: number;
    previewNextRow: boolean;
    allowEarlyDrop: boolean;
    initialIntervalMs: number;
    minimumIntervalMs: number;
    decreaseEveryRows: number;
    decreaseByMs: number;
    removalDurationFractionOfInterval: number;
  };
  objective: { type: string; targetRows: number | null };
  lossCondition: { type: string };
  delivery?: ItemSchedule;
  buffs?: { types: BuffType[]; first?: BuffType; schedule: BuffSchedule };
};

export const fallingLevel: FallingLevel = level;
export const STORY_ITEM = 6;
export const ROW_CLEAR_ITEM = 7;
export const COLUMN_CLEAR_ITEM = 8;
export const BOMB_ITEM = 9;
export const BUFF_TILES = { horizontal: ROW_CLEAR_ITEM, vertical: COLUMN_CLEAR_ITEM, bomb: BOMB_ITEM };
export type FallingGrid = number[][];
export interface FallingState {
  grid: FallingGrid;
  nextRow: number[];
  seed: number;
  score: number;
  rowsAdded: number;
  delivered: number;
  buffsSpawned: number;
  nextBuffRow?: number;
}
export interface TileMotion { from: Position; to: Position }

export function rowInterval(rowsAdded: number, { incomingRows }: FallingLevel = fallingLevel): number {
  const { initialIntervalMs, minimumIntervalMs, decreaseEveryRows, decreaseByMs } = incomingRows;
  return Math.max(minimumIntervalMs, initialIntervalMs - Math.floor(rowsAdded / decreaseEveryRows) * decreaseByMs);
}

export function turnDuration(rowsAdded: number, description: FallingLevel = fallingLevel): number {
  return rowInterval(rowsAdded, description) * description.incomingRows.removalDurationFractionOfInterval;
}

function isScheduled(schedule: ItemSchedule | undefined, row: number): boolean {
  return !!schedule && row >= schedule.firstRow && (row - schedule.firstRow) % schedule.everyRows === 0;
}

function generateRow(rng: SeededRNG, { board, delivery }: FallingLevel, rowNumber: number): number[] {
  const row = Array.from({ length: board.cols }, () => rng.nextInt(board.tileTypes));
  if (isScheduled(delivery, rowNumber)) row[rng.nextInt(board.cols)] = STORY_ITEM;
  return row;
}

export function createFalling(seed?: number, description: FallingLevel = fallingLevel): FallingState {
  const { board, rules, incomingRows, objective, lossCondition, delivery, buffs } = description;
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
  if ([delivery, buffs?.schedule].some(schedule => schedule &&
      ![schedule.firstRow, schedule.everyRows].every(n => Number.isSafeInteger(n) && n > 0))) {
    throw new RangeError('Invalid Story item schedule');
  }
  if (buffs) {
    const { everyRows, minimumEveryRows = everyRows } = buffs.schedule;
    if (!Array.isArray(buffs.types) || !buffs.types.length ||
        buffs.types.some(type => !Object.hasOwn(BUFF_TILES, type)) ||
        (buffs.first !== undefined && !buffs.types.includes(buffs.first)) ||
        !Number.isSafeInteger(minimumEveryRows) || minimumEveryRows < 1 || minimumEveryRows > everyRows) {
      throw new RangeError('Invalid Story buff configuration');
    }
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
  const nextRow = generateRow(rng, description, 1);
  return {
    grid, nextRow, seed: rng.getSeed(), score: 0, rowsAdded: 0, delivered: 0,
    buffsSpawned: 0, nextBuffRow: buffs?.schedule.firstRow
  };
}

export function findGroup(grid: FallingGrid, start: Position): Position[] {
  const color = grid[start.row]?.[start.col];
  if (color === undefined || color < 0 || color >= STORY_ITEM) return [];
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

export function findRemoval(grid: FallingGrid, start: Position): Position[] {
  const { row, col } = start;
  const tile = grid[row]?.[col];
  if (tile === ROW_CLEAR_ITEM || tile === COLUMN_CLEAR_ITEM || tile === BOMB_ITEM) {
    return grid.flatMap((cells, r) => cells.flatMap((value, c) => {
      const inArea = tile === ROW_CLEAR_ITEM ? r === row : tile === COLUMN_CLEAR_ITEM ? c === col :
        Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1;
      return inArea && value >= 0 ? [{ row: r, col: c }] : [];
    }));
  }
  const group = findGroup(grid, start);
  return group.length >= 2 ? group : [];
}

function settle(grid: FallingGrid, removed: Position[] = []) {
  const keys = new Set(removed.map(p => `${p.row},${p.col}`));
  const rows = grid.length;
  const cols = grid[0].length;
  const columns: Position[][] = [];
  const deliveries: TileMotion[] = [];
  for (let col = 0; col < cols; col++) {
    const survivors: Position[] = [];
    for (let row = 0; row < rows; row++) {
      if (grid[row][col] >= 0 && !keys.has(`${row},${col}`)) survivors.push({ row, col });
    }
    // Reaching the bottom removes the item and can free another item above it.
    while (survivors.length && grid[survivors.at(-1)!.row][col] === STORY_ITEM) {
      deliveries.push({ from: survivors.pop()!, to: { row: rows - 1, col } });
    }
    if (survivors.length) columns.push(survivors);
  }
  const settled = Array.from({ length: rows }, () => Array<number>(cols).fill(-1));
  const offset = Math.floor((cols - columns.length) / 2);
  const motions: TileMotion[] = [];
  columns.forEach((column, index) => column.forEach((from, i) => {
    const to = { row: rows - column.length + i, col: offset + index };
    settled[to.row][to.col] = grid[from.row][from.col];
    motions.push({ from, to });
  }));
  return { grid: settled, motions, deliveries };
}

/** Motion records preserve each surviving tile's identity through gravity and centering. */
export function clearAt(state: FallingState, start: Position): {
  state: FallingState; removed: Position[]; motions: TileMotion[]; deliveries: TileMotion[];
} {
  const removed = findRemoval(state.grid, start);
  if (!removed.length) return { state, removed: [], motions: [], deliveries: [] };
  const { grid, motions, deliveries } = settle(state.grid, removed);
  return {
    state: { ...state, grid, score: state.score + removed.length * (removed.length - 1) * 50, delivered: state.delivered + deliveries.length },
    removed, motions, deliveries
  };
}

/** Check overflow before mutating anything; the incoming row covers the full board width. */
export function addFallingRow(state: FallingState, description: FallingLevel = fallingLevel): {
  state: FallingState; added: Position[]; overflow: boolean; motions: TileMotion[]; deliveries: TileMotion[];
  buff?: Position & { tile: number };
} {
  if (state.grid[0].some(color => color >= 0)) return { state, added: [], overflow: true, motions: [], deliveries: [] };
  const { board, buffs } = description;
  const grid = state.grid.map(row => [...row]);
  const added: Position[] = [];
  for (let col = 0; col < board.cols; col++) {
    let row = board.rows - 1;
    while (row >= 0 && grid[row][col] >= 0) row--;
    grid[row][col] = state.nextRow[col];
    added.push({ row, col });
  }
  const rng = new SeededRNG(state.seed);
  const rowsAdded = state.rowsAdded + 1;
  let buff: (Position & { tile: number }) | undefined;
  let { buffsSpawned, nextBuffRow } = state;
  if (buffs && rowsAdded === nextBuffRow) {
    // The buff replaces a settled normal tile, leaving the incoming preview intact.
    const slots = state.grid.flatMap((cells, row) =>
      cells.flatMap((tile, col) => tile >= 0 && tile < STORY_ITEM ? [{ row, col }] : []));
    if (slots.length) {
      const pos = slots[rng.nextInt(slots.length)];
      const type = buffsSpawned === 0 && buffs.first ? buffs.first : buffs.types[rng.nextInt(buffs.types.length)];
      const tile = BUFF_TILES[type];
      grid[pos.row][pos.col] = tile;
      buff = { ...pos, tile };
      buffsSpawned++;
    }
    const { everyRows, minimumEveryRows = everyRows } = buffs.schedule;
    nextBuffRow += Math.max(minimumEveryRows, everyRows - Math.max(0, buffsSpawned - 1));
  }
  const nextRow = generateRow(rng, description, rowsAdded + 1);
  const { grid: settled, motions, deliveries } = settle(grid);
  return {
    state: { ...state, grid: settled, nextRow, seed: rng.getSeed(), rowsAdded, delivered: state.delivered + deliveries.length, buffsSpawned, nextBuffRow },
    added, overflow: false, buff, motions, deliveries
  };
}
