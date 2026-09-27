import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { gmailApiPlugin } from './src/server/vitePlugin';

export default defineConfig({
  plugins: [
    react(),
    gmailApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SES Matching',
        short_name: 'SES Matching',
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
    port: 5174,
  },
});
