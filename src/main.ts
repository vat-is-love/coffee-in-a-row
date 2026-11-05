/**
 * Jackpot Jock: Snowstorm Match-3
 * Main entry point - boots the Phaser game
 */

import { Game, Types } from 'phaser';
import { BootScene } from '@game/scenes/BootScene';
import { GameScene } from '@game/scenes/GameScene';

// Game configuration
const config: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: 320,
      height: 240
    },
    max: {
      width: 1280,
      height: 960
    }
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false
  },
  audio: {
    disableWebAudio: false
  },
  scene: [BootScene, GameScene]
};

// Initialize the game when DOM is ready
const game = new Game(config);

// Make game globally accessible for debugging (dev only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ((import.meta as any).env?.DEV) {
  (window as Window & { __GAME__?: Game }).__GAME__ = game;
}

export { game };