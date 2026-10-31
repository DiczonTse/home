const CACHE_NAME    = 'pokemon-city-walk-v2026-10-31-03';
const SPRITE_CACHE  = 'pokemon-city-walk-sprites-v1';
const RUNTIME_CACHE = 'pokemon-city-walk-runtime-v1';

// 本地“应用外壳”资源——安装时强制缓存
const LOCAL_ASSETS = [
  './',
  './pokemon_city_walk.html',
  './pokemon_city_walk_title.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/og-image.png',
  './Pokemon City Walk - Day Catch Piano.mp3',
  './Pokemon City Walk - Moon Walk.mp3',
  './Pokemon City Walk - Night Catch Sax.mp3',
  './Pokemon City Walk - Sun Walk.mp3',
  './Pokemon City Walk - Trade of the Day.mp3',
  './Pokemon City Walk - Final Encounter.mp3',
];

// ===== 安装：缓存本地外壳 =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ===== 激活：清理旧缓存（保留精灵图和 API 缓存） =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) =>
          key !== CACHE_NAME && key !== SPRITE_CACHE && key !== RUNTIME_CACHE
        ).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ===== 工具 =====
function isCacheable(response) {
  // 同源/API：需要 ok；跨域 <img> 是 opaque（status 0），允许缓存
  return !!response && (response.ok || response.type === 'opaque');
}

function putInto(cacheName, request, response) {
  return caches.open(cacheName)
    .then((cache) => cache.put(request, response))
    .catch(() => {});
}

function offlineHTML() {
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>離線中</title></head>' +
    '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#0d1117;color:#fff;font-family:sans-serif;text-align:center">' +
    '<div><div style="font-size:48px">📡</div>' +
    '<h1 style="margin:12px 0 6px">離線中</h1>' +
    '<p style="color:#aaa;font-size:14px">請連上網路後重新整理頁面</p></div>' +
    '</body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
  );
}

function offlineText() {
  return new Response('', { status: 504, statusText: 'Offline' });
}

function offlineJSON() {
  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ===== fetch =====
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // 策略 A：同源导航请求（HTML）→ NetworkFirst
  // 这是最关键的一条：否则 PWA 永远停在旧版 HTML
  if (sameOrigin && request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (isCacheable(response)) {
          await putInto(CACHE_NAME, request, response.clone());
        }
        return response;
      } catch (e) {
        const cached = await caches.match(request);
        if (cached) return cached;
        const shell = await caches.match('./pokemon_city_walk.html');
        return shell || offlineHTML();
      }
    })());
    return;
  }

  // 策略 B：同源其他静态资源 → CacheFirst
  if (sameOrigin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (isCacheable(response)) {
          await putInto(CACHE_NAME, request, response.clone());
        }
        return response;
      } catch (e) {
        return offlineText();
      }
    })());
    return;
  }

  // 策略 C：跨域静态资源（Leaflet / 精灵图）→ StaleWhileRevalidate
  if (url.hostname.includes('unpkg.com') ||
      url.hostname.includes('raw.githubusercontent.com')) {

    const isSprite =
      url.pathname.includes('/sprites/pokemon/') ||
      url.pathname.includes('/pokesprite/');
    const cacheName = isSprite ? SPRITE_CACHE : RUNTIME_CACHE;

    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(request, { ignoreVary: true });

      // 用 cors 模式重新请求，可拿到真实状态码（GitHub raw 支持 CORS）
      const networkPromise = (async () => {
        try {
          const corsReq = new Request(request.url, {
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store',
          });
          const response = await fetch(corsReq);
          if (response.ok) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        } catch (e) {
          // cors 失败时回退到原始请求（no-cors），但不缓存 opaque 结果
          try {
            return await fetch(request);
          } catch (_) {
            return null;
          }
        }
      })();

      if (cached) return cached;
      const fresh = await networkPromise;
      return fresh || offlineText();
    })());
    return;
  }

  // 策略 D：PokeAPI → NetworkFirst
  if (url.hostname.includes('pokeapi.co')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (isCacheable(response)) {
          putInto(RUNTIME_CACHE, request, response.clone());
        }
        return response;
      } catch (e) {
        const cached = await caches.match(request);
        return cached || offlineJSON();
      }
    })());
    return;
  }

  // 其他请求不拦截，直接交给浏览器
});