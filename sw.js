/* ============================================================
   IELTS Speaking Trainer · Service Worker
   策略：cache-first + 离线兜底
   - 首次访问缓存核心文件，之后离线也能打开
   - AI API（api.deepseek.com）请求直接放行，不缓存
   - 改代码后：把 CACHE 版本号 +1 再部署，即可全量刷新
   ============================================================ */
const CACHE = 'ielts-speak-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  // AI 接口直接放行，不缓存
  if (url.indexOf('api.deepseek.com') !== -1) return;
  // 只处理 GET
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (resp) {
        // 只缓存同源成功响应
        if (resp.status === 200 && url.indexOf(self.location.origin) !== -1) {
          var clone = resp.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, clone); });
        }
        return resp;
      }).catch(function () {
        // 网络失败且无缓存：回退到首页
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
