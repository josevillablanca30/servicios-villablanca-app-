package cl.villablanca.servicios.demo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.ContentValues;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;
import java.io.OutputStream;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewAssetLoader;
import android.webkit.RenderProcessGoneDetail;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.view.Gravity;

/** Contenedor Android de demostración. Nunca procesa tarjetas ni realiza cobros. */
public final class MainActivity extends Activity {
    private static final String LOCAL_URL = "https://appassets.androidplatform.net/assets/index.html";
    private static final String LOCAL_ASSET_PREFIX = "https://appassets.androidplatform.net/assets/";
    private static final int BACKGROUND = Color.rgb(11, 8, 15);
    private FrameLayout root;
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileChooser;
    private static final int FILE_CHOOSER_REQUEST = 403;
    private WebViewAssetLoader assetLoader;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);
        root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        setContentView(root);
        try {
            assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
            webView = new WebView(this);
            webView.setBackgroundColor(BACKGROUND);
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowFileAccess(false);
            settings.setAllowContentAccess(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            settings.setSupportMultipleWindows(false);
            settings.setJavaScriptCanOpenWindowsAutomatically(false);
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface public void openExternal(String url) {
                    if (url != null && (url.startsWith("https://wa.me/") ||
                      url.startsWith("https://api.whatsapp.com/"))) {
                        runOnUiThread(() -> openExternalUrl(url));
                    }
                }
                @JavascriptInterface public void openPayment(String url) {
                    if (url == null) return;
                    try {
                        Uri uri = Uri.parse(url);
                        String host = uri.getHost();
                        if ("https".equalsIgnoreCase(uri.getScheme()) &&
                             ("www.mercadopago.cl".equalsIgnoreCase(host) ||
                              "www.mercadopago.com".equalsIgnoreCase(host) ||
                              "mercadopago.cl".equalsIgnoreCase(host) ||
                              "mercadopago.com".equalsIgnoreCase(host) ||
                              "sandbox.mercadopago.cl".equalsIgnoreCase(host) ||
                              "sandbox.mercadopago.com".equalsIgnoreCase(host))) {
                            runOnUiThread(() -> openExternalUrl(url));
                        }
                    } catch (Exception ignored) { }
                }
                /** Solo permite exportar archivos locales .csv/.txt de la DEMO; no accede a datos bancarios. */
                @JavascriptInterface public void saveDemoFile(String fileName, String mime, String base64) {
                    if (fileName == null || !fileName.matches("[A-Za-z0-9._-]{1,100}") ||
                        !(fileName.endsWith(".csv") || fileName.endsWith(".txt") || fileName.endsWith(".pdf") || fileName.endsWith(".png") || fileName.endsWith(".jpg")) ||
                        base64 == null || base64.length() > 5000000) return;
                    if (!("text/csv;charset=utf-8".equals(mime) || "text/plain;charset=utf-8".equals(mime) || "application/pdf".equals(mime) || "image/png".equals(mime) || "image/jpeg".equals(mime))) return;
                    try {
                        final byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                        if (bytes.length > 3000000) return;
                        runOnUiThread(() -> saveCsvOrReceipt(fileName, mime, bytes));
                    } catch (IllegalArgumentException ignored) { }
                }
            }, "VillablancaAndroid");
            webView.setWebChromeClient(new WebChromeClient() {
                @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                    if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
                    pendingFileChooser = callback;
                    try {
                        Intent select = new Intent(Intent.ACTION_GET_CONTENT);
                        select.addCategory(Intent.CATEGORY_OPENABLE);
                        select.setType("*/*");
                        select.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/jpeg","image/png","application/pdf"});
                        startActivityForResult(Intent.createChooser(select,"Seleccionar comprobante"), FILE_CHOOSER_REQUEST);
                        return true;
                    } catch (Exception e) {
                        pendingFileChooser = null;
                        callback.onReceiveValue(null);
                        Toast.makeText(MainActivity.this,"No hay una aplicación para seleccionar archivos",Toast.LENGTH_LONG).show();
                        return false;
                    }
                }
            });
            webView.setWebViewClient(new WebViewClient() {
                @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    return assetLoader.shouldInterceptRequest(request.getUrl());
                }
                @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    return handleNavigation(url);
                }
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return handleNavigation(request.getUrl().toString());
                }
                @Override public void onPageFinished(WebView view, String url) {
                    if (LOCAL_URL.equals(url)) {
                        view.evaluateJavascript("(function(){var original=window.open;window.open=function(url){if(typeof url==='string' && (/^https:\\/\\/wa\\.me\\//.test(url)||/^https:\\/\\/api\\.whatsapp\\.com\\//.test(url))){VillablancaAndroid.openExternal(url);return null;}return original.apply(window,arguments);};})()",null);
                    }
                }
                @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                    if (req.isForMainFrame() && LOCAL_URL.equals(req.getUrl().toString())) {
                        showError("No se pudo cargar la aplicación. Reinstala el APK para recuperar los archivos.");
                    }
                }
                @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    root.removeView(view);
                    view.destroy();
                    webView = null;
                    showError("La vista se interrumpió. Cierra y vuelve a abrir la aplicación.");
                    return true;
                }
            });
            root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
            webView.loadUrl(LOCAL_URL);
        } catch (Exception e) {
            showError("No fue posible iniciar la aplicación. Actualiza Android System WebView e inténtalo nuevamente.");
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && pendingFileChooser != null) {
            Uri[] result = resultCode == RESULT_OK && data != null && data.getData() != null
                ? new Uri[]{data.getData()} : null;
            pendingFileChooser.onReceiveValue(result);
            pendingFileChooser = null;
        }
    }
    private void saveCsvOrReceipt(String fileName, String mime, byte[] bytes) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            Toast.makeText(this, "Para exportar en Android 9 o anterior, usa la versión web.", Toast.LENGTH_LONG).show();
            return;
        }
        Uri uri = null;
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, mime.startsWith("text/csv") ? "text/csv" : mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("Descarga no disponible");
            try (OutputStream stream = getContentResolver().openOutputStream(uri)) {
                if (stream == null) throw new IllegalStateException("No se pudo abrir el archivo");
                stream.write(bytes);
            }
            Toast.makeText(this, "Archivo guardado en Descargas: " + fileName, Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            if (uri != null) try { getContentResolver().delete(uri, null, null); } catch (Exception ignored) { }
            Toast.makeText(this, "No se pudo guardar el archivo. Intenta nuevamente.", Toast.LENGTH_LONG).show();
        }
    }

    private void openExternalUrl(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (ActivityNotFoundException ignored) { }
    }
    private boolean handleNavigation(String url) {
        if (url == null || url.startsWith(LOCAL_ASSET_PREFIX)) return false;
        if (url.startsWith("https://") || url.startsWith("http://") ||
                url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("whatsapp:")) {
            openExternalUrl(url);
        }
        return true;
    }
    private void showError(String msg) {
        if (root == null) return;
        root.removeAllViews();
        TextView t = new TextView(this);
        t.setText("Servicios Villablanca\n\n" + msg);
        t.setTextSize(17);
        t.setTextColor(Color.WHITE);
        t.setGravity(Gravity.CENTER);
        t.setPadding(30, 30, 30, 30);
        root.addView(t, new FrameLayout.LayoutParams(-1, -1));
    }
    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if (webView != null) {
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
