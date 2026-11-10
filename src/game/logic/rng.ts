/**
 * Seeded Random Number Generator (LCG)
 * Deterministic, reproducible, no external dependencies.
 * Uses the same algorithm as the original GameScene for compatibility.
 */

const MODULUS = 4294967296; // 2^32
const MULTIPLIER = 1664525;
const INCREMENT = 1013904223;

/**
 * Simple seeded RNG using Linear Congruential Generator
 */
export class SeededRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0; // Ensure unsigned 32-bit
  }

  /**
   * Generate next random number in [0, 1)
   */
  next(): number {
    this.seed = (this.seed * MULTIPLIER + INCREMENT) % MODULUS;
    return this.seed / MODULUS;
  }

  /**
   * Generate random integer in [0, max)
   */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /**
   * Get current seed (for serialization/debugging)
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Set seed directly
   */
  setSeed(seed: number): void {
    this.seed = seed >>> 0;
  }

  /**
   * Create a clone with the same state
   */
  clone(): SeededRNG {
    const cloned = new SeededRNG(0);
    cloned.seed = this.seed;
    return cloned;
  }

  /**
   * Create a new RNG with a different seed (for branching)
   */
  branch(): SeededRNG {
    return new SeededRNG(this.nextInt(MODULUS));
  }
}

/**
 * Create RNG from seed (factory function)
 */
export function createRNG(seed: number): SeededRNG {
  return new SeededRNG(seed);
}

/**
 * Default seed for reproducible tests
 */
export const DEFAULT_SEED = 12345;

/** Fresh entropy for each new game; explicit seeds remain available for replay/tests. */
export function createRandomSeed(): number {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * MODULUS);
}
