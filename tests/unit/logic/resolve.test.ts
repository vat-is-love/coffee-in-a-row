/**
 * Unit tests for match resolution and scoring
 */

import { describe, it, expect } from 'vitest';
import { GameConfig, BoardState, Tile, Position } from '../../../src/game/logic/types';
import { SeededRNG } from '../../../src/game/logic/rng';
import { findMatches } from '../../../src/game/logic/matches';
import { applyGravity, refillBoard, clearMatches, calculateScoreDelta, resolveAllMatches, resolveStep, isSnowCleared } from '../../../src/game/logic/resolve';
import { createEmptyBoardState } from '../../../src/game/logic/types';

const TEST_CONFIG: GameConfig = {
  rows: 8,
  cols: 8,
  tileTypes: 5,
  maxMoves: 25,
  snow: []
};

function createTile(type: Tile['type'], snow: Tile['snow'] = 0): Tile {
  return { type, snow };
}

function createTestState(grid: Tile[][]): BoardState {
  return {
    grid,
    movesLeft: 25,
    score: 0,
    rngSeed: 12345
  };
}

function createEmptyGrid(): Tile[][] {
  return Array(8).fill(null).map(() => Array(8).fill(null).map(() => createTile(-1 as Tile['type'])));
}

describe('applyGravity', () => {
  it('should make tiles fall down', () => {
    const grid = createEmptyGrid();
    // Place tiles at top
    grid[0][0] = createTile(1);
    grid[1][0] = createTile(2);
    grid[2][0] = createTile(3);

    const state = createTestState(grid);
    applyGravity(TEST_CONFIG, state);

    // Tiles should be at bottom
    expect(state.grid[7][0].type).toBe(3);
    expect(state.grid[6][0].type).toBe(2);
    expect(state.grid[5][0].type).toBe(1);
    expect(state.grid[4][0].type).toBe(-1);
  });

  it('should preserve snow layers during gravity', () => {
    const grid = createEmptyGrid();
    grid[0][0] = createTile(1, 1); // cell with snow layer 1
    grid[1][0] = createTile(2, 2); // cell with snow layer 2

    const state = createTestState(grid);
    applyGravity(TEST_CONFIG, state);

    expect(state.grid[0][0].snow).toBe(1);
    expect(state.grid[1][0].snow).toBe(2);
    expect(state.grid[7][0].snow).toBe(0);
    expect(state.grid[6][0].snow).toBe(0);
  });
});

describe('refillBoard', () => {
  it('should fill empty cells with random tiles', () => {
    const grid = createEmptyGrid();
    const state = createTestState(grid);
    const rng = new SeededRNG(42);

    refillBoard(TEST_CONFIG, state, rng);

    // All cells should be filled
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        expect(state.grid[row][col].type).not.toBe(-1);
        expect(state.grid[row][col].type).toBeLessThan(5);
        expect(state.grid[row][col].snow).toBe(0); // New tiles have no snow
      }
    }
  });
});

describe('clearMatches', () => {
  it('should clear matched tiles and count them', () => {
    const grid = createEmptyGrid();
    // Match of 3 at row 0
    grid[0][0] = createTile(1);
    grid[0][1] = createTile(1);
    grid[0][2] = createTile(1);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    const result = clearMatches(state, matches);

    expect(result.tilesCleared).toBe(3);
    expect(result.snowCleared).toBe(0);
    expect(state.grid[0][0].type).toBe(-1);
    expect(state.grid[0][1].type).toBe(-1);
    expect(state.grid[0][2].type).toBe(-1);
  });

  it('should count snow layers cleared', () => {
    const grid = createEmptyGrid();
    grid[0][0] = createTile(1, 1);
    grid[0][1] = createTile(1, 2);
    grid[0][2] = createTile(1, 0);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    const result = clearMatches(state, matches);

    expect(result.tilesCleared).toBe(3);
    expect(result.snowCleared).toBe(2); // One layer per matched snowy cell
    expect(state.grid[0][0].snow).toBe(0);
    expect(state.grid[0][1].snow).toBe(1);
  });

  it('should not double-count intersecting tiles', () => {
    const grid = createEmptyGrid();
    // T-shape intersection at (2,2)
    grid[2][1] = createTile(1);
    grid[2][2] = createTile(1); // intersection
    grid[2][3] = createTile(1);
    grid[1][2] = createTile(1);
    grid[3][2] = createTile(1);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);

    const result = clearMatches(state, matches);

    expect(result.tilesCleared).toBe(5); // 5 unique tiles
  });
});

describe('calculateScoreDelta', () => {
  it('should keep snow bonuses outside the tile cascade multiplier', () => {
    expect(calculateScoreDelta(3, 2, [3], 3)).toBe(1200);
  });
  it('should calculate base tile score', () => {
    const score = calculateScoreDelta(3, 0, [3], 1);
    expect(score).toBe(300); // 3 * 100
  });

  it('should add bonus for 4+ matches', () => {
    // Match of 4: 4 tiles, 1 extra beyond 3
    const score = calculateScoreDelta(4, 0, [4], 1);
    expect(score).toBe(450); // 4*100 + 1*50
  });

  it('should add bonus for match of 5', () => {
    // Match of 5: 5 tiles, 2 extra beyond 3
    const score = calculateScoreDelta(5, 0, [5], 1);
    expect(score).toBe(600); // 5*100 + 2*50
  });

  it('should add snow layer points', () => {
    const score = calculateScoreDelta(3, 2, [3], 1);
    expect(score).toBe(600); // 3*100 + 2*150
  });

  it('should apply cascade multiplier', () => {
    const score = calculateScoreDelta(3, 0, [3], 2); // cascade depth 2
    expect(score).toBe(600); // 300 * 2
  });

  it('should cap cascade multiplier at 3', () => {
    const score = calculateScoreDelta(3, 0, [3], 5); // cascade depth 5
    expect(score).toBe(900); // 300 * 3 (capped)
  });

  it('should handle multiple matches with different lengths', () => {
    // Two matches: one of 3, one of 4
    const score = calculateScoreDelta(7, 0, [3, 4], 1);
    expect(score).toBe(750); // 7*100 + 1*50 (only the 4-match gets bonus)
  });
});

describe('resolveStep', () => {
  it('should clear, apply gravity, and refill', () => {
    const grid = createEmptyGrid();
    // Match at top row
    grid[0][0] = createTile(1);
    grid[0][1] = createTile(1);
    grid[0][2] = createTile(1);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);
    const rng = new SeededRNG(123);

    const result = resolveStep(TEST_CONFIG, state, matches, 1, rng);

    expect(result.tilesCleared).toBe(3);
    expect(result.scoreDelta).toBe(300);
    // After gravity + refill, board should be full
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        expect(state.grid[row][col].type).not.toBe(-1);
      }
    }
  });
});

describe('resolveAllMatches', () => {
  it('should handle cascade chain', () => {
    const grid = createEmptyGrid();
    // Create a setup that will cascade:
    // Row 7 (bottom): [1,1,1] - will clear
    // Row 6: [2,2,2] - will fall and clear
    grid[7][0] = createTile(1);
    grid[7][1] = createTile(1);
    grid[7][2] = createTile(1);
    grid[6][0] = createTile(2);
    grid[6][1] = createTile(2);
    grid[6][2] = createTile(2);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);
    const rng = new SeededRNG(999);

    const result = resolveAllMatches(TEST_CONFIG, state, matches, rng);

    expect(result.cascades).toBeGreaterThanOrEqual(1);
    expect(result.tilesCleared).toBeGreaterThanOrEqual(3);
  });

  it('should terminate when no more matches', () => {
    const grid = createEmptyGrid();
    // Create a match at bottom row to avoid new tiles falling into match positions
    grid[7][0] = createTile(1);
    grid[7][1] = createTile(1);
    grid[7][2] = createTile(1);

    const state = createTestState(grid);
    const matches = findMatches(TEST_CONFIG, state);
    // Use a seed that doesn't produce cascades after refill
    const rng = new SeededRNG(12345);

    const result = resolveAllMatches(TEST_CONFIG, state, matches, rng);

    // Single match, possibly no cascade (depends on refill randomness)
    expect(result.cascades).toBeGreaterThanOrEqual(1);
    expect(result.matches).toEqual(matches);
  });
});

describe('isSnowCleared', () => {
  it('should return true when all snow is gone', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    expect(isSnowCleared(TEST_CONFIG, state)).toBe(true);
  });

  it('should return false when snow remains', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    state.grid[3][3].snow = 1;
    expect(isSnowCleared(TEST_CONFIG, state)).toBe(false);
  });

  it('should handle double-layer snow', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    state.grid[3][3].snow = 2;
    expect(isSnowCleared(TEST_CONFIG, state)).toBe(false);
  });
});
