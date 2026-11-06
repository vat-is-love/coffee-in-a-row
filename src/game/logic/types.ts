/**
 * Core type definitions for the Match-3 game logic.
 * Pure TypeScript - no Phaser, no DOM dependencies.
 */

export type TileType = 0 | 1 | 2 | 3 | 4 | 5;
export type TileTypeOrEmpty = TileType | -1;
export type SnowLayer = 0 | 1 | 2;

export enum Direction {
  Horizontal = 'horizontal',
  Vertical = 'vertical'
}

export interface Position {
  row: number;
  col: number;
}

export interface Tile {
  type: TileTypeOrEmpty;
  snow: SnowLayer;
}

export interface BoardConfig {
  rows: number;
  cols: number;
  tileTypes: number;
  maxMoves: number;
  snow: Array<{ row: number; col: number; layers: SnowLayer }>;
  seed?: number;
}

export interface BoardState {
  grid: Tile[][];
  movesLeft: number;
  score: number;
  rngSeed: number;
}

export interface Match {
  tiles: Position[];
  direction: Direction;
}

export interface ResolutionFrame {
  matches: Match[];
  boardState: BoardState;
  scoreDelta: number;
}

export interface ResolutionResult {
  frames: ResolutionFrame[];
  matches: Match[];
  cascades: number;
  scoreDelta: number;
  snowCleared: number;
  tilesCleared: number;
  boardState: BoardState;
}

export interface MoveResult {
  frames: ResolutionFrame[];
  valid: boolean;
  matches: Match[];
  cascades: number;
  scoreDelta: number;
  snowCleared: number;
  tilesCleared: number;
  boardState: BoardState;
  gameOver: 'none' | 'victory' | 'defeat' | 'reshuffle';
}

export interface GameConfig {
  rows: number;
  cols: number;
  tileTypes: number;
  maxMoves: number;
  snow: Array<{ row: number; col: number; layers: SnowLayer }>;
}

/**
 * Scoring constants - centralized for easy balancing
 */
export const SCORING = {
  TILE_BASE: 100,
  TILE_BONUS_PER_EXTRA: 50,      // per tile beyond 3 in a line
  SNOW_LAYER: 150,
  CASCADE_MULTIPLIER_CAP: 3,
  REMAINING_MOVE_BONUS: 100
} as const;

/**
 * Check if a position is within board bounds
 */
export function inBounds(config: GameConfig, pos: Position): boolean {
  return Number.isInteger(pos.row) && Number.isInteger(pos.col) &&
    pos.row >= 0 && pos.row < config.rows && pos.col >= 0 && pos.col < config.cols;
}

/**
 * Check if two positions are orthogonally adjacent
 */
export function areAdjacent(pos1: Position, pos2: Position): boolean {
  const dr = Math.abs(pos1.row - pos2.row);
  const dc = Math.abs(pos1.col - pos2.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

/**
 * Deep clone a board state
 */
export function cloneBoardState(state: BoardState): BoardState {
  return {
    grid: state.grid.map(row => row.map(tile => ({ ...tile }))),
    movesLeft: state.movesLeft,
    score: state.score,
    rngSeed: state.rngSeed
  };
}

/**
 * Create an empty board state from config
 */
export function createEmptyBoardState(config: GameConfig, rngSeed: number): BoardState {
  const grid: Tile[][] = [];
  for (let row = 0; row < config.rows; row++) {
    grid[row] = [];
    for (let col = 0; col < config.cols; col++) {
      grid[row][col] = { type: 0, snow: 0 };
    }
  }

  // Apply snow from config
  for (const snowCell of config.snow) {
    if (inBounds(config, { row: snowCell.row, col: snowCell.col })) {
      grid[snowCell.row][snowCell.col].snow = snowCell.layers;
    }
  }

  return {
    grid,
    movesLeft: config.maxMoves,
    score: 0,
    rngSeed
  };
}
