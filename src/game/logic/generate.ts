/** Deterministic, bounded construction of stable, playable boards. */
import { GameConfig, BoardState, Tile, createEmptyBoardState } from './types';
import { SeededRNG } from './rng';
import { hasValidMoves } from './matches';

/** Three colors ensure a choice after excluding two possible runs. */
export function validateGenerationConfig(config: GameConfig): void {
  if (!Number.isInteger(config.rows) || !Number.isInteger(config.cols) ||
      config.rows < 2 || config.cols < 2 || Math.max(config.rows, config.cols) < 3 ||
      !Number.isInteger(config.tileTypes) || config.tileTypes < 3 || config.tileTypes > 6) {
    throw new RangeError('Board generation requires at least 2x3 or 3x2 cells and 3–6 tile types');
  }
}

export function validateAttempts(maxAttempts: number): void {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 0) {
    throw new RangeError('maxAttempts must be a finite non-negative integer');
  }
}

/** Fill every cell, including snow-covered cells, without forming triples. */
export function fillBoardRandom(config: GameConfig, state: BoardState, rng: SeededRNG): void {
  validateGenerationConfig(config);
  fillUnassigned(config, state, rng, new Set());
}

function fillUnassigned(
  config: GameConfig, state: BoardState, rng: SeededRNG, fixed: Set<string>
): void {
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      if (fixed.has(`${row},${col}`)) continue;
      const forbidden = new Set<number>();
      if (col >= 2 && state.grid[row][col - 1].type === state.grid[row][col - 2].type) {
        forbidden.add(state.grid[row][col - 1].type);
      }
      if (row >= 2 && state.grid[row - 1][col].type === state.grid[row - 2][col].type) {
        forbidden.add(state.grid[row - 1][col].type);
      }
      const choices = Array.from({ length: config.tileTypes }, (_, type) => type)
        .filter(type => !forbidden.has(type));
      state.grid[row][col].type = choices[rng.nextInt(choices.length)] as Tile['type'];
    }
  }
}

/**
 * Try stable random boards, then construct a guaranteed swap:
 * A B A       A A A
 * C A C  -->  C B C
 * Transpose the motif on narrow boards. Snow does not restrict tile colors.
 */
export function generateInitialBoard(config: GameConfig, rng: SeededRNG, maxAttempts = 50): BoardState {
  validateGenerationConfig(config);
  validateAttempts(maxAttempts);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const state = createEmptyBoardState(config, rng.getSeed());
    fillBoardRandom(config, state, rng);
    if (hasValidMoves(config, state)) {
      state.rngSeed = rng.getSeed();
      return state;
    }
  }

  const state = createEmptyBoardState(config, rng.getSeed());
  const colors = Array.from({ length: config.tileTypes }, (_, type) => type);
  const selected = Array.from({ length: 3 }, () => colors.splice(rng.nextInt(colors.length), 1)[0]);
  const motif = [[selected[0], selected[1], selected[0]], [selected[2], selected[0], selected[2]]];
  const fixed = new Set<string>();
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const [row, col] = config.cols >= 3 ? [r, c] : [c, r];
      state.grid[row][col].type = motif[r][c] as Tile['type'];
      fixed.add(`${row},${col}`);
    }
  }
  fillUnassigned(config, state, rng, fixed);
  state.rngSeed = rng.getSeed();
  return state;
}

export function generateBoardFromSeed(config: GameConfig, seed: number): BoardState {
  return generateInitialBoard(config, new SeededRNG(seed));
}
