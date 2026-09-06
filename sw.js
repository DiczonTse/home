// sw.js - Service Worker for ☕迪遜咖啡廳 PWA

const CACHE_NAME = 'diczon-cafe-v1';
const MEDIA_CACHE_NAME = 'diczon-cafe-media-v1'; // 獨立管理影音快取，避免核心網頁更新時被洗掉

// 核心網頁與圖片靜態資源（移除了所有的 MP3 檔案）
const urlsToCache = [
    '/home/index.html',
    '/home/style.css',
    '/home/main.js',
    '/home/manifest.json',
    '/home/history.html',
    '/home/games/offline_dice/offline_dice.html',
	'/home/games/offline_dice/offline_dice.jpg',
	'/home/games/offline_dice/offline_dice_title.jpg',
	'/home/games/icq_rps/icq_rps.html',
	'/home/games/icq_rps/icq_rps.jpg',
	'/home/games/icq_rps/icq_rps_title.jpg',
    '/home/games/block_legend/block_legend.html',
	'/home/games/block_legend/block_legend.jpg',
	'/home/games/block_legend/block_legend_title.jpg',
    '/home/games/tic_tac_toe/tic_tac_toe.html',
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
					// 1. 如果快取已有此 MP3，直接讀取快取
					if (cachedResponse) {
						return cachedResponse;
					}

					// 2. 如果快取沒有，發送網絡請求下載
					return fetch(event.request).then(networkResponse => {
						// 僅當響應為完整 200 時才寫入快取（206 不儲存）
						if (networkResponse && networkResponse.status === 200) {
							cache.put(event.request, networkResponse.clone());
						}
						return networkResponse;
					}).catch(() => {
						// 沒網路且沒快取時的降級提示
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
