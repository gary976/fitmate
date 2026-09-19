// FitMate Service Worker：precache 应用壳，离线可用（视频与 AI 需联网）
const VERSION = 'fitmate-v3';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/tokens.css', './css/base.css', './css/components.css',
  './js/app.js', './js/router.js', './js/store.js',
  './js/api/ark.js', './js/api/prompts.js',
  './js/lib/ui.js', './js/lib/vision.js', './js/lib/bilibili.js', './js/lib/planner.js', './js/lib/data.js',
  './js/pages/home.js', './js/pages/train.js', './js/pages/equipment.js', './js/pages/diet.js',
  './js/pages/chat.js', './js/pages/profile.js', './js/pages/settings.js', './js/pages/feedback.js',
  './data/equipment.json', './data/foods.json',
  './icons/icon.svg', './icons/icon-maskable.svg', './icons/favicon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // 跨域(B站/AI)不拦截
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit ||
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
