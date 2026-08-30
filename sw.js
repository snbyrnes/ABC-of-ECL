/**
 * Service worker for ABC of ECL.
 *
 * Strategy:
 *   - App shell (HTML/CSS/JS/icons): stale-while-revalidate, so the site opens
 *     instantly and updates in the background.
 *   - Terminology servers and token endpoints: never touched. Query results are
 *     live clinical data and auth is bearer-token based; caching either would be
 *     both wrong and a privacy problem.
 *
 * Bump CACHE_VERSION whenever the shell changes.
 */

const CACHE_VERSION = 'abc-of-ecl-v3';

const SHELL = [
    './',
    './index.html',
    './builder.html',
    './compare.html',
    './examples.html',
    './resources.html',
    './404.html',
    './styles.css',
    './manifest.json',
    './favicon.svg',
    './icons.svg',
    './fonts/inter-latin.woff2',
    './fonts/jetbrains-mono-latin.woff2',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png',
    './CHANGELOG.md',
    './js/servers.js',
    './js/auth.js',
    './js/fhir.js',
    './js/templates.js',
    './js/anatomy.js',
    './js/shell.js',
    './js/builder.js',
    './js/compare.js',
    './js/playground.js',
    './js/valueset.js',
    './js/page.js'
];

/** Hosts whose responses must always come from the network. */
const LIVE_HOSTS = ['nmpc.hse.ie', 'r4.ontoserver.csiro.au'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            // addAll fails the whole install if any single file 404s, so add
            // them individually and let the rest through.
            .then(cache => Promise.all(SHELL.map(url =>
                cache.add(url).catch(err => console.warn('[sw] skipped', url, err.message))
            )))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Live terminology and auth traffic bypasses the cache entirely.
    if (LIVE_HOSTS.some(host => url.hostname.endsWith(host))) return;

    // Cross-origin assets (fonts, icon CSS) are left to the browser's own cache.
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(request).then(cached => {
            const network = fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached || caches.match('./404.html'));

            return cached || network;
        })
    );
});
