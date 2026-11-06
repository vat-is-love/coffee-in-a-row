/**
 * BootScene - Loading screen with asset loading
 */

import { Scene, GameObjects } from 'phaser';

export class BootScene extends Scene {
  private failed = false;
  private loadingText!: GameObjects.Text;
  private progressBar!: GameObjects.Graphics;
  private progressBox!: GameObjects.Graphics;

  constructor() {
    super({ key: 'BootScene', active: true });
  }

  preload(): void {
    const { width, height } = this.scale;

    // Create loading UI
    this.createLoadingUI(width, height);

    // Load placeholder assets (generated programmatically in create)
    this.failed = false;
    try { this.loadAssets(); } catch (error) { this.showLoadError(error); }
    this.load.on('loaderror', () => this.showLoadError(new Error('Asset loading failed')));

    // Set up load events
    this.load.on('progress', (value: number) => {
      this.updateProgress(value);
    });

    this.load.on('complete', () => {
      this.loadingComplete();
    });
  }

  private createLoadingUI(width: number, height: number): void {
    // Background
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Title
    this.add.text(width / 2, height / 2 - 80, 'COFFEE MATCH', {
      fontFamily: 'Fredoka One, Nunito, cursive',
      fontSize: `${Math.min(48, width / 9)}px`,
      color: '#e8a87c',
      stroke: '#6f4e37',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 20, 'Match-3 Demo', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '24px',
      color: '#f5f0e8'
    }).setOrigin(0.5);

    // Progress box
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x16213e, 1);
    this.progressBox.fillRoundedRect(width / 2 - Math.min(320, width - 32) / 2, height / 2 + 40, Math.min(320, width - 32), 20, 10);

    // Progress bar
    this.progressBar = this.add.graphics();

    // Loading text
    this.loadingText = this.add.text(width / 2, height / 2 + 100, 'Loading...', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '18px',
      color: '#b8a99a'
    }).setOrigin(0.5);
  }

  private loadAssets(): void {
    // Generate placeholder textures programmatically
    // Tile textures (6 coffee-themed colors)
    this.generateTileTextures();

    // Snow overlay textures
    this.generateSnowTextures();

    // UI elements
    this.generateUITextures();

    // Sound placeholders (we'll use Web Audio API for simple sounds)
    // this.load.audio('swap', 'assets/sounds/swap.ogg');
    // this.load.audio('match', 'assets/sounds/match.ogg');
    // this.load.audio('snow-break', 'assets/sounds/snow-break.ogg');
    // this.load.audio('win', 'assets/sounds/win.ogg');
    // this.load.audio('lose', 'assets/sounds/lose.ogg');
  }

  private generateTileTextures(): void {
    const tileTypes = 6;
    const tileSize = 64;

    for (let i = 0; i < tileTypes; i++) {
      const graphics = this.make.graphics();

      // Base colors for coffee-themed tiles
      const colors = [
        0xe74c3c, // 0 - Espresso (red)
        0xf39c12, // 1 - Caramel (orange)
        0x27ae60, // 2 - Matcha (green)
        0x9b59b6, // 3 - Lavender (purple)
        0x3498db, // 4 - Blueberry (blue)
        0xe91e63  // 5 - Raspberry (pink)
      ];

      const color = colors[i];

      // Draw coffee bean/icon shape in the center
      graphics.fillStyle(color, 1);

      // Coffee bean shape (simplified)
      const cx = tileSize / 2;
      const cy = tileSize / 2;
      const r = 18;

      // Main bean body
      graphics.fillEllipse(cx, cy, r * 1.5, r);
      // Bean split line
      graphics.lineStyle(3, 0x1a1a2e, 1);
      graphics.beginPath();
      graphics.moveTo(cx - r * 0.5, cy - r * 0.3);
      graphics.lineTo(cx + r * 0.5, cy + r * 0.3);
      graphics.strokePath();

      // Highlight
      graphics.fillStyle(0xffffff, 0.2);
      graphics.fillEllipse(cx - 4, cy - 4, 8, 8);

      graphics.generateTexture(`tile-${i}`, tileSize, tileSize);
      graphics.destroy();
    }
  }

  private generateSnowTextures(): void {
    const tileSize = 64;

    // Single layer snow
    const snow1 = this.make.graphics();
    snow1.fillStyle(0xffffff, 0.9);
    snow1.fillRoundedRect(0, 0, tileSize, tileSize, 8);
    // Snow texture lines
    snow1.lineStyle(1, 0xd0d0e0, 0.6);
    for (let i = 0; i < 8; i++) {
      snow1.beginPath();
      snow1.moveTo(i * 8, 0);
      snow1.lineTo(i * 8 + 4, tileSize);
      snow1.strokePath();
    }
    // Sparkle
    snow1.fillStyle(0xffffff, 1);
    snow1.fillCircle(16, 16, 2);
    snow1.fillCircle(48, 40, 1.5);
    snow1.fillCircle(40, 20, 1);
    snow1.generateTexture('snow-1', tileSize, tileSize);
    snow1.destroy();

    // Double layer snow (thicker)
    const snow2 = this.make.graphics();
    snow2.fillStyle(0xf0f0ff, 1);
    snow2.fillRoundedRect(0, 0, tileSize, tileSize, 8);
    // Thicker texture
    snow2.lineStyle(2, 0xc0c0e0, 0.8);
    for (let i = 0; i < 8; i++) {
      snow2.beginPath();
      snow2.moveTo(i * 8, 0);
      snow2.lineTo(i * 8 + 4, tileSize);
      snow2.strokePath();
    }
    // More sparkles
    snow2.fillStyle(0xffffff, 1);
    snow2.fillCircle(16, 16, 2.5);
    snow2.fillCircle(48, 40, 2);
    snow2.fillCircle(40, 20, 1.5);
    snow2.fillCircle(24, 48, 1);
    snow2.generateTexture('snow-2', tileSize, tileSize);
    snow2.destroy();

    // Snow breaking particle
    const particle = this.make.graphics();
    particle.fillStyle(0xffffff, 1);
    particle.fillCircle(4, 4, 4);
    particle.generateTexture('snow-particle', 8, 8);
    particle.destroy();
  }

  private generateUITextures(): void {
    // Button background
    const btn = this.make.graphics();
    btn.fillStyle(0x6f4e37, 1);
    btn.fillRoundedRect(0, 0, 200, 56, 28);
    btn.lineStyle(3, 0x8b6914, 1);
    btn.strokeRoundedRect(0, 0, 200, 56, 28);
    btn.generateTexture('btn-primary', 200, 56);
    btn.destroy();

    // Button hover
    const btnHover = this.make.graphics();
    btnHover.fillStyle(0x8b6914, 1);
    btnHover.fillRoundedRect(0, 0, 200, 56, 28);
    btnHover.lineStyle(3, 0xe8a87c, 1);
    btnHover.strokeRoundedRect(0, 0, 200, 56, 28);
    btnHover.generateTexture('btn-primary-hover', 200, 56);
    btnHover.destroy();

    // Button disabled
    const btnDisabled = this.make.graphics();
    btnDisabled.fillStyle(0x4a3d2e, 1);
    btnDisabled.fillRoundedRect(0, 0, 200, 56, 28);
    btnDisabled.lineStyle(3, 0x5a4a33, 1);
    btnDisabled.strokeRoundedRect(0, 0, 200, 56, 28);
    btnDisabled.generateTexture('btn-primary-disabled', 200, 56);
    btnDisabled.destroy();

    // Panel background
    const panel = this.make.graphics();
    panel.fillStyle(0x16213e, 0.95);
    panel.fillRoundedRect(0, 0, 300, 200, 16);
    panel.lineStyle(2, 0x6f4e37, 1);
    panel.strokeRoundedRect(0, 0, 300, 200, 16);
    panel.generateTexture('panel-bg', 300, 200);
    panel.destroy();

    // Selection highlight
    const highlight = this.make.graphics();
    highlight.lineStyle(4, 0xe8a87c, 1);
    highlight.strokeRoundedRect(2, 2, 60, 60, 10);
    highlight.generateTexture('selection-highlight', 64, 64);
    highlight.destroy();

    // Invalid swap indicator (red X)
    const invalid = this.make.graphics();
    invalid.lineStyle(4, 0xe74c3c, 1);
    invalid.beginPath();
    invalid.moveTo(12, 12);
    invalid.lineTo(52, 52);
    invalid.moveTo(52, 12);
    invalid.lineTo(12, 52);
    invalid.strokePath();
    invalid.generateTexture('invalid-swap', 64, 64);
    invalid.destroy();
  }

  private updateProgress(value: number): void {
    const width = this.scale.width;
    const height = this.scale.height;
    if (this.failed) return;
    const barWidth = Math.min(320, width - 32) - 8;

    this.progressBar.clear();
    this.progressBar.fillStyle(0xe8a87c, 1);
    this.progressBar.fillRoundedRect(
      width / 2 - barWidth / 2,
      height / 2 + 44,
      barWidth * value,
      12,
      6
    );

    this.loadingText.setText(`Loading... ${Math.round(value * 100)}%`);
  }

  private showLoadError(error: unknown): void {
    console.error('Unable to load game', error);
    this.failed = true;
    this.loadingText.setText('Loading failed. Tap to reload.')
      .setInteractive({ useHandCursor: true })
      .once('pointerdown', () => window.location.reload());
  }

  private loadingComplete(): void {
    if (this.failed) return;
    this.loadingText.setText('Ready!');
    this.time.delayedCall(300, () => {
      this.game.events.once('game-mode-selected', () => {
        this.scene.start(this.registry.get('gameMode') === 'falling' ? 'FallingScene' : 'GameScene');
      });
      this.game.events.emit('choose-game-mode');
    });
  }
}