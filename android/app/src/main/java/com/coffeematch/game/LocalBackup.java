package com.coffeematch.game;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Explicit opt-in, fixed public folder; no folder picker, account or Google service. */
final class LocalBackup {
    static final int REQUEST_ACCESS = 702;
    private static final int LIMIT = 4 * 1024 * 1024;
    private final MainActivity activity;
    private final SharedPreferences preferences;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private String permissionId;
    private boolean enabling;
    private boolean prepared;
    private volatile boolean closed;

    LocalBackup(MainActivity activity) {
        this.activity = activity;
        preferences = activity.getSharedPreferences("local-backup", Activity.MODE_PRIVATE);
    }

    private boolean hasAccess() {
        if (Build.VERSION.SDK_INT >= 30) return Environment.isExternalStorageManager();
        return activity.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
                && (Build.VERSION.SDK_INT < 29 || Environment.isExternalStorageLegacy());
    }

    private File folder() {
        return new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), "CoffeeMatch");
    }

    private File requireFolder() throws Exception {
        if (!hasAccess()) throw new SecurityException("storage-access-required");
        if (!Environment.MEDIA_MOUNTED.equals(Environment.getExternalStorageState())) throw new java.io.IOException("storage-unavailable");
        File directory = folder();
        if (!directory.isDirectory() && !directory.mkdirs()) throw new java.io.IOException("create-folder-failed");
        return directory;
    }

    void handle(String raw) {
        String id = "";
        try {
            if (raw == null || raw.length() > 2 * LIMIT + 65536) throw new IllegalArgumentException();
            JSONObject request = new JSONObject(raw);
            id = request.getString("id");
            if (id.length() > 100) throw new IllegalArgumentException();
            String action = request.getString("action");
            if ("enable".equals(action)) {
                if (enabling) throw new IllegalStateException("busy");
                enabling = true;
                prepared = false;
                permissionId = id;
                if (hasAccess()) { onAccessResult(); return; }
                try {
                    if (Build.VERSION.SDK_INT >= 30) {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                                Uri.parse("package:" + activity.getPackageName()));
                        try { activity.startActivityForResult(intent, REQUEST_ACCESS); }
                        catch (android.content.ActivityNotFoundException missing) {
                            activity.startActivityForResult(new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION), REQUEST_ACCESS);
                        }
                    } else {
                        activity.requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQUEST_ACCESS);
                    }
                } catch (RuntimeException exception) { enabling = false; permissionId = null; throw exception; }
                return;
            }
            final String replyId = id;
            io.execute(() -> {
                try {
                    switch (action) {
                        case "status": break;
                        case "activate":
                            if (!prepared || !hasAccess()) throw new IllegalStateException("not-prepared");
                            if (!preferences.edit().putBoolean("enabled", true).putLong("savedAt", 0)
                                    .putString("error", "").commit()) throw new java.io.IOException("preferences");
                            prepared = false;
                            break;
                        case "disable":
                            prepared = false;
                            if (!preferences.edit().putBoolean("enabled", false).putString("error", "").commit())
                                throw new java.io.IOException("preferences");
                            // Leave external copies in place, including when access has been revoked.
                            break;
                        case "write":
                            if (!preferences.getBoolean("enabled", false)) throw new IllegalStateException("disabled");
                            write(request.getString("data"));
                            break;
                        default: throw new IllegalArgumentException("unknown-action");
                    }
                    reply(replyId, status());
                } catch (Exception exception) { fail(replyId, "backup-operation-failed"); }
            });
        } catch (Exception exception) { fail(id, "backup-request-failed"); }
    }

    // Settings activity resultCode is not meaningful: inspect the permission itself.
    void onAccessResult() {
        final String id = permissionId;
        permissionId = null;
        if (id == null) return;
        if (!hasAccess()) {
            enabling = false;
            try { reply(id, new JSONObject().put("cancelled", true)); } catch (Exception ignored) { }
            return;
        }
        io.execute(() -> {
            try {
                File directory = requireFolder();
                JSONArray candidates = new JSONArray();
                for (String name : new String[]{"backup.json", "backup.previous.json"}) {
                    File file = new File(directory, name);
                    if (exists(file)) candidates.put(read(file));
                }
                prepared = true;
                reply(id, new JSONObject().put("candidates", candidates));
            } catch (Exception exception) { prepared = false; fail(id, "backup-storage-failed"); }
            finally { enabling = false; }
        });
    }

    private JSONObject status() throws Exception {
        boolean enabled = preferences.getBoolean("enabled", false);
        return new JSONObject().put("enabled", enabled).put("folder", enabled ? "Documents/CoffeeMatch" : "")
                .put("savedAt", preferences.getLong("savedAt", 0))
                .put("warning", enabled && (!hasAccess() || !preferences.getString("error", "").isEmpty()));
    }

    private boolean exists(File file) { return file.exists() || new File(file.getPath() + ".bak").exists(); }

    private String read(File file) throws Exception {
        try (InputStream input = new AtomicFile(file).openRead();
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (bytes.size() + count > LIMIT) throw new java.io.IOException("too-large");
                bytes.write(buffer, 0, count);
            }
            return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void put(File file, String raw) throws Exception {
        AtomicFile atomic = new AtomicFile(file);
        FileOutputStream output = null;
        try {
            output = atomic.startWrite();
            output.write(raw.getBytes(StandardCharsets.UTF_8));
            atomic.finishWrite(output);
        } catch (Exception exception) {
            if (output != null) atomic.failWrite(output);
            throw exception;
        }
        if (!raw.equals(read(file))) throw new java.io.IOException("verification-failed");
    }

    private void write(String raw) throws Exception {
        try {
            JSONObject backup = validate(raw);
            File directory = requireFolder();
            File main = new File(directory, "backup.json");
            // Keep the previous complete generation before committing the next one.
            if (exists(main)) {
                String previous = read(main);
                boolean valid = false;
                try { validate(previous); valid = true; } catch (Exception ignored) { }
                if (valid) put(new File(directory, "backup.previous.json"), previous);
            }
            put(main, raw);
            preferences.edit().putLong("savedAt", backup.getLong("savedAt")).putString("error", "").commit();
        } catch (Exception exception) {
            preferences.edit().putString("error", "write-failed").commit();
            throw exception;
        }
    }

    private JSONObject validate(String raw) throws Exception {
        if (raw.getBytes(StandardCharsets.UTF_8).length > LIMIT) throw new IllegalArgumentException("too-large");
        JSONObject backup = new JSONObject(raw);
        if (!"coffee-match-backup".equals(backup.getString("format")) || backup.getInt("version") != 1
                || backup.getLong("savedAt") < 0)
            throw new IllegalArgumentException("invalid-backup");
        JSONObject values = backup.getJSONObject("data");
        java.util.Iterator<String> keys = values.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            String value = values.getString(key);
            if ("coffee-preferences".equals(key)) {
                JSONObject prefs = new JSONObject(value);
                Object version = prefs.opt("version");
                Object lang = prefs.opt("language");
                Object mode = prefs.opt("mode");
                if ((version != null && (!(version instanceof Number) || ((Number)version).doubleValue() != 1))
                        || (!"ru".equals(lang) && !"en".equals(lang)) || !(prefs.opt("vibration") instanceof Boolean)
                        || (mode != null && !"classic".equals(mode) && !"falling".equals(mode)))
                    throw new IllegalArgumentException("invalid-preferences");
            } else if ("coffee-classic-records".equals(key) || "coffee-falling-records".equals(key)) {
                JSONArray records = new JSONArray(value);
                for (int i = 0; i < records.length(); i++) {
                    JSONObject record = records.getJSONObject(i);
                    integer(record.get("score")); integer(record.get("rows"));
                    integer(record.get("playedAt"));
                    if (record.getDouble("playedAt") > 8640000000000000d) throw new IllegalArgumentException("date");
                    if (record.has("durationMs")) integer(record.get("durationMs"));
                    else if ("coffee-classic-records".equals(key)) throw new IllegalArgumentException("duration");
                }
            } else throw new IllegalArgumentException("unknown-key");
        }
        return backup;
    }

    private void integer(Object value) {
        if (!(value instanceof Number)) throw new IllegalArgumentException("number");
        double n = ((Number)value).doubleValue();
        if (Double.isNaN(n) || n < 0 || n > 9007199254740991d || n != Math.floor(n))
            throw new IllegalArgumentException("integer");
    }

    private void reply(String id, JSONObject value) {
        if (!closed) activity.runOnUiThread(() -> {
            if (!closed) activity.backupReply(id, value);
        });
    }
    private void fail(String id, String error) {
        try { reply(id, new JSONObject().put("error", error)); } catch (Exception ignored) { }
    }
    void close() { closed = true; io.shutdown(); }
}
