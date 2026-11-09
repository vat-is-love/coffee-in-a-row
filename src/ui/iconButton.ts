import { Scene } from 'phaser';

/** Vector icons stay sharp and do not depend on fonts available on the phone. */
export function iconButton(scene: Scene, x: number, y: number, icon: 'settings' | 'pause' | 'play' | 'restart', action: () => void) {
  const button = scene.add.container(x, y);
  const background = scene.add.rectangle(22, 22, 44, 44, 0x6f4e37)
    .setStrokeStyle(1, 0xe8a87c, 0.6).setInteractive({ useHandCursor: true });
  const drawing = scene.add.graphics().fillStyle(0xf5f0e8).lineStyle(3, 0xf5f0e8);
  if (icon === 'settings') {
    drawing.strokeCircle(22, 22, 9);
    drawing.strokeCircle(22, 22, 3);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      drawing.lineBetween(22 + Math.cos(a) * 9, 22 + Math.sin(a) * 9, 22 + Math.cos(a) * 14, 22 + Math.sin(a) * 14);
    }
  } else if (icon === 'pause') {
    drawing.fillRect(14, 12, 5, 20).fillRect(25, 12, 5, 20);
  } else if (icon === 'play') {
    drawing.fillTriangle(16, 11, 16, 33, 32, 22);
  } else {
    drawing.beginPath().arc(22, 22, 11, 0, Math.PI * 1.65).strokePath();
    drawing.fillTriangle(22, 7, 31, 9, 24, 17);
  }
  background.on('pointerdown', action);
  background.on('pointerover', () => background.setFillStyle(0x8b6914));
  background.on('pointerout', () => background.setFillStyle(0x6f4e37));
  return button.add([background, drawing]);
}
