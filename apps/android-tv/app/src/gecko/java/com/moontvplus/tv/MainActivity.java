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
import org.mozilla.geckoview.MediaSession;

public class MainActivity extends Activity {
    private static GeckoRuntime runtime;

    private GeckoSession session;
    private GeckoView geckoView;
    private boolean canGoBack = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );

        geckoView = new GeckoView(this);
        geckoView.setFocusable(true);
        geckoView.setFocusableInTouchMode(true);
        geckoView.requestFocus();
        setContentView(geckoView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        if (runtime == null) {
            runtime = GeckoRuntime.create(this);
        }

        session = new GeckoSession();

        // === 关键修复：启用 MediaSession 支持（播放器控制 + 进度条） ===
        session.setMediaSessionDelegate(new MediaSession.Delegate() {
            @Override
            public void onActivated(GeckoSession session, MediaSession mediaSession) {
                // 播放器激活时（播放开始）显示/启用进度条
                canGoBack = true; // 可选，保留原返回功能
            }

            @Override
            public void onDeactivated(GeckoSession session, MediaSession mediaSession) {
                canGoBack = false;
            }

            @Override
            public void onSessionAction(GeckoSession session, MediaSession mediaSession, MediaSession.Action action) {
                // 可选：处理 seek、play、pause 等自定义动作
                switch (action) {
                    case PLAY:
                    case PAUSE:
                        // 如果你想自定义播放逻辑，可以在这里处理
                        break;
                    case SEEKTO:
                        // 拖进度条时调用 mediaSession.seekTo(...)
                        break;
                    // 其他 action 如 METADATACHANGE、VOLUMECHANGE 等可扩展
                }
            }

            // 可选：实现更多 MediaSession.Delegate 方法（如 onMetadataChange、onDurationChange 等）
            // @Override
            // public void onDurationChange(GeckoSession session, MediaSession mediaSession, double duration) { ... }
        });

        session.open(runtime);
        geckoView.setSession(session);

        // 加载 TV 页面（你的 buildTvUrl 方法保持不变）
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
        if (url.endsWith("/tv")) {
            return url;
        }
        return url + "/tv";
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
