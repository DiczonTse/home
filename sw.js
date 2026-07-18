// sw.js - Service Worker for ☕迪遜咖啡廳 PWA

const CACHE_NAME = 'diczon-cafe-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/main.js',
    '/manifest.json',
	'/history.html',
	'/games/offline_dice/offline_dice.html',
	'/games/offline_dice/Offline Dice - Title.mp3',
	'/games/offline_dice/Offline Dice - Shop.mp3'
	'/games/offline_dice/Offline Dice - Rank.mp3',
	'/games/offline_dice/Offline Dice - Fortress Charge.mp3',
	'/games/offline_dice/Offline Dice - Dice Rush.mp3',
	'/games/offline_dice/Offline Dice - Last Wave Hold.mp3',
	'/games/offline_dice/Offline Dice - Dice Riot.mp3',
	'/games/offline_dice/Offline Dice - Deck Build.mp3',
	'/block_legend.html',
	'/tic_tac_toe.html',
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
    '/tools/qr_code_generator.html',
    '/tools/timer.html',
    '/tools/stopper.html',
    '/tools/youtube_thumbnails.html'
];

// 安裝 Service Worker
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

// 攔截請求並返回（真正的網路優先策略）
self.addEventListener('fetch', event => {
    // 僅處理 GET 請求
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // 如果網路請求成功（狀態碼 200），克隆並更新快取
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // 網路失敗或斷線時，降級讀取快取
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // 快取也沒有時，返回自訂離線提示
                        return new Response('離線狀態，且無快取資源，請聯網後重試', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
                        });
                    });
            })
    );
});
