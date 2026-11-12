/**
 * Unit tests for match detection
 */

import { describe, it, expect } from 'vitest';
import { GameConfig, BoardState, Tile, Position, Direction } from '../../../src/game/logic/types';
import { SeededRNG } from '../../../src/game/logic/rng';
import { findMatches, wouldCreateMatch, hasValidMoves, getAllValidMoves, countUniqueMatchedTiles } from '../../../src/game/logic/matches';
import { generateInitialBoard } from '../../../src/game/logic/generate';

const TEST_CONFIG: GameConfig = {
  rows: 8,
  cols: 8,
  tileTypes: 5,
  maxMoves: 25,
  snow: []
};

function createTestState(grid: Tile[][]): BoardState {
  return {
    grid,
    movesLeft: 25,
    score: 0,
    rngSeed: 12345
  };
}

function createTile(type: Tile['type'], snow: Tile['snow'] = 0): Tile {
  return { type, snow };
}

function createEmptyGrid(): Tile[][] {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => createTile(-1)));
}

describe('findMatches', () => {
  it('should detect horizontal match of 3', () => {
    const grid = createEmptyGrid();
    // Row 0: three 1s at cols 0,1,2
    grid[0][0] = createTile(1);
    grid[0][1] = createTile(1);
    grid[0][2] = createTile(1);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    expect(matches.length).toBe(1);
    expect(matches[0].direction).toBe(Direction.Horizontal);
    expect(matches[0].tiles.length).toBe(3);
    expect(matches[0].tiles).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 }
    ]);
  });

  it('should detect horizontal match of 4', () => {
    const grid = createEmptyGrid();
    grid[0][0] = createTile(2);
    grid[0][1] = createTile(2);
    grid[0][2] = createTile(2);
    grid[0][3] = createTile(2);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    expect(matches.length).toBe(1);
    expect(matches[0].tiles.length).toBe(4);
  });

  it('should detect horizontal match of 5', () => {
    const grid = createEmptyGrid();
    for (let c = 0; c < 5; c++) grid[0][c] = createTile(3);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    expect(matches.length).toBe(1);
    expect(matches[0].tiles.length).toBe(5);
  });

  it('should detect vertical match of 3', () => {
    const grid = createEmptyGrid();
    grid[0][0] = createTile(1);
    grid[1][0] = createTile(1);
    grid[2][0] = createTile(1);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    expect(matches.length).toBe(1);
    expect(matches[0].direction).toBe(Direction.Vertical);
    expect(matches[0].tiles.length).toBe(3);
  });

  it('should detect multiple separate matches', () => {
    const grid = createEmptyGrid();
    // Horizontal match at row 0
    grid[0][0] = createTile(1);
    grid[0][1] = createTile(1);
    grid[0][2] = createTile(1);
    // Vertical match at col 5
    grid[0][5] = createTile(2);
    grid[1][5] = createTile(2);
    grid[2][5] = createTile(2);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    expect(matches.length).toBe(2);
  });

  it('should handle T-shaped intersection (count tiles once)', () => {
    const grid = createEmptyGrid();
    // T-shape: horizontal row 2, cols 1-3; vertical col 2, rows 1-3
    grid[2][1] = createTile(1);
    grid[2][2] = createTile(1); // intersection
    grid[2][3] = createTile(1);
    grid[1][2] = createTile(1);
    grid[3][2] = createTile(1);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    // Should find 2 matches (horizontal + vertical)
    expect(matches.length).toBe(2);

    // But unique tiles should be 5 (not 6)
    const uniqueCount = countUniqueMatchedTiles(matches);
    expect(uniqueCount).toBe(5);
  });

  it('should handle L-shaped intersection', () => {
    const grid = createEmptyGrid();
    // L-shape: horizontal row 0, cols 0-2; vertical col 0, rows 0-2
    grid[0][0] = createTile(1); // corner
    grid[0][1] = createTile(1);
    grid[0][2] = createTile(1);
    grid[1][0] = createTile(1);
    grid[2][0] = createTile(1);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    expect(matches.length).toBe(2);
    const uniqueCount = countUniqueMatchedTiles(matches);
    expect(uniqueCount).toBe(5);
  });

  it('should not detect diagonal matches', () => {
    const grid = createEmptyGrid();
    // Diagonal line
    grid[0][0] = createTile(1);
    grid[1][1] = createTile(1);
    grid[2][2] = createTile(1);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    expect(matches.length).toBe(0);
  });

  it('should not match tiles with type -1 (empty)', () => {
    const grid = createEmptyGrid();
    grid[0][0] = createTile(-1);
    grid[0][1] = createTile(-1);
    grid[0][2] = createTile(-1);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    expect(matches.length).toBe(0);
  });
});

describe('wouldCreateMatch', () => {
  it('should return true for valid swap creating match', () => {
    const grid = createEmptyGrid();
    // Row 0: [1, 0, 1, 1] - swap col 1 with col 0 creates match
    grid[0][0] = createTile(1);
    grid[0][1] = createTile(2);
    grid[0][2] = createTile(1);
    grid[0][3] = createTile(1);

    const state = createTestState(grid);
    const result = wouldCreateMatch(TEST_CONFIG, state, { row: 0, col: 0 }, { row: 0, col: 1 });

    expect(result).toBe(true);
  });

  it('should return false for swap not creating match', () => {
    const grid = createEmptyGrid();
    grid[0][0] = createTile(1);
    grid[0][1] = createTile(2);
    grid[0][2] = createTile(3);
    grid[0][3] = createTile(4);

    const state = createTestState(grid);
    const result = wouldCreateMatch(TEST_CONFIG, state, { row: 0, col: 0 }, { row: 0, col: 1 });

    expect(result).toBe(false);
  });

  it('ignores the source color after swapping and any unrelated match', () => {
    const grid = createEmptyGrid();
    grid[0][0] = createTile(1);
    grid[0][1] = createTile(2);
    grid[0][2] = createTile(1);
    grid[7] = Array.from({ length: 8 }, () => createTile(4));
    const state = createTestState(grid);

    expect(wouldCreateMatch(TEST_CONFIG, state, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(false);
    expect(grid[0].slice(0, 3).map(tile => tile.type)).toEqual([1, 2, 1]);
  });

  it('should return false for non-adjacent positions', () => {
    const grid = createEmptyGrid();
    grid[0][0] = createTile(1);
    grid[0][3] = createTile(1);

    const state = createTestState(grid);
    const result = wouldCreateMatch(TEST_CONFIG, state, { row: 0, col: 0 }, { row: 0, col: 3 });

    expect(result).toBe(false);
  });
});

describe('hasValidMoves', () => {
  it('should return true when valid moves exist', () => {
    const grid = createEmptyGrid();
    grid[0][0] = createTile(1);
    grid[0][1] = createTile(2);
    grid[0][2] = createTile(1);
    grid[0][3] = createTile(1);

    const state = createTestState(grid);
    expect(hasValidMoves(TEST_CONFIG, state)).toBe(true);
  });

  it('should return false when no valid moves', () => {
    const grid = createEmptyGrid();
    // Checkerboard pattern - no matches possible
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        grid[row][col] = createTile(((row + col) % 5) as Tile['type']);
      }
    }

    const state = createTestState(grid);
    expect(hasValidMoves(TEST_CONFIG, state)).toBe(false);
  });
});

describe('getAllValidMoves', () => {
  it('should return all valid move pairs', () => {
    const grid = createEmptyGrid();
    // Two possible swaps creating matches
    grid[0][0] = createTile(1);
    grid[0][1] = createTile(2);
    grid[0][2] = createTile(1);
    grid[0][3] = createTile(1);
    grid[1][0] = createTile(3);
    grid[1][1] = createTile(3);
    grid[1][2] = createTile(4);
    grid[1][3] = createTile(3);

    const state = createTestState(grid);
    const moves = getAllValidMoves(TEST_CONFIG, state);

    expect(moves).toEqual([
      [{ row: 0, col: 0 }, { row: 0, col: 1 }],
      [{ row: 1, col: 2 }, { row: 1, col: 3 }]
    ]);
  });
});
