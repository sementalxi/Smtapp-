// KIXO service worker: shows push notifications (support replies) even when the site is closed.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(
    self.registration.showNotification(d.title || "KIXO", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: d.tag || "kixo",
      renotify: true,
      vibrate: [150, 80, 150],
      data: { url: d.url || "/?support=1" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
