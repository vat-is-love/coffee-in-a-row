# APK для Huawei без Android Studio

Оболочка открывает https://vat-is-love.github.io/coffee-in-a-row/ в Android WebView.
Google Play Services и аккаунт Google не требуются. Нужен телефон с поддержкой
Android APK (Android 6 или новее); HarmonyOS NEXT требует отдельного решения.
На старых устройствах совместимость Phaser/WebGL зависит от системного WebView:
первую APK нужно проверить на самом телефоне.

## 1. Один раз создать ключ подписи

На Ubuntu требуется только `keytool` из Java JDK — Android Studio и Android SDK
локально не нужны. Если команды нет: `sudo apt install openjdk-17-jdk-headless`.
Из корня проекта выполните:

```bash
mkdir -p android/signing
keytool -genkeypair -keystore android/signing/coffee-match.jks \
  -storetype JKS -alias coffee-match -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 android/signing/coffee-match.jks > android/signing/coffee-match.jks.base64
```

`keytool` спросит пароль хранилища, данные владельца и пароль ключа.
Можно нажать Enter на запросе пароля ключа, чтобы использовать пароль хранилища.
Сохраните ключ и пароли в резервной копии: все будущие APK должны подписываться
тем же ключом. Файлы ключа и base64 исключены из Git; не добавляйте их принудительно.

## 2. Добавить четыре секрета в GitHub

В репозитории откройте **Settings → Secrets and variables → Actions → Secrets →
New repository secret**.

| Name | Secret |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Всё содержимое `android/signing/coffee-match.jks.base64` |
| `ANDROID_KEYSTORE_PASSWORD` | Пароль хранилища |
| `ANDROID_KEY_ALIAS` | `coffee-match` |
| `ANDROID_KEY_PASSWORD` | Пароль ключа (тот же, если выбрали Enter) |

Base64-файл откройте в редакторе и скопируйте целиком в значение секрета.
Ключ в base64 также является секретом. Без этих настроек сборка остановится
с сообщением; временный ключ вместо постоянного не создаётся.

## 3. Отправить изменения и скачать APK

1. Закоммитьте и отправьте новые файлы проекта на GitHub.
2. Убедитесь, что workflow **Deploy game to GitHub Pages** успешно завершился
   и адрес игры открывается в браузере. В **Settings → Pages** должен быть
   выбран источник **GitHub Actions**.
3. Откройте **Actions → Build Android APK → Run workflow** на ветке с новыми файлами.
4. После успешной сборки откройте её и в разделе **Artifacts** скачайте
   `coffee-match-apk`.
5. Распакуйте ZIP: внутри будет `app-release.apk`. Отправьте именно этот файл.

Сборка запускается вручную: для обычного обновления игры пересобирать оболочку не нужно.
Репозиторий может быть приватным: APK скачивает владелец и передаёт файл получателю.
При этом сама страница игры должна быть доступна телефону по HTTPS без авторизации.
GitHub-токены в оболочку не встраиваются.

Если игра переедет, задайте в **Settings → Secrets and variables → Actions →
Variables** переменную `ANDROID_GAME_URL` с новым HTTPS-адресом и завершающим `/`.
После этого соберите и установите новую APK. При смене домена/пути веб-хранилище
может отличаться, поэтому перенос сохранений не гарантируется.

## 4. Установить на Huawei

Скачайте APK на телефон и откройте через файловый менеджер. Если система запросит,
разрешите этому приложению установку из внешнего источника. Названия настроек
зависят от версии EMUI/HarmonyOS. После установки появится иконка Coffee Match.
Первый запуск — с интернетом. Если страница не загрузилась, есть кнопка «Повторить».

Прогресс браузера в APK автоматически не переносится: у WebView отдельное хранилище.
Не удаляйте приложение и не очищайте его данные, если хотите сохранить настройки/рекорды.

## Обновления и офлайн

Изменения игры публикуются существующим Pages workflow. Откройте приложение онлайн,
дайте ему скачать обновление, затем полностью закройте приложение (кнопка «Назад» →
«Закрыть») и откройте снова. Простое сворачивание приложения может не активировать
новый service worker. Обновления не перезагружают текущую партию.

Офлайн возможен после успешного кеширования service worker, если WebView устройства
поддерживает его. Для проверки загрузите игру онлайн, закройте её и запустите
снова в авиарежиме. Система может удалить кеш при очистке данных/нехватке места.

Для обновления самой оболочки повторите сборку и установите новую APK поверх старой.
Workflow увеличивает `versionCode` по номеру запуска и использует постоянный ключ.
Не удаляйте и не создавайте workflow заново со сбросом нумерации без проверки versionCode.
Идентификатор приложения `com.coffeematch.game` должен оставаться прежним.

## Локальная сборка (необязательно)

Нужны JDK 17, Gradle 8.11.1 и Android command-line SDK с platform 35 / build-tools 35.0.0.
Android Studio не нужен. Для проверки без release-ключа:

```bash
gradle -p android :app:assembleDebug :app:lintDebug
```

Debug APK не следует использовать вместо подписанной release APK для передачи и
дальнейших обновлений. В репозитории нет Gradle Wrapper: в Actions нужную версию
устанавливает `gradle/actions/setup-gradle`.

## Recovery and diagnostics (2026-11)

Supported: Android 8/API 26 or newer **with Android System WebView/Chrome 102+**.
API 26 is required for the renderer-process recovery callback.
OS version alone does not guarantee a compatible WebView. Google Play Services are not required.
The web build targets Chrome 102 and checks native dialog support before startup.

Web deployment (`npm run build`, publish the complete `dist` through the existing Pages workflow)
adds an independent inline loading/recovery screen, a 20-second watchdog and local diagnostic export.
Startup succeeds only after the mode picker is shown. No automatic reload occurs. Diagnostics
contain only error categories/names, source basenames, timestamps, build/APK identifiers and UA;
they never include saved values or error payloads. The bounded journal lives in memory and is lost
on reload: copy it before Retry. If clipboard access fails, select the displayed text manually.
Corrupt falling records are copied verbatim to `coffee-falling-records-recovery-<timestamp>` before
replacement. If backup fails, writing records is disabled for that attempt; the original survives.
Existing arrays are version 0; preference objects accept legacy/no version and version 1.

Service worker installs only after every precached file matches its build digest. No skipWaiting
or forced reload: close **all** game tabs/app windows to let a waiting update activate. Cache cleanup
only touches this game's scoped prefix; storage is never cleared. First launch still needs internet.
A previously installed broken worker may keep serving the previous site until its windows close.

The native timeout, renderer recovery, native diagnostic dialog, APK user-agent identifier and
debug-only remote inspection require an **updated APK**. Build using the existing Android workflow
with a higher `versionCode`, the same application ID and signing key. Install over the old APK
(`adb install -r <apk>`); do not uninstall or clear app data, as that deletes local records.
For local Gradle builds use `gradle -p android assembleDebug` or signed `assembleRelease` with
existing signing environment variables (see above). No Gradle wrapper is included in this project.

On the affected phone:
1. Copy existing diagnostics before retrying. Record Android and System WebView versions.
2. Publish the web build, close every game window, reopen online, then install the updated signed APK.
3. Open both modes and verify existing records/settings; play Falling rows through a loss.
4. Relaunch offline after a successful online launch; test airplane mode on first launch separately.
5. Test native main-page HTTP/network failures and renderer termination using a debug APK/device.
6. On a debug build inspect via desktop Chrome `chrome://inspect`; release inspection is disabled.
7. To verify update safety, start a round on release A, publish B, confirm the round is uninterrupted,
   close every client, reopen and copy diagnostics to confirm B. Never clear app storage to update.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`,
`node scripts/check-service-worker.mjs`, `npm run test:e2e -- tests/e2e/recovery.spec.ts`.
Browser tests cover interface readiness, missing main JS, startup exception/timeouts, clipboard
fallback and denied storage/vibration. Unit tests cover exact backup and preserved legacy records.
Native callbacks and real-device WebView behavior require a device/emulator; web recovery cannot
handle a totally frozen renderer thread, which must be closed/reopened through Android.

## Локальные резервные копии после удаления приложения

Оболочка `CoffeeBackup/2` использует галочку **«Сохранять прогресс после удаления»**
в настройках и на первом экране. Пользователь не выбирает и не создаёт папки.
После разрешения доступа приложение само создаёт локальную `Documents/CoffeeMatch`.
Google-сервисы и сервер не требуются. Веб-данные и APK нужно обновить; новую APK
с той же подписью сначала установите поверх старой, затем включите сохранение.

На Android 11+ галочка открывает системную страницу **«Доступ ко всем файлам»**
(`MANAGE_EXTERNAL_STORAGE`), где пользователь разрешает доступ и возвращается
в игру. Это широкое разрешение на общее хранилище; реализация работает только
с двумя файлами в фиксированной папке CoffeeMatch. На Android 8–10 используется
системный запрос разрешения записи; для Android 10 включён legacy storage.
Разрешение не запрашивается до включения галочки. Отказ оставляет копирование
выключенным, сама игра продолжает работать. Если прошивка не предоставляет
необходимый доступ, показывается ошибка, выбор папки автоматически не открывается.

Файл `backup.json` хранит настройки языка, режима, вибрации и рекорды обоих режимов.
Копия обновляется после сохранения настроек, выбора режима, завершения игры и при
запуске, если сохранение включено. Текущая партия/поле, кэш и диагностика не входят.
`backup.previous.json` хранит предыдущее проверенное поколение. Запись использует
AtomicFile и проверяется чтением после сохранения; файловые операции выполняются
вне UI-потока. Размер каждой копии ограничен 4 МиБ.

После переустановки включите ту же галочку и снова разрешите доступ. Игра сама
найдёт файлы в фиксированной папке и предложит восстановление. Выбирается самая
свежая корректная копия из двух; рекорды объединяются без повторов, настройки
берутся из копии, игра перезапускается. Если оба файла повреждены, сохранение
не включается и файлы не перезаписываются. Повреждённые текущие локальные рекорды
тоже блокируют восстановление, чтобы сохранить исходные данные.

Снятие галочки прекращает запись, но сохраняет существующие копии. Оно не отзывает
системное разрешение: при необходимости это делается в настройках Android.
Отмена восстановления не активирует запись в папку. После ошибки записи проверьте
свободное место; после отзыва доступа выключите/включите галочку и разрешите доступ
снова. Старые оболочки `CoffeeBackup/1` сохраняют прежний интерфейс выбора папки;
обычный браузер и APK без поддержки копирования его не показывают.

Сборка распространяется через APK. Публикация в Google Play с широким разрешением
доступа требует отдельной оценки политики магазина; такое разрешение ограничено
основным назначением приложения, и игровая резервная копия сама по себе не даёт
оснований для одобрения. Не использовать эту конфигурацию как готовую Play-сборку.

Проверка на телефоне в дополнение к автоматическим тестам протокола:
1. Включите галочку, откажите в доступе: она остаётся выключенной, игра работает.
2. Включите повторно и разрешите доступ: папка/копия создаются без файлового диалога.
3. Измените настройки и завершите игры обоих режимов; проверьте дату копии.
4. Снимите галочку: файлы остаются, дальнейшие результаты в копию не записываются.
5. На тестовой установке удалите APK, оставив папку, установите снова; включите
   сохранение и восстановитесь до выбора режима, сравните рекорды/настройки.
6. Проверьте отмену восстановления, отозванный доступ, нехватку места,
   повреждённый основной файл и оба повреждённых файла, запуск офлайн.
