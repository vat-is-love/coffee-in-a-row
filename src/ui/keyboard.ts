import type { Position } from '../game/logic/types';

const directions = new Map<string, [number, number]>([
  ['ArrowUp', [-1, 0]], ['KeyW', [-1, 0]],
  ['ArrowDown', [1, 0]], ['KeyS', [1, 0]],
  ['ArrowLeft', [0, -1]], ['KeyA', [0, -1]],
  ['ArrowRight', [0, 1]], ['KeyD', [0, 1]]
]);

export function keyDirection(event: KeyboardEvent): [number, number] | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  return directions.get(event.code || event.key);
}

export function moveBoardCursor(
  { row, col }: Position, [dr, dc]: [number, number], { rows, cols }: { rows: number; cols: number }
): Position {
  return { row: (row + dr + rows) % rows, col: (col + dc + cols) % cols };
}

export function keyActivates(event: KeyboardEvent): boolean {
  return !event.altKey && !event.ctrlKey && !event.metaKey && (event.key === ' ' || event.key === 'Enter');
}

export function installMenuKeyboard(menu: HTMLElement, back?: () => void): void {
  if (!(menu instanceof HTMLDialogElement)) menu.tabIndex = -1;
  menu.addEventListener('click', () => {
    // Clicking blank space can leave subsequent key events targeted at the body.
    if (!menu.contains(document.activeElement)) menu.focus();
  });
  menu.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && back) {
      event.preventDefault();
      if (!event.repeat) back();
      return;
    }
    const delta = keyDirection(event);
    if (!delta && !keyActivates(event)) return;
    const target = event.target;
    const verticalArrow = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    if (target instanceof HTMLSelectElement && verticalArrow) return;
    if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement &&
        target.type !== 'checkbox' && (target.type !== 'radio' || event.key.startsWith('Arrow')))) return;
    const controls = [...menu.querySelectorAll<HTMLElement>('button, select, input, textarea, a[href]')]
      .filter(control => !control.matches(':disabled') && !control.closest('[hidden], [inert]') && control.getClientRects().length);
    if (!controls.length) return;
    const index = controls.indexOf(document.activeElement as HTMLElement);
    if (delta && index >= 0) {
      event.preventDefault();
      const step = delta[0] || delta[1];
      controls[(index + step + controls.length) % controls.length].focus();
      return;
    }
    if (index < 0) {
      event.preventDefault();
      if (!event.repeat) controls[0].focus();
    }
  });
  menu.addEventListener('keyup', event => event.stopPropagation());
}
