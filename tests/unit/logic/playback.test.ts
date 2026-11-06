import { describe, expect, it } from 'vitest';
import { initializeGame, simulateMove, findMatches, hasValidMoves, type GameConfig, type MoveResult } from '../../../src/game/logic';

const config: GameConfig = { rows: 8, cols: 8, tileTypes: 5, maxMoves: 0, snow: [] };

describe('endless scene playback', () => {
  it('plays beyond a level move cap without victory bonuses and preserves independent cascade frames', () => {
    let state = initializeGame(config, 12345);
    let cascadesSeen = false;
    for (let turn = 0; turn < 200; turn++) {
      let result: MoveResult | undefined;
      for (let row = 0; row < 8 && !result; row++) for (let col = 0; col < 8 && !result; col++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const move = simulateMove(config, state, { row, col }, { row: row + dr, col: col + dc }, { endless: true });
          if (move.valid) { result = move; break; }
        }
      }
      expect(result).toBeDefined();
      const move = result!;
      expect(move.boardState.movesLeft).toBe(0);
      expect(move.boardState.score).toBe(state.score + move.scoreDelta);
      expect(move.frames).toHaveLength(move.cascades);
      expect(move.frames.reduce((sum, frame) => sum + frame.scoreDelta, 0)).toBe(move.scoreDelta);
      expect(findMatches(config, move.boardState)).toEqual([]);
      expect(hasValidMoves(config, move.boardState)).toBe(true);
      for (let index = 0; index < move.frames.length - 1; index++) {
        expect(findMatches(config, move.frames[index].boardState)).toEqual(move.frames[index + 1].matches);
        expect(move.frames[index].boardState.grid).not.toBe(move.frames[index + 1].boardState.grid);
      }
      cascadesSeen ||= move.cascades > 1;
      state = move.boardState;
    }
    expect(cascadesSeen).toBe(true);
  });
});
