import { Scene } from 'phaser';

/** Vector icons stay sharp and do not depend on fonts available on the phone. */
export function iconButton(scene: Scene, x: number, y: number, icon: 'menu' | 'restart', action: () => void) {
  const button = scene.add.container(x, y);
  const background = scene.add.rectangle(22, 22, 44, 44, 0x6f4e37)
    .setStrokeStyle(1, 0xe8a87c, 0.6).setInteractive({ useHandCursor: true });
  const drawing = scene.add.graphics().fillStyle(0xf5f0e8).lineStyle(3, 0xf5f0e8);
  if (icon === 'menu') {
    drawing.lineBetween(12, 15, 32, 15).lineBetween(12, 22, 32, 22).lineBetween(12, 29, 32, 29);
  } else {
    drawing.beginPath().arc(22, 22, 11, 0, Math.PI * 1.65).strokePath();
    drawing.fillTriangle(22, 7, 31, 9, 24, 17);
  }
  background.on('pointerdown', action);
  background.on('pointerover', () => background.setFillStyle(0x8b6914));
  background.on('pointerout', () => background.setFillStyle(0x6f4e37));
  return button.add([background, drawing]);
}
