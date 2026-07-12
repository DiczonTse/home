// sw.js - Service Worker for ☕迪遜咖啡廳 PWA

const CACHE_NAME = 'diczon-cafe-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/main.js',
    '/manifest.json',
    '/favicon.ico',
    '/pics/diczon_cafe.png',
    '/pics/diczon_song.png',
    '/pics/diczon_animation.png',
    '/pics/diczon_drama.png',
    '/pics/diczon_movie.png',
    '/pics/diczon_trailer.png',
    '/pics/diczon_comic.png',
    '/pics/diczon_novel.png',
    '/pics/diczon_ai.png',
    '/pics/diczon_tool.png',
    '/pics/gov_tool.png',
    '/pics/diczon_education.png',
    '/pics/diczon_game.png',
    '/pics/diczon_walkthrough.png',
    '/pics/diczon_gameplay.png',
    '/pics/gameplay_diczon.png',
    '/pics/gameplay_tony_gaming_hk.png',
    '/pics/gameplay_jackygameplayhk.png',
    '/pics/gameplay_bht_x_wmb.png',
    '/pics/diczon_vlog.png',
    '/pics/diczon_info.png',
    '/pics/diczon_news.png',
    '/pics/diczon_18+.png',
    '/pics/diczon_lgbtq.png',
    '/pics/bookmark.png',
    '/tools/calculator.html',
    '/tools/weather.html',
    '/tools/qr.html',
    '/tools/timer.html',
    '/tools/stopper.html',
    '/tools/youtube_thumbnails.html'
];

// 安装 Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(err => console.error('Cache addAll error:', err))
    );
    self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    event.waitUntil(clients.claim());
});

// 拦截请求并返回缓存（网络优先策略）
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 缓存命中则返回，否则尝试网络请求
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(response => {
                        // 检查有效响应
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        // 克隆响应以存储到缓存
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    })
                    .catch(() => {
                        // 离线时返回自定义离线页面（可选）
                        return new Response('离线状态，请联网后重试', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});