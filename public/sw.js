/*
 * RuangKerja service worker.
 *
 * Caches ONLY the app shell and static build assets:
 *   - precache: /offline.html + icons (bump VERSION when they change)
 *   - /build/assets/*: cache-first (file names are content-hashed by Vite)
 *
 * HTML pages, Inertia visits and data requests are never cached. Navigations
 * are network-first and fall back to /offline.html when the network is down.
 * Registration happens in resources/js/app.tsx.
 */

const VERSION = 'v1';
const SHELL_CACHE = `rk-shell-${VERSION}`;
const ASSET_CACHE = 'rk-assets';
const MAX_ASSET_ENTRIES = 200;

const OFFLINE_URL = '/offline.html';
const SHELL_URLS = [
    OFFLINE_URL,
    '/favicon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(SHELL_CACHE)
            .then((cache) =>
                cache.addAll(
                    SHELL_URLS.map(
                        (url) => new Request(url, { cache: 'reload' }),
                    ),
                ),
            )
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
            const keys = await caches.keys();

            await Promise.all(
                keys
                    .filter((key) => key.startsWith('rk-') && !keep.has(key))
                    .map((key) => caches.delete(key)),
            );

            if (self.registration.navigationPreload) {
                await self.registration.navigationPreload.enable();
            }

            await self.clients.claim();
        })(),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(networkFirstNavigation(event));

        return;
    }

    if (url.pathname.startsWith('/build/assets/')) {
        event.respondWith(cacheFirst(request));

        return;
    }

    if (SHELL_URLS.includes(url.pathname)) {
        event.respondWith(
            caches
                .match(request, { cacheName: SHELL_CACHE })
                .then((cached) => cached || fetch(request)),
        );
    }

    // Everything else (Inertia/JSON/API, uploads, /build/manifest.json, …)
    // goes straight to the network and is never stored.
});

async function networkFirstNavigation(event) {
    try {
        const preloaded = await event.preloadResponse;

        if (preloaded) {
            return preloaded;
        }

        return await fetch(event.request);
    } catch {
        const offline = await caches.match(OFFLINE_URL, {
            cacheName: SHELL_CACHE,
        });

        return (
            offline ||
            new Response('Anda sedang offline. Check-in butuh koneksi.', {
                status: 503,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
        );
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    const response = await fetch(request);

    if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
        await trimCache(cache, MAX_ASSET_ENTRIES);
    }

    return response;
}

// Hashed assets accumulate across deploys; drop the oldest beyond the limit.
async function trimCache(cache, maxEntries) {
    const keys = await cache.keys();

    if (keys.length <= maxEntries) {
        return;
    }

    await Promise.all(
        keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
    );
}
