import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' (not 'autoUpdate') keeps a newly-installed service worker in
      // the standard "waiting" state instead of force-activating it the
      // moment it's detected — it only takes over once every open tab is
      // closed and the app is relaunched, so an in-progress session is never
      // hot-swapped out from under the user. Detection itself is driven
      // explicitly from src/main.tsx (see registerSW() there), since without
      // that a PWA left open can go a long time before the browser's own
      // infrequent update check ever runs.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: '副業から始める事業承継マッチング',
        short_name: '副業→承継マッチング',
        lang: 'ja',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#0f172a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
