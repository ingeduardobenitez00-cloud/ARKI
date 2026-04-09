/**
 * Service Worker para ARKI PWA
 * Gestiona el ciclo de vida de las actualizaciones y asegura la carga de recursos de identidad.
 */

self.addEventListener('install', (event) => {
  // El Service Worker se instala pero no se activa automáticamente
  // permitiendo que la UI muestre el prompt de actualización si ya existe un controlador previo.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pasarela directa para recursos críticos de identidad visual para evitar bloqueos
  if (
    event.request.url.includes('logo.png') || 
    event.request.url.includes('favicon.ico') ||
    event.request.url.includes('manifest.json')
  ) {
    return; // Dejar que el navegador maneje la petición normalmente
  }

  // Lógica de red por defecto para Next.js App Router
  event.respondWith(
    fetch(event.request).catch(() => {
      // Fallback básico si offline
      return caches.match(event.request);
    })
  );
});

// Escuchar mensaje para forzar la activación (Skip Waiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
