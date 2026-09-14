// vitest用のvirtual:pwa-registerスタブ。実際のvite-plugin-pwaはVite本体の
// ビルド/開発サーバー経由でのみこの仮想モジュールを提供するため、vitest
// (プラグイン非経由)では解決できない。テストではSW登録自体を検証しないため、
// 何もしないno-opで代替する(vitest.config.tsのaliasから解決される)。
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

export function registerSW(_options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
