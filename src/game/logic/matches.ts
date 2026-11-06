/**
 * Match detection logic for Match-3.
 * Finds all horizontal and vertical matches of 3+ identical tiles.
 */

import {
  GameConfig,
  BoardState,
  Position,
  Match,
  Direction,
  areAdjacent,
  cloneBoardState,
  inBounds
} from './types';

/**
 * Find all matches on the board.
 * Returns matches with unique tiles (intersections counted once per tile).
 */
export function findMatches(config: GameConfig, state: BoardState): Match[] {
  const matches: Match[] = [];

  // Horizontal matches
  for (let row = 0; row < config.rows; row++) {
    let matchStart = 0;
    for (let col = 1; col <= config.cols; col++) {
      const currentTile = state.grid[row][col];
      const startTile = state.grid[row][matchStart];

      if (col < config.cols &&
          currentTile.type === startTile.type &&
          currentTile.type !== -1) {
        continue;
      }

      const matchLength = col - matchStart;
      if (matchLength >= 3) {
        const tiles: Position[] = [];
        for (let c = matchStart; c < col; c++) {
          tiles.push({ row, col: c });
        }
        matches.push({ tiles, direction: Direction.Horizontal });
      }
      matchStart = col;
    }
  }

  // Vertical matches
  for (let col = 0; col < config.cols; col++) {
    let matchStart = 0;
    for (let row = 1; row <= config.rows; row++) {
      // Check bounds before accessing grid
      const currentTile = row < config.rows ? state.grid[row][col] : { type: -1, snow: 0 };
      const startTile = state.grid[matchStart][col];

      if (row < config.rows &&
          currentTile.type === startTile.type &&
          currentTile.type !== -1) {
        continue;
      }

      const matchLength = row - matchStart;
      if (matchLength >= 3) {
        const tiles: Position[] = [];
        for (let r = matchStart; r < row; r++) {
          tiles.push({ row: r, col });
        }
        matches.push({ tiles, direction: Direction.Vertical });
      }
      matchStart = row;
    }
  }

  return matches;
}

/**
 * Check if a swap between two adjacent positions would create at least one match.
 * Does not mutate the board state.
 */
export function wouldCreateMatch(config: GameConfig, state: BoardState, pos1: Position, pos2: Position): boolean {
  if (!inBounds(config, pos1) || !inBounds(config, pos2) || !areAdjacent(pos1, pos2)) {
    return false;
  }
  const first = state.grid[pos1.row][pos1.col].type;
  const second = state.grid[pos2.row][pos2.col].type;
  if (first === -1 || second === -1 || first === second) return false;

  // Clone state to test swap
  const testState = cloneBoardState(state);

  // Perform swap
  const tile1 = testState.grid[pos1.row][pos1.col];
  const tile2 = testState.grid[pos2.row][pos2.col];
  [tile1.type, tile2.type] = [tile2.type, tile1.type];

  // Check for matches
  const matches = findMatches(config, testState);
  return matches.some(match => match.tiles.some(pos =>
    (pos.row === pos1.row && pos.col === pos1.col) ||
    (pos.row === pos2.row && pos.col === pos2.col)
  ));
}

/**
 * Check if the board has at least one valid move.
 */
export function hasValidMoves(config: GameConfig, state: BoardState): boolean {
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      // Check right
      if (col + 1 < config.cols) {
        if (wouldCreateMatch(config, state, { row, col }, { row, col: col + 1 })) {
          return true;
        }
      }
      // Check down
      if (row + 1 < config.rows) {
        if (wouldCreateMatch(config, state, { row, col }, { row: row + 1, col })) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Get all valid moves on the board as pairs of positions.
 */
export function getAllValidMoves(config: GameConfig, state: BoardState): Array<[Position, Position]> {
  const moves: Array<[Position, Position]> = [];

  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      // Check right
      if (col + 1 < config.cols) {
        const pos1: Position = { row, col };
        const pos2: Position = { row, col: col + 1 };
        if (wouldCreateMatch(config, state, pos1, pos2)) {
          moves.push([pos1, pos2]);
        }
      }
      // Check down
      if (row + 1 < config.rows) {
        const pos1: Position = { row, col };
        const pos2: Position = { row: row + 1, col };
        if (wouldCreateMatch(config, state, pos1, pos2)) {
          moves.push([pos1, pos2]);
        }
      }
    }
  }

  return moves;
}

/**
 * Count unique tiles involved in matches (for scoring).
 * Intersections (tiles in both horizontal and vertical match) counted once.
 */
export function countUniqueMatchedTiles(matches: Match[]): number {
  const uniquePositions = new Set<string>();
  for (const match of matches) {
    for (const pos of match.tiles) {
      uniquePositions.add(`${pos.row},${pos.col}`);
    }
  }
  return uniquePositions.size;
}

/**
 * Count tiles per match line (for bonus scoring on 4+ matches).
 * Returns array of match lengths.
 */
export function getMatchLengths(matches: Match[]): number[] {
  return matches.map(m => m.tiles.length);
}
