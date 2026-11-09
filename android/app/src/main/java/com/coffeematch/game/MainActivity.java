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
    private WebView web;
    private LinearLayout root;
    private LinearLayout error;
    private boolean failed;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
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
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                Uri game = Uri.parse(BuildConfig.GAME_URL);
                if ("https".equals(url.getScheme()) && game.getHost().equals(url.getHost())
                        && url.getPort() == game.getPort() && url.getPath() != null
                        && url.getPath().startsWith(game.getPath())) return false;
                if (request.isForMainFrame() && ("https".equals(url.getScheme()) || "http".equals(url.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                    catch (android.content.ActivityNotFoundException ignored) { }
                }
                return true;
            }
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                failed = false;
                error.setVisibility(View.GONE);
                web.setVisibility(View.VISIBLE);
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError detail) {
                if (request.isForMainFrame()) showError();
            }
            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request,
                    android.webkit.WebResourceResponse response) {
                if (request.isForMainFrame()) showError();
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                if (failed) return;
                // Check for web updates on every launch; never interrupt a running game.
                view.evaluateJavascript("if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistration().then(function(r) { if(r) r.update().catch(function() {}); }); }", null);
            }
        });
        error = new LinearLayout(this);
        error.setOrientation(LinearLayout.VERTICAL);
        error.setPadding(32, 32, 32, 32);
        TextView message = new TextView(this);
        message.setText("Не удалось загрузить игру. Проверьте интернет. Для первого запуска нужна связь и опубликованная игра на GitHub Pages.");
        message.setTextColor(Color.WHITE);
        error.addView(message);
        Button retry = new Button(this);
        retry.setText("Повторить");
        retry.setOnClickListener(v -> web.loadUrl(BuildConfig.GAME_URL));
        error.addView(retry);
        error.setVisibility(View.GONE);
        root.addView(error);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        web.loadUrl(BuildConfig.GAME_URL);
    }

    private void showError() {
        failed = true;
        web.setVisibility(View.GONE);
        error.setVisibility(View.VISIBLE);
    }

    @Override
    public void onBackPressed() {
        new AlertDialog.Builder(this).setMessage("Закрыть игру?")
            .setPositiveButton("Закрыть", (dialog, which) -> finish())
            .setNegativeButton("Продолжить", null).show();
    }

    @Override
    protected void onPause() { web.onPause(); super.onPause(); }
    @Override
    protected void onResume() { super.onResume(); web.onResume(); }
    @Override
    protected void onDestroy() {
        root.removeView(web);
        web.destroy();
        super.onDestroy();
    }
}
