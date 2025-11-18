// indexedDB.js – implementação simples para o PWA

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("cedae_pwa_db", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("respostas")) {
        db.createObjectStore("respostas", { keyPath: "idPergunta" });
      }
      if (!db.objectStoreNames.contains("fotos")) {
        db.createObjectStore("fotos", { keyPath: "fotoId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function initIndexedDB(tipo) {
  // tipo não é usado por enquanto, mas pode ser no futuro
  await openDB();
}

// --------------------- RESPOSTAS
async function saveAnswerToDB(idPergunta, valor) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("respostas", "readwrite");
    const store = tx.objectStore("respostas");
    store.put({ idPergunta, valor });

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// --------------------- FOTOS
async function savePhotoToDB(fotoId, blob, idPergunta) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("fotos", "readwrite");
    const store = tx.objectStore("fotos");
    store.put({ fotoId, blob, idPergunta });

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllPhotosFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("fotos", "readonly");
    const store = tx.objectStore("fotos");
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// limpa tudo para a próxima visita
async function clearCurrentDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["respostas", "fotos"], "readwrite");
    tx.objectStore("respostas").clear();
    tx.objectStore("fotos").clear();

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}