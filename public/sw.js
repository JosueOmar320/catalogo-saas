/* Service worker del panel: sólo avisos push (no guarda nada en caché). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : '' };
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Pedido nuevo';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      icon: '/panel-icon',
      badge: '/panel-icon',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      renotify: true,
      data: { url: typeof data.url === 'string' && data.url.startsWith('/dashboard') ? data.url : '/dashboard/pedidos' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard/pedidos';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).pathname.startsWith('/dashboard'));
      // navigate() sólo funciona en ventanas que este service worker controla.
      if (open) return open.navigate(url).then((client) => (client || open).focus()).catch(() => self.clients.openWindow(url));
      return self.clients.openWindow(url);
    }),
  );
});
