/* 命式ノート Service Worker
   目的：オフラインでも起動できる（計算は端末内完結なのでネット不要で占える）。
   方針：
   - アプリ本体（同一オリジン）は network-first（更新を常に優先、オフライン時はキャッシュ）。
   - 外部ライブラリ（esm.sh）は cache-first（バージョン固定で不変なため）。
   - Gemini API はキャッシュしない（常にネットワーク）。 */
const CACHE = "meishiki-note-v2";
const SHELL = ["./", "./index.html", "./natal.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Gemini 等の API はキャッシュしない
  if (url.hostname.endsWith("generativelanguage.googleapis.com")) return;

  // 外部ライブラリ（esm.sh など）: cache-first
  if (url.origin !== self.location.origin) {
    if (url.hostname.endsWith("esm.sh")) {
      e.respondWith(
        caches.open(CACHE).then((c) =>
          c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }))
        )
      );
    }
    return;
  }

  // 同一オリジン（アプリ本体）: network-first → 失敗時キャッシュ
  e.respondWith(
    fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
