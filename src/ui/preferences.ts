export type Language = 'en' | 'ru';
export type Mode = 'classic' | 'falling';
let mode: Mode | undefined;
let languageChosen = false;
export const PREFERENCES_KEY = 'coffee-preferences';
let language: Language = 'en';
let vibration = true;
try {
  const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved) && (saved.version === undefined || saved.version === 1)) {
  if (saved?.language === 'ru' || saved?.language === 'en') { language = saved.language; languageChosen = true; }
  if (saved?.mode === 'classic' || saved?.mode === 'falling') mode = saved.mode;
  if (typeof saved?.vibration === 'boolean') vibration = saved.vibration;
  }
} catch { /* Preferences are optional when storage is unavailable. */ }
export function getPreferences() { return { language, vibration }; }
export function getStartupPreferences() { return { mode, languageChosen }; }
export function savePreferences(next: { language: Language; vibration: boolean; mode?: Mode }): void {
  if (next.mode) mode = next.mode;
  languageChosen = true;
  language = next.language;
  vibration = next.vibration;
  document.documentElement.lang = language;
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...next, mode, version: 1 })); } catch { /* Keep in memory. */ }
  if (!vibration) requestVibration('cancel');
}
document.documentElement.lang = language;
export function t(english: string): string {
  return language === 'ru' ? (russian[english] ?? english) : english;
}
type HapticEvent = 'match' | 'loss' | 'test' | 'cancel';
function requestVibration(event: HapticEvent): string {
  try {
    // Only the APK advertises this protocol; ordinary browsers must never show a prompt.
    if (typeof window !== 'undefined' && /CoffeeHaptics\/1/.test(navigator.userAgent)) {
      return `Android: ${window.prompt('coffee-haptics', event) ?? 'unavailable'}`;
    }
    if (typeof navigator.vibrate !== 'function') return 'Browser: unsupported';
    const pattern = event === 'cancel' ? 0 : event === 'match' ? 25 : event === 'test' ? [150, 100, 150] : [80, 50, 120];
    return navigator.vibrate(pattern) ? 'Browser: requested' : 'Browser: rejected';
  } catch { return 'Vibration: error'; }
}
export function testVibration(enabled: boolean): string {
  const result = !enabled ? 'Vibration: disabled' : document.hidden ? 'Vibration: page hidden' : requestVibration('test');
  return `${result}\n${navigator.userAgent}\nvisible=${!document.hidden}; secure=${globalThis.isSecureContext}`;
}
export function vibrate(event: 'match' | 'loss'): void {
  if (!vibration || document.hidden) return;
  requestVibration(event);
}
const russian: Record<string, string> = {
  'Version': 'Версия',
  'local build': 'локальная сборка',
  'Update game': 'Обновить игру',
  'Download the latest version from GitHub Pages. The game will restart; scores and settings are kept.': 'Загрузить свежую версию с GitHub Pages. Игра перезапустится; рекорды и настройки сохранятся.',
  'Checking and downloading update…': 'Проверяем и загружаем обновление…',
  'The latest version is already installed.': 'Уже установлена актуальная версия.',
  'Restarting…': 'Перезапуск…',
  'Update failed. Check your connection and try again.': 'Не удалось обновить игру. Проверьте интернет и попробуйте снова.',

  "Board cleared · Top 10": "Поле очищено · Топ-10",
  "Time": "Время",
  "Cleared": "Очищено",
  "Match lines of 3 to clear every cell's pale background.": "Собирайте линии от 3, чтобы очистить светлый фон каждой клетки.",
  "Continue": "Продолжить",
  "FREE PLAY": "СВОБОДНАЯ ИГРА",
  "Choose game mode": "Выберите режим игры",
  "Falling pieces": "Падающие ряды",
  "Tap connected groups of 2+ before the next row arrives.": "Убирайте группы от 2 фишек до появления нового ряда.",
  "Match three": "Три в ряд",
  "Swap tiles to make lines of 3.": "Меняйте фишки местами, собирая линии от 3.",
  "You can change the mode in settings.": "Режим можно изменить в настройках.",
  "Settings": "Настройки",
  "Game mode": "Режим игры",
  "Swap tiles to make lines of 3. New tiles refill the board.": "Собирайте линии от 3 фишек. Поле заполняется новыми фишками.",
  "Tap connected groups of 2+. Columns gather in the center. Clear space before the next row arrives.": "Убирайте группы от 2 фишек. Столбцы сдвигаются к центру. Освобождайте место для нового ряда.",
  "Changing mode starts a new game.": "Смена режима начинает новую игру.",
  "Cancel": "Отмена",
  "Apply": "Применить",
  "Language": "Язык",
  "Vibration": "Вибрация",
  "Test vibration": "Проверить вибрацию",
  "Requested does not confirm physical vibration. If silent, check phone vibration and Do Not Disturb settings.": "Отправка команды не подтверждает работу мотора. Если отклика нет, проверьте вибрацию и режим «Не беспокоить» на телефоне.",
  "Light feedback for matches, stronger feedback on game over.": "Лёгкий отклик при удалении фишек, более заметный при проигрыше.",
  "Game over · Top 10": "Игра окончена · Топ-10",
  "Best results on this device. Your result is highlighted.": "Лучшие результаты на этом устройстве. Ваш результат выделен.",
  "Rows": "Ряды",
  "Score": "Очки",
  "Date / time": "Дата / время",
  "Start again": "Начать заново",
  "This result could not be saved on this device.": "Не удалось сохранить результат на этом устройстве.",
  "Drop next row ↓": "Сбросить ряд ↓",
  "FALLING ROWS": "ПАДАЮЩИЕ РЯДЫ",
  "Restart": "Заново",
  "Resume": "Продолжить",
  "Pause": "Пауза",
  "Board full · Restart to try again": "Поле заполнено · Начните заново",
  "Paused · Resume or press Escape": "Пауза · Продолжить или Escape",
  "Settling…": "Фишки перемещаются…",
  "Nearly full! Clear space for the next row": "Поле почти заполнено! Освободите место",
  "Tap groups of 2+ · Empty columns move to center": "Группы от 2 фишек · Столбцы сдвигаются к центру",
  "FREE PLAY · Settings": "ИГРА · Настройки",
  "Swipe or tap two tiles · Arrows + Space": "Свайп или две фишки · Стрелки + Пробел",
  "Try a swap that makes a line of 3": "Соберите линию от 3 фишек",
  "Match!": "Совпадение!",
  "No moves · Shuffling…": "Нет ходов · Перемешиваем…",
  "Board shuffled · Keep playing": "Поле перемешано · Продолжайте",
  "Swipe or tap two tiles · Shift + Arrow swaps": "Свайп или две фишки · Shift + Стрелка — обмен",
  "Resolving…": "Обработка…",
  "Board error. Reload to try again.": "Ошибка поля. Перезагрузите игру.",
  "Match-3 Demo": "Три в ряд",
  "Loading...": "Загрузка…",
  "Loading failed. Tap to reload.": "Ошибка загрузки. Нажмите для повтора.",
  "Ready!": "Готово!",
  "Moves": "Ходы",
  "Next row": "Следующий ряд",
  "Cascade": "Каскад",
  "Paused · Escape to resume": "Пауза · Escape — продолжить",
};
