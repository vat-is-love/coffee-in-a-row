import level from '@game/levels/match3.json';
import { fixedTiles, levelSeed } from './initial';
import {
  createEmptyBoardState, findMatches, hasValidMoves, initializeGame, validateGenerationConfig,
  type GameConfig, type TileType
} from '../logic';

export type Match3Level = {
  mode: string;
  board: {
    rows: number;
    cols: number;
    tileTypes: number;
    initial: { kind: string; fill: string; allowInitialMatches: boolean; requireLegalSwap: boolean } |
      { kind: string; tiles: number[][] };
    coating: { kind: string; clearsOn: string };
  };
  random: Parameters<typeof levelSeed>[0];
  rules: {
    minimumMatchLength: number;
    swap: string;
    gravity: string;
    refill: string;
    cascades: boolean;
    onNoLegalSwaps: string;
  };
  objective: { type: string; targetCells: number };
  limits: { moves: number | null; timeMs: number | null };
  timer: { startsOn: string };
};

export const match3Level = level;

export function startMatch3(description: Match3Level = match3Level) {
  const { board, rules, objective, limits, timer } = description;
  const { rows, cols, tileTypes, initial, coating } = board;
  const config: GameConfig = { rows, cols, tileTypes, maxMoves: 0, snow: [] };
  validateGenerationConfig(config);
  if (description.mode !== 'match3' || rules.minimumMatchLength !== 3 ||
      rules.swap !== 'orthogonally_adjacent' || rules.gravity !== 'down' ||
      rules.refill !== 'random' || !rules.cascades || rules.onNoLegalSwaps !== 'reshuffle' ||
      coating.kind !== 'all_cells' || coating.clearsOn !== 'match_in_cell' ||
      objective.type !== 'clear_all_coating' || objective.targetCells !== rows * cols ||
      limits.moves !== null || limits.timeMs !== null || timer.startsOn !== 'first_swap_attempt') {
    throw new RangeError('Unsupported Match-3 level rules');
  }
  const seed = levelSeed(description.random);
  if (initial.kind === 'generated' && 'fill' in initial && initial.fill === 'all_cells' &&
      !initial.allowInitialMatches && initial.requireLegalSwap) {
    return { config, state: initializeGame(config, seed) };
  }
  if (initial.kind !== 'fixed' || !('tiles' in initial)) {
    throw new RangeError('Unsupported Match-3 starting layout');
  }
  const state = createEmptyBoardState(config, seed);
  state.grid = fixedTiles(board, initial.tiles, 0).map(row => row.map(type => ({ type: type as TileType, snow: 0 })));
  if (findMatches(config, state).length || !hasValidMoves(config, state)) {
    throw new RangeError('Match-3 must start without matches and with a legal swap');
  }
  return { config, state };
}
