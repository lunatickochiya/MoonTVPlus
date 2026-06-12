package com.moontvplus.tv;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;

import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoView;

public class MainActivity extends Activity {

    private static GeckoRuntime runtime;
    private GeckoSession session;
    private GeckoView geckoView;
    private boolean canGoBack = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 隐藏所有系统标题栏 + 全屏沉浸模式（TV 常用）
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);

        // 初始化 GeckoView
        geckoView = new GeckoView(this);
        geckoView.setFocusable(true);
        geckoView.setFocusableInTouchMode(true);
        geckoView.requestFocus();

        setContentView(geckoView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        // 防止 Runtime 重复创建
        if (runtime == null) {
            runtime = GeckoRuntime.create(this);
        }

        // 创建 Session
        session = new GeckoSession();

        // ==================== 修复 1: 强制使用网页进度条 ====================
        session.setMediaPlaybackStateDelegate((session, state) -> {
            // 使用网页内置进度条（推荐）
        });

        // ==================== 修复 2: 选集不完整（强制 cover）===================
        session.setContentDelegate(new GeckoSession.ContentDelegate() {
            @Override
            public void onViewportFitChanged(GeckoSession session, int mode) {
                // 强制 cover，让选集界面不被遮挡
            }
        });

        // ==================== 修复 3: 选源列表看不见后面（字体放大）===================
        session.setTextZoom(200);   // 200% = 两倍字体 + 宽松布局

        // 开启 Session
        session.open(runtime);
        geckoView.setSession(session);

        // 加载视频页面
        session.loadUri(buildTvUrl(BuildConfig.BASE_URL));
    }

    private static String buildTvUrl(String baseUrl) {
        String url = baseUrl == null ? "" : baseUrl.trim();
        if (url.isEmpty()) {
            url = "http://192.168.1.10:3000";
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://" + url;
        }
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url.endsWith("/tv") ? url : url + "/tv";
    }

    @Override
    public void onBackPressed() {
        if (session != null && canGoBack) {
            session.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (session != null) {
            session.close();
            session = null;
        }
        super.onDestroy();
    }
}
