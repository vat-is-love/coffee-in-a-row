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
  inBounds
} from './types';

/** Find match lines in row order, then in column order. */
export function findMatches(config: GameConfig, state: BoardState): Match[] {
  const matches: Match[] = [];

  for (const direction of [Direction.Horizontal, Direction.Vertical]) {
    const horizontal = direction === Direction.Horizontal;
    const lineCount = horizontal ? config.rows : config.cols;
    const lineLength = horizontal ? config.cols : config.rows;
    if (lineLength < 3) continue;

    for (let line = 0; line < lineCount; line++) {
      let start = 0;
      let type = horizontal ? state.grid[line][0].type : state.grid[0][line].type;
      for (let i = 1; i <= lineLength; i++) {
        const next = i === lineLength ? -1
          : horizontal ? state.grid[line][i].type : state.grid[i][line].type;
        if (next !== -1 && next === type) continue;
        if (i - start >= 3) {
          const tiles: Position[] = [];
          for (let cell = start; cell < i; cell++) {
            tiles.push(horizontal ? { row: line, col: cell } : { row: cell, col: line });
          }
          matches.push({ tiles, direction });
        }
        start = i;
        type = next;
      }
    }
  }

  return matches;
}

/** Only a line through one of the two swapped cells can validate the swap. */
export function wouldCreateMatch(config: GameConfig, state: BoardState, pos1: Position, pos2: Position): boolean {
  if (!inBounds(config, pos1) || !inBounds(config, pos2) || !areAdjacent(pos1, pos2)) return false;
  const first = state.grid[pos1.row][pos1.col].type;
  const second = state.grid[pos2.row][pos2.col].type;
  if (first === -1 || second === -1 || first === second) return false;

  return hasLineAt(pos1, pos2, second) || hasLineAt(pos2, pos1, first);

  function hasLineAt({ row, col }: Position, source: Position, type: number): boolean {
    return hasTriple(0, 1) || hasTriple(1, 0);

    function hasTriple(dr: number, dc: number): boolean {
      const before = matchesAt(row - dr, col - dc);
      const after = matchesAt(row + dr, col + dc);
      return (before && (after || matchesAt(row - 2 * dr, col - 2 * dc))) ||
        (after && matchesAt(row + 2 * dr, col + 2 * dc));
    }

    function matchesAt(r: number, c: number): boolean {
      // The source cell receives the other color and cannot extend this line.
      return r >= 0 && r < config.rows && c >= 0 && c < config.cols &&
        (r !== source.row || c !== source.col) && state.grid[r][c].type === type;
    }
  }
}

function* validMoves(config: GameConfig, state: BoardState): Generator<[Position, Position]> {
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const from = { row, col };
      const right = { row, col: col + 1 };
      const down = { row: row + 1, col };
      if (wouldCreateMatch(config, state, from, right)) yield [from, right];
      if (wouldCreateMatch(config, state, from, down)) yield [{ ...from }, down];
    }
  }
}

export function hasValidMoves(config: GameConfig, state: BoardState): boolean {
  return validMoves(config, state).next().done === false;
}

export function getAllValidMoves(config: GameConfig, state: BoardState): Array<[Position, Position]> {
  return Array.from(validMoves(config, state));
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
