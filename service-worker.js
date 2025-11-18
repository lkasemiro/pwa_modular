// =============================================
// SERVICE WORKER – PWA Modular /cedae-pwa-v8
// =============================================

const CACHE_NAME = "cedae-pwa-v8"; // Cache atualizado para forçar reinstalação
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./app.js",
  "./indexedDB.js",
  "./roteiros.js",
  "./style.css",

  // Imagens e logos
  "./icon.png", 
  "./icon-192.png",
  "./icon-512.png",
  // Adicione aqui se tiver outros ícones

  // Bibliotecas externas (CORREÇÃO DE ESTILO E FUNCIONALIDADE)
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/leaflet/dist/leaflet.css", // CSS do mapa para estilo
  "https://unpkg.com/leaflet/dist/leaflet.js",  // JS do mapa
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"
];

// =============================================
// INSTALL – Pré-cache da aplicação
// =============================================
self.addEventListener("install", event => {
  console.log("SW: instalando…");

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL).catch(error => {
        // Se a instalação falhar (e.g., falha no download de um CDN), loga o erro
        console.error("Falha ao pré-cachear um ou mais recursos:", error);
      });
    })
  );
  self.skipWaiting(); 
});

// =============================================
// ACTIVATE – Remove caches antigos
// =============================================
self.addEventListener("activate", event => {
  console.log("SW: ativado");

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log("SW: removendo cache antigo:", key);
            return caches.delete(key);
          })
      )
    )
  );
  return self.clients.claim(); // Assume o controle imediatamente
});

// =============================================
// FETCH – Estratégia: Cache Falling Back to Network (com atualização de cache)
// =============================================
self.addEventListener("fetch", event => {
  const req = event.request;

  // Ignorar requisições não HTTP(S)
  if (
    req.url.startsWith("chrome-extension") ||
    req.url.includes("blob:") ||
    req.url.includes("data:")
  ) {
    return;
  }

  // Tenta responder com o cache, se falhar, vai para a rede.
  event.respondWith(
    caches.match(req).then(cacheRes => {
      // Se encontrou no cache, retorna a versão cacheada
      if (cacheRes) {
        // Opcional: Busca a versão mais nova em segundo plano (Stale-While-Revalidate)
        fetch(req).then(networkRes => {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, networkRes.clone());
          });
        }).catch(err => console.log("SW: Falha ao buscar nova versão de:", req.url));

        return cacheRes;
      }

      // Se não encontrou no cache, tenta a rede e armazena o resultado
      return fetch(req)
        .then(networkRes => {
          // Armazena a resposta da rede no cache
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, networkRes.clone());
          });
          return networkRes;
        })
        .catch(() => {
          // Falhou na rede e não tinha no cache: retorna uma resposta de falha (pode ser personalizado)
          console.log("SW: Recurso não encontrado na rede ou cache:", req.url);
          // Para evitar quebrar o CSS/JS, é melhor retornar uma falha de rede padrão
          return new Response("Recurso offline.", { status: 503, statusText: "Offline" });
        });
    })
  );
});

// =============================================
// MENSAGENS DO CLIENTE
// =============================================
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});