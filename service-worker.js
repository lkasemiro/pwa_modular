// service-worker.js
// PWA Supervisão Ambiental – CEDAE

const CACHE_NAME = "pwa-supervisao-v1";

// Ajuste esses caminhos se seus arquivos estiverem em outra pasta
const URLS_TO_CACHE = [
  "./",
  "./index.html",
  "./app.js",
  "./indexedDB.js",
  "./roteiros.js",
  "./style.css",
  "./manifest.json",
  "./icon.png"
];

// -----------------------------
// INSTALAÇÃO – PRE-CACHE
// -----------------------------
self.addEventListener("install", event => {
  console.log("[SW] Instalando service worker...");

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[SW] Adicionando arquivos ao cache inicial...");
      return cache.addAll(URLS_TO_CACHE);
    })
  );

  // força ativação imediata após instalar
  self.skipWaiting();
});

// -----------------------------
// ATIVAÇÃO – LIMPAR CACHES ANTIGOS
// -----------------------------
self.addEventListener("activate", event => {
  console.log("[SW] Ativando service worker...");

  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("[SW] Removendo cache antigo:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// -----------------------------
// FETCH – ESTRATÉGIA CACHE-FIRST
// -----------------------------
self.addEventListener("fetch", event => {
  const req = event.request;

  // Só lidamos com GET
  if (req.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // Resposta do cache
        return cached;
      }

      // Se não estiver no cache, vai pra rede
      return fetch(req)
        .then(res => {
          // Opcional: guardar no cache o que vier da rede (mesmo domínio)
          const clone = res.clone();
          if (req.url.startsWith(self.location.origin)) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(req, clone);
            });
          }
          return res;
        })
        .catch(() => {
          // Aqui você pode retornar uma página offline customizada se quiser
          // ex: return caches.match("./offline.html");
          return new Response(
            "Você está offline e este recurso ainda não foi salvo no cache.",
            { status: 503, statusText: "Offline" }
          );
        });
    })
  );
});
