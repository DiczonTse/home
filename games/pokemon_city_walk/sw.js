/* =========================================================
   Pokémon City Walk - Service Worker
   ========================================================= */

const CACHE_NAME    = 'pokemon-city-walk-v2026-11-10-04';
const SPRITE_CACHE  = 'pokemon-city-walk-sprites-v1';
const RUNTIME_CACHE = 'pokemon-city-walk-runtime-v1';

// 本地“应用外壳”资源——安装时尝试缓存
// 注意：任何一个文件不存在都不会导致整个 SW 安装失败（下面逐个缓存）
const LOCAL_ASSETS = [
  './',
  './pokemon_city_walk.html',
  './pokemon_city_walk_title.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/og-image.png',
  './merge_save.html',
  './qrcode.min.js',
  './jsQR.js',
  './Pokemon City Walk - Holiday Daylight.mp3',
  './Pokemon City Walk - Sun Walk.mp3',
  './Pokemon City Walk - Moon Walk.mp3',
  './Pokemon City Walk - Holiday Midnight.mp3',
  './Pokemon City Walk - Day Catch Piano.mp3',
  './Pokemon City Walk - Night Catch Sax.mp3',
  './Pokemon City Walk - Trade of the Day.mp3',
  './Pokemon City Walk - Final Encounter.mp3',
];

/* =========================================================
   工具
   ========================================================= */
function isCacheable(response) {
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

/* =========================================================
   安装：逐个缓存本地外壳，避免单个 404 导致整体失败
   ========================================================= */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        LOCAL_ASSETS.map(async (url) => {
          try {
            const request = new Request(url, { cache: 'no-cache' });
            const response = await fetch(request);
            if (isCacheable(response)) {
              await cache.put(request, response.clone());
            } else {
              console.warn('[SW] 跳过不可缓存资源:', url, response.status);
            }
          } catch (err) {
            console.warn('[SW] 预缓存失败（已忽略）:', url, err);
          }
        })
      );
      await self.skipWaiting();
    })
  );
});

/* =========================================================
   激活：清理旧 CACHE_NAME，保留精灵图 / API 缓存
   ========================================================= */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) =>
          key !== CACHE_NAME &&
          key !== SPRITE_CACHE &&
          key !== RUNTIME_CACHE
        ).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* =========================================================
   消息：允许页面强制新 SW 接管
   ========================================================= */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* =========================================================
   fetch 策略
   ========================================================= */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  /* ---- 策略 A：同源导航请求（HTML）→ NetworkFirst ---- */
  if (sameOrigin && request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (isCacheable(response)) {
          await putInto(CACHE_NAME, request, response.clone());
        }
        return response;
      } catch (e) {
        const cached = await caches.match(request, { ignoreVary: true });
        if (cached) return cached;
        const shell = await caches.match('./pokemon_city_walk.html', { ignoreVary: true });
        return shell || offlineHTML();
      }
    })());
    return;
  }

  /* ---- 策略 B：同源其他静态资源 → CacheFirst ---- */
  if (sameOrigin) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreVary: true });
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

  /* ---- 策略 C：跨域静态资源（Leaflet / 精灵图）→ StaleWhileRevalidate ---- */
  if (url.hostname.includes('unpkg.com') ||
      url.hostname.includes('raw.githubusercontent.com')) {

    const isSprite =
      url.pathname.includes('/sprites/pokemon/') ||
      url.pathname.includes('/pokesprite/');
    const cacheName = isSprite ? SPRITE_CACHE : RUNTIME_CACHE;

    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(request, { ignoreVary: true });

      // 后台用 cors 请求获取真实响应并更新缓存
      const networkPromise = (async () => {
        try {
          const corsReq = new Request(request.url, {
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store',
          });
          const response = await fetch(corsReq);
          if (response.ok) {
            await cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        } catch (e) {
          try {
            return await fetch(request);
          } catch (_) {
            return null;
          }
        }
      })();

      // 有缓存立即返回（忽略 Vary），同时后台更新
      if (cached) {
        // 如果是 opaque，仍然返回，但后台会尝试用 cors 更新
        networkPromise.catch(() => {});
        return cached;
      }

      const fresh = await networkPromise;
      return fresh || offlineText();
    })());
    return;
  }

  /* ---- 策略 D：PokeAPI → CacheFirst ---- */
  if (url.hostname.includes('pokeapi.co')) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreVary: true });
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (isCacheable(response)) {
          putInto(RUNTIME_CACHE, request, response.clone());
        }
        return response;
      } catch (e) {
        return offlineJSON();
      }
    })());
    return;
  }

  // 其他请求不拦截
});