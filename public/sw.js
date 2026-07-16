// Service Worker de CoreStock: cachea el "app shell" en tiempo de uso
// (no en build) para que abrir una pantalla ya visitada funcione sin
// conexión. No usa un manifiesto de precache generado en build (los
// archivos de Next.js llevan hash y cambian en cada despliegue) — en
// vez de eso cachea bajo demanda a medida que el usuario navega.

const VERSION = "corestock-v1";
const CACHE_ESTATICOS = `${VERSION}-estaticos`;
const CACHE_PAGINAS = `${VERSION}-paginas`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith("corestock-") && !nombre.startsWith(VERSION))
          .map((nombre) => caches.delete(nombre))
      );
      await self.clients.claim();
    })()
  );
});

function esAssetEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/logo.png"
  );
}

self.addEventListener("fetch", (evento) => {
  const { request } = evento;

  // Solo GET — nunca se intercepta un POST/PATCH a Supabase; esos
  // siempre van directo a la red (o fallan y la app los encola aparte
  // en IndexedDB, ver lib/sync.ts). El Service Worker únicamente
  // cachea lo que hace falta para que la interfaz cargue sin Internet.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear llamadas a la API de Supabase ni rutas /api propias
  // — esos datos deben ser siempre frescos (o pasar por el manejo de
  // offline explícito de la app), no servidos desde una caché del SW.
  if (url.pathname.startsWith("/api/")) return;

  if (esAssetEstatico(url)) {
    // Cache-first: son archivos con hash en el nombre, si ya están en
    // caché nunca cambian de contenido.
    evento.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_ESTATICOS);
        const enCache = await cache.match(request);
        if (enCache) return enCache;

        try {
          const respuesta = await fetch(request);
          if (respuesta.ok) cache.put(request, respuesta.clone());
          return respuesta;
        } catch {
          return enCache || Response.error();
        }
      })()
    );
    return;
  }

  // Navegación entre páginas: network-first, con la última versión en
  // caché como respaldo si no hay conexión.
  if (request.mode === "navigate") {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_PAGINAS);

        try {
          const respuesta = await fetch(request);
          if (respuesta.ok) cache.put(request, respuesta.clone());
          return respuesta;
        } catch {
          const enCache = await cache.match(request);
          if (enCache) return enCache;
          // Última pantalla visitada como último recurso, mejor que
          // una pantalla de error del navegador sin ningún estilo.
          const menu = await cache.match("/menu");
          return menu || Response.error();
        }
      })()
    );
  }
});
