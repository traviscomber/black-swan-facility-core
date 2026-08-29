const CACHE = "bsfc-orchard-shell-v1"
const STATIC = ["/orchard-offline.html", "/icon.svg", "/apple-icon.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/") || url.pathname.includes("supabase")) return

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/orchard-offline.html")))
    return
  }

  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(request, copy))
      return response
    })))
  }
})
