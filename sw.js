// sw.js - Service Worker for ☕迪遜咖啡廳 PWA

const CACHE_NAME = 'diczon-cafe-v1';
const MEDIA_CACHE_NAME = 'diczon-cafe-media-v1';

// 核心網頁與圖片靜態資源
const urlsToCache = [
    '/home/index.html',
    '/home/style.css',
    '/home/main.js',
    '/home/manifest.json',
    '/home/history.html',
    '/home/games/offline_dice/offline_dice.html',
    '/home/games/offline_dice/offline_dice.jpg',
    '/home/games/shields_and_staffs/shields_and_staffs.html',
    '/home/games/shields_and_staffs/shields_and_staffs.jpg',
    '/home/games/block_legend/block_legend.html',
    '/home/games/block_legend/block_legend.jpg',
    '/home/games/backpack_scramble/backpack_scramble.html',
    '/home/games/backpack_scramble/backpack_scramble.jpg',
	'/home/games/backpack_scramble/you_m.jpg',
	'/home/games/backpack_scramble/you_f.jpg',
	'/home/games/backpack_scramble/victor.jpg',
	'/home/games/backpack_scramble/diczon.jpg',
	'/home/games/backpack_scramble/cherier.jpg',
	'/home/games/backpack_scramble/ringo.jpg',
	'/home/games/backpack_scramble/leo.jpg',
	'/home/games/backpack_scramble/zoe.jpg',
	'/home/games/backpack_scramble/terry.jpg',
	'/home/games/backpack_scramble/rodge.jpg',
	'/home/games/backpack_scramble/lok.jpg',
	'/home/games/backpack_scramble/rico.jpg',
	'/home/games/backpack_scramble/shop.jpg',
	'/home/games/xiangqi/xiangqi.html',
    '/home/games/xiangqi/xiangqi.jpg',
    '/home/games/chess/chess.html',
    '/home/games/chess/chess.jpg',
    '/home/games/animal_chess/animal_chess.html',
    '/home/games/animal_chess/animal_chess.jpg',
    '/home/games/icq_rps/icq_rps.html',
    '/home/games/icq_rps/icq_rps.jpg',
	'/home/games/blade_axe_spear/blade_axe_spear.html',
    '/home/games/blade_axe_spear/blade_axe_spear.jpg',
    '/home/games/reversi/reversi.html',
    '/home/games/reversi/reversi.jpg',
	'/home/games/connect_4/connect_4.html',
    '/home/games/connect_4/connect_4.jpg',
    '/home/games/tic_tac_toe/tic_tac_toe.html',
    '/home/games/tic_tac_toe/tic_tac_toe.jpg',
    '/home/icons/favicon.ico',
    '/home/icons/diczon.jpg',
    '/home/icons/favicon-16x16.png',
    '/home/icons/favicon-32x32.png',
    '/home/icons/favicon-192x192.png',
    '/home/pics/diczon_cafe.jpg',
    '/home/tools/weather.html',
    '/home/tools/calculator.html',
    '/home/tools/qr_code_generator.html',
    '/home/tools/task_manager.html',
    '/home/tools/process_formulation.html',
    '/home/tools/data_viewer.html',
    '/home/tools/youtube_thumbnails.html',
    '/home/tools/bookmarks.html',
    '/home/tools/relatives.html',
    '/home/tools/timer.html',
    '/home/tools/drawing_lots.html'
];

// ✨ 新增：要「背景預先下載」的媒體檔案清單
// 注意：檔名有空格要用 %20 編碼
const mediaToPreload = [
    '/home/games/chess/Chess%20-%20Jazz%20Board.mp3',
    // 未來其他遊戲的 MP3 加在這裡，例如：
    // '/home/games/xiangqi/xiangqi-bgm.mp3',
];

// ============================================================
// ✨ 新增：背景下載媒體檔案的函式（不阻塞 install）
// ============================================================
async function preloadMedia() {
    try {
        const cache = await caches.open(MEDIA_CACHE_NAME);
        for (const url of mediaToPreload) {
            // 若快取已有，跳過
            const existing = await cache.match(url);
            if (existing) {
                console.log('[Media] 已快取，略過：', url);
                continue;
            }
            try {
                // 用 no-cors 不一定能讀取 body，所以維持正常 fetch
                const response = await fetch(url);
                if (response && response.status === 200) {
                    await cache.put(url, response.clone());
                    console.log('[Media] 背景下載完成：', url);
                } else {
                    console.warn('[Media] 下載失敗，狀態碼：', response.status, url);
                }
            } catch (err) {
                console.warn('[Media] 單檔下載失敗：', url, err);
            }
        }
    } catch (err) {
        console.warn('[Media] 背景預載程序失敗：', err);
    }
}

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

    // ✨ 核心改動：核心快取完成後，在背景非阻塞地下載 MP3
    // 用 waitUntil 包住，SW 不會在下載完成前被殺掉，
    // 但「不會延遲 activate」——使用者立刻可用網站。
    event.waitUntil(preloadMedia());

    self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', event => {
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
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // MP3 快取優先（保留原本邏輯）
    if (/\.(mp3|ogg|m4a|wav)$/i.test(url.pathname)) {
        event.respondWith(
            caches.open(MEDIA_CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        return new Response('離線狀態且音訊未快取', { status: 404 });
                    });
                });
            })
        );
        return;
    }

    // 一般網頁資源：網路優先
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        return new Response('離線狀態，且無快取資源，請聯網後重試', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
                        });
                    });
            })
    );
});