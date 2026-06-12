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

        // 隐藏标题栏并全屏
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

        // 创建 GeckoView（播放器）
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

        // 创建会话并加载页面
        session = new GeckoSession();
        session.setNavigationDelegate(new GeckoSession.NavigationDelegate() {
            @Override
            public void onCanGoBack(GeckoSession session, boolean canGoBackValue) {
                canGoBack = canGoBackValue;
            }
        });

        session.open(runtime);
        geckoView.setSession(session);

        // 关键修复：注入自定义 CSS 解决视频播放问题
        String customCss = """
                /* === 修复进度条不可用 === */
                video::-webkit-media-controls-enclosure {
                    display: block !important;
                    height: auto !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                }
                video::-webkit-media-controls-timeline-container {
                    display: block !important;
                }
                
                /* === 修复选集不完整（末尾集数被隐藏） === */
                .episodes-list,
                .episode-list,
                .select-episode,
                .episode-grid,
                .ep-list,
                .video-list,
                .episode-scroll,
                .tab-content,
                [class*="episode"] {
                    max-height: 100% !important;
                    overflow-y: visible !important;
                    padding-bottom: 40px !important;
                    flex-wrap: wrap !important;
                }
                .episodes-list, .episode-list, .video-list {
                    min-height: 100% !important;
                    height: auto !important;
                }
                
                /* === 修复选源看不见后面 === */
                .sources-list,
                .source-list,
                .quality-list,
                .source-grid,
                .select-source,
                .source-select,
                .quality-tabs,
                .source-tabs {
                    max-height: 100% !important;
                    overflow-y: visible !important;
                    padding-bottom: 40px !important;
                    flex-wrap: wrap !important;
                }
                .sources-list, .source-list {
                    min-height: 100% !important;
                    height: auto !important;
                }
                
                /* 确保视频列表/源列表在页面加载后可见 */
                document.addEventListener('DOMContentLoaded', () => {
                    // 额外确保视频列表容器可见
                    const lists = document.querySelectorAll('.episodes-list, .episode-list, .video-list, .sources-list, .source-list, .quality-list');
                    lists.forEach(list => {
                        if (list) {
                            list.style.maxHeight = '100%';
                            list.style.overflowY = 'visible';
                            list.style.paddingBottom = '40px';
                        }
                    });
                });
                """;

        String js = "document.head.insertAdjacentHTML('beforeend', `<style>${customCss.replace("\n", "")}</style>`);";

        session.loadUri(buildTvUrl(BuildConfig.BASE_URL));
        session.evaluateJS(js, null, null); // 页面加载完成后注入样式（最可靠）
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
