/**
 * Board reshuffle: when no valid moves remain.
 * Preserves snow, shuffles tiles, ensures playable board.
 */

import {
  GameConfig,
  BoardState,
  Tile,
  cloneBoardState
} from './types';
import { SeededRNG } from './rng';
import { findMatches, hasValidMoves } from './matches';
import { generateInitialBoard, validateAttempts, validateGenerationConfig } from './generate';

/**
 * Collect all non-empty tile types from the board.
 */
export function collectTileTypes(config: GameConfig, state: BoardState): Tile['type'][] {
  const types: Tile['type'][] = [];
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const tile = state.grid[row][col];
      if (tile.type !== -1) {
        types.push(tile.type);
      }
    }
  }
  return types;
}

/**
 * Shuffle array in place using Fisher-Yates algorithm.
 */
export function shuffleArray<T>(array: T[], rng: SeededRNG): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Reshuffle the board:
 * - Preserves snow layers in each cell
 * - Randomly redistributes tile types
 * - Ensures no matches and at least one valid move
 */
export function reshuffleBoard(config: GameConfig, state: BoardState, rng: SeededRNG, maxAttempts = 10): BoardState {
  validateGenerationConfig(config);
  validateAttempts(maxAttempts);
  const newState = cloneBoardState(state);

  // Collect existing tile types (excluding empty)
  const tileTypes = collectTileTypes(config, newState);

  let attempts = 0;
  while (attempts < maxAttempts && tileTypes.length === config.rows * config.cols) {
    // Shuffle tile types
    shuffleArray(tileTypes, rng);

    // Redistribute shuffled types back to non-empty cells
    let idx = 0;
    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.cols; col++) {
        if (newState.grid[row][col].type !== -1) {
          newState.grid[row][col].type = tileTypes[idx++];
          // Preserve snow!
        }
      }
    }

    // Verify: no matches AND has valid moves
    const matches = findMatches(config, newState);
    const validMoves = hasValidMoves(config, newState);

    if (matches.length === 0 && validMoves) {
      newState.rngSeed = rng.getSeed();
      return newState;
    }

    attempts++;
  }

  // A fixed multiset may have no playable arrangement. Regenerate tile colors
  // rather than returning an invalid board; retain all cell snow and counters.
  const replacement = generateInitialBoard(config, rng, 0);
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      newState.grid[row][col].type = replacement.grid[row][col].type;
    }
  }
  newState.rngSeed = rng.getSeed();
  return newState;
}

/**
 * Check if reshuffle is needed (no valid moves).
 */
export function needsReshuffle(config: GameConfig, state: BoardState): boolean {
  return !hasValidMoves(config, state);
}
