import type { GameConfig } from '../../../src/game/logic/types';

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
