import { notifyDataChanged } from './storage';
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
    if (saved.language === 'ru' || saved.language === 'en') {
      language = saved.language;
      languageChosen = true;
    }
    if (saved.mode === 'classic' || saved.mode === 'falling') mode = saved.mode;
    if (typeof saved.vibration === 'boolean') vibration = saved.vibration;
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
  notifyDataChanged();
  if (!vibration) requestVibration('cancel');
}
document.documentElement.lang = language;
export function t(english: string): string {
  return language === 'ru' ? (russian[english] ?? english) : english;
}
type HapticEvent = 'match' | 'loss' | 'cancel';
function requestVibration(event: HapticEvent): void {
  try {
    // Only the APK advertises this protocol; ordinary browsers must never show a prompt.
    if (typeof window !== 'undefined' && /CoffeeHaptics\/1/.test(navigator.userAgent)) {
      window.prompt('coffee-haptics', event);
      return;
    }
    const pattern = event === 'cancel' ? 0 : event === 'match' ? 25 : [80, 50, 120];
    navigator.vibrate?.(pattern);
  } catch { /* Haptics are optional. */ }
}
export function vibrate(event: 'match' | 'loss'): void {
  if (!vibration || document.hidden) return;
  requestVibration(event);
}
const russian: Record<string, string> = {
  "Data restored, but backup setup failed. Choose the folder again in settings.": "Данные восстановлены, но настроить копирование не удалось. Выберите папку заново в настройках.",
  "Save progress after uninstall": "Сохранять прогресс после удаления",
  "Allow storage access when Android asks. Records and settings are saved automatically. After reinstalling, enable this option to restore. The current board is not saved.": "Разрешите доступ к файлам, когда Android попросит. Рекорды и настройки сохраняются автоматически. После переустановки включите эту галочку для восстановления. Текущее игровое поле не сохраняется.",
  "Backup could not be saved. Check free space and turn saving off and on to grant access again.": "Не удалось сохранить копию. Проверьте свободное место; выключите и включите сохранение, чтобы снова разрешить доступ.",
  "Saving was not enabled. Storage access is required.": "Сохранение не включено. Нужно разрешить доступ к файлам.",
  "A saved game was found. Restore records and settings? Current records will be kept. The game will restart.": "Найдена сохранённая игра. Восстановить рекорды и настройки? Текущие рекорды сохранятся. Игра перезапустится.",
  "Data restored, but backup setup failed. Turn saving off and on in settings to try again.": "Данные восстановлены, но копирование настроить не удалось. Выключите и включите сохранение в настройках, чтобы повторить попытку.",
  "Could not enable saving. Check storage access and free space, then try again.": "Не удалось включить сохранение. Проверьте доступ к файлам и свободное место, затем повторите попытку.",
  "Could not turn saving off. Try again.": "Не удалось выключить сохранение. Попробуйте снова.",
  "Local backup": "Локальная резервная копия",
  "Backup folder": "Папка резервной копии",
  "Last backup": "Последнее сохранение",
  "No backup saved yet.": "Копия ещё не сохранена.",
  "Backup is not configured.": "Резервное копирование не настроено.",
  "Choose backup folder / restore": "Выбрать папку / восстановить",
  "Choose or create Documents/CoffeeMatch on your phone. Records and settings are saved automatically. After reinstalling, choose the same folder to restore. The current board is not saved.": "Выберите или создайте папку Documents/CoffeeMatch на телефоне. Рекорды и настройки сохраняются автоматически. После переустановки выберите эту же папку для восстановления. Текущее игровое поле не сохраняется.",
  "Restore records and settings from this folder? Current records will be kept. The game will restart.": "Восстановить рекорды и настройки из этой папки? Текущие рекорды сохранятся. Игра перезапустится.",
  "Backup failed. Check folder access and free space; choose the folder again if needed.": "Не удалось сохранить копию. Проверьте доступ к папке и свободное место; при необходимости выберите папку заново.",
  "Could not configure backup. Check the folder and try again.": "Не удалось настроить копирование. Проверьте папку и попробуйте снова.",
  'Version': 'Версия',
  'local build': 'локальная сборка',
  'Update game': 'Обновить игру',
  'Check for updates': 'Проверить обновления',
  'Check for game and Android app updates. A game update restarts the current round.': 'Проверить обновления игры и Android-приложения. Обновление игры перезапустит текущую партию.',
  'Could not check for an Android app update.': 'Не удалось проверить обновление Android-приложения.',
  'The game is up to date.': 'У игры актуальная версия.',
  'Could not update the game. Check your connection and try again.': 'Не удалось обновить игру. Проверьте подключение и попробуйте снова.',
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
