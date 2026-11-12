package com.coffeematch.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final Uri GAME_URI = Uri.parse(BuildConfig.GAME_URL);
    private WebView web;
    private LocalBackup backup;
    private ApkUpdater updater;
    private final java.util.ArrayList<Runnable> pendingBackupReplies = new java.util.ArrayList<>();
    private LinearLayout root;
    private LinearLayout error;
    private boolean failed;
    private String diagnostic = "startup";
    private String webDiagnostic = "not-observed";
    private final android.os.Handler watchdog = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable timeout = () -> showError("native-load-timeout");
    private final Runnable checkReady = new Runnable() {
        @Override public void run() {
            if (web == null || failed) return;
            web.evaluateJavascript("JSON.stringify({documentState:document.readyState,version:document.documentElement.dataset.coffeeBuild,lang:document.documentElement.lang,recovery:window.CoffeeRecovery ? (window.CoffeeRecovery.diagnostics ? window.CoffeeRecovery.diagnostics() : {ready:window.CoffeeRecovery.isReady()}) : null})", value -> {
                if (failed || web == null) return;
                try {
                    webDiagnostic = new org.json.JSONTokener(value).nextValue().toString();
                    org.json.JSONObject page = new org.json.JSONObject(webDiagnostic);
                    org.json.JSONObject recovery = page.optJSONObject("recovery");
                    if (recovery != null && recovery.optBoolean("ready")) {
                        watchdog.removeCallbacks(timeout);
                        if (isGameUrl(web.getUrl())) {
                            setLanguage(page.optString("lang"));
                            updater.gameReady(page.optString("version"));
                        }
                        return;
                    }
                } catch (org.json.JSONException ignored) { }
                watchdog.postDelayed(this, 500);
            });
        }
    };
    private boolean ru;
    String label(String en, String russian) { return ru ? russian : en; }

    private void setLanguage(String language) {
        if (!"en".equals(language) && !"ru".equals(language)) return;
        ru = "ru".equals(language);
        getPreferences(0).edit().putBoolean("ru", ru).apply();
    }

    private static boolean isGameUrl(String url) {
        return url != null && isGameUrl(Uri.parse(url));
    }

    private static boolean isGameUrl(Uri url) {
        String path = url.getPath();
        return "https".equals(url.getScheme()) && GAME_URI.getHost().equals(url.getHost())
                && url.getPort() == GAME_URI.getPort() && path != null
                && path.startsWith(GAME_URI.getPath());
    }

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        ru = getPreferences(0).getBoolean("ru", java.util.Locale.getDefault().getLanguage().equals("ru"));
        backup = new LocalBackup(this);
        updater = new ApkUpdater(this);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(26, 26, 46));
        // Keep controls outside system bars, including Android 15 edge-to-edge.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(26, 26, 46));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " CoffeeBackup/2 CoffeeHaptics/1 CoffeeUpdater/1 CoffeeAPK/" + BuildConfig.VERSION_NAME + "." + BuildConfig.VERSION_CODE);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override public boolean onJsPrompt(WebView view, String url, String message, String value,
                    android.webkit.JsPromptResult result) {
                if (!"coffee-haptics".equals(message) && !"coffee-backup".equals(message)
                        && !"coffee-apk-update".equals(message)) { result.cancel(); return true; }
                if (!isGameUrl(url) || !hasWindowFocus()) {
                    result.confirm("rejected"); return true;
                }
                if ("coffee-apk-update".equals(message)) {
                    if (!isGameUrl(view.getUrl())) { result.confirm("rejected"); return true; }
                    result.confirm("accepted");
                    setLanguage(value);
                    updater.check(true);
                    return true;
                }
                if ("coffee-backup".equals(message)) {
                    result.confirm("accepted");
                    backup.handle(value);
                    return true;
                }
                try {
                    android.os.Vibrator motor = (android.os.Vibrator)getSystemService(VIBRATOR_SERVICE);
                    if (motor == null || !motor.hasVibrator()) { result.confirm("no-vibrator"); return true; }
                    if ("cancel".equals(value)) motor.cancel();
                    else if ("match".equals(value)) motor.vibrate(android.os.VibrationEffect.createOneShot(25, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                    else if ("loss".equals(value) || "test".equals(value)) {
                        long[] pattern = "test".equals(value) ? new long[]{0, 150, 100, 150} : new long[]{0, 80, 50, 120};
                        motor.vibrate(android.os.VibrationEffect.createWaveform(pattern, -1));
                    } else { result.confirm("unknown-event"); return true; }
                    result.confirm("requested");
                } catch (RuntimeException exception) { result.confirm("error:" + exception.getClass().getSimpleName()); }
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (isGameUrl(url)) return false;
                if (request.isForMainFrame() && ("https".equals(url.getScheme()) || "http".equals(url.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                    catch (android.content.ActivityNotFoundException ignored) { }
                }
                return true;
            }
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                failed = false;
                webDiagnostic = "navigation-started";
                watchdog.removeCallbacks(checkReady);
                watchdog.post(checkReady);
                watchdog.removeCallbacks(timeout);
                watchdog.postDelayed(timeout, 20000);
                error.setVisibility(View.GONE);
                web.setVisibility(View.VISIBLE);
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError detail) {
                if (request.isForMainFrame()) showError("main-frame-network:" + detail.getErrorCode());
            }
            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request,
                    android.webkit.WebResourceResponse response) {
                if (request.isForMainFrame()) showError("main-frame-http:" + response.getStatusCode());
            }
            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                showError("renderer-gone:" + detail.didCrash());
                root.removeView(view);
                view.destroy();
                web = null;
                return true;
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                if (failed) return;
                watchdog.removeCallbacks(checkReady);
                watchdog.post(checkReady);
                view.evaluateJavascript("document.documentElement.lang", value -> {
                    if ("\"ru\"".equals(value) || "\"en\"".equals(value)) getPreferences(0).edit().putBoolean("ru", "\"ru\"".equals(value)).apply();
                });
                // Check for web updates on every launch; never interrupt a running game.
                view.evaluateJavascript("if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistration().then(function(r) { if(r) r.update().catch(function() {}); }); }", null);
            }
        });
        error = new LinearLayout(this);
        error.setOrientation(LinearLayout.VERTICAL);
        error.setPadding(32, 32, 32, 32);
        TextView message = new TextView(this);
        message.setText(label("Unable to load game. Check your connection and update Android System WebView (Chrome 102+).", "Не удалось загрузить игру. Проверьте интернет и обновите Android System WebView (Chrome 102+)."));
        message.setTextColor(Color.WHITE);
        error.addView(message);
        Button retry = new Button(this);
        retry.setText(label("Retry", "Повторить"));
        retry.setOnClickListener(v -> { if (web == null) recreate(); else web.loadUrl(BuildConfig.GAME_URL); });
        Button copy = new Button(this);
        copy.setText(label("Copy diagnostics", "Скопировать диагностику"));
        copy.setOnClickListener(v -> {
            String report = "APK " + BuildConfig.VERSION_NAME + "." + BuildConfig.VERSION_CODE + " Android " + android.os.Build.VERSION.RELEASE
                + "\n" + diagnostic + "\nWeb: " + webDiagnostic + "\n" + (web == null ? "renderer unavailable" : web.getSettings().getUserAgentString());
            try { ((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(android.content.ClipData.newPlainText("Coffee diagnostics", report)); }
            catch (RuntimeException ignored) { }
            new AlertDialog.Builder(this).setMessage(report).setPositiveButton("OK", null).show();
        });
        error.addView(copy);
        error.addView(retry);
        error.setVisibility(View.GONE);
        root.addView(error);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        web.loadUrl(BuildConfig.GAME_URL);
    }

    void backupReply(String id, org.json.JSONObject reply) {
        if (web == null || isFinishing() || isDestroyed()) return;
        // Permission settings return before the activity necessarily regains focus.
        // Wait before delivering data that can trigger the next trusted JS prompt.
        if (!hasWindowFocus()) { pendingBackupReplies.add(() -> backupReply(id, reply)); return; }
        if (!isGameUrl(web.getUrl())) return;
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('coffee-backup-result',{detail:{id:"
                + org.json.JSONObject.quote(id) + ",reply:" + reply.toString() + "}}))", null);
    }

    @Override
    public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused && !pendingBackupReplies.isEmpty()) {
            java.util.ArrayList<Runnable> ready = new java.util.ArrayList<>(pendingBackupReplies);
            pendingBackupReplies.clear();
            for (Runnable reply : ready) reply.run();
        }
        if (focused && updater != null) updater.onWindowFocused();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == LocalBackup.REQUEST_ACCESS) backup.onAccessResult();
        if (requestCode == ApkUpdater.REQUEST_INSTALL_ACCESS) updater.onInstallAccessResult();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LocalBackup.REQUEST_ACCESS) backup.onAccessResult();
    }

    private void showError(String code) {
        watchdog.removeCallbacks(checkReady);
        watchdog.removeCallbacks(timeout);
        diagnostic = new java.util.Date().toString() + " " + code;
        failed = true;
        if (web != null) web.setVisibility(View.GONE);
        error.setVisibility(View.VISIBLE);
    }

    @Override
    public void onBackPressed() {
        new AlertDialog.Builder(this).setMessage("Закрыть игру?")
            .setPositiveButton("Закрыть", (dialog, which) -> finish())
            .setNegativeButton("Продолжить", null).show();
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("document.documentElement.lang", value -> {
                if ("\"ru\"".equals(value) || "\"en\"".equals(value)) {
                    ru = "\"ru\"".equals(value);
                    getPreferences(0).edit().putBoolean("ru", ru).apply();
                }
            });
            web.onPause();
        }
        android.os.Vibrator motor = (android.os.Vibrator)getSystemService(VIBRATOR_SERVICE);
        if (motor != null) motor.cancel();
        super.onPause();
    }
    @Override
    protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override
    protected void onDestroy() {
        watchdog.removeCallbacks(timeout);
        watchdog.removeCallbacks(checkReady);
        if (backup != null) backup.close();
        if (updater != null) updater.close();
        pendingBackupReplies.clear();
        if (web != null) { root.removeView(web); web.destroy(); }
        super.onDestroy();
    }
}
