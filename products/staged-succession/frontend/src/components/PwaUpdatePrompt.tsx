import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Owns the PWA service-worker registration and surfaces the "新しいバージョン
 * があります" prompt. registerType: 'prompt' (see vite.config.ts) means a
 * newly-installed service worker sits in "waiting" and never takes over on
 * its own — onNeedRefresh() below is exactly the signal that one is ready,
 * and clicking 今すぐ更新 calls the updateSW(true) function vite-plugin-pwa
 * gives us, which sends the SKIP_WAITING message and reloads once the new
 * worker takes control (its own tested mechanism — no custom reload/race
 * handling needed here).
 *
 * Detection itself is still driven by periodic + on-foreground checks
 * (unchanged from before this prompt existed), since a PWA left open can
 * otherwise go a long time before the browser's own infrequent check runs.
 */
export function PwaUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    updateSWRef.current = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update();
        });
      },
    });
  }, []);

  if (!needRefresh || dismissed) return null;

  async function handleUpdate() {
    await updateSWRef.current?.(true);
  }

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm md:bottom-4">
      <div className="font-jp flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-float">
        <div>
          <p className="font-mincho text-[14px] font-semibold text-foreground">新しいバージョンがあります</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">最新版を利用できます</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="あとで更新する"
            className="rounded-full border border-border px-3 py-1.5 text-[12px] text-foreground/70 transition-colors hover:bg-surface-secondary"
          >
            あとで
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            aria-label="今すぐ更新して最新バージョンを適用する"
            className="rounded-full bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-accent-foreground shadow-card transition-all active:scale-[0.98]"
          >
            今すぐ更新
          </button>
        </div>
      </div>
    </div>
  );
}
