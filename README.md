# Jackpot Jock: Snowstorm Match-3

Браузерная кофейная Match-3 игра с 10 уровнями и публичным лидербордом.

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

Текущий этап: **M0 - Repository foundation** ✓

---

*Разработано в соответствии с PROJECT_SPEC.md v1.0*