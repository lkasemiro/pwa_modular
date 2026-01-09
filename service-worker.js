// =============================================
// SERVICE WORKER – PWA Supervisão Ambiental CEDAE
// Versão: v14 - Foco em Georreferenciamento Offline
// =============================================

const CACHE_NAME = "cedae-pwa-v14"; 

// Arquivos essenciais para o funcionamento sem internet
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./app.js",
  "./indexedDB.js",
  "./roteiros.js",
  "./style.css",
  "./icon.png"
];

// 1. INSTALL – Cache Inicial (Obrigatório)
self.addEventListener("install", (event) => {
  console.log("SW: Cacheando núcleo do app...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Se um desses arquivos falhar (404), o SW não instala.
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE – Limpeza de versões obsoletas
self.addEventListener("activate", (event) => {
  console.log("SW: Limpando caches antigos...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 3. FETCH – Estratégia "Cache First" Otimizada
// Prioriza o que já está baixado para garantir velocidade instantânea
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Ignorar requisições de extensões ou protocolos não-http
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cacheRes) => {
      // Retorna o cache se encontrar (mesmo offline)
      if (cacheRes) return cacheRes;

      // Se não estiver no cache, busca na rede e salva para a próxima vez
      return fetch(request)
        .then((networkRes) => {
          // Só salva no cache se a resposta for válida
          if (!networkRes || networkRes.status !== 200) {
            return networkRes;
          }

          const responseToCache = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkRes;
        })
        .catch((err) => {
          // Se falhar a rede (OFFLINE TOTAL) e não tiver cache:
          if (request.mode === 'navigate') {
            return caches.match("./index.html");
          }
          console.error("SW: Recurso não disponível offline:", request.url);
        });
    })
  );
});
