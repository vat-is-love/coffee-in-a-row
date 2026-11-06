/**
 * Unit tests for board generation
 */

import { describe, it, expect } from 'vitest';
import { GameConfig, BoardState } from '../../../src/game/logic/types';
import { SeededRNG } from '../../../src/game/logic/rng';
import { findMatches, hasValidMoves } from '../../../src/game/logic/matches';
import { generateInitialBoard, generateBoardFromSeed } from '../../../src/game/logic/generate';

const TEST_CONFIG: GameConfig = {
  rows: 8,
  cols: 8,
  tileTypes: 5,
  maxMoves: 25,
  snow: []
};

describe('generateInitialBoard', () => {
  it('should generate board with no initial matches', () => {
    const rng = new SeededRNG(12345);
    const state = generateInitialBoard(TEST_CONFIG, rng);

    const matches = findMatches(TEST_CONFIG, state);
    expect(matches.length).toBe(0);
  });

  it('should generate board with at least one valid move', () => {
    const rng = new SeededRNG(12345);
    const state = generateInitialBoard(TEST_CONFIG, rng);

    expect(hasValidMoves(TEST_CONFIG, state)).toBe(true);
  });

  it('should be deterministic with same seed', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    const state1 = generateInitialBoard(TEST_CONFIG, rng1);
    const state2 = generateInitialBoard(TEST_CONFIG, rng2);

    // Compare grids
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        expect(state1.grid[row][col].type).toBe(state2.grid[row][col].type);
      }
    }
  });

  it('should produce different boards with different seeds', () => {
    const rng1 = new SeededRNG(111);
    const rng2 = new SeededRNG(222);

    const state1 = generateInitialBoard(TEST_CONFIG, rng1);
    const state2 = generateInitialBoard(TEST_CONFIG, rng2);

    let different = false;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (state1.grid[row][col].type !== state2.grid[row][col].type) {
          different = true;
        }
      }
    }
    expect(different).toBe(true);
  });

  it('should fill all cells with valid tile types', () => {
    const rng = new SeededRNG(999);
    const state = generateInitialBoard(TEST_CONFIG, rng);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const tile = state.grid[row][col];
        expect(tile.type).toBeGreaterThanOrEqual(0);
        expect(tile.type).toBeLessThan(5);
        expect(tile.snow).toBe(0);
      }
    }
  });

  it('should remain playable when random attempts are disabled', () => {
    const config = { ...TEST_CONFIG, rows: 4, cols: 4, tileTypes: 3 };
    const state = generateInitialBoard(config, new SeededRNG(1), 0);
    expect(findMatches(config, state)).toEqual([]);
    expect(hasValidMoves(config, state)).toBe(true);
  });

});

describe('generateBoardFromSeed', () => {
  it('should generate reproducible board from seed', () => {
    const state1 = generateBoardFromSeed(TEST_CONFIG, 12345);
    const state2 = generateBoardFromSeed(TEST_CONFIG, 12345);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        expect(state1.grid[row][col].type).toBe(state2.grid[row][col].type);
      }
    }
  });

  it('should produce valid playable board', () => {
    const state = generateBoardFromSeed(TEST_CONFIG, 42);

    const matches = findMatches(TEST_CONFIG, state);
    expect(matches.length).toBe(0);
    expect(hasValidMoves(TEST_CONFIG, state)).toBe(true);
  });
});