/* OkuHız service worker – derleme sırasında vite.config.ts tarafından dist/sw.js olarak üretilir.
 * __VERSION__ ve __PRECACHE__ yer tutucuları derleme çıktısıyla değiştirilir.
 *
 * Strateji:
 *  - /api/*            → her zaman ağ (çocuk verisi asla önbelleğe alınmaz)
 *  - sayfa gezinmeleri → önce ağ, çevrimdışıysa önbellekteki uygulama kabuğu
 *  - /assets/*         → önce önbellek (dosya adları içerik özetli, değişmez)
 *  - diğer statik      → önbellekten hemen, arka planda güncelle
 */
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const SHELL_CACHE = `okuhiz-shell-${VERSION}`;
const RUNTIME_CACHE = "okuhiz-runtime";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("okuhiz-shell-") && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match("/", { cacheName: SHELL_CACHE })) ?? Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => hit ?? Response.error());
      return hit ?? network;
    }),
  );
});
