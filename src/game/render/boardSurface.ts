import type { Scene, GameObjects } from 'phaser';

/** Both modes share the same board background and cell borders. */
export function createBoardSurface(scene: Scene, { rows, cols }: { rows: number; cols: number }): GameObjects.Graphics {
  const surface = scene.add.graphics();
  const width = cols * 64;
  const height = rows * 64;
  surface.fillStyle(0x0d0d1a, 0.5).fillRoundedRect(-12, -12, width + 24, height + 24, 16);
  surface.lineStyle(1, 0xe4cfad, 0.3);
  for (let col = 0; col <= cols; col++) surface.lineBetween(col * 64, 0, col * 64, height);
  for (let row = 0; row <= rows; row++) surface.lineBetween(0, row * 64, width, row * 64);
  return surface;
}

/** Marks the active cell separately from the selected swap tile or removal group. */
export function createBoardCursor(scene: Scene, board: GameObjects.Container): GameObjects.Graphics {
  const cursor = scene.add.graphics().setVisible(false);
  cursor.lineStyle(5, 0x1a1a2e).strokeRoundedRect(3, 3, 58, 58, 10);
  cursor.lineStyle(2, 0xffedc4).strokeRoundedRect(3, 3, 58, 58, 10);
  board.add(cursor);
  return cursor;
}

export function showBoardCursor(
  board: GameObjects.Container, cursor: GameObjects.Graphics, position: { row: number; col: number } | null
): void {
  cursor.setVisible(Boolean(position));
  if (!position) return;
  cursor.setPosition(position.col * 64, position.row * 64);
  board.bringToTop(cursor);
}
