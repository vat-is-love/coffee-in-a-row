package com.coffeematch.game;

import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

final class ApkUpdater {
    static final int REQUEST_INSTALL_ACCESS = 601;
    private static final long RETRY_DELAY_MS = TimeUnit.HOURS.toMillis(2);
    private static final int APK_LIMIT = 64 * 1024 * 1024;
    private static final String RELEASES = "https://github.com/" + BuildConfig.RELEASE_REPOSITORY + "/releases/";

    private final MainActivity activity;
    private final SharedPreferences prefs;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private String webBuild = "";
    private boolean checking;
    private boolean manualCheck;
    private boolean downloading;
    private Runnable whenFocused;

    ApkUpdater(MainActivity activity) {
        this.activity = activity;
        prefs = activity.getSharedPreferences("apk-update", 0);
    }

    void gameReady(String build) {
        // Published Pages builds use major.minor.runNumber.
        webBuild = build.matches("[0-9]{1,9}\\.[0-9]{1,9}\\.[0-9]{1,12}") ? build : "";
        check(false);
    }

    void check(boolean manual) {
        if (downloading) return;
        if (checking) {
            manualCheck |= manual;
            return;
        }
        String build = webBuild;
        boolean sameBuild = !build.isEmpty() && build.equals(prefs.getString("checkedBuild", ""));
        long retryAt = sameBuild ? prefs.getLong("retryAt", 0) : 0;
        if (!manual && (build.isEmpty() || (sameBuild && (retryAt == 0 || System.currentTimeMillis() < retryAt)))) return;

        checking = true;
        manualCheck = manual;
        worker.execute(() -> {
            Release latest = null;
            boolean failed = false;
            try {
                latest = fetchRelease();
            } catch (Exception exception) {
                failed = true;
                android.util.Log.w("CoffeeUpdate", "APK update check failed", exception);
            }
            Release release = latest;
            boolean requestFailed = failed;
            activity.runOnUiThread(() -> finishCheck(build, sameBuild, retryAt, release, requestFailed));
        });
    }

    private void finishCheck(String build, boolean sameBuild, long retryAt, Release release, boolean failed) {
        checking = false;
        if (!isAlive()) return;
        boolean manual = manualCheck;
        boolean available = release != null && release.versionCode > BuildConfig.VERSION_CODE;
        if (!failed && !build.isEmpty()) {
            long now = System.currentTimeMillis();
            long nextCheck = 0;
            if (!available) {
                if (!sameBuild) nextCheck = now + RETRY_DELAY_MS;
                else if (retryAt > now) nextCheck = retryAt;
            }
            prefs.edit().putString("checkedBuild", build).putLong("retryAt", nextCheck).apply();
        }
        if (available && (manual || release.versionCode > prefs.getInt("offeredVersion", 0))) {
            runWhenFocused(() -> offer(release));
        } else if (manual) {
            if (failed) {
                notify("Could not check for an Android app update.", "Не удалось проверить обновление Android-приложения.");
            } else if (release == null) {
                notify("No Android update has been published yet.", "Обновление Android-приложения ещё не опубликовано.");
            } else {
                notify("The Android app is up to date.", "У Android-приложения актуальная версия.");
            }
        }
        if (!build.equals(webBuild) && !available) check(false);
    }

    private void offer(Release release) {
        prefs.edit().putInt("offeredVersion", release.versionCode).apply();
        new AlertDialog.Builder(activity)
                .setTitle(activity.label("Android update available", "Доступно обновление приложения"))
                .setMessage(activity.label("Install Android build " + release.versionCode + "?",
                        "Установить сборку Android № " + release.versionCode + "?"))
                .setPositiveButton(activity.label("Update", "Обновить"), (dialog, which) -> download(release))
                .setNegativeButton(activity.label("Later", "Позже"), null)
                .show();
    }

    private void download(Release release) {
        if (downloading) return;
        downloading = true;
        notify("Downloading Android update…", "Загружаем обновление Android-приложения…");
        worker.execute(() -> {
            boolean success = false;
            try {
                downloadAndVerify(release);
                success = true;
            } catch (Exception exception) {
                android.util.Log.w("CoffeeUpdate", "APK update download failed", exception);
            }
            boolean verified = success;
            activity.runOnUiThread(() -> {
                downloading = false;
                if (!isAlive()) return;
                if (verified) runWhenFocused(this::requestInstall);
                else notify("Could not download or verify the update.", "Не удалось загрузить или проверить обновление.");
            });
        });
    }

    private void requestInstall() {
        try {
            if (activity.getPackageManager().canRequestPackageInstalls()) {
                openInstaller();
                return;
            }
            new AlertDialog.Builder(activity)
                    .setMessage(activity.label(
                            "Allow Coffee Match to install apps in Android settings, then return to continue.",
                            "Разрешите Coffee Match устанавливать приложения в настройках Android, затем вернитесь в игру."))
                    .setPositiveButton(activity.label("Open settings", "Открыть настройки"), (dialog, which) -> {
                        try {
                            activity.startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:" + activity.getPackageName())), REQUEST_INSTALL_ACCESS);
                        } catch (RuntimeException exception) {
                            installUnavailable();
                        }
                    })
                    .setNegativeButton(activity.label("Cancel", "Отмена"), null)
                    .show();
        } catch (RuntimeException exception) {
            installUnavailable();
        }
    }

    void onInstallAccessResult() {
        if (activity.getPackageManager().canRequestPackageInstalls()) runWhenFocused(this::openInstaller);
    }

    private void openInstaller() {
        if (!UpdateApkProvider.apkFile(activity).isFile()) {
            installUnavailable();
            return;
        }
        try {
            Intent install = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(UpdateApkProvider.APK_URI, UpdateApkProvider.APK_TYPE)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            install.setClipData(ClipData.newRawUri("Coffee Match APK", UpdateApkProvider.APK_URI));
            activity.startActivity(install);
        } catch (RuntimeException exception) {
            installUnavailable();
        }
    }

    private void installUnavailable() {
        notify("Could not open the Android installer.", "Не удалось открыть установщик Android.");
    }

    private void notify(String en, String ru) {
        Toast.makeText(activity, activity.label(en, ru), Toast.LENGTH_LONG).show();
    }

    private boolean isAlive() { return !activity.isFinishing() && !activity.isDestroyed() && !worker.isShutdown(); }

    private void runWhenFocused(Runnable action) {
        whenFocused = action;
        if (activity.hasWindowFocus()) onWindowFocused();
    }

    void onWindowFocused() {
        if (whenFocused == null || !isAlive()) return;
        Runnable action = whenFocused;
        whenFocused = null;
        action.run();
    }

    void close() {
        whenFocused = null;
        worker.shutdownNow();
    }

    private static Release fetchRelease() throws Exception {
        HttpURLConnection connection = connect("latest/download/android-update.json");
        try {
            int status = connection.getResponseCode();
            if (status == HttpURLConnection.HTTP_NOT_FOUND) return null;
            requireOk(status);
            ByteArrayOutputStream data = new ByteArrayOutputStream();
            try (InputStream stream = connection.getInputStream()) {
                byte[] buffer = new byte[1024];
                for (int size; (size = stream.read(buffer)) != -1;) {
                    if (data.size() + size > 4096) throw new IOException("Update metadata too large");
                    data.write(buffer, 0, size);
                }
            }
            JSONObject json = new JSONObject(new String(data.toByteArray(), StandardCharsets.UTF_8));
            int versionCode = json.getInt("versionCode");
            String sha256 = json.getString("sha256");
            if (versionCode < 1 || !sha256.matches("[0-9a-f]{64}")) throw new IOException("Invalid update metadata");
            return new Release(versionCode, sha256);
        } finally {
            connection.disconnect();
        }
    }

    private void downloadAndVerify(Release release) throws Exception {
        File temporary = File.createTempFile("coffee-update-", ".apk", activity.getCacheDir());
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            HttpURLConnection connection = connect("download/android-" + release.versionCode + "/CoffeeMatch.apk");
            try {
                requireOk(connection.getResponseCode());
                long deadline = SystemClock.elapsedRealtime() + TimeUnit.MINUTES.toMillis(3);
                try (InputStream stream = connection.getInputStream(); FileOutputStream output = new FileOutputStream(temporary)) {
                    byte[] buffer = new byte[32 * 1024];
                    long bytes = 0;
                    for (int size; (size = stream.read(buffer)) != -1;) {
                        bytes += size;
                        if (bytes > APK_LIMIT || SystemClock.elapsedRealtime() > deadline || Thread.currentThread().isInterrupted()) {
                            throw new IOException("APK download exceeded its limit");
                        }
                        output.write(buffer, 0, size);
                        digest.update(buffer, 0, size);
                    }
                }
            } finally {
                connection.disconnect();
            }
            StringBuilder sha256 = new StringBuilder(64);
            for (byte value : digest.digest()) {
                sha256.append(Character.forDigit((value & 0xff) >> 4, 16));
                sha256.append(Character.forDigit(value & 0xf, 16));
            }
            if (!release.sha256.contentEquals(sha256)) throw new IOException("APK checksum mismatch");
            PackageInfo info = activity.getPackageManager().getPackageArchiveInfo(temporary.getPath(), 0);
            if (info == null || !activity.getPackageName().equals(info.packageName)) throw new IOException("Wrong APK package");
            long version = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            if (version != release.versionCode || version <= BuildConfig.VERSION_CODE) throw new IOException("Wrong APK version");
            if (!temporary.renameTo(UpdateApkProvider.apkFile(activity))) throw new IOException("Could not stage APK");
        } finally {
            if (temporary.exists() && !temporary.delete()) android.util.Log.w("CoffeeUpdate", "Could not delete partial APK");
        }
    }

    private static HttpURLConnection connect(String path) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(RELEASES + path).openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(15000);
        connection.setUseCaches(false);
        return connection;
    }

    private static void requireOk(int status) throws IOException {
        if (status != HttpURLConnection.HTTP_OK) throw new IOException("Unexpected HTTP status " + status);
    }

    private static final class Release {
        final int versionCode;
        final String sha256;

        Release(int versionCode, String sha256) {
            this.versionCode = versionCode;
            this.sha256 = sha256;
        }
    }
}
