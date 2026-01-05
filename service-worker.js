// =============================================
// SERVICE WORKER – PWA Supervisão Ambiental CEDAE
// =============================================

const CACHE_NAME = "cedae-pwa-v10"; // Incrementado para v10 para forçar atualização do manifest novo
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./app.js",
  "./indexedDB.js",
  "./roteiros.js",
  "./style.css",
  "./icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png"
];

// INSTALL – Cache agressivo dos recursos essenciais
self.addEventListener("install", (event) => {
  console.log("SW: Instalando nova versão...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usamos addAll para garantir que o núcleo do app esteja disponível offline
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ACTIVATE – Gestão de memória e limpeza
self.addEventListener("activate", (event) => {
  console.log("SW: Versão ativa e pronta.");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("SW: Limpando cache antigo:", key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// FETCH – Estratégia "Cache First, falling back to Network"
// Ideal para áreas como Tinguá: prioriza a velocidade do cache e não depende da rede.
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Ignorar extensões e esquemas que não sejam http/https (evita erros no Chrome)
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cacheRes) => {
      // Se está no cache, entrega imediatamente (performance máxima)
      if (cacheRes) return cacheRes;

      // Se não está no cache, tenta buscar na rede
      return fetch(request)
        .then((networkRes) => {
          // Só armazena no cache se for uma resposta válida do nosso servidor
          if (networkRes && networkRes.status === 200 && networkRes.type === "basic") {
            const responseToCache = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkRes;
        })
        .catch(() => {
          // Fallback: se estiver offline e o recurso não estiver no cache,
          // redireciona para a página inicial (ajuda a evitar "dinossauro" do Chrome)
          if (request.mode === 'navigate') {
            return caches.match("./index.html");
          }
        });
    })
  );
});

// Listener para forçar atualização via interface (botão "Atualizar App")
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
