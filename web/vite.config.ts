import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH || '/';
  if (!base.startsWith('/') || !base.endsWith('/'))
    throw new Error('VITE_BASE_PATH must start and end with /');
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['mark.svg', 'icons/*.png'],
        manifest: {
          id: base,
          name: 'Гуй Му — Магистр',
          short_name: 'Гуй Му',
          description: 'Трекер волн, боссов и АФК-чеков Гуй Му на Comeback PW',
          lang: 'ru',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#101411',
          theme_color: '#101411',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: 'icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          skipWaiting: false,
          clientsClaim: true,
        },
        devOptions: { enabled: false },
      }),
    ],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
  };
});
