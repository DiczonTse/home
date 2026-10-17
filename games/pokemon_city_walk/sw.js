const CACHE_NAME = 'pokemon-city-walk-v1';

// 本地“应用外壳”资源——安装时强制缓存
const LOCAL_ASSETS = [
  './',
  './pokemon_city_walk.html',
  './pokemon_city_walk_title.jpg',
  './Pokemon City Walk - Day Catch Piano.mp3',
  './Pokemon City Walk - Moon Walk.mp3',
  './Pokemon City Walk - Night Catch Sax.mp3',
  './Pokemon City Walk - Sun Walk.mp3',
  './Pokemon City Walk - Trade of the Day.mp3',
];

// 安装：缓存本地外壳
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(LOCAL_ASSETS))
  );
  self.skipWaiting();
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 只处理 GET 请求
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 策略 A：同源本地资源 → CacheFirst（优先缓存，适合应用外壳）
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // 策略 B：远程静态资源（Leaflet、精灵图）→ StaleWhileRevalidate
  // 先返回缓存，后台同时更新，兼顾速度与新鲜度
  if (
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('raw.githubusercontent.com')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        }).catch(() => cached); // 网络失败时回退到缓存
        return cached || network;
      })
    );
    return;
  }

  // 其他请求（如 PokeAPI 实时数据）→ NetworkFirst，失败时尝试缓存
  if (url.hostname.includes('pokeapi.co')) {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => caches.match(request))
    );
  }
});