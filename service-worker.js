const CACHE_NAME = "family-shift-v2";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json"
];

// インストール時にキャッシュ
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 古いキャッシュを削除
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ネットワーク優先、失敗時にキャッシュにフォールバック
// Firebase系のリクエストはキャッシュしない
self.addEventListener("fetch", event => {
  const url = event.request.url;

  // Firebaseへのリクエストはスルー（キャッシュしない）
  if (
    url.includes("firebaseapp.com") ||
    url.includes("googleapis.com") ||
    url.includes("gstatic.com") ||
    url.includes("firestore.googleapis.com")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 静的ファイル：キャッシュ優先 → ネットワーク
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 成功したレスポンスをキャッシュに追加
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // オフラインでindexを要求された場合
        if (event.request.destination === "document") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
