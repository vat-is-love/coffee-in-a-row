import type { Scene } from 'phaser';
import { iconButton } from '../../ui/iconButton';

export function openGameMenu(): void {
  window.dispatchEvent(new Event('game-menu'));
}

export function createHud(scene: Scene, titleText: string, restart?: () => void) {
  const width = Math.min(scene.scale.width - 24, 620);
  const container = scene.add.container((scene.scale.width - width) / 2, 10).setDepth(20);
  const background = scene.add.graphics().fillStyle(0x16213e, 0.95).fillRoundedRect(0, 0, width, 104, 14);
  const style = { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#f5f0e8' };
  const title = scene.add.text(12, 10, titleText, { ...style, color: '#e8a87c', fontStyle: 'bold' });
  const titleWidth = width - (restart ? 122 : 72);
  if (title.width > titleWidth) title.setScale(titleWidth / title.width);
  const menu = iconButton(scene, width - 54, 8, 'menu', openGameMenu).setName('game-menu');
  const score = scene.add.text(12, 36, '', style);
  const progress = scene.add.text(12, 62, '', { ...style, fontSize: '12px' });
  const status = scene.add.text(12, 84, '', { ...style, fontSize: '11px', color: '#e4cfad' });
  container.add([background, title, menu, score, progress, status]);
  if (restart) container.add(iconButton(scene, width - 104, 8, 'restart', restart).setName('restart'));
  return { container, score, progress, status };
}
