import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    alias: {
      // vite-plugin-pwaの仮想モジュール(Vite本体のビルド/開発サーバー経由
      // でのみ解決される)をvitestではno-opスタブへ差し替える。
      'virtual:pwa-register': path.resolve(__dirname, 'src/web/testUtils/pwaRegisterStub.ts'),
    },
  },
});
