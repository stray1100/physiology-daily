/* 生理学每日学习助手 · PWA Service Worker
 * 作用：把应用外壳（HTML / manifest / 图标）预缓存到本机，断网或飞行模式下仍可打开。
 * 升级：修改下面的 CACHE_VERSION 后重新部署，用户下次联网打开时会自动换用新缓存。
 */
var CACHE_VERSION = 'slyx-pwa-v1.1.0';
var CACHE_NAME = CACHE_VERSION;

/* 预缓存清单：全部使用相对路径，便于部署在域名根目录或 GitHub Pages 子路径下 */
var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/apple-touch-icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      /* 逐个 add，避免单个资源失败导致整体安装失败 */
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () { /* 忽略单个失败 */ });
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME && key.indexOf('slyx-pwa-') === 0) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  /* 页面导航：优先缓存，缓存缺失时回退到首页，最后才走网络 */
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        return caches.match('./index.html').then(function (shell) {
          return shell || fetch(req);
        });
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  /* 静态资源：缓存优先，未命中则联网并顺手写入缓存 */
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
