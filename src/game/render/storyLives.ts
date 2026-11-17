import type { GameObjects, Scene } from 'phaser';

export const storyLives = 3;
export const rowsPerLife = 20;
const heartSize = 22;
const textureSize = heartSize * 2;

function heartTexture(scene: Scene, filled: boolean): string {
  const key = filled ? 'story-heart-fill' : 'story-heart-outline';
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, textureSize, textureSize)!;
  const context = texture.context;
  context.scale(2, 2);
  context.beginPath();
  context.moveTo(11, 5.5);
  context.bezierCurveTo(4, -1, -1, 5, 2.5, 11);
  context.bezierCurveTo(4, 14, 8, 17, 11, 20);
  context.bezierCurveTo(14, 17, 18, 14, 19.5, 11);
  context.bezierCurveTo(23, 5, 18, -1, 11, 5.5);
  context.closePath();
  context.strokeStyle = context.fillStyle = '#ff646f';
  context.lineWidth = 1.5;
  context.lineJoin = 'round';
  if (filled) context.fill();
  else context.stroke();
  texture.refresh();
  return key;
}

export function createStoryLives(scene: Scene, container: GameObjects.Container, hudWidth: number) {
  const outline = heartTexture(scene, false);
  const fill = heartTexture(scene, true);
  return Array.from({ length: storyLives }, (_, index) => {
    const x = hudWidth - 84 + index * 24;
    const makeHeart = (key: string) => scene.add.image(x, 56, key)
      .setOrigin(0).setDisplaySize(heartSize, heartSize);
    const filled = makeHeart(fill);
    container.add([filled, makeHeart(outline)]);
    return filled;
  });
}

export function renderStoryLives(hearts: GameObjects.Image[], charge: number): void {
  hearts.forEach((heart, index) => {
    const fraction = Math.max(0, Math.min(1, charge / rowsPerLife - index));
    heart.setVisible(fraction > 0);
    if (fraction === 1) heart.setCrop();
    else if (fraction > 0) {
      const height = fraction * 36;
      heart.setCrop(0, 40 - height, textureSize, height);
    }
  });
}
