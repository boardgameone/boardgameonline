import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.tsx',
            refresh: true,
        }),
        react(),
        VitePWA({
            registerType: 'prompt',
            includeAssets: ['favicon.png', 'pwa-icons/*.png'],
            manifest: {
                name: 'BoardGameOnline',
                short_name: 'BGOnline',
                description: 'Play board games online with friends',
                theme_color: '#1e3a5f',
                background_color: '#1e3a5f',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: '/pwa-icons/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-icons/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-icons/icon-maskable-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                    {
                        src: '/pwa-icons/icon-152x152.png',
                        sizes: '152x152',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-icons/icon-180x180.png',
                        sizes: '180x180',
                        type: 'image/png',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.bunny\.net\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'bunny-fonts-cache',
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
                        urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'images-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                            },
                        },
                    },
                    {
                        urlPattern: /\.(mp3|wav|ogg)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'audio-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                            },
                        },
                    },
                    {
                        urlPattern: ({ request }) =>
                            request.mode === 'navigate' ||
                            request.headers.get('X-Inertia') === 'true',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'pages-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24, // 1 day
                            },
                            networkTimeoutSeconds: 10,
                        },
                    },
                ],
            },
        }),
    ],
});
