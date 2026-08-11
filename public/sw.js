/* CuadrAPP service worker: Web Push (RF-013) + PWA */

// Listener vacío: sin él los navegadores no consideran la app instalable.
// Al no llamar respondWith, las peticiones siguen su curso normal por la red.
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let data = { title: 'CuadrAPP', body: 'Tienes pagos pendientes', url: '/calendar' }
  try { data = { ...data, ...event.data.json() } } catch (_) { /* payload no-JSON */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'cuadrapp-reminder',
      data: { url: data.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) return win.focus()
      }
      return clients.openWindow(url)
    })
  )
})
