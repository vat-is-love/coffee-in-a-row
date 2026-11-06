/**
 * Unit tests for SeededRNG
 */

import { describe, it, expect } from 'vitest';
import { SeededRNG, createRNG, DEFAULT_SEED } from '../../../src/game/logic/rng';

describe('SeededRNG', () => {
  it('should produce deterministic sequence with same seed', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('should produce different sequences with different seeds', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(54321);

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).not.toEqual(seq2);
  });

  it('next() should return values in [0, 1)', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 1000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('nextInt(max) should return values in [0, max)', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(10);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(10);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('clone() should produce identical sequence', () => {
    const rng1 = new SeededRNG(999);
    const rng2 = rng1.clone();

    for (let i = 0; i < 50; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('branch() should produce different but deterministic sequence', () => {
    const rng = new SeededRNG(777);
    const branch1 = rng.branch();
    const branch2 = rng.branch();

    // Both branches should be different from each other
    expect(branch1.next()).not.toBe(branch2.next());

    // But each branch should be reproducible
    const branch1Clone = branch1.clone();
    expect(branch1.next()).toBe(branch1Clone.next());
  });

  it('getSeed/setSeed should work correctly', () => {
    const rng = new SeededRNG(111);
    const seed = rng.getSeed();
    expect(seed).toBe(111);

    rng.next();
    rng.next();
    rng.setSeed(seed);
    // Should be back to initial state
    expect(rng.getSeed()).toBe(111);
  });

  it('createRNG factory should work', () => {
    const rng = createRNG(555);
    expect(rng.next()).toBe(new SeededRNG(555).next());
  });

  it('DEFAULT_SEED should be defined', () => {
    expect(DEFAULT_SEED).toBe(12345);
  });
});