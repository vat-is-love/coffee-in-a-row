import { GameObjects, type Scene } from 'phaser';

export function installPauseMask(
  scene: Scene,
  containers: () => (GameObjects.Container | undefined)[],
  isManuallyPaused: () => boolean,
  isFinished: () => boolean,
  reducedMotion: boolean
): () => void {
  const masked = new Map<GameObjects.Image, { texture: string; scaleX: number }>();
  let frame = 0;
  let started = 0;

  function rotate(now: number): void {
    const progress = Math.min(1, (now - started) / 360);
    const width = Math.cos(progress * Math.PI * 2);
    for (const [sprite, original] of masked) {
      if (!sprite.scene) continue;
      sprite.scaleX = original.scaleX * width;
      if (progress === 1) sprite.setTexture('tile-paused');
    }
    frame = progress < 1 ? requestAnimationFrame(rotate) : 0;
  }

  function restore(): void {
    cancelAnimationFrame(frame);
    frame = 0;
    for (const [sprite, original] of masked) {
      if (!sprite.scene) continue;
      sprite.setTexture(original.texture);
      sprite.scaleX = original.scaleX;
    }
    masked.clear();
  }

  function sync(): void {
    if (isFinished() || !(isManuallyPaused() || scene.sys.isPaused())) {
      restore();
      return;
    }
    const wasMasked = masked.size > 0;
    for (const [sprite] of masked) if (!sprite.scene) masked.delete(sprite);
    for (const container of containers()) {
      for (const sprite of container?.list ?? []) {
        if (!(sprite instanceof GameObjects.Image) || !sprite.texture.key.startsWith('tile-') || masked.has(sprite)) continue;
        masked.set(sprite, { texture: sprite.texture.key, scaleX: sprite.scaleX });
        if (reducedMotion || (wasMasked && !frame)) sprite.setTexture('tile-paused');
      }
    }
    if (!wasMasked && masked.size && !reducedMotion) {
      started = performance.now();
      frame = requestAnimationFrame(rotate);
    }
  }

  scene.events.on('pause', sync);
  scene.events.on('resume', sync);
  scene.events.once('shutdown', () => {
    scene.events.off('pause', sync);
    scene.events.off('resume', sync);
    restore();
  });
  return sync;
}
