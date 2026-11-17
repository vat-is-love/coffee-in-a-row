import { installPauseMask } from '../render/pauseMask';
import { createBoardSurface } from '../render/boardSurface';
import { createHud, openGameMenu } from '../render/hud';
import { getPreferences, getStoryStars, saveStoryCheckpoint, t, vibrate } from '../../ui/preferences';
import { Scene, GameObjects, Input } from 'phaser';
import { fallingLevel, createFalling, clearAt, findRemoval, addFallingRow, rowInterval, ROW_CLEAR_ITEM, COLUMN_CLEAR_ITEM, STORY_ITEM, BUFF_TILES, turnDuration, type FallingLevel, type FallingState } from '../logic/falling';
import { isStoryMode, loadStory, storyTitle, stories, type StoryChallenge, type StoryChallengeEvent } from '../levels/story';
import type { Position } from '../logic/types';
import { showFallingLeaderboard } from '../../ui/fallingLeaderboard';
import { showStoryIntro } from '../../ui/storyIntro';
import { showStoryResult } from '../../ui/storyResult';

type TileView = Position & { sprite: GameObjects.Image };
const previewHoldMs = 150;
const powerUps = new Map((Object.keys(BUFF_TILES) as (keyof typeof BUFF_TILES)[])
  .map(name => [BUFF_TILES[name], name] as const));

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
  private remaining = 0;
  private preview: GameObjects.Image[] = [];
  private previewContainer!: GameObjects.Container;
  private previewRow: number[] = [];
  private droppingRow = false;
  private dropButton?: GameObjects.Text;
  private isProcessing = false;
  private pendingOutline!: GameObjects.Graphics;
  private settlingPreview: { grid: number[][]; board: (TileView | null)[][] } | null = null;
  private pendingTile: TileView | null = null;
  private removingTiles = new Set<TileView>();
  private briefingOpen = false;
  private syncPauseMask?: () => void;
  private gameOver = false;
  private reducedMotion = false;
  private elapsed = 0;
  private selected!: Position;
  private failed = false;
  private level!: FallingLevel;
  private story?: ReturnType<typeof loadStory>;
  private levelIndex = 0;
  private cleared = 0;
  private buffUsed = false;
  private challengeProgress = 0;
  private activeChallenge?: StoryChallenge;

  private get storyStage() { return this.story?.stages[this.levelIndex]; }
  private get requiresBuff() { return !!this.level.buffs && !this.level.delivery; }
  private get storyProgress() { return this.level.delivery ? this.state.delivered : this.cleared; }
  private get storyGoalReached() {
    const stage = this.storyStage;
    return !!stage && this.storyProgress >= stage.target && (!this.requiresBuff || this.buffUsed);
  }
  private get previewHold() { return this.level.incomingRows.previewNextRow ? previewHoldMs : 0; }
  private get boardWidth() { return this.level.board.cols * 64; }
  private get boardHeight() { return this.level.board.rows * 64; }

  constructor() { super({ key: 'FallingScene' }); }

  create({ levelIndex = 0, skipBriefing = false }: { levelIndex?: number; skipBriefing?: boolean } = {}): void {
    const mode: unknown = this.registry.get('gameMode');
    try {
      this.story = isStoryMode(mode) ? loadStory(stories[mode]) : undefined;
      this.levelIndex = levelIndex;
      this.level = this.storyStage?.level ?? fallingLevel;
      this.state = createFalling(undefined, this.level);
      this.failed = false;
    } catch (error) {
      console.error('Unable to load Falling Rows level', error);
      this.failed = true;
      window.CoffeeRecovery?.fail('invalid-falling-level');
      return;
    }
    this.remaining = rowInterval(0, this.level) + this.previewHold;
    this.previewRow = [...this.state.nextRow];
    this.droppingRow = false;
    this.selected = { row: this.level.board.rows - 1, col: 0 };
    this.isProcessing = this.briefingOpen = this.gameOver = false;
    this.cleared = 0;
    this.buffUsed = false;
    this.challengeProgress = 0;
    this.activeChallenge = isStoryMode(mode) && getStoryStars(mode, levelIndex) < 3
      ? this.storyStage?.thirdStar : undefined;
    this.elapsed = 0;
    this.pendingTile = null;
    this.settlingPreview = null;
    this.removingTiles.clear();
    this.board = [];
    this.highlights = [];
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.boardContainer = this.add.container(0, 0);
    const surface = createBoardSurface(this, this.level.board);
    this.danger = this.add.graphics();
    this.boardContainer.add([surface, this.danger]);
    this.renderBoard();
    this.pendingOutline = this.add.graphics();
    this.boardContainer.add(this.pendingOutline);
    this.syncPauseMask = installPauseMask(this, () => [this.boardContainer, this.previewContainer],
      () => !this.briefingOpen && this.sys.isPaused(),
      () => this.gameOver || this.failed, this.reducedMotion);
    this.layout();
    this.input.on('pointerup', this.click, this);
    this.input.on('pointermove', this.hover, this);
    this.input.keyboard?.on('keydown', this.keyDown, this);
    this.scale.on('resize', this.layout, this);
    this.game.events.on('language-changed', this.layout, this);
    const hideGroups = () => {
      this.showGroup(null);
      this.pendingOutline.clear();
    };
    this.events.on('pause', hideGroups);
    this.events.once('shutdown', () => {
      this.events.off('pause', hideGroups);
      this.settlingPreview = null;
      this.pendingTile = null;
      this.removingTiles.clear();
      this.input.off('pointerup', this.click, this);
      this.input.off('pointermove', this.hover, this);
      this.input.keyboard?.off('keydown', this.keyDown, this);
      this.scale.off('resize', this.layout, this);
      this.game.events.off('language-changed', this.layout, this);
    });
    const stage = this.storyStage;
    if (stage && isStoryMode(mode) && !skipBriefing) {
      this.briefingOpen = true;
      this.scene.pause();
      const cleanup = showStoryIntro(
        mode, levelIndex, stage, this.textures,
        () => {
          this.events.off('shutdown', cleanup);
          this.briefingOpen = false;
          this.scene.resume();
        }
      );
      this.events.once('shutdown', cleanup);
    }
  }

  update(_time: number, delta: number): void {
    if (this.failed) return;
    this.drawPendingOutline();
    if (this.gameOver || document.hidden) return;
    this.elapsed += delta;
    // Start the hold on the frame that first shows the complete preview.
    const floor = this.remaining > this.previewHold ? this.previewHold : 0;
    this.remaining = Math.max(floor, this.remaining - delta);
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
    const { boardWidth, boardHeight } = this;
    const { previewNextRow, allowEarlyDrop } = this.level.incomingRows;
    const available = Math.max(1, height - 196);
    const previewSpace = previewNextRow ? 84 : 0;
    const contentHeight = boardHeight + 12 + previewSpace;
    const scale = Math.min(1.15, (width - 24) / (boardWidth + 24), available / contentHeight);
    this.boardContainer.setScale(scale).setPosition(
      (width - boardWidth * scale) / 2, 126 + previewSpace * scale + (available - contentHeight * scale) / 2
    );
    this.dropButton?.destroy();
    this.dropButton = undefined;
    if (allowEarlyDrop) {
      this.dropButton = this.add.text(width / 2, this.boardContainer.y + (boardHeight + 12) * scale + 12,
        t('Drop next row ↓'), {
          fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#1a1a2e', backgroundColor: '#e8a87c'
        }).setOrigin(0.5, 0).setPadding(18, 10).setDepth(20).setInteractive({ useHandCursor: true });
      this.dropButton.on('pointerup', () => this.requestDrop());
    }
    this.createHUD();
  }

  private requestDrop(): void {
    if (this.gameOver || this.droppingRow || this.remaining <= 0) return;
    this.remaining = 0;
    this.updateHUD();
    // A request during removal is fulfilled once the board has settled.
    if (!this.isProcessing) void this.dropRow();
  }

  private createHUD(): void {
    this.hudContainer?.destroy();
    const mode: unknown = this.registry.get('gameMode');
    const title = this.story && isStoryMode(mode)
      ? `${storyTitle(mode, getPreferences().language)} · ${t('Level')} ${this.levelIndex + 1}/${this.story.stages.length}`
      : t('FALLING ROWS');
    const hud = createHud(this, title, this.gameOver ? () => this.scene.restart({ levelIndex: this.levelIndex }) : undefined);
    this.hudContainer = hud.container;
    this.scoreText = hud.score;
    this.timerText = hud.progress;
    this.statusText = hud.status;
    if (this.level.incomingRows.previewNextRow) this.createPreview();
    this.updateHUD();
  }

  private createPreview(): void {
    const { cols } = this.level.board;
    this.previewContainer?.destroy();
    const board = this.boardContainer;
    this.previewContainer = this.add.container(board.x, board.y - 84 * board.scaleY)
      .setScale(board.scaleX).setDepth(10);
    const slots = this.add.graphics();
    slots.fillStyle(0x16213e, 0.9).fillRoundedRect(0, 0, this.boardWidth, 64, 8);
    slots.lineStyle(1, 0xe4cfad, 0.35).strokeRoundedRect(0, 0, this.boardWidth, 64, 8);
    for (let col = 1; col < cols; col++) slots.lineBetween(col * 64, 0, col * 64, 64);
    this.previewContainer.add(slots);
    this.preview = this.previewRow.map((color, col) => {
      const sprite = this.add.image(col * 64 + 32, 32, `tile-${color}`).setDisplaySize(64, 64);
      this.previewContainer.add(sprite);
      return sprite;
    });
    this.syncPauseMask?.();
  }

  private updateHUD(): void {
    const { cols } = this.level.board;
    const progress = this.droppingRow ? 1 : Math.max(0, Math.min(1, 1 - (this.remaining - this.previewHold) / rowInterval(this.state.rowsAdded, this.level)));
    // Each tile materializes during its own slice of the countdown, left to right.
    this.preview.forEach((sprite, col) => sprite.setAlpha(Math.max(0, Math.min(1, progress * cols - col))));
    this.dropButton?.setAlpha(this.gameOver || this.droppingRow || this.remaining <= 0 ? 0.45 : 1);
    const stage = this.storyStage;
    const buffProgress = this.requiresBuff ? ` · ${t('Buffs used')}: ${Number(this.buffUsed)} / 1` : '';
    const displayedProgress = stage && (!this.requiresBuff || this.buffUsed)
      ? Math.min(this.storyProgress, stage.target) : this.storyProgress;
    this.scoreText.setText(stage
      ? `${t(this.level.delivery ? 'Items delivered' : 'Tiles cleared')}: ${displayedProgress} / ${stage.target}${buffProgress}`
      : `${t('Score')}: ${this.state.score} · ${t('Rows')}: ${this.state.rowsAdded}`);
    this.timerText.setText(stage && this.gameOver ? '' : `${t('Next row')}: ${(this.remaining / 1000).toFixed(1)}s`);
    const [top, second] = this.state.grid;
    const danger = top.some(color => color >= 0) || second.some(color => color >= 0);
    this.danger.clear();
    if (danger) this.danger.fillStyle(0xe74c3c, 0.12 + Math.sin(this.elapsed / 300) * 0.04).fillRect(0, 0, this.boardWidth, 128);
    this.timerText.setColor(danger || this.remaining < 2000 ? '#ffb49f' : '#f5f0e8');
    const buffs = this.level.buffs?.types;
    const hint = this.level.delivery ? 'Clear tiles beneath items to deliver them' :
      buffs?.includes('bomb') ? 'Lightning clears lines · Bombs clear nearby tiles' :
      buffs?.includes('vertical') ? 'Tap lightning to clear its row or column' :
      buffs ? 'Tap the lightning tile to clear its row' : 'Tap groups of 2+ · Empty columns move to center';
    this.statusText.setText(this.storyGoalReached ? '' : this.gameOver ? t('Board full · Restart to try again') : this.isProcessing ? t('Settling…') : danger ? t('Nearly full! Clear space for the next row') : t(hint));
  }

  private position(pointer: Input.Pointer): Position | null {
    const { rows, cols } = this.level.board;
    const col = Math.floor((pointer.x - this.boardContainer.x) / this.boardContainer.scaleX / 64);
    const row = Math.floor((pointer.y - this.boardContainer.y) / this.boardContainer.scaleY / 64);
    return row >= 0 && row < rows && col >= 0 && col < cols ? { row, col } : null;
  }

  private click(pointer: Input.Pointer): void {
    const pos = this.position(pointer);
    if (!pos || this.gameOver) return;
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
    if (!this.pendingTile || this.gameOver) return;
    const board = this.settlingPreview?.board ?? this.board;
    const grid = this.settlingPreview?.grid ?? this.state.grid;
    let position: Position | null = null;
    board.forEach((row, r) => row.forEach((tile, col) => {
      if (tile === this.pendingTile) position = { row: r, col };
    }));
    if (!position) return;
    const removal = findRemoval(grid, position);
    if (!removal.length) return;
    this.pendingOutline.lineStyle(2, 0xe4cfad, 0.55);
    removal.forEach(({ row, col }) => {
      const sprite = board[row][col]?.sprite;
      if (sprite?.active) this.pendingOutline.strokeRoundedRect(sprite.x - 27, sprite.y - 27, 54, 54, 9);
    });
    // Newly dropped tiles may have been added above this overlay.
    this.boardContainer.bringToTop(this.pendingOutline);
  }

  private processPending(): void {
    if (this.isProcessing || this.gameOver) return;
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
    if (!pos || this.isProcessing || this.gameOver) return;
    this.highlights = findRemoval(this.state.grid, pos).map(p => {
      const sprite = this.add.image(p.col * 64 + 32, p.row * 64 + 32, 'selection-highlight').setAlpha(0.75);
      this.boardContainer.add(sprite);
      return sprite;
    });
  }

  private keyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); openGameMenu(); return; }
    if (this.isProcessing || this.gameOver) return;
    const directions: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const delta = directions[event.key];
    if (delta) {
      const { rows, cols } = this.level.board;
      event.preventDefault();
      this.selected = { row: Math.max(0, Math.min(rows - 1, this.selected.row + delta[0])), col: Math.max(0, Math.min(cols - 1, this.selected.col + delta[1])) };
      this.showGroup(this.selected);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      void this.remove(this.selected);
    }
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

  private advanceChallenge(event: StoryChallengeEvent): void {
    this.challengeProgress = this.activeChallenge?.advance?.(this.challengeProgress, event) ?? this.challengeProgress;
  }

  private async remove(pos: Position): Promise<void> {
    if (this.isProcessing || this.gameOver || this.remaining <= 0) return;
    const result = clearAt(this.state, pos);
    if (!result.removed.length) return;
    const activated = this.state.grid[pos.row][pos.col];
    const rowClear = activated === ROW_CLEAR_ITEM;
    const columnClear = activated === COLUMN_CLEAR_ITEM;
    const removedTiles = result.removed.map(({ row, col }) => this.state.grid[row][col]);
    const tilesCleared = removedTiles.filter(tile => tile < STORY_ITEM).length;
    if (this.activeChallenge?.advance) {
      this.advanceChallenge({
        type: 'clear',
        grid: result.state.grid,
        count: removedTiles.length,
        clearedTiles: tilesCleared,
        color: activated < STORY_ITEM ? activated : undefined,
        powerUp: powerUps.get(activated),
        removedPowerUps: removedTiles.flatMap(tile => powerUps.get(tile) ?? []),
        destroyedItems: removedTiles.filter(tile => tile === STORY_ITEM).length,
        deliveredItems: result.deliveries.length
      });
    }
    vibrate('match');
    this.isProcessing = true;
    this.showGroup(null);
    const started = this.time.now;
    this.updateHUD();
    const removed = result.removed.map(p => this.board[p.row][p.col]!);
    const deliveries = result.deliveries.map(({ from, to }) => ({ tile: this.board[from.row][from.col]!, to }));
    this.removingTiles = new Set([...removed, ...deliveries.map(({ tile }) => tile)]);
    const survivors = result.motions.map(({ from, to }) => ({ tile: this.board[from.row][from.col]!, to }));
    const slide = !rowClear || survivors.some(({ tile, to }) => tile.col !== to.col);
    const { rows, cols } = this.level.board;
    const previewBoard = Array.from({ length: rows }, () => Array<TileView | null>(cols).fill(null));
    for (const { tile, to } of survivors) previewBoard[to.row][to.col] = tile;
    this.settlingPreview = { grid: result.state.grid, board: previewBoard };
    const turnMs = turnDuration(this.state.rowsAdded, this.level);
    if ((rowClear || columnClear) && !this.reducedMotion) {
      const axis = rowClear ? 'col' : 'row';
      const step = turnMs * 0.30 / Math.max(1, (rowClear ? cols : rows) - 1);
      await Promise.all(removed.map(tile => this.animate([tile.sprite], {
        alpha: 0, scaleX: 0.25, scaleY: 0.25, delay: Math.abs(tile[axis] - pos[axis]) * step
      }, turnMs * 0.18)));
    } else {
      await this.spinAway(removed.map(tile => tile.sprite), turnMs * 0.48);
    }
    removed.forEach(tile => tile.sprite.destroy());
    await Promise.all([...survivors, ...deliveries].map(({ tile, to }) => this.animate([tile.sprite], { y: to.row * 64 + 32 }, turnMs * (slide ? 0.28 : 0.48))));
    const deliveredSprites = deliveries.map(({ tile }) => tile.sprite);
    await Promise.all([
      ...(slide ? survivors.map(({ tile, to }) => this.animate([tile.sprite], { x: to.col * 64 + 32 }, turnMs * 0.20)) : []),
      this.animate(deliveredSprites, { alpha: 0 }, turnMs * 0.20)
    ]);
    deliveredSprites.forEach(sprite => sprite.destroy());
    for (const { tile, to } of survivors) Object.assign(tile, to);
    this.board = previewBoard;
    this.state = result.state;
    this.settlingPreview = null;
    // Reduced motion and short falls retain the same gameplay rate limit.
    await this.wait(Math.max(1, turnMs - (this.time.now - started)));
    this.removingTiles.clear();
    if (this.storyStage && !this.level.delivery) {
      this.cleared += tilesCleared;
      if (activated > STORY_ITEM) this.buffUsed = true;
    }
    this.isProcessing = false;
    if (this.finishStoryStage()) return;
    this.updateHUD();
    this.processPending();
  }

  private finishStoryStage(): boolean {
    const mode: unknown = this.registry.get('gameMode');
    if (!this.story || !this.storyGoalReached || !isStoryMode(mode)) return false;
    const next = this.levelIndex + 1;
    const finished = next === this.story.stages.length;
    const earnedThirdStar = this.activeChallenge?.qualifies(this.state.grid, this.challengeProgress) === true;
    saveStoryCheckpoint(mode, next, earnedThirdStar);
    this.gameOver = true;
    this.pendingTile = null;
    this.updateHUD();
    const messages = this.story.messages[getPreferences().language];
    const details = earnedThirdStar ? document.createElement('p') : undefined;
    if (details) details.textContent = t('Third star earned!');
    const cleanup = showStoryResult(
      finished ? messages.victory : messages.levelComplete,
      finished ? messages.restart : messages.continue,
      () => this.scene.restart({ levelIndex: finished ? 0 : next }),
      {
        details,
        victory: finished ? { messages, chooseMode: mode => this.game.events.emit('select-mode-after-story', mode) } : undefined
      }
    );
    this.events.once('shutdown', cleanup);
    return true;
  }

  private async dropRow(): Promise<void> {
    if (this.isProcessing || this.gameOver) return;
    this.isProcessing = true;
    this.droppingRow = true;
    this.updateHUD();
    this.showGroup(null);
    const result = addFallingRow(this.state, this.level);
    if (result.overflow) {
      this.gameOver = true;
      this.pendingTile = null;
      this.drawPendingOutline();
      vibrate('loss');
      this.isProcessing = false;
      this.droppingRow = false;
      this.createHUD();
      const cleanup = this.storyStage
        ? showStoryResult(t('Board full'), t('Retry level'), () => this.scene.restart({ levelIndex: this.levelIndex }))
        : showFallingLeaderboard(this.state.score, this.state.rowsAdded, () => this.scene.restart());
      this.events.once('shutdown', cleanup);
      return;
    }
    const { nextRow: incoming, grid, delivered } = this.state;
    this.advanceChallenge({
      type: 'beforeDrop',
      hasAvailableMove: () => grid.some((cells, row) =>
        cells.some((tile, col) => tile >= 0 && findRemoval(grid, { row, col }).length > 0))
    });
    this.state = { ...result.state, grid: grid.map(row => [...row]), delivered };
    // Start the next interval when the row is released, including its fall time.
    this.remaining = rowInterval(this.state.rowsAdded, this.level) + this.previewHold;
    const tiles = result.added.map(pos => {
      const tile = this.makeTile(pos.row, pos.col, incoming[pos.col], -52);
      this.state.grid[pos.row][pos.col] = incoming[pos.col];
      this.board[pos.row][pos.col] = tile;
      return tile;
    });
    const deliveries = result.deliveries.map(({ from }) => this.board[from.row][from.col]!);
    this.removingTiles = new Set(deliveries);
    const animations = tiles.map(tile => this.animate([tile.sprite], { y: tile.row * 64 + 32 }, 280));
    if (result.buff) {
      const { row, col, tile } = result.buff;
      const view = this.board[row][col]!;
      const flipToBuff = () => {
        if (this.pendingTile === view) this.pendingTile = null;
        this.state.grid[row][col] = tile;
        view.sprite.setTexture(`tile-${tile}`);
      };
      if (this.reducedMotion) flipToBuff();
      else animations.push(this.animate([view.sprite], { scaleX: 0, yoyo: true, onYoyo: flipToBuff }, 100));
    }
    await Promise.all(animations);
    const board = this.board.map(row => row.map((): TileView | null => null));
    const survivors = result.motions.map(({ from, to }) => {
      const tile = this.board[from.row][from.col]!;
      board[to.row][to.col] = tile;
      return { tile, to };
    });
    this.settlingPreview = { grid: result.state.grid, board };
    await Promise.all([
      this.animate(deliveries.map(tile => tile.sprite), { alpha: 0 }, 100),
      ...survivors.filter(({ tile, to }) => tile.col !== to.col).map(({ tile, to }) =>
        this.animate([tile.sprite], { x: to.col * 64 + 32 }, 100))
    ]);
    deliveries.forEach(tile => tile.sprite.destroy());
    for (const { tile, to } of survivors) Object.assign(tile, to);
    this.board = board;
    this.state = result.state;
    this.settlingPreview = null;
    this.removingTiles.clear();
    this.droppingRow = false;
    this.previewRow = [...this.state.nextRow];
    this.isProcessing = false;
    this.createHUD();
    if (this.finishStoryStage()) return;
    this.processPending();
  }
}
