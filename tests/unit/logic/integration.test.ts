/**
 * Integration tests for the full game logic flow
 */

import { describe, it, expect } from 'vitest';
import { GameConfig, BoardState, Position } from '../../../src/game/logic/types';
import { SeededRNG } from '../../../src/game/logic/rng';
import { findMatches, hasValidMoves } from '../../../src/game/logic/matches';
import { resolveAllMatches, isSnowCleared } from '../../../src/game/logic/resolve';
import { generateInitialBoard } from '../../../src/game/logic/generate';
import { reshuffleBoard } from '../../../src/game/logic/reshuffle';
import {
  simulateMove,
  initializeGame,
  getSnowRemaining,
  serializeState,
  deserializeState
} from '../../../src/game/logic/index';
import { LEVEL_1_CONFIG } from '../fixtures/match3';

describe('simulateMove', () => {
  it('should return invalid for non-adjacent swap', () => {
    const state = initializeGame(LEVEL_1_CONFIG, 12345);
    const result = simulateMove(LEVEL_1_CONFIG, state, { row: 0, col: 0 }, { row: 0, col: 3 });

    expect(result.valid).toBe(false);
    expect(result.gameOver).toBe('none');
    // State should be unchanged
    expect(result.boardState.movesLeft).toBe(state.movesLeft);
  });

  it('should return invalid for swap not creating match', () => {
    const state = initializeGame(LEVEL_1_CONFIG, 12345);

    // Find a swap that doesn't create a match
    let found = false;
    for (let row = 0; row < 8 && !found; row++) {
      for (let col = 0; col < 7 && !found; col++) {
        const result = simulateMove(LEVEL_1_CONFIG, state, { row, col }, { row, col: col + 1 });
        if (!result.valid) {
          found = true;
          expect(result.valid).toBe(false);
          expect(result.boardState.movesLeft).toBe(state.movesLeft);
        }
      }
    }
    // At least one invalid move should exist
    expect(found).toBe(true);
  });

  it('should execute valid move and consume a move', () => {
    const state = initializeGame(LEVEL_1_CONFIG, 12345);

    // Find a valid move
    let validMove: [Position, Position] | null = null;
    for (let row = 0; row < 8 && !validMove; row++) {
      for (let col = 0; col < 7 && !validMove; col++) {
        const result = simulateMove(LEVEL_1_CONFIG, state, { row, col }, { row, col: col + 1 });
        if (result.valid) {
          validMove = [{ row, col }, { row, col: col + 1 }];
        }
      }
    }

    expect(validMove).not.toBeNull();

    const result = simulateMove(LEVEL_1_CONFIG, state, validMove![0], validMove![1]);

    expect(result.valid).toBe(true);
    expect(result.boardState.movesLeft).toBe(state.movesLeft - 1);
    expect(result.scoreDelta).toBeGreaterThan(0);
  });

  it('should handle cascades correctly', () => {
    // Create a board state that will cascade
    const config: GameConfig = { ...LEVEL_1_CONFIG, snow: [] };
    const state = createCascadeState(config);

    // Find a move that triggers cascade
    const moves = findValidMoves(config, state);
    expect(moves.length).toBeGreaterThan(0);

    const result = simulateMove(config, state, moves[0][0], moves[0][1]);

    expect(result.valid).toBe(true);
    expect(result.cascades).toBeGreaterThanOrEqual(1);
  });

  it('should prioritize victory when the last move clears the final snow layer', () => {
    const config: GameConfig = {
      rows: 3, cols: 3, tileTypes: 3, maxMoves: 1,
      snow: [{ row: 0, col: 0, layers: 1 }]
    };
    const state = initializeGame(config, 12345);
    const colors = [[0, 1, 0], [2, 0, 2], [1, 2, 1]];
    state.grid.forEach((row, r) => row.forEach((tile, c) => { tile.type = colors[r][c] as 0 | 1 | 2; }));
    const result = simulateMove(config, state, { row: 0, col: 1 }, { row: 1, col: 1 });
    expect(result.valid).toBe(true);
    expect(result.snowCleared).toBe(1);
    expect(result.boardState.movesLeft).toBe(0);
    expect(result.gameOver).toBe('victory');
  });

  it('should detect defeat when moves exhausted and snow remains', () => {
    const config: GameConfig = {
      ...LEVEL_1_CONFIG, maxMoves: 1,
      snow: Array.from({ length: 64 }, (_, i) => ({ row: Math.floor(i / 8), col: i % 8, layers: 2 }))
    };
    const state = initializeGame(config, 12345);
    const moves = findValidMoves(config, state);
    expect(moves.length).toBeGreaterThan(0);
    const result = simulateMove(config, state, moves[0][0], moves[0][1]);
    expect(result.valid).toBe(true);
    expect(result.boardState.movesLeft).toBe(0);
    expect(result.gameOver).toBe('defeat');
  });

  it('should trigger reshuffle when no valid moves remain', () => {
    const config: GameConfig = { ...LEVEL_1_CONFIG, snow: [] };
    const state = createNoMovesState(config);

    expect(hasValidMoves(config, state)).toBe(false);

    // Make any move (will be invalid, but let's test reshuffle directly)
    const rng = new SeededRNG(state.rngSeed);
    const reshuffled = reshuffleBoard(config, state, rng);

    expect(hasValidMoves(config, reshuffled)).toBe(true);
  });
});

describe('initializeGame', () => {
  it('should create valid initial game state', () => {
    const state = initializeGame(LEVEL_1_CONFIG, 12345);

    expect(state.movesLeft).toBe(LEVEL_1_CONFIG.maxMoves);
    expect(state.score).toBe(0);
    const rng = new SeededRNG(12345);
    generateInitialBoard(LEVEL_1_CONFIG, rng);
    expect(state.rngSeed).toBe(rng.getSeed());
    expect(state.grid.length).toBe(8);
    expect(state.grid[0].length).toBe(8);

    // No initial matches
    const matches = findMatches(LEVEL_1_CONFIG, state);
    expect(matches.length).toBe(0);

    // Has valid moves
    expect(hasValidMoves(LEVEL_1_CONFIG, state)).toBe(true);
  });

  it('should be deterministic with same seed', () => {
    const state1 = initializeGame(LEVEL_1_CONFIG, 42);
    const state2 = initializeGame(LEVEL_1_CONFIG, 42);

    expect(JSON.stringify(state1)).toBe(JSON.stringify(state2));
  });
});

describe('getSnowRemaining', () => {
  it('should count total snow layers', () => {
    const state = initializeGame(LEVEL_1_CONFIG, 12345);
    const snow = getSnowRemaining(LEVEL_1_CONFIG, state);

    // Level 1 has 6 single-layer snow cells = 6
    expect(snow).toBe(6);
  });

  it('should handle double-layer snow', () => {
    const config: GameConfig = {
      ...LEVEL_1_CONFIG,
      snow: [{ row: 0, col: 0, layers: 2 }, { row: 1, col: 1, layers: 1 }]
    };
    const state = initializeGame(config, 12345);
    const snow = getSnowRemaining(config, state);

    expect(snow).toBe(3);
  });
});

describe('serialize/deserialize', () => {
  it('should round-trip state correctly', () => {
    const state = initializeGame(LEVEL_1_CONFIG, 12345);
    const serialized = serializeState(state);
    const deserialized = deserializeState(serialized);

    expect(deserialized.movesLeft).toBe(state.movesLeft);
    expect(deserialized.score).toBe(state.score);
    expect(deserialized.rngSeed).toBe(state.rngSeed);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        expect(deserialized.grid[row][col].type).toBe(state.grid[row][col].type);
        expect(deserialized.grid[row][col].snow).toBe(state.grid[row][col].snow);
      }
    }
  });
});

// Helper functions for tests

function createCascadeState(config: GameConfig): BoardState {
  const state = initializeGame(config, 999);
  // Set up a cascade: bottom row matches, above row will fall and match
  for (let col = 0; col < 3; col++) {
    state.grid[7][col] = { type: 1, snow: 0 }; // bottom row - match of 3
    state.grid[6][col] = { type: 2, snow: 0 }; // row above - will fall and match
    state.grid[5][col] = { type: 2, snow: 0 };
    state.grid[4][col] = { type: 2, snow: 0 };
  }
  return state;
}

function createNoMovesState(config: GameConfig): BoardState {
  const state = initializeGame(config, 888);
  // Create a checkerboard-like pattern with no valid moves
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      state.grid[row][col] = { type: (row * 2 + col) % 5, snow: 0 };
    }
  }
  return state;
}

function findValidMoves(config: GameConfig, state: BoardState): Array<[Position, Position]> {
  const moves: Array<[Position, Position]> = [];
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols - 1; col++) {
      const pos1: Position = { row, col };
      const pos2: Position = { row, col: col + 1 };
      const result = simulateMove(config, state, pos1, pos2);
      if (result.valid) moves.push([pos1, pos2]);
    }
  }
  return moves;
}
