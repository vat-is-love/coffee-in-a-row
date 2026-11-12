/**
 * Match resolution engine: clear → gravity → refill → cascades.
 * Pure logic with deterministic scoring.
 */

import {
  GameConfig,
  BoardState,
  Tile,
  Match,
  ResolutionResult,
  ResolutionFrame,
  SCORING,
  cloneBoardState
} from './types';
import { getMatchLengths, findMatches } from './matches';
import { SeededRNG } from './rng';
import { reshuffleBoard } from './reshuffle';

export const MAX_CASCADES = 100;

/**
 * Apply gravity: tiles fall down in each column.
 * Empty cells (type === -1) are filled from above.
 */
export function applyGravity(config: GameConfig, state: BoardState): void {
  for (let col = 0; col < config.cols; col++) {
    let writeRow = config.rows - 1;

    // Move existing tiles down
    for (let row = config.rows - 1; row >= 0; row--) {
      const tile = state.grid[row][col];
      if (tile.type !== -1) {
        if (row !== writeRow) {
          state.grid[writeRow][col].type = tile.type;
          tile.type = -1;
        }
        writeRow--;
      }
    }
  }
}

/**
 * Refill empty cells at the top of each column with new random tiles.
 */
export function refillBoard(config: GameConfig, state: BoardState, rng: SeededRNG): void {
  for (let col = 0; col < config.cols; col++) {
    for (let row = 0; row < config.rows; row++) {
      if (state.grid[row][col].type === -1) {
        const newType = rng.nextInt(config.tileTypes) as Tile['type'];
        state.grid[row][col].type = newType;
      }
    }
  }
}

/**
 * Clear matched tiles from the board.
 * Returns number of tiles cleared and snow layers removed.
 */
export function clearMatches(state: BoardState, matches: Match[]): { tilesCleared: number; snowCleared: number } {
  let tilesCleared = 0;
  let snowCleared = 0;

  for (const match of matches) {
    for (const { row, col } of match.tiles) {
      const tile = state.grid[row][col];
      // Intersections are already empty when the second match reaches them.
      if (tile.type === -1) continue;
      tilesCleared++;
      if (tile.snow > 0) {
        snowCleared++;
        tile.snow--;
      }
      tile.type = -1;
    }
  }

  return { tilesCleared, snowCleared };
}

/**
 * Calculate score delta for a resolution step.
 */
export function calculateScoreDelta(
  tilesCleared: number,
  snowCleared: number,
  matchLengths: number[],
  cascadeDepth: number
): number {
  let score = tilesCleared * SCORING.TILE_BASE;

  // Bonus for matches of 4+ (per tile beyond 3 in each line)
  for (const length of matchLengths) {
    if (length > 3) {
      score += (length - 3) * SCORING.TILE_BONUS_PER_EXTRA;
    }
  }

  // Cascade multiplier applies to tile points only; snow earns a fixed bonus.
  const multiplier = Math.min(cascadeDepth, SCORING.CASCADE_MULTIPLIER_CAP);
  return score * multiplier + snowCleared * SCORING.SNOW_LAYER;
}

/**
 * Single resolution step: clear matches → gravity → refill.
 * Returns the updated state and resolution details.
 */
export function resolveStep(
  config: GameConfig,
  state: BoardState,
  matches: Match[],
  cascadeDepth: number,
  rng: SeededRNG
): { state: BoardState; tilesCleared: number; snowCleared: number; scoreDelta: number } {
  // Clear matches
  const { tilesCleared, snowCleared } = clearMatches(state, matches);

  // Calculate score for this step
  const matchLengths = getMatchLengths(matches);
  const scoreDelta = calculateScoreDelta(tilesCleared, snowCleared, matchLengths, cascadeDepth);

  // Apply gravity
  applyGravity(config, state);

  // Refill with new tiles
  refillBoard(config, state, rng);

  return { state, tilesCleared, snowCleared, scoreDelta };
}

/**
 * Full resolution loop: repeatedly resolve matches until board is stable.
 * Handles cascades with increasing depth multiplier.
 */
export function resolveAllMatches(
  config: GameConfig,
  initialState: BoardState,
  initialMatches: Match[],
  rng: SeededRNG
): ResolutionResult {
  const state = cloneBoardState(initialState);
  let totalTilesCleared = 0;
  let totalSnowCleared = 0;
  let totalScoreDelta = 0;
  const frames: ResolutionFrame[] = [];
  let currentMatches = initialMatches;

  while (currentMatches.length > 0) {
    // Bound work even for a pathological RNG. The safety reshuffle awards no
    // extra points and preserves the remaining snow and move/score counters.
    if (frames.length >= MAX_CASCADES) {
      state.grid = reshuffleBoard(config, state, rng, 0).grid;
      break;
    }
    const stepResult = resolveStep(config, state, currentMatches, frames.length + 1, rng);

    totalTilesCleared += stepResult.tilesCleared;
    totalSnowCleared += stepResult.snowCleared;
    totalScoreDelta += stepResult.scoreDelta;
    const frameState = cloneBoardState(state);
    frameState.score += totalScoreDelta;
    frameState.rngSeed = rng.getSeed();
    frames.push({ matches: currentMatches, boardState: frameState, scoreDelta: stepResult.scoreDelta });
    currentMatches = findMatches(config, state);
  }

  state.rngSeed = rng.getSeed();
  return {
    frames,
    matches: initialMatches,
    cascades: frames.length,
    scoreDelta: totalScoreDelta,
    snowCleared: totalSnowCleared,
    tilesCleared: totalTilesCleared,
    boardState: state
  };
}

/**
 * Check if all snow is cleared (victory condition for snow levels).
 */
export function isSnowCleared(config: GameConfig, state: BoardState): boolean {
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      if (state.grid[row][col].snow > 0) {
        return false;
      }
    }
  }
  return true;
}
