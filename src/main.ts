/**
 * Coffee Match: Match-3 Demo
 * Main entry point - boots the Phaser game
 */

import { AUTO, CANVAS, Core, Game, Types } from 'phaser';
import { isAndroidApp } from './pwa';
import { BootScene } from '@game/scenes/BootScene';
import { GameScene } from '@game/scenes/GameScene';
import { FallingScene } from '@game/scenes/FallingScene';
import { installSettings } from './ui/settings';
import { version as appVersion } from '../package.json';

document.documentElement.dataset.coffeeBuild = appVersion;

// Game configuration
const config: Types.Core.GameConfig = {
  // This game uses only 2D drawing. Avoid device-specific WebGL startup
  // failures in the native WebView; browsers retain automatic selection.
  type: isAndroidApp() ? CANVAS : AUTO,
  callbacks: {
    preBoot: () => window.CoffeeRecovery?.stage('renderer-init'),
    postBoot: () => window.CoffeeRecovery?.stage('game-loop-start')
  },
  parent: 'game-container',
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    // The parent uses flex centering; Phaser margins would offset the canvas twice on resize.
    autoCenter: Phaser.Scale.NO_CENTER
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false
  },
  audio: {
    noAudio: true
  },
  scene: [BootScene, GameScene, FallingScene]
};

// Initialize the game when DOM is ready
window.CoffeeRecovery?.stage('phaser-init');
const game = new Game(config);
window.CoffeeRecovery?.stage('settings-init');
installSettings(game);
window.CoffeeRecovery?.stage('textures-loading');

// Mobile orientation events can precede the parent's new layout. Observe the
// actual container so Phaser always resizes against its final dimensions.
const gameHost = document.getElementById('game-container');
const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([entry]) => {
  const width = Math.floor(entry.contentRect.width);
  const height = Math.floor(entry.contentRect.height);
  if (width > 0 && height > 0 && (game.scale.width !== width || game.scale.height !== height)) {
    game.scale.setParentSize(width, height);
  }
});
game.events.once(Core.Events.READY, () => {
  if (gameHost) resizeObserver?.observe(gameHost);
});
game.events.once(Core.Events.DESTROY, () => resizeObserver?.disconnect());

// Make game globally accessible for debugging (dev only)
if (import.meta.env.DEV) {
  (window as Window & { __GAME__?: Game }).__GAME__ = game;
}

export { game };
