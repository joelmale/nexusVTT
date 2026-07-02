import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env variables
  const isDev = command === 'serve';
  const isAnalyze = mode === 'analyze';
  return {
    plugins: [
      tailwindcss(), // Tailwind v4 Vite plugin (must be first)
      react(),
      isAnalyze &&
        visualizer({
          open: true,
          filename: 'stats.html',
          gzipSize: true,
          brotliSize: true,
        }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['nexus-icon.svg'],
        manifest: {
          name: 'Nexus VTT - Virtual Tabletop',
          short_name: 'Nexus VTT',
          description:
            'A lightweight, modern virtual tabletop for browser-based RPG sessions',
          theme_color: '#6366f1',
          background_color: '#667eea',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/assets/icons/nexus-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/assets/icons/nexus-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/assets/icons/nexus-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          // Take control of all clients immediately on SW update — without this,
          // the old SW stays active until every tab of the site is closed, causing
          // a 20-30s freeze while the old (large) pre-cache list is validated.
          skipWaiting: true,
          clientsClaim: true,
          // Only precache the critical shell: HTML entry point, CSS, and small icons.
          // Large JS chunks (dice-box, pdf viewer, game UI, offscreen workers), fonts,
          // and large images are cached on first use via runtimeCaching instead.
          // This prevents the ~4-6MB IndexedDB write storm that crawls the machine on first visit.
          globPatterns: ['**/*.{html,css,ico}'],
          maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
          globIgnores: [
            '**/world-map-generator/**',
            '**/one-page-dungeon/**',
            '**/dwellings-generator/**',
            '**/city-generator/**',
            '**/cave-generator/**',
          ],
          runtimeCaching: [
            // JS chunks — cache after first load (lazy, not upfront)
            {
              urlPattern: /\.js$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'js-chunks-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            // Self-hosted fonts (woff/woff2 served from origin)
            {
              urlPattern: /\.(woff2?|ttf|otf)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'fonts-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
            // SVG and large images — cache after first use
            {
              urlPattern: /\.(svg|png|jpg|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/assets\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'assets-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            {
              urlPattern: /\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5, // 5 minutes
                },
                networkTimeoutSeconds: 10,
              },
            },
          ],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api/,
            /^\/auth/,
            /^\/ws/,
            /^\/cave-generator/,
            /^\/city-generator/,
            /^\/dwellings-generator/,
            /^\/one-page-dungeon/,
            /^\/world-map-generator/,
          ],
        },
        devOptions: {
          enabled: false, // Disable in dev mode to avoid conflicts
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/stores': path.resolve(__dirname, './src/stores'),
        '@/types': path.resolve(__dirname, './src/types'),
        '@/utils': path.resolve(__dirname, './src/utils'),
      },
    },
    server: {
      port: parseInt(process.env.PORT || '5173'),
      host: true,
      open: true,
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_URL || 'http://localhost:5001',
          changeOrigin: true,
        },
        '/auth': {
          target: process.env.VITE_API_PROXY_URL || 'http://localhost:5001',
          changeOrigin: true,
        },
        '/ws': {
          target: process.env.VITE_WS_PROXY_URL || 'ws://localhost:5001',
          ws: true,
        },
      },
    },
    build: {
      // Disable source maps in production for better security and smaller bundle
      sourcemap: isDev ? true : false,
      // CSS code splitting and optimization
      cssCodeSplit: true,
      // Vite 8 minifies CSS with lightningcss by default, which is stricter than
      // vite 7's esbuild and rejects a pre-existing dangling-combinator selector
      // in the app CSS. Pin esbuild to preserve the prior (lenient) behavior; the
      // invalid selector is tracked as a separate CSS cleanup follow-up.
      cssMinify: 'esbuild',
      rollupOptions: {
        output: {
          // Separate CSS chunks for better caching with content hashing
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) {
              return 'assets/css/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
          // Optimize chunk splitting for better caching.
          // Vite 8 uses Rolldown, which expects `manualChunks` as a function
          // (the object-map form is a Rollup-ism it no longer accepts). This
          // reproduces the previous vendor grouping. Package matches use a
          // trailing-slash path boundary so `react` doesn't also capture
          // `react-dom` / `react-router-dom` / `react-dnd`.
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined;
            const inPkg = (name: string) =>
              id.includes(`/node_modules/${name}/`);
            if (inPkg('react') || inPkg('react-dom')) return 'vendor-react';
            if (inPkg('react-router-dom')) return 'vendor-router';
            if (inPkg('zustand') || inPkg('immer')) return 'vendor-state';
            if (inPkg('sonner')) return 'vendor-ui';
            if (inPkg('@3d-dice/dice-box')) return 'vendor-3d';
            if (inPkg('pdfjs-dist')) return 'vendor-pdf';
            if (inPkg('uuid')) return 'vendor-utils';
            if (inPkg('react-dnd') || inPkg('react-dnd-html5-backend'))
              return 'vendor-dnd';
            return undefined;
          },
        },
      },
    },
    css: {
      // Enable CSS source maps in development
      devSourcemap: isDev,
    },
  };
});
