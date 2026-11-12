import { createRandomSeed } from '../logic/rng';

export function levelSeed(random: { seedPolicy: string; seed?: number }): number {
  if (random.seedPolicy === 'fresh_per_game') return createRandomSeed();
  const { seed } = random;
  if (random.seedPolicy === 'fixed' && seed !== undefined && Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff) {
    return seed;
  }
  throw new RangeError('Expected a fresh seed or a fixed unsigned 32-bit seed');
}

export function fixedTiles(
  { rows, cols, tileTypes }: { rows: number; cols: number; tileTypes: number },
  tiles: number[][] | undefined,
  minTile: number
): number[][] {
  if (!Array.isArray(tiles) || tiles.length !== rows || tiles.some(row =>
    !Array.isArray(row) || row.length !== cols ||
    row.some(tile => !Number.isInteger(tile) || tile < minTile || tile >= tileTypes))) {
    throw new RangeError('Fixed tiles must match the board dimensions and palette');
  }
  return tiles.map(row => [...row]);
}
