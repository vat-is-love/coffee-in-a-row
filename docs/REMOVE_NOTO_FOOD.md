# Как убрать временные фишки Noto Emoji

1. В `src/ui/settings.ts` убери вариант «Эмодзи», а в `src/ui/preferences.ts` убери `emoji` из списка стилей. Сохранённый выбор эмодзи тогда вернётся к кофейным зёрнам.
2. В `src/game/scenes/BootScene.ts` убери список `notoFood` и загрузку SVG. Продолжай создавать шесть игровых текстур для двух оставшихся стилей.
3. Обнови проверки стилей в `tests/e2e/game.spec.ts` и `tests/e2e/preferences.spec.ts`, описание в замысле и запись готовящегося выпуска в `coffee-levels/PATCH_NOTES.md`.
4. Удали папку `public/noto-food/` целиком, включая `LICENSE` и `NOTICE`, и этот файл.

Источник оригинальных SVG — [Noto Emoji v2.047](https://github.com/googlefonts/noto-emoji/tree/v2.047/svg). При сборке папка `public/noto-food/` копируется в игру вместе с лицензией Apache 2.0 и уведомлением Google об авторстве.
