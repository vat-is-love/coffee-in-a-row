/**
 * Unit tests for board reshuffle
 */

import { describe, it, expect } from 'vitest';
import { GameConfig, BoardState } from '../../../src/game/logic/types';
import { SeededRNG } from '../../../src/game/logic/rng';
import { findMatches, hasValidMoves } from '../../../src/game/logic/matches';
import { reshuffleBoard, needsReshuffle, collectTileTypes } from '../../../src/game/logic/reshuffle';
import { createEmptyBoardState } from '../../../src/game/logic/types';

const TEST_CONFIG: GameConfig = {
  rows: 8,
  cols: 8,
  tileTypes: 5,
  maxMoves: 25,
  snow: []
};

describe('collectTileTypes', () => {
  it('should collect all non-empty tile types', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    // Set all to empty first
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        state.grid[row][col] = { type: -1 as any, snow: 0 };
      }
    }
    state.grid[0][0] = { type: 1, snow: 0 };
    state.grid[0][1] = { type: 2, snow: 0 };
    state.grid[1][0] = { type: 1, snow: 0 };

    const types = collectTileTypes(TEST_CONFIG, state);
    expect(types).toEqual([1, 2, 1]);
  });

  it('should not include empty tiles (-1)', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    // Set all to empty first
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        state.grid[row][col] = { type: -1 as any, snow: 0 };
      }
    }
    state.grid[0][0] = { type: -1 as any, snow: 0 };
    state.grid[0][1] = { type: 1, snow: 0 };

    const types = collectTileTypes(TEST_CONFIG, state);
    expect(types).toEqual([1]);
  });
});

describe('reshuffleBoard', () => {
  it('should preserve snow layers', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    // Fill with tiles
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        state.grid[row][col] = { type: (row + col) % 5, snow: 0 };
      }
    }
    // Add some snow
    state.grid[3][3].snow = 1;
    state.grid[4][4].snow = 2;

    const rng = new SeededRNG(42);
    const newState = reshuffleBoard(TEST_CONFIG, state, rng);

    // Snow should be preserved
    expect(newState.grid[3][3].snow).toBe(1);
    expect(newState.grid[4][4].snow).toBe(2);
  });

  it('should produce board with no matches', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        state.grid[row][col] = { type: (row + col) % 5, snow: 0 };
      }
    }

    const rng = new SeededRNG(42);
    const newState = reshuffleBoard(TEST_CONFIG, state, rng);

    const matches = findMatches(TEST_CONFIG, newState);
    expect(matches.length).toBe(0);
  });

  it('should produce board with at least one valid move', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        state.grid[row][col] = { type: (row + col) % 5, snow: 0 };
      }
    }

    const rng = new SeededRNG(42);
    const newState = reshuffleBoard(TEST_CONFIG, state, rng);

    expect(hasValidMoves(TEST_CONFIG, newState)).toBe(true);
  });

  it('should preserve total tile count', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    let originalCount = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        state.grid[row][col] = { type: (row + col) % 5, snow: 0 };
        originalCount++;
      }
    }

    const rng = new SeededRNG(42);
    const newState = reshuffleBoard(TEST_CONFIG, state, rng);

    let newCount = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (newState.grid[row][col].type !== -1) newCount++;
      }
    }

    expect(newCount).toBe(originalCount);
  });
});

describe('needsReshuffle', () => {
  it('should return true when no valid moves', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    // Checkerboard - no moves
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        state.grid[row][col] = { type: (row + col) % 5, snow: 0 };
      }
    }

    expect(needsReshuffle(TEST_CONFIG, state)).toBe(true);
  });

  it('should return false when valid moves exist', () => {
    const state = createEmptyBoardState(TEST_CONFIG, 12345);
    state.grid[0][0] = { type: 1, snow: 0 };
    state.grid[0][1] = { type: 2, snow: 0 };
    state.grid[0][2] = { type: 1, snow: 0 };
    state.grid[0][3] = { type: 1, snow: 0 };
    // Fill rest with pattern that allows moves
    for (let row = 1; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        state.grid[row][col] = { type: (row + col) % 5, snow: 0 };
      }
    }

    expect(needsReshuffle(TEST_CONFIG, state)).toBe(false);
  });
});