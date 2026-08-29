const CACHE = "bsfc-orchard-shell-v2"
const STATIC = ["/orchard-offline.html", "/icon.svg", "/apple-icon.png", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
    self.registration.navigationPreload ? self.registration.navigationPreload.enable() : Promise.resolve(),
  ]))
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/") || url.pathname.includes("supabase")) return

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse
        if (preload) return preload
        return await fetch(request)
      } catch {
        return (await caches.match("/orchard-offline.html")) || Response.error()
      }
    })())
    return
  }

  if (["style", "script", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith((async () => {
      const cached = await caches.match(request)
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      }).catch(() => null)
      if (cached) {
        event.waitUntil(network.then(() => undefined))
        return cached
      }
      return (await network) || Response.error()
    })())
  }
})
