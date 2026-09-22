/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// `base: './'` + hash routing lets the same build run at https://<user>.github.io/<repo>/, on Vercel/Netlify,
// or from any sub-folder, with no server rewrites.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'config.js'],
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
        // config.js must always come from the network so a new Supabase key takes effect immediately.
        globIgnores: ['config.js'],
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.endsWith('/config.js'), handler: 'NetworkFirst', options: { cacheName: 'ect-config' } },
        ],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
