import { createBoardSurface } from '../render/boardSurface';
import { showClassicLeaderboard, formatDuration } from '../../ui/fallingLeaderboard';
import { iconButton } from '../../ui/iconButton';
import { t, vibrate } from '../../ui/preferences';
import { Scene, GameObjects, Input } from 'phaser';
import {
  initializeGame, simulateMove, areAdjacent, cloneBoardState,
  type BoardState, type GameConfig, type Position, type ResolutionFrame
} from '../logic';

const TILE_SIZE = 64;
const BOARD_PADDING = 12;
const HUD_BOTTOM = 120;
const VIEW_MARGIN = 12;
const FREE_PLAY: GameConfig = { rows: 8, cols: 8, tileTypes: 5, maxMoves: 0, snow: [] };

interface TileView extends Position {
  sprite: GameObjects.Image;
}

/** Rendering follows the pure engine's frames; input stays locked until all tweens finish. */
export class GameScene extends Scene {
  private config = FREE_PLAY;
  private clearedCells = new Set<string>();
  private coating!: GameObjects.Graphics;
  private completed = false;
  private elapsed = 0;
  private state!: BoardState;
  private board: TileView[][] = [];
  private selectedTile: TileView | null = null;
  private highlight: GameObjects.Image | null = null;
  private gesture: { tile: TileView; x: number; y: number; id: number } | null = null;
  private isProcessing = false;
  private paused = false;
  private failed = false;
  private movesPlayed = 0;
  private reducedMotion = false;
  private boardContainer!: GameObjects.Container;
  private hudContainer!: GameObjects.Container;
  private background!: GameObjects.Graphics;
  private scoreText!: GameObjects.Text;
  private movesText!: GameObjects.Text;
  private statusText!: GameObjects.Text;

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    this.completed = false;
    this.elapsed = 0;
    this.clearedCells = new Set();
    this.board = [];
    this.isProcessing = false;
    this.paused = false;
    this.failed = false;
    this.movesPlayed = 0;
    this.selectedTile = null;
    this.gesture = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.background = this.add.graphics();
    this.boardContainer = this.add.container(0, 0);
    this.createBoardSurface();
    this.createHUD();
    this.resizeLayout();
    try {
      this.state = initializeGame(this.config, 12345);
      this.renderBoard();
      this.updateHUD();
    } catch (error) { this.showError(error); }
    this.input.on('pointerdown', this.pointerDown, this);
    this.input.on('pointerup', this.pointerUp, this);
    this.input.on('pointerupoutside', this.cancelGesture, this);
    this.input.on('gameout', this.cancelGesture, this);
    this.input.keyboard?.on('keydown', this.keyDown, this);
    this.scale.on('resize', this.resizeLayout, this);
    this.game.events.on('language-changed', this.resizeLayout, this);
    // Readiness belongs to the playable interface, including when the saved
    // mode bypasses the first-launch picker. Wait until its first frame renders.
    if (!this.failed) this.game.events.once('postrender', () => window.CoffeeRecovery?.ready());
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.resizeLayout, this);
      this.game.events.off('language-changed', this.resizeLayout, this);
      this.input.off('pointerdown', this.pointerDown, this);
      this.input.off('pointerup', this.pointerUp, this);
      this.input.off('pointerupoutside', this.cancelGesture, this);
      this.input.off('gameout', this.cancelGesture, this);
      this.input.keyboard?.off('keydown', this.keyDown, this);
      this.gesture = null;
    });
  }

  private createBoardSurface(): void {
    this.boardContainer.add(createBoardSurface(this));
    this.coating = this.add.graphics();
    this.boardContainer.add(this.coating);
    this.drawCoating();
  }

  private drawCoating(): void {
    this.coating.clear().fillStyle(0xffffff, 0.10);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      if (!this.clearedCells.has(`${row},${col}`)) this.coating.fillRect(col * 64 + 1, row * 64 + 1, 62, 62);
    }
  }

  update(_time: number, delta: number): void {
    if (this.paused || this.failed || this.completed || document.hidden) return;
    this.elapsed += delta;
    this.updateProgress();
  }

  private createHUD(): void {
    const width = Math.min(this.scale.width - 24, 620);
    this.hudContainer = this.add.container((this.scale.width - width) / 2, 10).setDepth(20);
    const bg = this.add.graphics().fillStyle(0x16213e, 0.95);
    bg.fillRoundedRect(0, 0, width, 104, 14);
    const style = { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#f5f0e8' };
    const title = this.add.text(12, 10, t('Match three'), { ...style, color: '#e8a87c', fontStyle: 'bold' });
    if (title.width > width - 128) title.setScale((width - 128) / title.width);
    const settings = iconButton(this, width - 104, 8, 'settings', () => window.dispatchEvent(new Event('game-settings')));
    this.movesText = this.add.text(12, 62, '', { ...style, fontSize: '12px' });
    this.scoreText = this.add.text(12, 36, '', style);
    const pause = iconButton(this, width - 54, 8, this.paused ? 'play' : 'pause', () => this.togglePause());
    this.statusText = this.add.text(12, 84, '', { ...style, fontSize: '11px', color: '#e4cfad' });
    this.hudContainer.add([bg, title, settings, this.movesText, this.scoreText, pause, this.statusText]);
    if (this.state) this.updateHUD();
  }

  private resizeLayout(): void {
    const { width, height } = this.scale;
    this.cancelGesture();
    this.background.clear().fillStyle(0x1a1a2e).fillRect(0, 0, width, height);
    this.hudContainer.destroy();
    this.createHUD();
    const boardWidth = this.config.cols * TILE_SIZE;
    const boardHeight = this.config.rows * TILE_SIZE;
    const availableHeight = Math.max(1, height - HUD_BOTTOM - VIEW_MARGIN * 2);
    const scale = Math.min(1.15, (width - 24) / (boardWidth + 24), availableHeight / (boardHeight + 24));
    this.boardContainer.setScale(scale).setPosition(
      (width - boardWidth * scale) / 2,
      HUD_BOTTOM + VIEW_MARGIN + BOARD_PADDING * scale +
        (availableHeight - (boardHeight + 24) * scale) / 2
    );
  }

  private updateHUD(message = t('Swipe or tap two tiles · Arrows + Space')): void {
    this.updateProgress();
    this.scoreText.setText(`${t('Score')}: ${this.state.score}`);
    this.statusText.setText(this.failed ? t('Board error. Reload to try again.') : this.paused ? t('Paused · Resume or press Escape') : message);
  }

  private updateProgress(): void {
    this.movesText.setText(`${t('Cleared')}: ${this.clearedCells.size}/64 · ${t('Time')}: ${formatDuration(this.elapsed)}`);
  }

  private createTile(row: number, col: number, type: number, y = row * 64 + 32): TileView {
    const sprite = this.add.image(col * 64 + 32, y, `tile-${type}`).setDisplaySize(64, 64);
    this.boardContainer.add(sprite);
    return { row, col, sprite };
  }

  private renderBoard(): void {
    this.clearSelection();
    for (const row of this.board) for (const tile of row) tile.sprite.destroy();
    this.board = this.state.grid.map((row, r) => row.map((tile, c) => this.createTile(r, c, tile.type)));
  }

  private tileAt(x: number, y: number): TileView | null {
    const col = Math.floor((x - this.boardContainer.x) / this.boardContainer.scaleX / 64);
    const row = Math.floor((y - this.boardContainer.y) / this.boardContainer.scaleY / 64);
    return this.board[row]?.[col] ?? null;
  }

  private pointerDown(pointer: Input.Pointer): void {
    if (this.isProcessing || this.paused || this.failed || this.completed || this.gesture) return;
    const tile = this.tileAt(pointer.x, pointer.y);
    if (tile) this.gesture = { tile, x: pointer.x, y: pointer.y, id: pointer.id };
    else this.clearSelection();
  }

  private pointerUp(pointer: Input.Pointer): void {
    const start = this.gesture;
    if (!start || start.id !== pointer.id) return;
    this.gesture = null;
    if (this.isProcessing || this.paused || this.failed || this.completed) return;
    const dx = pointer.x - start.x;
    const dy = pointer.y - start.y;
    const threshold = Math.max(8, 64 * this.boardContainer.scaleX * 0.25);
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= threshold) {
      const row = start.tile.row + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0);
      const col = start.tile.col + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0);
      const target = this.board[row]?.[col];
      if (target) void this.attemptSwap(start.tile, target);
      else this.clearSelection();
    } else if (this.tileAt(pointer.x, pointer.y) === start.tile) {
      this.selectTile(start.tile);
    }
  }

  private cancelGesture(): void { this.gesture = null; }

  private selectTile(tile: TileView): void {
    if (this.selectedTile === tile) { this.clearSelection(); return; }
    if (this.selectedTile && areAdjacent(this.selectedTile, tile)) {
      void this.attemptSwap(this.selectedTile, tile);
      return;
    }
    this.clearSelection();
    this.selectedTile = tile;
    this.highlight = this.add.image(tile.col * 64 + 32, tile.row * 64 + 32, 'selection-highlight');
    this.boardContainer.add(this.highlight);
  }

  private clearSelection(): void {
    this.highlight?.destroy();
    this.highlight = null;
    this.selectedTile = null;
  }

  private keyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { this.togglePause(); return; }
    if (this.isProcessing || this.paused || this.failed || this.completed) return;
    const directions: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const delta = directions[event.key];
    if (delta) {
      event.preventDefault();
      const current = this.selectedTile ?? this.board[0][0];
      const tile = this.board[current.row + delta[0]]?.[current.col + delta[1]];
      if (event.shiftKey && tile && this.selectedTile) void this.attemptSwap(current, tile);
      else {
        this.clearSelection();
        this.selectTile(tile ?? current);
      }
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!this.selectedTile) this.selectTile(this.board[0][0]);
    }
  }

  private togglePause(): void {
    if (this.isProcessing || this.failed || this.completed) return;
    this.paused = !this.paused;
    this.cancelGesture();
    this.clearSelection();
    this.hudContainer.destroy();
    this.createHUD();
  }

  private animate(targets: GameObjects.Image | GameObjects.Image[], values: object, duration: number): Promise<void> {
    return new Promise(resolve => {
      this.tweens.add({ targets, ...values, duration: this.reducedMotion ? 1 : duration, ease: 'Cubic.easeOut', onComplete: () => resolve() });
    });
  }

  private async attemptSwap(a: TileView, b: TileView): Promise<void> {
    if (this.isProcessing || this.paused || this.failed || this.completed) return;
    this.isProcessing = true;
    this.clearSelection();
    this.cancelGesture();
    try {
      const result = simulateMove(this.config, this.state, a, b, { endless: true });
      await Promise.all([
        this.animate(a.sprite, { x: b.col * 64 + 32, y: b.row * 64 + 32 }, 150),
        this.animate(b.sprite, { x: a.col * 64 + 32, y: a.row * 64 + 32 }, 150)
      ]);
      if (!result.valid) {
        await Promise.all([
          this.animate(a.sprite, { x: a.col * 64 + 32, y: a.row * 64 + 32 }, 150),
          this.animate(b.sprite, { x: b.col * 64 + 32, y: b.row * 64 + 32 }, 150)
        ]);
        this.updateHUD(t('Try a swap that makes a line of 3'));
        return;
      }
      const ar = a.row, ac = a.col, br = b.row, bc = b.col;
      this.board[ar][ac] = b; this.board[br][bc] = a;
      a.row = br; a.col = bc; b.row = ar; b.col = ac;
      this.movesPlayed++;
      for (let i = 0; i < result.frames.length; i++) {
        this.updateHUD(i === 0 ? t('Match!') : `${t('Cascade')} ×${i + 1}`);
        await this.playFrame(result.frames[i]);
      }
      if (result.gameOver === 'reshuffle' || result.cascades >= 100) {
        this.updateHUD(t('No moves · Shuffling…'));
        const sprites = this.board.flat().map(tile => tile.sprite);
        await this.animate(sprites, { alpha: 0.2 }, 250);
      }
      this.state = result.boardState;
      this.renderBoard();
      if (this.clearedCells.size === this.config.rows * this.config.cols) {
        this.completed = true;
        this.clearSelection();
        const cleanup = showClassicLeaderboard(this.state.score, this.elapsed, () => this.scene.restart());
        this.events.once('shutdown', cleanup);
      }
      this.updateHUD(result.gameOver === 'reshuffle' ? t('Board shuffled · Keep playing') : t('Swipe or tap two tiles · Shift + Arrow swaps'));
    } catch (error) { this.showError(error); }
    finally { this.isProcessing = false; }
  }

  private async playFrame(frame: ResolutionFrame): Promise<void> {
    vibrate('match');
    const cleared = new Set(frame.matches.flatMap(match => match.tiles.map(pos => `${pos.row},${pos.col}`)));
    const removed = this.board.flat().filter(tile => cleared.has(`${tile.row},${tile.col}`));
    await this.animate(removed.map(tile => tile.sprite), { scaleX: 0, scaleY: 0, alpha: 0 }, 170);
    cleared.forEach(cell => this.clearedCells.add(cell));
    this.drawCoating();
    removed.forEach(tile => tile.sprite.destroy());
    const next: TileView[][] = Array.from({ length: this.config.rows }, () => []);
    const falls: Promise<void>[] = [];
    for (let col = 0; col < this.config.cols; col++) {
      const survivors = this.board.map(row => row[col]).filter(tile => !cleared.has(`${tile.row},${tile.col}`));
      const missing = this.config.rows - survivors.length;
      for (let row = 0; row < this.config.rows; row++) {
        const tile = row < missing
          ? this.createTile(row, col, frame.boardState.grid[row][col].type, (row - missing) * 64 + 32)
          : survivors[row - missing];
        tile.row = row; tile.col = col;
        next[row][col] = tile;
        falls.push(this.animate(tile.sprite, { y: row * 64 + 32 }, 240));
      }
    }
    this.board = next;
    await Promise.all(falls);
    const score = this.state.score + frame.scoreDelta;
    this.state = cloneBoardState(frame.boardState);
    this.state.score = score;
    this.updateHUD(t('Resolving…'));
  }

  private showError(error: unknown): void {
    console.error('Unable to render board', error);
    this.failed = true;
    this.clearSelection();
    this.statusText.setText(t('Board error. Reload to try again.'));
  }
}
