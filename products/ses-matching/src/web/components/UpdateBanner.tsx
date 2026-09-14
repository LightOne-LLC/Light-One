import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Vercelへ新しいバージョンをデプロイした際、開きっぱなしのタブに古いJS
 * bundleが残り続けないようにするための最小限の自動更新UI。
 *
 * vite.config.tsのregisterType:'autoUpdate'により、新しいService Workerは
 * 検知され次第バックグラウンドでinstall/activateされる(既存タブの操作を
 * 妨げない)。ただしautoUpdateのデフォルト挙動は、activate完了時に
 * ページを無条件でreloadしてしまう(入力中の操作が壊れうる)ため、ここでは
 * onNeedReloadを上書きしてバナー表示のみに留め、reloadはユーザーが
 * 「更新」を押した時だけ行う。
 */
export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let updateInterval: ReturnType<typeof setInterval> | undefined;

    registerSW({
      immediate: true,
      onNeedReload: () => setUpdateAvailable(true),
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // 長時間開きっぱなしのPWAでも新しいデプロイを検知できるよう、
        // 定期的にService Workerの更新有無を確認する。
        updateInterval = setInterval(() => {
          registration.update().catch(() => {});
        }, UPDATE_CHECK_INTERVAL_MS);
      },
    });

    return () => {
      if (updateInterval) clearInterval(updateInterval);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="update-banner">
      <span>新しいバージョンがあります。更新しますか？</span>
      <button type="button" onClick={() => window.location.reload()}>
        更新
      </button>
    </div>
  );
}
