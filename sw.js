// sw.js - Service Worker for ☕迪遜咖啡廳 PWA

const CACHE_NAME = 'diczon-cafe-v1';
const MEDIA_CACHE_NAME = 'diczon-cafe-media-v1'; // 獨立管理影音快取，避免核心網頁更新時被洗掉

// 核心網頁與圖片靜態資源（移除了所有的 MP3 檔案）
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/main.js',
    '/manifest.json',
    '/history.html',
    '/games/offline_dice/offline_dice.html',
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
    '/tools/youtube_thumbnails.html' // 已修正上一行漏掉逗號的語法錯誤
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
    // 允許保留核心快取和多媒體快取
    const cacheWhitelist = [CACHE_NAME, MEDIA_CACHE_NAME];
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

// 攔截請求並返回
self.addEventListener('fetch', event => {
    // 僅處理 GET 請求
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // ✨ 核心改動：針對 MP3 檔案採取「快取優先，首次播放才下載並快取」策略
    if (url.pathname.endsWith('.mp3')) {
        event.respondWith(
            caches.open(MEDIA_CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    // 1. 如果快取已有此 MP3，直接讀取快取，不再浪費網絡流量
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // 2. 如果快取沒有，發送網絡請求下載
                    return fetch(event.request).then(networkResponse => {
                        // 處理 Safari/Chrome 的音訊分段請求 (206 Partial Content) 
                        // 基本快取 API 只能完美存儲 200 OK，如果是一般播放請求則寫入快取
                        if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 206)) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        // 沒網網絡且沒快取時的降級提示
                        return new Response('離線狀態且音訊未快取', { status: 404 });
                    });
                });
            })
        );
        return; // 跳出，其餘一般網頁資源走下面的「網路優先」邏輯
    }

    // 🌐 一般網頁資源：維持您原本的「網路優先」策略
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
