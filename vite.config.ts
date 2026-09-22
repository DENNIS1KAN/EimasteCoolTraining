/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// `base: './'` + hash routing lets the same build run at https://<user>.github.io/<repo>/, on Vercel/Netlify,
// or from any sub-folder, with no server rewrites.
// ECT_PREVIEW=1 builds a self-contained preview (no service worker) into dist-preview/, e.g. for a sandboxed demo page.
const preview = process.env.ECT_PREVIEW === '1'

export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    !preview &&
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // config.js is deliberately NOT listed here: anything in includeAssets lands in the precache manifest, and a
      // precached copy is served cache-first (it would keep an old, e.g. demo, config after the keys are added).
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Eimaste Cool Training',
        short_name: 'Eimaste Cool',
        description: 'Train together: workouts, weight, meal plans and friendly competition.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#07090f',
        theme_color: '#07090f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // config.js must always come from the network so a new Supabase key takes effect immediately; the cached copy
        // is only the offline fallback (and the fallback on a stalled gym connection, after a few seconds).
        globIgnores: ['config.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/config.js'),
            handler: 'NetworkFirst',
            options: { cacheName: 'ect-config', networkTimeoutSeconds: 4 },
          },
        ],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2022',
    outDir: preview ? 'dist-preview' : 'dist',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
