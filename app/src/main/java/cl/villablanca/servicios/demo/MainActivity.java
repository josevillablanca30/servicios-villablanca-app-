package cl.villablanca.servicios.demo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.RenderProcessGoneDetail;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.view.Gravity;

/** Contenedor Android de demostración. Nunca procesa tarjetas ni realiza cobros. */
public final class MainActivity extends Activity {
    private static final String LOCAL_URL = "file:///android_asset/index.html";
    private static final int BACKGROUND = Color.rgb(11, 8, 15);
    private FrameLayout root;
    private WebView webView;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);
        root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        setContentView(root);
        try {
            webView = new WebView(this);
            webView.setBackgroundColor(BACKGROUND);
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowFileAccess(true);
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
            }, "VillablancaAndroid");
            webView.setWebChromeClient(new WebChromeClient());
            webView.setWebViewClient(new WebViewClient() {
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
    private void openExternalUrl(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (ActivityNotFoundException ignored) { }
    }
    private boolean handleNavigation(String url) {
        if (url == null || url.startsWith("file:///android_asset/")) return false;
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
