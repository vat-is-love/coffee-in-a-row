/**
 * GameScene - Основная игровая сцена с доской Match-3
 */

import { Scene, GameObjects, Input, Math as PhaserMath } from 'phaser';

// Типы для игровой логики
type TileType = 0 | 1 | 2 | 3 | 4 | 5;
type TileTypeOrEmpty = TileType | -1;
type SnowLayer = 0 | 1 | 2;

interface TileData {
  row: number;
  col: number;
  type: TileTypeOrEmpty;
  snow: SnowLayer;
  sprite: GameObjects.Image | null;
  snowSprite: GameObjects.Image | null;
}

interface BoardConfig {
  rows: number;
  cols: number;
  tileTypes: number;
  maxMoves: number;
  snow: Array<{ row: number; col: number; layers: SnowLayer }>;
}

const DEFAULT_CONFIG: BoardConfig = {
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

const TILE_SIZE = 64;
const TILE_SPACING = 4;
const BOARD_PADDING = 20;

export class GameScene extends Scene {
  private board: TileData[][] = [];
  private config: BoardConfig = DEFAULT_CONFIG;
  private selectedTile: TileData | null = null;
  private movesLeft: number = 0;
  private score: number = 0;
  private isProcessing: boolean = false;
  private rngSeed: number = Date.now();

  // HUD элементы
  private movesText!: GameObjects.Text;
  private scoreText!: GameObjects.Text;
  private levelText!: GameObjects.Text;
  private snowRemainingText!: GameObjects.Text;

  // Контейнеры
  private boardContainer!: GameObjects.Container;
  private hudContainer!: GameObjects.Container;

  constructor() {
    super({ key: 'GameScene', active: false });
  }

  create(): void {
    const { width, height } = this.scale;

    // Фон
    this.createBackground(width, height);

    // Инициализация конфигурации уровня
    this.initLevel();

    // Создание HUD
    this.createHUD(width, height);

    // Создание игровой доски
    this.createBoard(width, height);

    // Настройка ввода
    this.setupInput();

    // Генерация начальной доски
    this.generateBoard();
    this.renderBoard();
  }

  private createBackground(width: number, _height: number): void {
    // Градиентный фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    bg.fillRect(0, 0, width, this.scale.height);

    // Декоративные снежинки
    this.createSnowflakes(width, this.scale.height);
  }

  private createSnowflakes(width: number, height: number): void {
    for (let i = 0; i < 30; i++) {
      const x = PhaserMath.Between(0, width);
      const y = PhaserMath.Between(0, height);
      const size = PhaserMath.Between(2, 6);
      const alpha = PhaserMath.FloatBetween(0.1, 0.4);

      const flake = this.add.graphics();
      flake.fillStyle(0xffffff, alpha);
      flake.fillCircle(0, 0, size);
      flake.setPosition(x, y);

      // Анимация падения
      this.tweens.add({
        targets: flake,
        y: height + 50,
        x: x + PhaserMath.Between(-50, 50),
        duration: PhaserMath.Between(10000, 20000),
        repeat: -1,
        delay: PhaserMath.Between(0, 10000),
        ease: 'Sine.easeInOut',
        onRepeat: () => {
          flake.setPosition(PhaserMath.Between(0, width), -50);
        }
      });
    }
  }

  private initLevel(): void {
    // Уровень 1 конфигурация
    this.config = { ...DEFAULT_CONFIG };
    this.movesLeft = this.config.maxMoves;
    this.score = 0;
    this.rngSeed = 12345; // Фиксированный seed для воспроизводимости
  }

  private createHUD(width: number, _height: number): void {
    this.hudContainer = this.add.container(0, 0);

    // Панель HUD сверху
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x16213e, 0.9);
    hudBg.fillRoundedRect(10, 10, width - 20, 100, 12);
    hudBg.lineStyle(2, 0x6f4e37, 1);
    hudBg.strokeRoundedRect(10, 10, width - 20, 100, 12);
    this.hudContainer.add(hudBg);

    // Уровень
    this.levelText = this.add.text(30, 25, 'УРОВЕНЬ 1', {
      fontFamily: 'Fredoka One, Nunito, cursive',
      fontSize: '24px',
      color: '#e8a87c',
      stroke: '#6f4e37',
      strokeThickness: 3
    });
    this.hudContainer.add(this.levelText);

    // Ходы
    this.movesText = this.add.text(width - 30, 25, `ХОДЫ: ${this.movesLeft}`, {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '20px',
      color: '#f5f0e8',
      fontStyle: 'bold'
    }).setOrigin(1, 0);
    this.hudContainer.add(this.movesText);

    // Счёт
    this.scoreText = this.add.text(30, 65, `СЧЁТ: ${this.score}`, {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '20px',
      color: '#f5f0e8'
    });
    this.hudContainer.add(this.scoreText);

    // Оставшийся снег
    const snowCount = this.config.snow.reduce((sum, s) => sum + s.layers, 0);
    this.snowRemainingText = this.add.text(width - 30, 65, `СНЕГ: ${snowCount}`, {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(1, 0);
    this.hudContainer.add(this.snowRemainingText);

    // Кнопка паузы
    this.createPauseButton(width);
  }

  private createPauseButton(width: number): void {
    const pauseBtn = this.add.container(width - 60, 30);
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x6f4e37, 1);
    btnBg.fillRoundedRect(-20, -20, 40, 40, 8);
    btnBg.lineStyle(2, 0x8b6914, 1);
    btnBg.strokeRoundedRect(-20, -20, 40, 40, 8);

    const pauseIcon = this.add.graphics();
    pauseIcon.lineStyle(3, 0xe8a87c, 1);
    pauseIcon.beginPath();
    pauseIcon.moveTo(-6, -10);
    pauseIcon.lineTo(-6, 10);
    pauseIcon.moveTo(6, -10);
    pauseIcon.lineTo(6, 10);
    pauseIcon.strokePath();

    pauseBtn.add([btnBg, pauseIcon]);
    pauseBtn.setSize(40, 40);
    pauseBtn.setInteractive(new Phaser.Geom.Rectangle(-20, -20, 40, 40), Phaser.Geom.Rectangle.Contains);

    pauseBtn.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x8b6914, 1);
      btnBg.fillRoundedRect(-20, -20, 40, 40, 8);
      btnBg.lineStyle(2, 0xe8a87c, 1);
      btnBg.strokeRoundedRect(-20, -20, 40, 40, 8);
    });

    pauseBtn.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x6f4e37, 1);
      btnBg.fillRoundedRect(-20, -20, 40, 40, 8);
      btnBg.lineStyle(2, 0x8b6914, 1);
      btnBg.strokeRoundedRect(-20, -20, 40, 40, 8);
    });

    pauseBtn.on('pointerdown', () => this.showPauseMenu());
    this.hudContainer.add(pauseBtn);
  }

  private createBoard(width: number, height: number): void {
    const boardWidth = this.config.cols * (TILE_SIZE + TILE_SPACING) - TILE_SPACING;
    const boardHeight = this.config.rows * (TILE_SIZE + TILE_SPACING) - TILE_SPACING;
    const startX = (width - boardWidth) / 2;
    const startY = (height - boardHeight) / 2 + 20; // Смещение вниз для HUD

    this.boardContainer = this.add.container(startX, startY);

    // Фон доски
    const boardBg = this.add.graphics();
    boardBg.fillStyle(0x0d0d1a, 1);
    boardBg.fillRoundedRect(
      -BOARD_PADDING,
      -BOARD_PADDING,
      boardWidth + BOARD_PADDING * 2,
      boardHeight + BOARD_PADDING * 2,
      16
    );
    boardBg.lineStyle(3, 0x6f4e37, 1);
    boardBg.strokeRoundedRect(
      -BOARD_PADDING,
      -BOARD_PADDING,
      boardWidth + BOARD_PADDING * 2,
      boardHeight + BOARD_PADDING * 2,
      16
    );
    this.boardContainer.add(boardBg);

    // Инициализация массива доски
    this.board = [];
    for (let row = 0; row < this.config.rows; row++) {
      this.board[row] = [];
      for (let col = 0; col < this.config.cols; col++) {
        this.board[row][col] = {
          row,
          col,
          type: 0,
          snow: 0,
          sprite: null,
          snowSprite: null
        };
      }
    }

    // Применение снега из конфигурации
    for (const snowCell of this.config.snow) {
      if (snowCell.row < this.config.rows && snowCell.col < this.config.cols) {
        this.board[snowCell.row][snowCell.col].snow = snowCell.layers;
      }
    }
  }

  private setupInput(): void {
    // Ввод обрабатывается через события тайлов
    this.input.on('pointerdown', (pointer: Input.Pointer) => {
      if (!this.isProcessing) {
        this.handlePointerDown(pointer);
      }
    });
  }

  private handlePointerDown(pointer: Input.Pointer): void {
    // Определение тайла под курсором
    const tile = this.getTileAtPosition(pointer.x, pointer.y);
    if (tile) {
      this.onTileSelected(tile);
    }
  }

  private getTileAtPosition(x: number, y: number): TileData | null {
    // Простое преобразование координат (для идеального решения нужна матрица)
    const boardX = x - this.boardContainer.x;
    const boardY = y - this.boardContainer.y;

    const col = Math.floor(boardX / (TILE_SIZE + TILE_SPACING));
    const row = Math.floor(boardY / (TILE_SIZE + TILE_SPACING));

    if (row >= 0 && row < this.config.rows && col >= 0 && col < this.config.cols) {
      return this.board[row][col];
    }
    return null;
  }

  private onTileSelected(tile: TileData): void {
    if (this.selectedTile === null) {
      // Первый выбор
      this.selectedTile = tile;
      this.showSelectionHighlight(tile);
    } else if (this.selectedTile === tile) {
      // Клик по тому же тайлу - отмена выбора
      this.clearSelection();
    } else if (this.areAdjacent(this.selectedTile, tile)) {
      // Соседние тайлы - попытка обмена
      this.attemptSwap(this.selectedTile, tile);
    } else {
      // Другой тайл - меняем выбор
      this.clearSelection();
      this.selectedTile = tile;
      this.showSelectionHighlight(tile);
    }
  }

  private areAdjacent(tile1: TileData, tile2: TileData): boolean {
    const dr = Math.abs(tile1.row - tile2.row);
    const dc = Math.abs(tile1.col - tile2.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  private showSelectionHighlight(tile: TileData): void {
    if (tile.sprite) {
      const highlight = this.add.image(tile.sprite.x, tile.sprite.y, 'selection-highlight');
      highlight.setDepth(10);
      tile.sprite.setData('highlight', highlight);
      this.boardContainer.add(highlight);

      // Пульсация
      this.tweens.add({
        targets: highlight,
        scale: { from: 1, to: 1.1 },
        alpha: { from: 1, to: 0.7 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  private clearSelection(): void {
    if (this.selectedTile?.sprite) {
      const highlight = this.selectedTile.sprite.getData('highlight');
      if (highlight) {
        this.tweens.killTweensOf(highlight);
        highlight.destroy();
        this.selectedTile.sprite.setData('highlight', null);
      }
    }
    this.selectedTile = null;
  }

  private attemptSwap(tile1: TileData, tile2: TileData): void {
    this.clearSelection();
    this.isProcessing = true;

    // Анимация обмена
    this.animateSwap(tile1, tile2, () => {
      // Проверка на совпадения после обмена
      const matches = this.findMatches();

      if (matches.length > 0) {
        // Успешный ход
        this.movesLeft--;
        this.updateMovesDisplay();
        this.resolveMatches(matches);
      } else {
        // Неудачный обмен - возврат
        this.animateSwap(tile2, tile1, () => {
          this.showInvalidSwapFeedback(tile1, tile2);
          this.isProcessing = false;
        });
      }
    });
  }

  private animateSwap(tile1: TileData, tile2: TileData, callback: () => void): void {
    if (!tile1.sprite || !tile2.sprite) {
      callback();
      return;
    }

    const pos1 = { x: tile1.sprite.x, y: tile1.sprite.y };
    const pos2 = { x: tile2.sprite.x, y: tile2.sprite.y };

    // Обмен спрайтов в данных
    [tile1.sprite, tile2.sprite] = [tile2.sprite, tile1.sprite];
    [tile1.snowSprite, tile2.snowSprite] = [tile2.snowSprite, tile1.snowSprite];
    [tile1.row, tile2.row] = [tile2.row, tile1.row];
    [tile1.col, tile2.col] = [tile2.col, tile1.col];

    // Обновление массива доски
    this.board[tile1.row][tile1.col] = tile1;
    this.board[tile2.row][tile2.col] = tile2;

    // Анимация движения
    this.tweens.add({
      targets: tile1.sprite,
      x: pos1.x,
      y: pos1.y,
      duration: 200,
      ease: 'Cubic.easeOut'
    });

    if (tile1.snowSprite) {
      this.tweens.add({
        targets: tile1.snowSprite,
        x: pos1.x,
        y: pos1.y,
        duration: 200,
        ease: 'Cubic.easeOut'
      });
    }

    this.tweens.add({
      targets: tile2.sprite,
      x: pos2.x,
      y: pos2.y,
      duration: 200,
      ease: 'Cubic.easeOut',
      onComplete: callback
    });

    if (tile2.snowSprite) {
      this.tweens.add({
        targets: tile2.snowSprite,
        x: pos2.x,
        y: pos2.y,
        duration: 200,
        ease: 'Cubic.easeOut'
      });
    }
  }

  private showInvalidSwapFeedback(tile1: TileData, tile2: TileData): void {
    if (!tile1.sprite || !tile2.sprite) return;

    // Красный крестик между тайлами
    const midX = (tile1.sprite.x + tile2.sprite.x) / 2;
    const midY = (tile1.sprite.y + tile2.sprite.y) / 2;

    const invalid = this.add.image(midX, midY, 'invalid-swap');
    invalid.setDepth(20);
    this.boardContainer.add(invalid);

    // Встряска тайлов
    this.tweens.add({
      targets: [tile1.sprite, tile2.sprite],
      x: '+=5',
      duration: 50,
      yoyo: true,
      repeat: 3,
      ease: 'Cubic.easeOut'
    });

    this.tweens.add({
      targets: invalid,
      scale: { from: 0.5, to: 1.2 },
      alpha: { from: 1, to: 0 },
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => invalid.destroy()
    });
  }

  private findMatches(): Array<{ tiles: TileData[]; direction: 'horizontal' | 'vertical' }> {
    const matches: Array<{ tiles: TileData[]; direction: 'horizontal' | 'vertical' }> = [];

    // Горизонтальные совпадения
    for (let row = 0; row < this.config.rows; row++) {
      let matchStart = 0;
      for (let col = 1; col <= this.config.cols; col++) {
        if (col < this.config.cols &&
            this.board[row][col].type === this.board[row][matchStart].type &&
            this.board[row][col].type !== -1) {
          continue;
        }

        const matchLength = col - matchStart;
        if (matchLength >= 3) {
          const tiles: TileData[] = [];
          for (let c = matchStart; c < col; c++) {
            tiles.push(this.board[row][c]);
          }
          matches.push({ tiles, direction: 'horizontal' });
        }
        matchStart = col;
      }
    }

    // Вертикальные совпадения
    for (let col = 0; col < this.config.cols; col++) {
      let matchStart = 0;
      for (let row = 1; row <= this.config.rows; row++) {
        if (row < this.config.rows &&
            this.board[row][col].type === this.board[matchStart][col].type &&
            this.board[row][col].type !== -1) {
          continue;
        }

        const matchLength = row - matchStart;
        if (matchLength >= 3) {
          const tiles: TileData[] = [];
          for (let r = matchStart; r < row; r++) {
            tiles.push(this.board[r][col]);
          }
          matches.push({ tiles, direction: 'vertical' });
        }
        matchStart = row;
      }
    }

    return matches;
  }

  private resolveMatches(matches: Array<{ tiles: TileData[]; direction: 'horizontal' | 'vertical' }>): void {
    // Собираем все уникальные тайлы для удаления
    const tilesToClear = new Set<TileData>();
    let snowCleared = 0;
    let tilesCleared = 0;

    for (const match of matches) {
      for (const tile of match.tiles) {
        if (!tilesToClear.has(tile)) {
          tilesToClear.add(tile);
          tilesCleared++;
          if (tile.snow > 0) {
            snowCleared += tile.snow;
            tile.snow = 0;
          }
        }
      }
    }

    // Подсчёт очков
    const basePoints = tilesCleared * 100;
    const snowPoints = snowCleared * 150;
    this.score += basePoints + snowPoints;
    this.updateScoreDisplay();

    // Анимация удаления
    this.animateClear(Array.from(tilesToClear), () => {
      // Гравитация и заполнение
      this.applyGravityAndRefill(() => {
        // Проверка каскадов
        const newMatches = this.findMatches();
        if (newMatches.length > 0) {
          this.resolveMatches(newMatches);
        } else {
          this.checkGameState();
        }
      });
    });
  }

  private animateClear(tiles: TileData[], callback: () => void): void {
    let completed = 0;
    const total = tiles.length;

    if (total === 0) {
      callback();
      return;
    }

    for (const tile of tiles) {
      if (tile.sprite) {
        // Эффект вспышки
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 1);
        flash.fillCircle(tile.sprite.x, tile.sprite.y, TILE_SIZE / 2);
        this.boardContainer.add(flash);

        this.tweens.add({
          targets: [tile.sprite, tile.snowSprite, flash],
          scale: { from: 1, to: 0 },
          alpha: { from: 1, to: 0 },
          duration: 200,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            tile.sprite?.destroy();
            tile.snowSprite?.destroy();
            flash.destroy();
            tile.sprite = null;
            tile.snowSprite = null;
            tile.type = -1; // Помечаем как пустой
            completed++;
            if (completed === total) callback();
          }
        });

        // Частицы снега если был снег
        if (tile.snow > 0) {
          this.createSnowParticles(tile.sprite.x, tile.sprite.y);
        }
      } else {
        completed++;
        if (completed === total) callback();
      }
    }
  }

  private createSnowParticles(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const particle = this.add.image(x, y, 'snow-particle');
      this.boardContainer.add(particle);

      const angle = (i / 8) * Math.PI * 2;
      const distance = PhaserMath.Between(30, 60);
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;

      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0.3 },
        duration: 400,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  private applyGravityAndRefill(callback: () => void): void {
    let columnsToProcess = 0;
    let columnsCompleted = 0;

    for (let col = 0; col < this.config.cols; col++) {
      let writeRow = this.config.rows - 1;
      let hasEmpty = false;

      // Сдвиг тайлов вниз
      for (let row = this.config.rows - 1; row >= 0; row--) {
        const tile = this.board[row][col];
        if (tile.type !== -1) {
          if (row !== writeRow) {
            // Перемещение тайла
            this.board[writeRow][col] = tile;
            this.board[row][col] = {
              row,
              col,
              type: -1,
              snow: 0,
              sprite: null,
              snowSprite: null
            };
            tile.row = writeRow;
            hasEmpty = true;
          }
          writeRow--;
        } else {
          hasEmpty = true;
        }
      }

      // Заполнение пустых клеток новыми тайлами
      if (hasEmpty) {
        columnsToProcess++;
        for (let row = writeRow; row >= 0; row--) {
          const newType = this.randomTileType() as TileType;
          const newTile: TileData = {
            row,
            col,
            type: newType,
            snow: 0,
            sprite: null,
            snowSprite: null
          };
          this.board[row][col] = newTile;
        }
      }
    }

    if (columnsToProcess === 0) {
      callback();
      return;
    }

    // Перерисовка доски с анимацией падения
    this.renderBoardWithFallAnimation(() => {
      columnsCompleted++;
      if (columnsCompleted >= columnsToProcess) {
        callback();
      }
    });
  }

  private renderBoardWithFallAnimation(callback: () => void): void {
    let animated = 0;
    let totalAnimated = 0;

    // Подсчёт анимируемых тайлов
    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        const tile = this.board[row][col];
        if (tile.type !== -1 && (!tile.sprite || tile.sprite.y !== this.getTileY(row))) {
          totalAnimated++;
        }
      }
    }

    if (totalAnimated === 0) {
      this.renderBoard();
      callback();
      return;
    }

    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        const tile = this.board[row][col];
        if (tile.type !== -1) {
          const targetX = this.getTileX(col);
          const targetY = this.getTileY(row);

          if (!tile.sprite) {
            // Новый тайл - создаём сверху
            this.createTileSprite(tile, targetX, targetY - 200);
            this.tweens.add({
              targets: tile.sprite,
              y: targetY,
              duration: 300,
              ease: 'Bounce.easeOut',
              onComplete: () => {
                animated++;
                if (animated >= totalAnimated) callback();
              }
            });
            if (tile.snowSprite) {
              this.tweens.add({
                targets: tile.snowSprite,
                y: targetY,
                duration: 300,
                ease: 'Bounce.easeOut'
              });
            }
          } else if (tile.sprite.y !== targetY || tile.sprite.x !== targetX) {
            // Существующий тайл - анимируем перемещение
            this.tweens.add({
              targets: tile.sprite,
              x: targetX,
              y: targetY,
              duration: 300,
              ease: 'Cubic.easeOut',
              onComplete: () => {
                animated++;
                if (animated >= totalAnimated) callback();
              }
            });
            if (tile.snowSprite) {
              this.tweens.add({
                targets: tile.snowSprite,
                x: targetX,
                y: targetY,
                duration: 300,
                ease: 'Cubic.easeOut'
              });
            }
          }
        }
      }
    }
  }

  private checkGameState(): void {
    const snowRemaining = this.getSnowRemaining();

    // Проверка победы
    if (snowRemaining === 0) {
      this.onVictory();
      return;
    }

    // Проверка ходов
    if (this.movesLeft <= 0) {
      this.onDefeat();
      return;
    }

    // Проверка возможных ходов
    if (!this.hasValidMoves()) {
      this.reshuffleBoard();
      return;
    }

    this.isProcessing = false;
  }

  private getSnowRemaining(): number {
    let count = 0;
    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        count += this.board[row][col].snow;
      }
    }
    return count;
  }

  private hasValidMoves(): boolean {
    // Проверка всех возможных обменов
    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        // Проверка вправо
        if (col + 1 < this.config.cols) {
          if (this.wouldCreateMatch(row, col, row, col + 1)) return true;
        }
        // Проверка вниз
        if (row + 1 < this.config.rows) {
          if (this.wouldCreateMatch(row, col, row + 1, col)) return true;
        }
      }
    }
    return false;
  }

  private wouldCreateMatch(r1: number, c1: number, r2: number, c2: number): boolean {
    // Временно меняем местами
    const t1 = this.board[r1][c1];
    const t2 = this.board[r2][c2];
    const type1 = t1.type;
    const type2 = t2.type;

    t1.type = type2;
    t2.type = type1;

    const matches = this.findMatches();

    // Возвращаем обратно
    t1.type = type1;
    t2.type = type2;

    return matches.length > 0;
  }

  private reshuffleBoard(): void {
    // Показать уведомление о перемешивании
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2, 'НЕТ ХОДОВ\nПЕРЕМЕШИВАНИЕ...', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '32px',
      color: '#e8a87c',
      stroke: '#6f4e37',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: text,
      alpha: { from: 0, to: 1 },
      duration: 300,
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          this.tweens.add({
            targets: text,
            alpha: { from: 1, to: 0 },
            duration: 300,
            onComplete: () => {
              text.destroy();
              this.shuffleBoard();
              this.renderBoard();
              this.isProcessing = false;
            }
          });
        });
      }
    });
  }

  private shuffleBoard(): void {
    // Собираем все типы тайлов
    const tileTypes: TileTypeOrEmpty[] = [];
    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        if (this.board[row][col].type !== -1) {
          tileTypes.push(this.board[row][col].type);
        }
      }
    }

    // Перемешиваем (Fisher-Yates)
    for (let i = tileTypes.length - 1; i > 0; i--) {
      const j = this.randomInt(i + 1);
      [tileTypes[i], tileTypes[j]] = [tileTypes[j], tileTypes[i]];
    }

    // Размещаем обратно, сохраняя снег
    let idx = 0;
    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        if (this.board[row][col].type !== -1) {
          this.board[row][col].type = tileTypes[idx++];
        }
      }
    }

    // Убеждаемся, что нет случайных совпадений и есть хотя бы один ход
    let attempts = 0;
    while ((this.findMatches().length > 0 || !this.hasValidMoves()) && attempts < 10) {
      this.shuffleBoard();
      attempts++;
    }
  }

  private onVictory(): void {
    const bonus = this.movesLeft * 100;
    this.score += bonus;

    this.showResultScreen('ПОБЕДА!', `Бонус за ходы: +${bonus}`, true);
  }

  private onDefeat(): void {
    this.showResultScreen('ПОРАЖЕНИЕ', 'Ходы закончились', false);
  }

  private showResultScreen(title: string, subtitle: string, isVictory: boolean): void {
    const { width, height } = this.scale;
    this.isProcessing = true;

    // Оверлей
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(50);

    // Панель результата
    const panel = this.add.container(width / 2, height / 2);
    panel.setDepth(60);

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x16213e, 1);
    panelBg.fillRoundedRect(-180, -120, 360, 240, 16);
    panelBg.lineStyle(3, isVictory ? 0x2ecc71 : 0xe74c3c, 1);
    panelBg.strokeRoundedRect(-180, -120, 360, 240, 16);
    panel.add(panelBg);

    const titleText = this.add.text(0, -60, title, {
      fontFamily: 'Fredoka One, Nunito, cursive',
      fontSize: '42px',
      color: isVictory ? '#2ecc71' : '#e74c3c',
      stroke: '#1a1a2e',
      strokeThickness: 4
    }).setOrigin(0.5);
    panel.add(titleText);

    const subtitleText = this.add.text(0, -10, subtitle, {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '22px',
      color: '#f5f0e8'
    }).setOrigin(0.5);
    panel.add(subtitleText);

    const scoreText = this.add.text(0, 30, `СЧЁТ: ${this.score}`, {
      fontFamily: 'Fredoka One, Nunito, cursive',
      fontSize: '28px',
      color: '#e8a87c'
    }).setOrigin(0.5);
    panel.add(scoreText);

    // Кнопка
    const btnText = isVictory ? 'ПРОДОЛЖИТЬ' : 'ПОПРОБОВАТЬ СНОВА';
    const btn = this.createButton(0, 80, btnText, () => {
      overlay.destroy();
      panel.destroy();
      if (isVictory) {
        // Следующий уровень или завершение
        this.restartLevel();
      } else {
        this.restartLevel();
      }
    });
    btn.setDepth(60);
    panel.add(btn);

    // Анимация появления
    panel.setScale(0.8);
    panel.setAlpha(0);
    this.tweens.add({
      targets: panel,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  private createButton(x: number, y: number, text: string, callback: () => void): GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x6f4e37, 1);
    bg.fillRoundedRect(-100, -28, 200, 56, 28);
    bg.lineStyle(3, 0x8b6914, 1);
    bg.strokeRoundedRect(-100, -28, 200, 56, 28);

    const txt = this.add.text(0, 0, text, {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '18px',
      color: '#f5f0e8',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([bg, txt]);
    container.setSize(200, 56);
    container.setInteractive(new Phaser.Geom.Rectangle(-100, -28, 200, 56), Phaser.Geom.Rectangle.Contains);

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x8b6914, 1);
      bg.fillRoundedRect(-100, -28, 200, 56, 28);
      bg.lineStyle(3, 0xe8a87c, 1);
      bg.strokeRoundedRect(-100, -28, 200, 56, 28);
      txt.setColor('#fff8f0');
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x6f4e37, 1);
      bg.fillRoundedRect(-100, -28, 200, 56, 28);
      bg.lineStyle(3, 0x8b6914, 1);
      bg.strokeRoundedRect(-100, -28, 200, 56, 28);
      txt.setColor('#f5f0e8');
    });

    container.on('pointerdown', callback);

    return container;
  }

  private showPauseMenu(): void {
    // Заглушка для меню паузы
    console.warn('Pause menu - to be implemented');
  }

  private restartLevel(): void {
    // Очистка доски
    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        const tile = this.board[row][col];
        tile.sprite?.destroy();
        tile.snowSprite?.destroy();
      }
    }

    this.boardContainer.removeAll(true);
    this.createBoard(this.scale.width, this.scale.height);
    this.generateBoard();
    this.renderBoard();
    this.movesLeft = this.config.maxMoves;
    this.updateMovesDisplay();
    this.isProcessing = false;
  }

  private generateBoard(): void {
    // Генерация доски без совпадений и с гарантированным ходом
    let attempts = 0;
    do {
      for (let row = 0; row < this.config.rows; row++) {
        for (let col = 0; col < this.config.cols; col++) {
          if (this.board[row][col].type !== -1 || this.board[row][col].snow > 0) {
            this.board[row][col].type = this.randomTileType() as TileType;
          }
        }
      }
      attempts++;
    } while ((this.findMatches().length > 0 || !this.hasValidMoves()) && attempts < 50);
  }

  private renderBoard(): void {
    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        const tile = this.board[row][col];
        if (tile.type !== -1) {
          this.createTileSprite(tile, this.getTileX(col), this.getTileY(row));
        }
      }
    }
    this.updateSnowDisplay();
  }

  private createTileSprite(tile: TileData, x: number, y: number): void {
    // Основной тайл
    const sprite = this.add.image(x, y, `tile-${tile.type}`);
    sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
    sprite.setData('tile', tile);
    sprite.setInteractive();
    this.boardContainer.add(sprite);
    tile.sprite = sprite;

    // Снег если есть
    if (tile.snow > 0) {
      const snowKey = tile.snow === 2 ? 'snow-2' : 'snow-1';
      const snowSprite = this.add.image(x, y, snowKey);
      snowSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
      this.boardContainer.add(snowSprite);
      tile.snowSprite = snowSprite;
    }

    // Обработка кликов
    sprite.on('pointerdown', () => {
      if (!this.isProcessing) {
        this.onTileSelected(tile);
      }
    });
  }

  private getTileX(col: number): number {
    return col * (TILE_SIZE + TILE_SPACING) + TILE_SIZE / 2;
  }

  private getTileY(row: number): number {
    return row * (TILE_SIZE + TILE_SPACING) + TILE_SIZE / 2;
  }

  private updateMovesDisplay(): void {
    this.movesText.setText(`ХОДЫ: ${this.movesLeft}`);
  }

  private updateScoreDisplay(): void {
    this.scoreText.setText(`СЧЁТ: ${this.score}`);
  }

  private updateSnowDisplay(): void {
    const snowCount = this.getSnowRemaining();
    this.snowRemainingText.setText(`СНЕГ: ${snowCount}`);
  }

  // RNG методы
  private randomTileType(): number {
    this.rngSeed = (this.rngSeed * 1664525 + 1013904223) % 4294967296;
    return Math.floor((this.rngSeed / 4294967296) * this.config.tileTypes);
  }

  private randomInt(max: number): number {
    this.rngSeed = (this.rngSeed * 1664525 + 1013904223) % 4294967296;
    return Math.floor((this.rngSeed / 4294967296) * max);
  }
}