import { GameObjects, type Scene } from 'phaser';

const turnDuration = 360;

export function installPauseMask(
  scene: Scene,
  containers: () => (GameObjects.Container | undefined)[],
  isPaused: () => boolean,
  isFinished: () => boolean,
  reducedMotion: boolean
): () => void {
  const masked = new Map<GameObjects.Image, { texture: string; scaleX: number; displayedScaleX: number }>();
  let frame = 0;
  let progress = 0;
  let target = 0;
  let lastFrame = 0;

  function paint(): void {
    const width = Math.abs(Math.cos(progress * Math.PI));
    for (const [sprite, original] of masked) {
      if (!sprite.scene) {
        masked.delete(sprite);
        continue;
      }
      // Gameplay tweens can resume while the tiles are turning back.
      if (sprite.scaleX !== original.displayedScaleX) original.scaleX = sprite.scaleX;
      if (sprite.texture.key !== 'tile-paused') original.texture = sprite.texture.key;
      const texture = progress >= 0.5 ? 'tile-paused' : original.texture;
      if (sprite.texture.key !== texture) sprite.setTexture(texture);
      sprite.scaleX = original.displayedScaleX = original.scaleX * width;
    }
    if (progress === 0 && target === 0) masked.clear();
  }

  function rotate(now: number): void {
    const step = Math.max(0, now - lastFrame) / turnDuration;
    lastFrame = Math.max(lastFrame, now);
    progress = target === 1 ? Math.min(1, progress + step) : Math.max(0, progress - step);
    paint();
    frame = progress !== target ? requestAnimationFrame(rotate) : 0;
  }

  function restore(): void {
    cancelAnimationFrame(frame);
    frame = progress = target = 0;
    paint();
  }

  function sync(): void {
    if (isFinished()) {
      restore();
      return;
    }
    target = Number(isPaused());
    if (target === 1) {
      for (const container of containers()) {
        for (const sprite of container?.list ?? []) {
          if (!(sprite instanceof GameObjects.Image) || !sprite.texture.key.startsWith('tile-') || masked.has(sprite)) continue;
          masked.set(sprite, { texture: sprite.texture.key, scaleX: sprite.scaleX, displayedScaleX: sprite.scaleX });
        }
      }
    }
    if (reducedMotion) progress = target;
    paint();
    if (!frame && masked.size && progress !== target) {
      lastFrame = performance.now();
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
