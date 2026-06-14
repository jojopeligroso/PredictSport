const CACHE_NAME = "sp-v2";
const PRECACHE_URLS = ["/icon-192.png", "/icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) {
            return name !== CACHE_NAME;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  // Only cache GET requests for static assets
  if (event.request.method !== "GET") return;

  var url = new URL(event.request.url);

  // Cache icon, font, and flag assets; network-first for everything else.
  // Flags (/flags/*.svg) are static national flag SVGs — safe to cache forever
  // since the filename is the ISO code.
  if (
    url.pathname.startsWith("/icon-") ||
    url.pathname.startsWith("/apple-touch-icon") ||
    url.pathname.startsWith("/flags/") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
  }
});

// Push notification handling
self.addEventListener("push", function (event) {
  if (!event.data) return;

  var data = event.data.json();
  var options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "ps-notification",
    renotify: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = event.notification.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          if (clientList[i].url.includes(url) && "focus" in clientList[i]) {
            return clientList[i].focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
