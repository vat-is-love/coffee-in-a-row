import { getPreferences, t } from '../../ui/preferences';
/**
 * BootScene - Loading screen with asset loading
 */

import { Scene, GameObjects } from 'phaser';
import { BOMB_ITEM, COLUMN_CLEAR_ITEM, ROW_CLEAR_ITEM, STORY_ITEM } from '../logic/falling';
import storyItem from '../render/story-item.svg?url';
import rowClearItem from '../render/row-clear-item.svg?url';
import columnClearItem from '../render/column-clear-item.svg?url';
import bombItem from '../render/bomb-item.svg?url';

// Temporary Noto Emoji palette. See docs/REMOVE_NOTO_FOOD.md.
const notoFood = ['1f34e', '1f9c0', '1f966', '1f347', '1fad0', '1f32d'];

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
      this.generateTileTextures('beans');
      this.generateTileTextures('food');
      notoFood.forEach((code, index) => {
        this.load.svg(`tile-emoji-${index}`, `${import.meta.env.BASE_URL}noto-food/emoji_u${code}.svg`, { width: 64, height: 64 });
      });
      this.generateSelectionTexture();
      this.load.image(`tile-${STORY_ITEM}`, storyItem);
      this.load.image(`tile-${ROW_CLEAR_ITEM}`, rowClearItem);
      this.load.image(`tile-${COLUMN_CLEAR_ITEM}`, columnClearItem);
      this.load.image(`tile-${BOMB_ITEM}`, bombItem);
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

  private generateTileTextures(style: 'beans' | 'food'): void {
    const tileSize = 64;

    const colors = style === 'beans'
      ? [0xe74c3c, 0xf39c12, 0x27ae60, 0x9b59b6, 0x3498db, 0xe91e63, 0xffffff]
      : [0xe74845, 0xffcf51, 0x65c456, 0xa76ce0, 0xff9947, 0x3e9bde];
    colors.forEach((color, index) => {
      const graphics = this.make.graphics();
      graphics.fillStyle(color);
      switch (style === 'food' ? index : -1) {
        case 0: // Apple
          graphics.fillCircle(26, 33, 11).fillCircle(37, 33, 11);
          graphics.fillEllipse(32, 38, 26, 20);
          graphics.fillStyle(0x80513d).fillRect(30, 15, 4, 10);
          graphics.fillStyle(0x78ba52).fillEllipse(38, 19, 12, 6);
          break;
        case 1: // Cheese wedge
          graphics.fillTriangle(13, 43, 27, 19, 51, 43);
          graphics.fillStyle(0xcf8c32).fillCircle(28, 35, 3).fillCircle(37, 39, 2);
          break;
        case 2: // Broccoli
          graphics.fillStyle(0x92d16f).fillRoundedRect(27, 30, 10, 18, 3);
          graphics.fillStyle(color).fillCircle(22, 29, 9).fillCircle(32, 24, 10).fillCircle(42, 29, 9);
          break;
        case 3: // Grapes
          graphics.fillCircle(22, 24, 7).fillCircle(32, 24, 7).fillCircle(42, 24, 7);
          graphics.fillCircle(27, 34, 7).fillCircle(37, 34, 7).fillCircle(32, 44, 7);
          break;
        case 4: // Carrot
          graphics.fillTriangle(16, 48, 30, 20, 47, 34);
          graphics.fillStyle(0x78ba52).fillTriangle(37, 26, 36, 13, 45, 20);
          graphics.fillTriangle(39, 28, 54, 20, 48, 31);
          break;
        case 5: // Blueberry
          graphics.fillCircle(32, 34, 15);
          graphics.fillStyle(0x28639e).fillCircle(32, 25, 6);
          graphics.fillStyle(0x9ed5f5).fillEllipse(25, 32, 6, 4);
          break;
        default: // Original coffee bean and pause cover
          graphics.fillEllipse(32, 32, 27, 18);
          graphics.lineStyle(3, 0x1a1a2e).lineBetween(23, 27, 41, 37);
          graphics.fillStyle(0xffffff, 0.2).fillEllipse(28, 28, 8, 8);
          break;
      }
      graphics.generateTexture(index === 6 ? 'tile-paused' : `tile-${style}-${index}`, tileSize, tileSize);
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
    // Keep the texture objects used by the board, preview and pause mask stable.
    const textures = this.textures;
    const tiles = notoFood.map((_, index) => textures.createCanvas(`tile-${index}`, 64, 64)!);
    const applyTileStyle = () => {
      const { tileStyle } = getPreferences();
      tiles.forEach((texture, index) => {
        const source = textures.get(`tile-${tileStyle}-${index}`).getSourceImage();
        texture.clear(0, 0, texture.width, texture.height, false)
          .draw(0, 0, source as HTMLCanvasElement | HTMLImageElement, false).refresh();
      });
    };
    applyTileStyle();
    this.game.events.on('tile-style-changed', applyTileStyle);
    window.CoffeeRecovery?.stage('boot-assets-ready');
    this.loadingText.setText(t('Ready!'));
    this.time.delayedCall(300, () => {
      this.scene.stop();
      this.game.events.emit('show-main-menu');
    });
  }
}
