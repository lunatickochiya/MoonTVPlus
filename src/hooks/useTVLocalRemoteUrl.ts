'use client';

import { useEffect, useState } from 'react';

const LOCAL_REMOTE_URL_KEY = 'moontv_local_remote_url';

type MoonTVLocalRemoteBridge = {
  getRemoteUrl?: () => string;
};

declare global {
  interface Window {
    MoonTVLocalRemote?: MoonTVLocalRemoteBridge;
    __MOONTV_LOCAL_REMOTE_URL?: string;
  }
}

function readTVLocalRemoteUrl() {
  let bridgeUrl = '';
  try {
    bridgeUrl = window.MoonTVLocalRemote?.getRemoteUrl?.() || '';
  } catch {
    // The Android bridge can be temporarily unavailable while the WebView loads.
  }

  return (
    bridgeUrl ||
    window.__MOONTV_LOCAL_REMOTE_URL ||
    localStorage.getItem(LOCAL_REMOTE_URL_KEY) ||
    ''
  );
}

export default function useTVLocalRemoteUrl() {
  const [localRemoteUrl, setLocalRemoteUrl] = useState('');

  useEffect(() => {
    const syncLocalRemoteUrl = () => {
      setLocalRemoteUrl(readTVLocalRemoteUrl());
    };

    const onLocalRemoteInfo = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      setLocalRemoteUrl(detail?.url || readTVLocalRemoteUrl());
    };

    syncLocalRemoteUrl();
    window.addEventListener('moontv:local-remote-info', onLocalRemoteInfo);
    const timer = window.setInterval(syncLocalRemoteUrl, 1500);

    return () => {
      window.removeEventListener('moontv:local-remote-info', onLocalRemoteInfo);
      window.clearInterval(timer);
    };
  }, []);

  return localRemoteUrl;
}
