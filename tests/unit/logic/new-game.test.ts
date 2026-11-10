import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeGame, LEVEL_1_CONFIG } from '../../../src/game/logic/index';
import { createFalling, addFallingRow } from '../../../src/game/logic/falling';
import { createRandomSeed } from '../../../src/game/logic/rng';

afterEach(() => vi.unstubAllGlobals());

describe('new game randomness', () => {
  it('uses fresh entropy for both modes even when the clock does not advance', () => {
    let seed = 100;
    vi.stubGlobal('crypto', {
      getRandomValues: (values: Uint32Array) => { values[0] = seed++; return values; }
    });
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    try {
      const classic = initializeGame(LEVEL_1_CONFIG);
      expect(classic).toEqual(initializeGame(LEVEL_1_CONFIG, 100));
      expect(initializeGame(LEVEL_1_CONFIG).grid).not.toEqual(classic.grid);
      const falling = createFalling();
      const nextFalling = createFalling();
      expect(falling).toEqual(createFalling(102));
      expect(nextFalling.grid).not.toEqual(falling.grid);
      expect(nextFalling.nextRow).not.toEqual(falling.nextRow);
      expect(addFallingRow(nextFalling).state.nextRow).not.toEqual(addFallingRow(falling).state.nextRow);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('supports environments without Web Crypto', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
    try {
      expect(createRandomSeed()).toBe(3221225472);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
