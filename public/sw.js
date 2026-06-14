const STATIC_CACHE = "criczone-static-v8";
const STATIC_ASSETS = [
  "/index.html",
  "/styles.css?v=3",
  "/js/api.js",
  "/js/ui.js",
  "/js/teams.js",
  "/js/matches.js",
  "/js/bookings.js",
  "/js/players.js",
  "/js/turfs.js",
  "/js/tournaments.js",
  "/js/app.js",
  "/runtime-config.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(async () => {
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true
        });
        await Promise.all(
          windowClients.map((client) =>
            client.navigate(client.url).catch(() => undefined)
          )
        );
      })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        if (request.mode === "navigate") return caches.match("/index.html");
        return Response.error();
      })
  );
});
