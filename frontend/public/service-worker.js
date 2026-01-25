// Service Worker for Quendoo AI PWA
const CACHE_NAME = 'quendoo-ai-v1'
const RUNTIME_CACHE = 'quendoo-ai-runtime'

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/quendoo-logo.svg',
  '/manifest.json'
]

// Install event - precache assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...')

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Precaching assets')
        return cache.addAll(PRECACHE_ASSETS)
      })
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...')

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE
            })
            .map((cacheName) => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }

  // Skip API requests for now (they need fresh data)
  if (url.pathname.startsWith('/api/')) {
    return
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[ServiceWorker] Serving from cache:', request.url)
          return cachedResponse
        }

        return fetch(request)
          .then((response) => {
            // Don't cache if not successful
            if (!response || response.status !== 200 || response.type === 'error') {
              return response
            }

            // Clone the response
            const responseToCache = response.clone()

            // Cache runtime assets
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache)
              })

            return response
          })
          .catch((error) => {
            console.error('[ServiceWorker] Fetch failed:', error)

            // Return offline page if available
            return caches.match('/offline.html')
          })
      })
  )
})

// Background sync for offline messages (future implementation)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    console.log('[ServiceWorker] Background sync: messages')
    event.waitUntil(syncMessages())
  }
})

// Push notifications (future implementation)
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push notification received')

  const options = {
    body: event.data ? event.data.text() : 'New message from Quendoo AI',
    icon: '/quendoo-logo.svg',
    badge: '/quendoo-logo.svg',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  }

  event.waitUntil(
    self.registration.showNotification('Quendoo AI', options)
  )
})

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked')

  event.notification.close()

  event.waitUntil(
    clients.openWindow('/')
  )
})

// Helper function for syncing messages (placeholder)
async function syncMessages() {
  // TODO: Implement actual message syncing
  console.log('[ServiceWorker] Syncing messages...')
  return Promise.resolve()
}
