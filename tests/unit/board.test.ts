/** Regression and seeded invariant checks for the M1 engine (no Phaser/DOM). */
import { describe, expect, it, vi } from 'vitest';
import {
  LEVEL_1_CONFIG, GameConfig, BoardState, SeededRNG, generateInitialBoard,
  initializeGame, findMatches, hasValidMoves, reshuffleBoard, simulateMove,
  wouldCreateMatch, resolveAllMatches, MAX_CASCADES, serializeState, deserializeState
} from '../../src/game/logic';

function assertPlayable(config: GameConfig, state: BoardState): void {
  expect(findMatches(config, state)).toEqual([]);
  expect(hasValidMoves(config, state)).toBe(true);
  expect(state.grid.flat().every(t => t.type >= 0 && t.type < config.tileTypes)).toBe(true);
}

function firstMove(config: GameConfig, state: BoardState) {
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const a = { row, col };
      for (const b of [{ row: row + 1, col }, { row, col: col + 1 }]) {
        if (wouldCreateMatch(config, state, a, b)) return [a, b] as const;
      }
    }
  }
  throw new Error('Expected a legal move');
}

describe('M1 seeded board invariants', () => {
  it.each([5, 6])('constructs stable playable boards with %i colors for 1000 seeds', tileTypes => {
    const config = { ...LEVEL_1_CONFIG, tileTypes };
    for (let seed = 0; seed < 1000; seed++) {
      const rng = new SeededRNG(seed);
      const state = generateInitialBoard(config, rng);
      assertPlayable(config, state);
      expect(state.rngSeed).toBe(rng.getSeed());
      for (const cell of config.snow) {
        expect(state.grid[cell.row][cell.col].snow).toBe(cell.layers);
      }
    }
  });

  it.each([[8, 8], [2, 3], [3, 2], [3, 3]])(
    'constructs a guaranteed fallback for %ix%i boards', (rows, cols) => {
      const config = { ...LEVEL_1_CONFIG, rows, cols, tileTypes: 3, snow: [] };
      for (let seed = 0; seed < 100; seed++) {
        const rng = new SeededRNG(seed);
        const state = generateInitialBoard(config, rng, 0);
        assertPlayable(config, state);
        expect(state).toEqual(generateInitialBoard(config, new SeededRNG(seed), 0));
      }
    }
  );

  it('randomizes colors under snow instead of fixing them to zero', () => {
    const config = {
      ...LEVEL_1_CONFIG,
      snow: Array.from({ length: 64 }, (_, i) => ({ row: Math.floor(i / 8), col: i % 8, layers: 2 as const }))
    };
    const state = initializeGame(config, 0);
    assertPlayable(config, state);
    expect(new Set(state.grid.flat().map(t => t.type)).size).toBeGreaterThan(1);
    expect(state.grid.flat().every(t => t.snow === 2)).toBe(true);
  });

  it.each([0, 10])('reshuffles safely with %i random attempts over 1000 seeds', attempts => {
    const config = LEVEL_1_CONFIG;
    const state = initializeGame(config, 1);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) state.grid[row][col].type = (row + col) % 5;
    }
    expect(hasValidMoves(config, state)).toBe(false);
    state.movesLeft = 7;
    state.score = 1234;
    const before = serializeState(state);
    for (let seed = 0; seed < 1000; seed++) {
      const rng = new SeededRNG(seed);
      const result = reshuffleBoard(config, state, rng, attempts);
      assertPlayable(config, result);
      expect(result.rngSeed).toBe(rng.getSeed());
      expect(result.movesLeft).toBe(7);
      expect(result.score).toBe(1234);
      expect(result.grid.map(row => row.map(t => t.snow)))
        .toEqual(state.grid.map(row => row.map(t => t.snow)));
      expect(serializeState(state)).toBe(before);
      if (seed < 10) expect(result).toEqual(reshuffleBoard(config, state, new SeededRNG(seed), attempts));
    }
  });

  it('regenerates an impossible tile multiset without losing counters or snow', () => {
    const state = initializeGame(LEVEL_1_CONFIG, 1);
    for (const tile of state.grid.flat()) tile.type = 0;
    const result = reshuffleBoard(LEVEL_1_CONFIG, state, new SeededRNG(1));
    assertPlayable(LEVEL_1_CONFIG, result);
    expect(result.grid.map(row => row.map(t => t.snow))).toEqual(state.grid.map(row => row.map(t => t.snow)));
  });

  it('fills holes instead of accepting an incomplete reshuffled board', () => {
    const state = initializeGame(LEVEL_1_CONFIG, 1);
    state.grid[3][3].type = -1;
    assertPlayable(LEVEL_1_CONFIG, reshuffleBoard(LEVEL_1_CONFIG, state, new SeededRNG(1)));
    expect(state.grid[3][3].type).toBe(-1);
  });

  it.each([
    { rows: 2, cols: 2 }, { rows: 0 }, { rows: 3.5 },
    { tileTypes: 0 }, { tileTypes: 2 }, { tileTypes: 7 }
  ])('rejects unsupported generation configuration %j', override => {
    expect(() => initializeGame({ ...LEVEL_1_CONFIG, ...override }, 1)).toThrow(RangeError);
  });

  it.each([-1, Infinity, NaN, 0.5])('rejects an invalid attempt limit %s', attempts => {
    const state = initializeGame(LEVEL_1_CONFIG, 1);
    expect(() => generateInitialBoard(LEVEL_1_CONFIG, new SeededRNG(1), attempts)).toThrow(RangeError);
    expect(() => reshuffleBoard(LEVEL_1_CONFIG, state, new SeededRNG(1), attempts)).toThrow(RangeError);
  });
});

describe('M1 move and cascade invariants', () => {
  it('replays up to 25 moves for each of 100 seeds without mutation or unstable results', () => {
    for (let seed = 0; seed < 100; seed++) {
      let state = initializeGame(LEVEL_1_CONFIG, seed);
      for (let turn = 0; turn < 25; turn++) {
        const move = firstMove(LEVEL_1_CONFIG, state);
        const before = serializeState(state);
        const result = simulateMove(LEVEL_1_CONFIG, state, ...move);
        expect(serializeState(state)).toBe(before);
        expect(result).toEqual(simulateMove(LEVEL_1_CONFIG, deserializeState(before), ...move));
        expect(result.valid).toBe(true);
        expect(result.boardState.movesLeft).toBe(state.movesLeft - 1);
        expect(result.cascades).toBeLessThanOrEqual(MAX_CASCADES);
        expect(findMatches(LEVEL_1_CONFIG, result.boardState)).toEqual([]);
        if (result.gameOver === 'victory' || result.gameOver === 'defeat') break;
        assertPlayable(LEVEL_1_CONFIG, result.boardState);
        state = result.boardState;
      }
    }
  });

  it('terminates even when refill always selects the same color', () => {
    const config = { ...LEVEL_1_CONFIG, snow: [] };
    const state = initializeGame(config, 1);
    for (const tile of state.grid.flat()) tile.type = 0;
    const before = serializeState(state);
    const rng = new SeededRNG(1);
    vi.spyOn(rng, 'nextInt').mockReturnValue(0);
    const result = resolveAllMatches(config, state, findMatches(config, state), rng);
    expect(result.cascades).toBe(MAX_CASCADES);
    assertPlayable(config, result.boardState);
    expect(serializeState(state)).toBe(before);
    expect(result.boardState.movesLeft).toBe(state.movesLeft);
    expect(result.scoreDelta).toBeGreaterThan(0);
  });

  it.each([
    [{ row: -1, col: 0 }, { row: 0, col: 0 }],
    [{ row: 7, col: 0 }, { row: 8, col: 0 }],
    [{ row: 0, col: 7 }, { row: 0, col: 8 }],
    [{ row: 0.5, col: 0 }, { row: 1.5, col: 0 }]
  ])('rejects invalid coordinates without throwing', (a, b) => {
    const state = initializeGame(LEVEL_1_CONFIG, 1);
    const before = serializeState(state);
    expect(simulateMove(LEVEL_1_CONFIG, state, a, b).valid).toBe(false);
    expect(serializeState(state)).toBe(before);
  });

  it('does not consume moves for equal colors or unrelated existing matches', () => {
    const state = initializeGame(LEVEL_1_CONFIG, 1);
    for (let col = 0; col < 3; col++) state.grid[0][col].type = 0;
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) state.grid[row][col].type = (row + col) % 5;
    }
    expect(wouldCreateMatch(LEVEL_1_CONFIG, state, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(false);
    expect(simulateMove(LEVEL_1_CONFIG, state, { row: 7, col: 0 }, { row: 7, col: 1 }).valid).toBe(false);
  });

  it('rejects a move after the move limit is exhausted', () => {
    const state = initializeGame(LEVEL_1_CONFIG, 1);
    const move = firstMove(LEVEL_1_CONFIG, state);
    state.movesLeft = 0;
    const result = simulateMove(LEVEL_1_CONFIG, state, ...move);
    expect(result.valid).toBe(false);
    expect(result.boardState).toBe(state);
  });
});
