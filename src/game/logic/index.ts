/**
 * Public API for the Match-3 game logic.
 * All logic is pure TypeScript with no external dependencies.
 */

export * from './types';
export * from './rng';
export * from './matches';
export * from './resolve';
export * from './generate';
export * from './reshuffle';

import {
  GameConfig,
  BoardState,
  Position,
  MoveResult,
  cloneBoardState,
  areAdjacent
} from './types';
import { SeededRNG, createRandomSeed } from './rng';
import { findMatches, wouldCreateMatch } from './matches';
import { resolveAllMatches, isSnowCleared } from './resolve';
import { generateInitialBoard } from './generate';
import { reshuffleBoard, needsReshuffle } from './reshuffle';

/**
 * High-level move simulation:
 * 1. Validate swap (adjacent, creates match)
 * 2. Apply swap
 * 3. Resolve all matches (with cascades)
 * 4. Check game state (victory/defeat/reshuffle)
 * 5. Return new state and all deltas
 */
export function simulateMove(
  config: GameConfig,
  state: BoardState,
  pos1: Position,
  pos2: Position,
  options: { endless?: boolean } = {}
): MoveResult {
  if (!options.endless && state.movesLeft <= 0) return createInvalidMoveResult(state, 'no-moves-left');
  // Validate adjacency
  if (!areAdjacent(pos1, pos2)) {
    return createInvalidMoveResult(state, 'not-adjacent');
  }

  // Check if swap would create a match
  if (!wouldCreateMatch(config, state, pos1, pos2)) {
    return createInvalidMoveResult(state, 'no-match');
  }

  // Clone state and apply swap
  const newState = cloneBoardState(state);
  const tile1 = newState.grid[pos1.row][pos1.col];
  const tile2 = newState.grid[pos2.row][pos2.col];
  [tile1.type, tile2.type] = [tile2.type, tile1.type];

  // Consume a move
  if (!options.endless) newState.movesLeft--;

  // Create RNG from current seed
  const rng = new SeededRNG(newState.rngSeed);

  // Find initial matches
  const initialMatches = findMatches(config, newState);

  if (initialMatches.length === 0) {
    // Should not happen since we validated, but safety check
    return createInvalidMoveResult(state, 'no-match-after-swap');
  }

  // Resolve all matches (handles cascades)
  const resolution = resolveAllMatches(config, newState, initialMatches, rng);

  // Update state with resolution results
  newState.grid = resolution.boardState.grid;
  newState.score += resolution.scoreDelta;
  newState.rngSeed = rng.getSeed();

  // Check game state
  let gameOver: MoveResult['gameOver'] = 'none';

  // Victory takes precedence on final move (per spec)
  if (!options.endless && isSnowCleared(config, newState)) {
    gameOver = 'victory';
    // Add remaining move bonus
    newState.score += newState.movesLeft * 100;
  } else if (!options.endless && newState.movesLeft <= 0) {
    gameOver = 'defeat';
  } else if (needsReshuffle(config, newState)) {
    // Reshuffle and continue
    const reshuffledState = reshuffleBoard(config, newState, rng);
    newState.grid = reshuffledState.grid;
    newState.rngSeed = rng.getSeed();
    gameOver = 'reshuffle';
  }

  return {
    frames: resolution.frames,
    valid: true,
    matches: resolution.matches,
    cascades: resolution.cascades,
    scoreDelta: resolution.scoreDelta,
    snowCleared: resolution.snowCleared,
    tilesCleared: resolution.tilesCleared,
    boardState: newState,
    gameOver
  };
}

/**
 * Create result for invalid move (no state change, no move consumed).
 */
function createInvalidMoveResult(state: BoardState, _reason: string): MoveResult {
  return {
    frames: [],
    valid: false,
    matches: [],
    cascades: 0,
    scoreDelta: 0,
    snowCleared: 0,
    tilesCleared: 0,
    boardState: state,
    gameOver: 'none'
  };
}

/**
 * Initialize a new game/level.
 */
export function initializeGame(config: GameConfig, seed?: number): BoardState {
  const initialSeed = seed ?? createRandomSeed();
  const rng = new SeededRNG(initialSeed);
  const state = generateInitialBoard(config, rng);
  return state;
}

/**
 * Get current snow remaining count.
 */
export function getSnowRemaining(config: GameConfig, state: BoardState): number {
  let count = 0;
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      count += state.grid[row][col].snow;
    }
  }
  return count;
}

/**
 * Serialize board state for saving/sync.
 */
export function serializeState(state: BoardState): string {
  return JSON.stringify({
    grid: state.grid,
    movesLeft: state.movesLeft,
    score: state.score,
    rngSeed: state.rngSeed
  });
}

/**
 * Deserialize board state.
 */
export function deserializeState(data: string): BoardState {
  const parsed = JSON.parse(data);
  return {
    grid: parsed.grid,
    movesLeft: parsed.movesLeft,
    score: parsed.score,
    rngSeed: parsed.rngSeed
  };
}

/**
 * Default level 1 configuration.
 */
export const LEVEL_1_CONFIG: GameConfig = {
  rows: 8,
  cols: 8,
  tileTypes: 5,
  maxMoves: 25,
  snow: [
    { row: 3, col: 3, layers: 1 },
    { row: 3, col: 4, layers: 1 },
    { row: 4, col: 3, layers: 1 },
    { row: 4, col: 4, layers: 1 },
    { row: 2, col: 5, layers: 1 },
    { row: 5, col: 2, layers: 1 }
  ]
};

/**
 * All 10 level configurations (starting values from spec).
 */
export const LEVEL_CONFIGS: GameConfig[] = [
  // Level 1
  { rows: 8, cols: 8, tileTypes: 5, maxMoves: 28, snow: [{row:3,col:3,layers:1},{row:3,col:4,layers:1},{row:4,col:3,layers:1},{row:4,col:4,layers:1},{row:2,col:5,layers:1},{row:5,col:2,layers:1}] },
  // Level 2
  { rows: 8, cols: 8, tileTypes: 5, maxMoves: 27, snow: [] }, // TODO: add 10 single-layer edge positions
  // Level 3
  { rows: 8, cols: 8, tileTypes: 5, maxMoves: 25, snow: [] }, // TODO: add 14 single-layer corner positions
  // Level 4
  { rows: 8, cols: 8, tileTypes: 5, maxMoves: 25, snow: [] }, // TODO: 12 single + 3 double
  // Level 5
  { rows: 8, cols: 8, tileTypes: 6, maxMoves: 25, snow: [] }, // TODO: 16 single + 3 double
  // Level 6
  { rows: 8, cols: 8, tileTypes: 6, maxMoves: 24, snow: [] }, // TODO: 18 single + 4 double
  // Level 7
  { rows: 8, cols: 8, tileTypes: 6, maxMoves: 23, snow: [] }, // TODO: 20 single + 5 double
  // Level 8
  { rows: 8, cols: 8, tileTypes: 6, maxMoves: 22, snow: [] }, // TODO: 20 single + 7 double
  // Level 9
  { rows: 8, cols: 8, tileTypes: 6, maxMoves: 21, snow: [] }, // TODO: 22 single + 8 double
  // Level 10
  { rows: 8, cols: 8, tileTypes: 6, maxMoves: 20, snow: [] }  // TODO: 24 single + 10 double
];
