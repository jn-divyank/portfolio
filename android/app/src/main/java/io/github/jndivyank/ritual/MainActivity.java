package io.github.jndivyank.ritual;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.HapticFeedbackConstants;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Hosts the web app in tracker/ (bundled into the APK as assets) in a full-screen WebView,
 * and adds the few things a browser can't do well on Android: the back button, system bar
 * colours, haptics, and saving or opening backup files.
 */
public class MainActivity extends ComponentActivity {
    // Assets are served from a fixed https origin so the page is a secure context and its
    // localStorage stays put across launches and app updates. Nothing goes to the network.
    private static final String HOST = "appassets.androidplatform.net";
    private static final String PREFIX = "/app/";
    private static final String START_URL = "https://" + HOST + PREFIX + "index.html";

    private static final int LIGHT_BG = 0xFFF5F4F0;
    private static final int DARK_BG = 0xFF0A0A0B;

    private FrameLayout root;
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileCallback;
    private String pendingBackup;

    private final ActivityResultLauncher<Intent> openFile = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), result -> {
                if (pendingFileCallback == null) return;
                pendingFileCallback.onReceiveValue(
                        WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData()));
                pendingFileCallback = null;
            });

    private final ActivityResultLauncher<String> saveFile = registerForActivityResult(
            new ActivityResultContracts.CreateDocument("application/json"), uri -> {
                String json = pendingBackup;
                pendingBackup = null;
                if (uri == null || json == null) return; // picker cancelled
                boolean saved;
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) throw new IOException("No output stream");
                    out.write(json.getBytes(StandardCharsets.UTF_8));
                    saved = true;
                } catch (IOException | SecurityException e) {
                    saved = false;
                }
                webView.evaluateJavascript("window.ritualBackupSaved && window.ritualBackupSaved(" + saved + ")", null);
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }

        root = new FrameLayout(this);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.TRANSPARENT);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        applySystemBars(isSystemDark());

        // Draw behind the system bars but keep the page clear of them and of the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        webView.addJavascriptInterface(new Bridge(), "RitualNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serveAsset(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (HOST.equals(url.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException ignored) {
                    // Nothing can open it; stay put.
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("*/*")
                        .putExtra(Intent.EXTRA_MIME_TYPES,
                                new String[] {"application/json", "text/plain", "application/octet-stream"});
                try {
                    openFile.launch(intent);
                    return true;
                } catch (ActivityNotFoundException e) {
                    pendingFileCallback = null;
                    return false;
                }
            }
        });

        // Back closes the open sheet, then returns to Today, then leaves the app.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                webView.evaluateJavascript("window.ritualBack ? window.ritualBack() : false", handled -> {
                    if ("true".equals(handled)) return;
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                });
            }
        });

        webView.loadUrl(START_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    private WebResourceResponse serveAsset(Uri url) {
        String path = url.getPath();
        if (!HOST.equals(url.getHost()) || path == null || !path.startsWith(PREFIX)) return null;
        String asset = path.substring(PREFIX.length());
        if (asset.isEmpty() || asset.endsWith("/")) asset += "index.html";
        try {
            InputStream in = getAssets().open(asset);
            String mime = mimeType(asset);
            return new WebResourceResponse(mime, mime.startsWith("text/") ? "utf-8" : null, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
        }
    }

    // Module scripts are refused unless served with a JavaScript MIME type, so map explicitly.
    private static String mimeType(String name) {
        String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (ext) {
            case "html": return "text/html";
            case "js": return "text/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "webmanifest": return "application/manifest+json";
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "woff2": return "font/woff2";
            default: return "application/octet-stream";
        }
    }

    private boolean isSystemDark() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
    }

    private void applySystemBars(boolean dark) {
        root.setBackgroundColor(dark ? DARK_BG : LIGHT_BG);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), root);
        bars.setAppearanceLightStatusBars(!dark);
        bars.setAppearanceLightNavigationBars(!dark);
    }

    private void haptic(int constant) {
        root.performHapticFeedback(constant);
    }

    /** Exposed to the page as window.RitualNative. Called on a background thread. */
    private final class Bridge {
        @JavascriptInterface
        public void setTheme(boolean dark) {
            runOnUiThread(() -> applySystemBars(dark));
        }

        @JavascriptInterface
        public void saveBackup(String json, String fileName) {
            runOnUiThread(() -> {
                pendingBackup = json;
                saveFile.launch(fileName);
            });
        }

        @JavascriptInterface
        public void haptic(String kind) {
            int confirm = Build.VERSION.SDK_INT >= 30
                    ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY;
            runOnUiThread(() -> {
                switch (kind) {
                    case "success":
                        MainActivity.this.haptic(confirm);
                        break;
                    case "celebrate":
                        MainActivity.this.haptic(confirm);
                        root.postDelayed(() -> MainActivity.this.haptic(confirm), 140);
                        break;
                    case "undo":
                        MainActivity.this.haptic(Build.VERSION.SDK_INT >= 30
                                ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS);
                        break;
                    default:
                        MainActivity.this.haptic(HapticFeedbackConstants.KEYBOARD_TAP);
                }
            });
        }
    }
}
