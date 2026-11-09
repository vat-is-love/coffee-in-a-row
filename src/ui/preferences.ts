export type Language = 'en' | 'ru';
export const PREFERENCES_KEY = 'coffee-preferences';
let language: Language = 'en';
let vibration = true;
try {
  const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}');
  if (saved?.language === 'ru' || saved?.language === 'en') language = saved.language;
  if (typeof saved?.vibration === 'boolean') vibration = saved.vibration;
} catch { /* Preferences are optional when storage is unavailable. */ }
export function getPreferences() { return { language, vibration }; }
export function savePreferences(next: { language: Language; vibration: boolean }): void {
  language = next.language;
  vibration = next.vibration;
  document.documentElement.lang = language;
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next)); } catch { /* Keep in memory. */ }
  if (!vibration) { try { navigator.vibrate?.(0); } catch { /* Unsupported device. */ } }
}
document.documentElement.lang = language;
export function t(english: string): string {
  return language === 'ru' ? (russian[english] ?? english) : english;
}
/** Short durations keep match feedback subtle; browsers control actual intensity. */
export function vibrate(event: 'match' | 'loss'): void {
  if (!vibration || document.hidden) return;
  try { navigator.vibrate?.(event === 'match' ? 12 : [80, 50, 120]); }
  catch { /* Unsupported or denied vibration must never interrupt gameplay. */ }
}
const russian: Record<string, string> = {
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
