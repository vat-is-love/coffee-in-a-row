import { t } from '../../ui/preferences';
/**
 * BootScene - Loading screen with asset loading
 */

import { Scene, GameObjects } from 'phaser';

export class BootScene extends Scene {
  private failed = false;
  private loadingText!: GameObjects.Text;
  private progressBar!: GameObjects.Graphics;

  constructor() {
    super({ key: 'BootScene', active: true });
  }

  preload(): void {
    window.CoffeeRecovery?.stage('boot-scene-preload');
    const { width, height } = this.scale;

    // Create loading UI
    this.createLoadingUI(width, height);

    this.failed = false;
    try {
      this.generateTileTextures();
      this.generateSelectionTexture();
    } catch (error) { this.showLoadError(error); }
    this.load.on('loaderror', () => this.showLoadError(new Error('Asset loading failed')));

    this.load.on('progress', this.updateProgress, this);
    this.load.on('complete', this.loadingComplete, this);
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

    this.add.text(width / 2, height / 2 - 20, t('Match-3 Demo'), {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '24px',
      color: '#f5f0e8'
    }).setOrigin(0.5);

    const progressWidth = Math.min(320, width - 32);
    this.add.graphics().fillStyle(0x16213e, 1)
      .fillRoundedRect((width - progressWidth) / 2, height / 2 + 40, progressWidth, 20, 10);

    // Progress bar
    this.progressBar = this.add.graphics();

    // Loading text
    this.loadingText = this.add.text(width / 2, height / 2 + 100, t('Loading...'), {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '18px',
      color: '#b8a99a'
    }).setOrigin(0.5);
  }

  private generateTileTextures(): void {
    const tileSize = 64;

    const colors = [0xe74c3c, 0xf39c12, 0x27ae60, 0x9b59b6, 0x3498db, 0xe91e63];
    colors.forEach((color, index) => {
      const graphics = this.make.graphics();
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

      graphics.generateTexture(`tile-${index}`, tileSize, tileSize);
      graphics.destroy();
    });
  }

  private generateSelectionTexture(): void {
    const highlight = this.make.graphics();
    highlight.lineStyle(4, 0xe8a87c, 1);
    highlight.strokeRoundedRect(2, 2, 60, 60, 10);
    highlight.generateTexture('selection-highlight', 64, 64);
    highlight.destroy();
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

    this.loadingText.setText(`${t('Loading...')} ${Math.round(value * 100)}%`);
  }

  private showLoadError(error: unknown): void {
    console.error('Unable to load game', error);
    this.failed = true;
    this.loadingText.setText(t('Loading failed. Tap to reload.'))
      .setInteractive({ useHandCursor: true })
      .once('pointerdown', () => window.location.reload());
  }

  private loadingComplete(): void {
    if (this.failed) return;
    window.CoffeeRecovery?.stage('boot-assets-ready');
    this.loadingText.setText(t('Ready!'));
    this.time.delayedCall(300, () => {
      this.game.events.once('game-mode-selected', () => {
        this.scene.start(this.registry.get('gameMode') === 'falling' ? 'FallingScene' : 'GameScene');
      });
      this.game.events.emit('choose-game-mode');
    });
  }
}
