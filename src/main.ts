/**
 * Coffee Match: Match-3 Demo
 * Main entry point - boots the Phaser game
 */

import { Game, Types } from 'phaser';
import { BootScene } from '@game/scenes/BootScene';
import { GameScene } from '@game/scenes/GameScene';
import { FallingScene } from '@game/scenes/FallingScene';
import { installSettings } from './ui/settings';

// Game configuration
const config: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    // The parent uses flex centering; Phaser margins would offset the canvas twice on resize.
    autoCenter: Phaser.Scale.NO_CENTER
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
  scene: [BootScene, GameScene, FallingScene]
};

// Initialize the game when DOM is ready
const game = new Game(config);
installSettings(game);

// Mobile orientation events can precede the parent's new layout. Observe the
// actual container so Phaser always resizes against its final dimensions.
const gameHost = document.getElementById('game-container');
const resizeObserver = new ResizeObserver(([entry]) => {
  const width = Math.floor(entry.contentRect.width);
  const height = Math.floor(entry.contentRect.height);
  if (width > 0 && height > 0 && (game.scale.width !== width || game.scale.height !== height)) {
    game.scale.setParentSize(width, height);
  }
});
game.events.once(Phaser.Core.Events.READY, () => {
  if (gameHost) resizeObserver.observe(gameHost);
});
game.events.once(Phaser.Core.Events.DESTROY, () => resizeObserver.disconnect());


// Make game globally accessible for debugging (dev only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ((import.meta as any).env?.DEV) {
  (window as Window & { __GAME__?: Game }).__GAME__ = game;
}

export { game };