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
 *
 * 更新チェックは3経路で行う(いずれもcheckForUpdateを共有し、実装を重複
 * させない):
 *   1. 登録完了直後に1回(1時間待たず起動直後に最新版を確認する)。
 *   2. document.visibilitychangeでvisibleに戻ったとき(ホーム画面PWAを
 *      再度開いた際、既存のJS実行コンテキストがresumeされてこの
 *      useEffect自体は再実行されない場合があるため、フォアグラウンド
 *      復帰を明示的に検知して再チェックする)。
 *   3. 既存の1時間間隔のポーリング(上記2つが起きないまま長時間開き
 *      っぱなしにされた場合の保険)。
 */
export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let updateInterval: ReturnType<typeof setInterval> | undefined;
    let handleVisibilityChange: (() => void) | undefined;

    registerSW({
      immediate: true,
      onNeedReload: () => setUpdateAvailable(true),
      onRegisteredSW(_swUrl, registration) {
        // cleanupがこのコールバックより先に走っていた場合(登録完了前に
        // アンマウントされた場合)、listener/intervalを残さない。
        if (!registration || cancelled) return;

        const checkForUpdate = () => {
          registration.update().catch(() => {});
        };

        // 1. 起動直後に一度確認する。
        checkForUpdate();

        // 2. フォアグラウンド復帰時に確認する。
        handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 3. 長時間開きっぱなしのPWAでも新しいデプロイを検知できるよう、
        // 定期的にService Workerの更新有無を確認する(保険的な経路)。
        updateInterval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      },
    });

    return () => {
      cancelled = true;
      if (updateInterval) clearInterval(updateInterval);
      if (handleVisibilityChange) document.removeEventListener('visibilitychange', handleVisibilityChange);
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
