import type { Scene, GameObjects } from 'phaser';

/** Both modes share the same board background and cell borders. */
export function createBoardSurface(scene: Scene): GameObjects.Graphics {
  const surface = scene.add.graphics();
  surface.fillStyle(0x0d0d1a, 0.5).fillRoundedRect(-12, -12, 536, 536, 16);
  surface.lineStyle(1, 0xe4cfad, 0.3);
  for (let n = 0; n <= 8; n++) {
    surface.lineBetween(n * 64, 0, n * 64, 512);
    surface.lineBetween(0, n * 64, 512, n * 64);
  }
  return surface;
}
