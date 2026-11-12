import { createBoardSurface } from '../render/boardSurface';
import { createHud } from '../render/hud';
import { t, vibrate } from '../../ui/preferences';
import { Scene, GameObjects, Input } from 'phaser';
import { FALLING, createFalling, clearGroup, findGroup, addFallingRow, rowInterval, turnDuration, type FallingState } from '../logic/falling';
import type { Position } from '../logic/types';
import { showFallingLeaderboard } from '../../ui/fallingLeaderboard';

type TileView = Position & { sprite: GameObjects.Image };

export class FallingScene extends Scene {
  private state!: FallingState;
  private board: (TileView | null)[][] = [];
  private boardContainer!: GameObjects.Container;
  private hudContainer!: GameObjects.Container;
  private timerText!: GameObjects.Text;
  private statusText!: GameObjects.Text;
  private scoreText!: GameObjects.Text;
  private danger!: GameObjects.Graphics;
  private highlights: GameObjects.Image[] = [];
  private remaining = rowInterval(0);
  private preview: GameObjects.Image[] = [];
  private previewContainer!: GameObjects.Container;
  private previewRow: number[] = [];
  private droppingRow = false;
  private dropButton!: GameObjects.Text;
  private isProcessing = false;
  private pendingOutline!: GameObjects.Graphics;
  private settlingPreview: { grid: number[][]; board: (TileView | null)[][] } | null = null;
  private pendingTile: TileView | null = null;
  private removingTiles = new Set<TileView>();
  private paused = false;
  private gameOver = false;
  private reducedMotion = false;
  private elapsed = 0;
  private selected: Position = { row: 7, col: 0 };

  constructor() { super({ key: 'FallingScene' }); }

  create(): void {
    this.state = createFalling();
    this.remaining = rowInterval(0);
    this.previewRow = [...this.state.nextRow];
    this.droppingRow = false;
    this.selected = { row: 7, col: 0 };
    this.isProcessing = this.paused = this.gameOver = false;
    this.elapsed = 0;
    this.pendingTile = null;
    this.settlingPreview = null;
    this.removingTiles.clear();
    this.board = [];
    this.highlights = [];
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.boardContainer = this.add.container(0, 0);
    const surface = createBoardSurface(this);
    this.danger = this.add.graphics();
    this.boardContainer.add([surface, this.danger]);
    this.renderBoard();
    this.pendingOutline = this.add.graphics();
    this.boardContainer.add(this.pendingOutline);
    this.layout();
    this.input.on('pointerup', this.click, this);
    this.input.on('pointermove', this.hover, this);
    this.input.keyboard?.on('keydown', this.keyDown, this);
    this.scale.on('resize', this.layout, this);
    this.game.events.on('language-changed', this.layout, this);
    // Readiness belongs to the playable interface, including when the saved
    // mode bypasses the first-launch picker. Wait until its first frame renders.
    this.game.events.once('postrender', () => window.CoffeeRecovery?.ready());
    this.events.once('shutdown', () => {
      this.settlingPreview = null;
      this.pendingTile = null;
      this.removingTiles.clear();
      this.input.off('pointerup', this.click, this);
      this.input.off('pointermove', this.hover, this);
      this.input.keyboard?.off('keydown', this.keyDown, this);
      this.scale.off('resize', this.layout, this);
      this.game.events.off('language-changed', this.layout, this);
    });
  }

  update(_time: number, delta: number): void {
    this.drawPendingOutline();
    if (this.paused || this.gameOver || document.hidden) return;
    this.elapsed += delta;
    this.remaining = Math.max(0, this.remaining - delta);
    this.updateHUD();
    if (this.remaining === 0 && !this.isProcessing) void this.dropRow();
  }

  private renderBoard(): void {
    this.board.flat().forEach(tile => tile?.sprite.destroy());
    this.board = this.state.grid.map((row, r) => row.map((color, c) => color < 0 ? null : this.makeTile(r, c, color)));
  }

  private makeTile(row: number, col: number, color: number, y = row * 64 + 32): TileView {
    const sprite = this.add.image(col * 64 + 32, y, `tile-${color}`).setDisplaySize(64, 64);
    this.boardContainer.add(sprite);
    return { row, col, sprite };
  }

  private layout(): void {
    const { width, height } = this.scale;
    const available = Math.max(1, height - 196);
    // Reserve one full-size preview row immediately above the eight playable rows.
    const scale = Math.min(1.15, (width - 24) / 536, available / 608);
    this.boardContainer.setScale(scale).setPosition(
      (width - 512 * scale) / 2, 126 + 84 * scale + (available - 608 * scale) / 2
    );
    this.dropButton?.destroy();
    this.dropButton = this.add.text(width / 2, this.boardContainer.y + 524 * scale + 12,
      t('Drop next row ↓'), {
        fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#1a1a2e', backgroundColor: '#e8a87c'
      }).setOrigin(0.5, 0).setPadding(18, 10).setDepth(20).setInteractive({ useHandCursor: true });
    this.dropButton.on('pointerup', () => this.requestDrop());
    this.createHUD();
  }

  private requestDrop(): void {
    if (this.paused || this.gameOver || this.droppingRow || this.remaining <= 0) return;
    this.remaining = 0;
    this.updateHUD();
    // A request during removal is fulfilled once the board has settled.
    if (!this.isProcessing) void this.dropRow();
  }

  private createHUD(): void {
    this.hudContainer?.destroy();
    const icon = this.gameOver ? 'restart' : this.paused ? 'play' : 'pause';
    const hud = createHud(this, t('FALLING ROWS'), icon, () => {
      if (this.gameOver) this.scene.restart();
      else this.togglePause();
    });
    this.hudContainer = hud.container;
    this.scoreText = hud.score;
    this.timerText = hud.progress;
    this.statusText = hud.status;
    this.createPreview();
    this.updateHUD();
  }

  private createPreview(): void {
    this.previewContainer?.destroy();
    const board = this.boardContainer;
    this.previewContainer = this.add.container(board.x, board.y - 84 * board.scaleY)
      .setScale(board.scaleX).setDepth(10);
    const slots = this.add.graphics();
    slots.fillStyle(0x16213e, 0.9).fillRoundedRect(0, 0, 512, 64, 8);
    slots.lineStyle(1, 0xe4cfad, 0.35).strokeRoundedRect(0, 0, 512, 64, 8);
    for (let col = 1; col < FALLING.cols; col++) slots.lineBetween(col * 64, 0, col * 64, 64);
    this.previewContainer.add(slots);
    this.preview = this.previewRow.map((color, col) => {
      const sprite = this.add.image(col * 64 + 32, 32, `tile-${color}`).setDisplaySize(64, 64);
      this.previewContainer.add(sprite);
      return sprite;
    });
  }

  private updateHUD(): void {
    const progress = this.droppingRow ? 1 : Math.max(0, Math.min(1, 1 - this.remaining / rowInterval(this.state.rowsAdded)));
    // Each tile materializes during its own eighth of the countdown, left to right.
    this.preview.forEach((sprite, col) => sprite.setAlpha(Math.max(0, Math.min(1, progress * FALLING.cols - col))));
    this.dropButton?.setAlpha(this.paused || this.gameOver || this.droppingRow || this.remaining <= 0 ? 0.45 : 1);
    this.scoreText.setText(`${t('Score')}: ${this.state.score} · ${t('Rows')}: ${this.state.rowsAdded}`);
    this.timerText.setText(`${t('Next row')}: ${(this.remaining / 1000).toFixed(1)}s`);
    const [top, second] = this.state.grid;
    const danger = top.some(color => color >= 0) || second.some(color => color >= 0);
    this.danger.clear();
    if (danger) this.danger.fillStyle(0xe74c3c, 0.12 + Math.sin(this.elapsed / 300) * 0.04).fillRect(0, 0, 512, 128);
    this.timerText.setColor(danger || this.remaining < 2000 ? '#ffb49f' : '#f5f0e8');
    this.statusText.setText(this.gameOver ? t('Board full · Restart to try again') : this.paused ? t('Paused · Resume or press Escape') : this.isProcessing ? t('Settling…') : danger ? t('Nearly full! Clear space for the next row') : t('Tap groups of 2+ · Empty columns move to center'));
  }

  private position(pointer: Input.Pointer): Position | null {
    const col = Math.floor((pointer.x - this.boardContainer.x) / this.boardContainer.scaleX / 64);
    const row = Math.floor((pointer.y - this.boardContainer.y) / this.boardContainer.scaleY / 64);
    return row >= 0 && row < 8 && col >= 0 && col < 8 ? { row, col } : null;
  }

  private click(pointer: Input.Pointer): void {
    const pos = this.position(pointer);
    if (!pos || this.paused || this.gameOver) return;
    if (this.isProcessing) {
      // Follow the visible tile through gravity and column centering, not its old cell.
      const x = (pointer.x - this.boardContainer.x) / this.boardContainer.scaleX;
      const y = (pointer.y - this.boardContainer.y) / this.boardContainer.scaleY;
      this.pendingTile = this.board.flat().find(tile => tile && tile.sprite.active
        && !this.removingTiles.has(tile)
        && Math.abs(tile.sprite.x - x) <= 32 && Math.abs(tile.sprite.y - y) <= 32) ?? null;
      this.drawPendingOutline();
      return;
    }
    void this.remove(pos);
  }

  private drawPendingOutline(): void {
    this.pendingOutline.clear();
    if (!this.pendingTile || this.paused || this.gameOver) return;
    const board = this.settlingPreview?.board ?? this.board;
    const grid = this.settlingPreview?.grid ?? this.state.grid;
    let position: Position | null = null;
    board.forEach((row, r) => row.forEach((tile, col) => {
      if (tile === this.pendingTile) position = { row: r, col };
    }));
    if (!position) return;
    const group = findGroup(grid, position);
    if (group.length < 2) return;
    this.pendingOutline.lineStyle(2, 0xe4cfad, 0.55);
    group.forEach(({ row, col }) => {
      const sprite = board[row][col]?.sprite;
      if (sprite?.active) this.pendingOutline.strokeRoundedRect(sprite.x - 27, sprite.y - 27, 54, 54, 9);
    });
    // Newly dropped tiles may have been added above this overlay.
    this.boardContainer.bringToTop(this.pendingOutline);
  }

  private processPending(): void {
    if (this.isProcessing || this.paused || this.gameOver) return;
    // An expired timer always releases its row before another removal.
    if (this.remaining <= 0) {
      void this.dropRow();
      return;
    }
    const tile = this.pendingTile;
    this.pendingTile = null;
    this.drawPendingOutline();
    if (tile && this.board[tile.row]?.[tile.col] === tile && tile.sprite.active) {
      void this.remove({ row: tile.row, col: tile.col });
    }
  }

  private hover(pointer: Input.Pointer): void {
    this.showGroup(this.position(pointer));
  }

  private showGroup(pos: Position | null): void {
    this.highlights.forEach(sprite => sprite.destroy());
    this.highlights = [];
    if (!pos || this.isProcessing || this.paused || this.gameOver) return;
    const group = findGroup(this.state.grid, pos);
    if (group.length < 2) return;
    this.highlights = group.map(p => {
      const sprite = this.add.image(p.col * 64 + 32, p.row * 64 + 32, 'selection-highlight').setAlpha(0.75);
      this.boardContainer.add(sprite);
      return sprite;
    });
  }

  private keyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { this.togglePause(); return; }
    if (this.isProcessing || this.paused || this.gameOver) return;
    const directions: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const delta = directions[event.key];
    if (delta) {
      event.preventDefault();
      this.selected = { row: Math.max(0, Math.min(7, this.selected.row + delta[0])), col: Math.max(0, Math.min(7, this.selected.col + delta[1])) };
      this.showGroup(this.selected);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      void this.remove(this.selected);
    }
  }

  private togglePause(): void {
    if (this.isProcessing || this.gameOver) return;
    this.paused = !this.paused;
    this.showGroup(null);
    this.createHUD();
  }

  private animate(targets: GameObjects.Image[], values: object, duration: number): Promise<void> {
    if (!targets.length) return Promise.resolve();
    return new Promise(resolve => this.tweens.add({ targets, ...values, duration: this.reducedMotion ? 1 : duration, ease: 'Cubic.easeOut', onComplete: () => resolve() }));
  }

  private spinAway(targets: GameObjects.Image[], duration: number): Promise<void> {
    if (this.reducedMotion) return this.animate(targets, { alpha: 0 }, 1);
    return new Promise(resolve => {
      this.tweens.addCounter({
        from: 0, to: 1, duration, ease: 'Linear',
        onUpdate: tween => {
          const progress = tween.getValue() ?? 0;
          // Project a rotating tile onto its horizontal width: front, edge, back, edge.
          const width = Math.cos(progress * Math.PI * 2.5);
          targets.forEach(sprite => sprite.setScale(width, 1).setAlpha(1 - progress * progress));
        },
        onComplete: () => resolve()
      });
    });
  }

  private wait(duration: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(duration, resolve));
  }

  private async remove(pos: Position): Promise<void> {
    if (this.isProcessing || this.paused || this.gameOver || this.remaining <= 0) return;
    const result = clearGroup(this.state, pos);
    if (!result.removed.length) return;
    vibrate('match');
    this.isProcessing = true;
    this.showGroup(null);
    const started = this.time.now;
    this.updateHUD();
    this.removingTiles = new Set(result.removed.map(p => this.board[p.row][p.col]!));
    const survivors = result.motions.map(({ from, to }) => ({ tile: this.board[from.row][from.col]!, to }));
    const previewBoard = Array.from({ length: FALLING.rows }, () => Array<TileView | null>(FALLING.cols).fill(null));
    for (const { tile, to } of survivors) previewBoard[to.row][to.col] = tile;
    this.settlingPreview = { grid: result.state.grid, board: previewBoard };
    const removed = [...this.removingTiles].map(tile => tile.sprite);
    const turnMs = turnDuration(this.state.rowsAdded);
    await this.spinAway(removed, turnMs * 0.48);
    removed.forEach(sprite => sprite.destroy());
    await Promise.all(survivors.map(({ tile, to }) => this.animate([tile.sprite], { y: to.row * 64 + 32 }, turnMs * 0.28)));
    await Promise.all(survivors.map(({ tile, to }) => this.animate([tile.sprite], { x: to.col * 64 + 32 }, turnMs * 0.20)));
    for (const { tile, to } of survivors) Object.assign(tile, to);
    this.board = previewBoard;
    this.state = result.state;
    this.settlingPreview = null;
    // Reduced motion and short falls retain the same gameplay rate limit.
    await this.wait(Math.max(1, turnMs - (this.time.now - started)));
    this.removingTiles.clear();
    this.isProcessing = false;
    this.updateHUD();
    this.processPending();
  }

  private async dropRow(): Promise<void> {
    if (this.isProcessing || this.paused || this.gameOver) return;
    this.isProcessing = true;
    this.droppingRow = true;
    this.updateHUD();
    this.showGroup(null);
    const result = addFallingRow(this.state);
    if (result.overflow) {
      this.gameOver = true;
      this.pendingTile = null;
      this.drawPendingOutline();
      vibrate('loss');
      this.isProcessing = false;
      this.droppingRow = false;
      this.createHUD();
      const cleanup = showFallingLeaderboard(this.state.score, this.state.rowsAdded, () => this.scene.restart());
      this.events.once('shutdown', cleanup);
      return;
    }
    this.state = result.state;
    // Start the next interval when the row is released, including its fall time.
    this.remaining = rowInterval(this.state.rowsAdded);
    const tiles = result.added.map(pos => {
      const tile = this.makeTile(pos.row, pos.col, this.state.grid[pos.row][pos.col], -52);
      this.board[pos.row][pos.col] = tile;
      return tile;
    });
    await Promise.all(tiles.map(tile => this.animate([tile.sprite], { y: tile.row * 64 + 32 }, 280)));
    this.droppingRow = false;
    this.previewRow = [...this.state.nextRow];
    this.isProcessing = false;
    this.createHUD();
    this.processPending();
  }
}
