/* Self-destroying service worker.
 *
 * The old installable-PWA build registered a service worker that cached the app
 * shell and caused a "page keeps refreshing" loop (the cached shell can't be
 * evicted by the page it's intercepting, so a fresh deploy never reaches the
 * browser). This neutralizer is shipped at that worker's path; the browser
 * revalidates the worker script on navigation, picks up THIS version, and it
 * then deletes all caches, unregisters itself, and reloads any open tab once to
 * a clean, worker-free state.
 *
 * The current app ships no service worker, so once this runs the loop is gone
 * for good. It is never registered by the current build — a stray copy on disk
 * is harmless; it only activates by replacing an already-registered worker.
 */
self.addEventListener("install", function () {
  // Activate immediately instead of waiting for the old worker's tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      // Drop every Cache Storage entry the old worker left behind.
      try {
        if (self.caches && caches.keys) {
          var keys = await caches.keys();
          await Promise.all(
            keys.map(function (k) {
              return caches.delete(k);
            })
          );
        }
      } catch (e) {}
      // Remove this worker's registration entirely.
      try {
        await self.registration.unregister();
      } catch (e) {}
      // Reload open tabs once so they re-fetch the clean, worker-free shell.
      try {
        var clients = await self.clients.matchAll({ type: "window" });
        clients.forEach(function (c) {
          try {
            c.navigate(c.url);
          } catch (e) {}
        });
      } catch (e) {}
    })()
  );
});

// No "fetch" handler on purpose: a worker without one does not intercept
// network requests, so navigations go straight to the network even in the brief
// window before this worker finishes unregistering.
