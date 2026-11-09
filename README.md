# Coffee Match: Match-3 Demo

Браузерная кофейная Match-3 игра. Сейчас доступно бесконечное тестовое поле (M2); 10 уровней и публичный лидерборд запланированы в следующих этапах.

## Быстрый старт

### Требования

- Node.js >= 20.0.0
- npm >= 10.0.0

### Установка

```bash
# Клонирование репозитория
git clone <repository-url>
cd coffee-in-a-row

# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev
```

Игра будет доступна по адресу `http://localhost:3000`

### Доступные команды

```bash
# Запуск dev-сервера с автооткрытием браузера
npm run dev

# Сборка для продакшена
npm run build

# Предпросмотр продакшен-сборки
npm run preview

# Проверка типов TypeScript
npm run typecheck

# Линтинг кода
npm run lint

# Запуск юнит-тестов
npm run test

# Запуск юнит-тестов в watch-режиме
npm run test:watch

# Запуск e2e тестов (Playwright)
npm run test:e2e

# Запуск e2e тестов с UI
npm run test:e2e:ui
```

## Структура проекта

```
/
├── PROJECT_SPEC.md           # Спецификация проекта
├── README.md                 # Этот файл
├── .env.example              # Пример переменных окружения
├── .gitignore
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── eslint.config.js
├── .prettierrc
├── vitest.config.ts
├── playwright.config.ts
├── index.html
├── public/                   # Статические ассеты
├── src/
│   ├── main.ts               # Точка входа
│   ├── styles/
│   │   └── main.css          # Основные стили
│   ├── game/
│   │   ├── logic/            # Чистая игровая логика (M1)
│   │   ├── levels/           # Конфигурации уровней (M3)
│   │   ├── scenes/           # Phaser сцены
│   │   │   ├── BootScene.ts  # Загрузочный экран
│   │   │   └── GameScene.ts  # Основная игровая сцена
│   │   ├── components/       # UI компоненты (M2)
│   │   └── assets/           # Игровые ассеты
│   ├── services/             # API сервисы (M5)
│   └── ui/                   # Меню/формы/лидерборд (M4)
└── tests/
    ├── unit/                 # Юнит-тесты
    ├── integration/          # Интеграционные тесты
    └── e2e/                  # E2E тесты (Playwright)
```

## Разработка

### Архитектура

Игра следует архитектуре, описанной в `PROJECT_SPEC.md`:

1. **Логика** (`src/game/logic/`) - чистые алгоритмы без зависимостей от Phaser/DOM
2. **Сцены** (`src/game/scenes/`) - рендеринг и анимации через Phaser 3
3. **Компоненты** (`src/game/components/`) - переиспользуемые UI элементы
4. **Сервисы** (`src/services/`) - работа с бэкендом (Supabase)
5. **UI** (`src/ui/`) - меню, формы, лидерборд

### Добавление новых уровней

Уровни конфигурируются через JSON/TypeScript файлы в `src/game/levels/`. Схема конфигурации:

```typescript
interface LevelConfig {
  id: number;                    // 1..10
  rows: number;
  cols: number;
  tileTypes: number;             // количество типов тайлов
  maxMoves: number;
  snow: Array<{row: number; col: number; layers: 1 | 2}>;
  goal: {type: 'clear_all_snow'};
  seed?: number;                 // опционально для фикстур
}
```

### Плейсхолдерные ассеты

Все графические ассеты генерируются программно в `BootScene.ts`:
- 6 типов кофейных тайлов (Эспрессо, Карамель, Матча, Лаванда, Брусника, Малина)
- 2 слоя снега
- UI элементы (кнопки, панели, индикаторы)

Для замены на реальные ассеты:
1. Поместите файлы в `public/assets/`
2. Обновите `BootScene.preload()` для загрузки вместо генерации
3. Размеры тайлов: 64x64px

## Тестирование

### Юнит-тесты (Vitest)

```bash
npm run test
```

Тесты покрывают:
- Детекцию совпадений (горизонтальные, вертикальные, T/L формы)
- Валидацию обменов
- Генерацию досок
- Гравитацию и каскады
- Механику снега
- Формулы подсчёта очков

### E2E тесты (Playwright)

```bash
# Установка браузеров (один раз)
npx playwright install

# Запуск тестов
npm run test:e2e
```

Тесты проверяют критические пользовательские сценарии на Chrome, Firefox, Safari, мобильных устройствах.

## Деплой

### Сборка

```bash
npm run build
```

Результат в папке `dist/` - статические файлы для хостинга на любом CDN/статическом хостинге.

### Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значениями:

```bash
cp .env.example .env
```

Обязательные переменные для продакшена:
- `VITE_SUPABASE_URL` - URL проекта Supabase
- `VITE_SUPABASE_ANON_KEY` - анонимный ключ Supabase
- `VITE_API_URL` - URL Edge Functions (опционально)

### Внедрение на сайт (iframe)

```html
<iframe
  src="https://your-domain.com/game/"
  width="100%"
  height="600"
  frameborder="0"
  allowfullscreen
  style="max-width: 800px; aspect-ratio: 4/3;">
</iframe>
```

Рекомендуемые размеры: 800x600 (4:3), адаптивно до 320px ширины.

## Настройка Supabase (Backend)

### Миграции

Миграции находятся в `supabase/migrations/` (создаются в M5).

### Edge Functions

Функции в `supabase/functions/`:
- `verify-run` - верификация прогона
- `submit-score` - отправка результата
- `get-leaderboard` - получение лидерборда
- `admin-reset` - админский сброс (требует авторизации)

### Администрирование

Ручное создание нового периода лидерборда:
```bash
# Через Supabase Dashboard или CLI
supabase functions invoke admin-reset --data '{"action": "new_period"}'
```

## Лицензирование ассетов

См. `docs/ASSET_LICENSES.md` (создаётся в M6).

## Известные ограничения (MVP)

- Нет аккаунтов/паролей - идентификация по устройству
- Email опционален, не показывается в лидерборде
- Античит: серверная верификация прогонов (не клиентский скор)
- Только английский UI (строки централизованы для локализации)
- Нет покупок, рекламы, соцсетей, пуш-уведомлений

## Дорожная карта

См. `PROJECT_SPEC.md` §12 — Roadmap с этапами M0-M6.

Текущий этап: **M2 — Playable scene and controls** ✓. Следующий этап — **M3: Snow, goals, scoring, 10 levels**.

Движок `src/game/logic/` работает независимо от Phaser. Генерация создаёт поле без готовых совпадений и с допустимым ходом, включая клетки со снегом. Поддерживаются целочисленные размеры от 2×3 или 3×2 и 3–6 типов тайлов; игровые конфигурации используют 8×8 и 5–6 типов. Неподдерживаемые размеры, число типов и некорректный лимит попыток отклоняются с `RangeError`.

Генерация сначала заполняет поле без троек, а при отсутствии допустимого хода после лимита попыток использует конструкцию с гарантированным обменом. Перемешивание пробует сохранить набор цветов; если подходящей перестановки не найдено, цвета генерируются заново. Снег в каждой клетке, счёт и оставшиеся ходы при этом сохраняются. После 100 каскадов выполняется безопасное перемешивание без дополнительных очков за саму перестановку. `BoardState.rngSeed` хранит текущее состояние RNG после генерации/хода; исходный seed передаётся отдельно в `initializeGame` для воспроизведения.

Все 102 юнит-теста проходят; 13 тестов-заглушек заменены реальными проверками. Регрессии охватывают тысячи seed, принудительный резервный путь, неизменность входного состояния, продолжение после сериализации и ограничение каскадов даже при постоянном результате RNG.

Сцена подключена к движку M1. Временный режим **Free Play**: поле 8×8, пять типов плиток, неограниченные ходы, счёт и число успешных обменов. Нет снега, условий победы/поражения и бонуса за оставшиеся ходы. Конфигурации 2–10, прогресс и баланс остаются в M3.

Управление: свайп мышью/пальцем либо два нажатия на соседние плитки. Повторное нажатие снимает выделение; нажатие на дальнюю плитку переносит его. Стрелки перемещают выделение, Space/Enter начинают выбор, Shift + стрелка выполняет обмен. Pause/Resume и Escape приостанавливают ввод между ходами.

Неверный обмен анимируется обратно без изменения счёта и счётчика обменов. Каскады проигрываются последовательно: удаление → падение → заполнение; ввод блокируется до конца анимации. При отсутствии ходов движок автоматически перемешивает поле. `prefers-reduced-motion` сокращает анимации. Изменение размера окна сохраняет поле; ResizeObserver синхронизирует canvas с контейнером после смены ориентации, центрирование выполняется через CSS. Ошибка загрузки предлагает повторную загрузку, ошибка поля показывает явное сообщение.

`simulateMove(config, state, from, to, { endless: true })` включает режим без лимита ходов и завершения уровня; обычный вызов сохраняет правила M1. `MoveResult.frames` содержит независимые снимки каскадов для анимации, `boardState` — окончательное состояние после возможного перемешивания. Сцена не реализует повторно правила совпадений, гравитации или подсчёта очков.

Проверки: `npm run lint`, `npm run typecheck`, `npm test` (102 теста), `npm run build` и `npm run test:e2e -- --reporter=line --workers=1` (20 тестов) проходят. При сборке остаётся предупреждение о размере чанка Phaser.

Браузерные проверки охватывают обмен двумя нажатиями, настоящий touch-свайп, откат неверного обмена, блокировку ввода, каскады, паузу, клавиатуру, изменение размера во время анимации и 40 последовательных ходов. Поле и HUD проверяются на ширинах 320/375/768/1280 и в ландшафтном режиме. Проверки Mobile Chrome используют эмуляцию Chromium; Safari/Firefox и реальные устройства остаются для M6.

M0 принят по результатам локальных проверок. По решению от 2026-11-06 настройка и первый запуск CI отложены до появления необходимости в удалённом рабочем процессе и не блокируют закрытие M0.

---

*Разработано в соответствии с PROJECT_SPEC.md v1.0*

### Falling rows mode

Open **Settings** in the game HUD to choose **Classic** or **Falling rows**. Switching modes starts a fresh game; the selection is remembered on this device. Opening settings freezes the current game, and Cancel resumes it.

Falling rows starts with the bottom three rows filled and four tile colors. Tap an orthogonally connected group of at least two matching tiles to remove it. Surviving tiles fall down, then nonempty columns gather in the center while retaining their order. Tiles spin around their vertical axis when removed. Rows arrive every 5 seconds initially; the interval decreases by 250 ms every 10 rows, stopping at 3.5 seconds after 60 rows. Each removal takes one tenth of the current row interval (500 ms initially, decreasing to 350 ms after 60 rows), including with reduced motion enabled. During resolution, the last tapped tile is buffered and its group is removed once the board settles; an expired row timer takes priority. A subtle, steady coffee-colored outline marks the pending group and follows its tiles as they move. Singletons receive no pending outline.

A full-size preview directly above the board builds the next row from left to right over the countdown, with each tile aligned to its destination column. Rows arrive every five seconds, gradually speeding up by a quarter second every ten rows to a four-second minimum. Removal time scales with the interval to preserve roughly eight moves per row. The **Drop next row** button below the board completes the preview and releases the next row early, restarting the countdown. If a removal is underway, the requested row waits for it to finish. The countdown continues through removal animations; a due row waits for the current move to settle. Pause and settings freeze the timer. A new row that cannot fit ends the game; use Restart to begin again. Larger groups earn more points per tile.

## GitHub Pages и установка на телефон

Workflow `.github/workflows/pages.yml` публикует `dist/` при push в `main` или `master`.
В GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
Исходники и `package-lock.json` должны быть в репозитории; `dist/` и `node_modules/` не коммитятся.
Относительный `base: './'` поддерживает публикацию в подпапке репозитория.

Манифест находится в `public/manifest.webmanifest`, иконки — в `public/icons/`.
`npm run build` генерирует `dist/sw.js` со списком файлов и версией кеша по их содержимому.
После первой успешной загрузки и завершения кеширования игра доступна офлайн.
Откройте игру онлайн, подождите загрузки, закройте и откройте снова перед проверкой авиарежима.
После новой публикации откройте игру с интернетом, дайте браузеру скачать обновление,
закройте все окна/вкладки игры и запустите снова. Во время партии принудительной перезагрузки нет.
Данные кеша браузер или система могут удалить при очистке/нехватке места.

Android: меню браузера → «Установить приложение» / «Добавить на главный экран».
iPhone: Safari → «Поделиться» → «На экран Домой».
На Huawei без Google установка зависит от браузера: попробуйте в Huawei Browser
добавить страницу в закладки и выбрать главный экран. Ярлык тоже открывает актуальный сайт.
Если создание ярлыка не работает и телефон поддерживает Android APK, возможна отдельная
APK-оболочка с Android WebView, открывающая HTTPS-адрес опубликованной игры.
Она не требует Google Play Services; обновления веб-игры загружаются с сайта,
а изменения самой оболочки потребуют установки новой APK. Оболочка добавлена в `android/`, сборка — `.github/workflows/android.yml`.
Пошаговая настройка подписи, скачивание APK и установка: [docs/ANDROID.md](docs/ANDROID.md).
Для HarmonyOS NEXT требуется отдельное решение: Android APK там не поддерживаются.
