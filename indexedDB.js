// indexedDB.js – Banco de dados modular para Geral, PGE e AA

// ===============================
// CONFIGURAÇÃO DOS BANCOS
// ===============================
// Cada módulo terá seu próprio DB:
// DB_GERAL, DB_PGE, DB_AA
// Cada DB terá stores:
// - Respostas
// - Fotos
// - Meta (opcional no futuro)

let CURRENT_DB = null;
let CURRENT_DB_NAME = null;
let CURRENT_DB_VERSION = 1;

// ===============================
// FUNÇÃO PRINCIPAL: initIndexedDB(tipo)
// ===============================
function initIndexedDB(tipoRoteiro) {
  return new Promise((resolve, reject) => {
    const map = {
      geral: "DB_GERAL",
      pge: "DB_PGE",
      aa: "DB_AA"
    };

    CURRENT_DB_NAME = map[tipoRoteiro];
    if (!CURRENT_DB_NAME) return reject("Tipo de roteiro inválido");

    const request = indexedDB.open(CURRENT_DB_NAME, CURRENT_DB_VERSION);

    request.onerror = e => reject("Falha ao abrir o banco: " + e.target.error);

    request.onupgradeneeded = e => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains("Respostas")) {
        db.createObjectStore("Respostas", { keyPath: "idPergunta" });
      }

      if (!db.objectStoreNames.contains("Fotos")) {
        db.createObjectStore("Fotos", { keyPath: "fotoId" });
      }
    };

    request.onsuccess = e => {
      CURRENT_DB = e.target.result;
      resolve();
    };
  });
}

// ===============================
// STORE HELPERS
// ===============================
function getStore(storeName, mode = "readwrite") {
  const tx = CURRENT_DB.transaction([storeName], mode);
  return tx.objectStore(storeName);
}

// ===============================
// SALVAR RESPOSTA
// ===============================
function saveAnswerToDB(idPergunta, valor) {
  if (!CURRENT_DB) return;
  const store = getStore("Respostas");
  store.put({ idPergunta, valor });
}

// ===============================
// SALVAR FOTO (BLOB)
// ===============================
function savePhotoToDB(fotoId, blob, idPergunta) {
  if (!CURRENT_DB) return;
  const store = getStore("Fotos");
  store.put({ fotoId, blob, idPergunta });
}

// ===============================
// LISTAR TODAS AS FOTOS DO DB
// ===============================
function getAllPhotosFromDB() {
  return new Promise((resolve, reject) => {
    const store = getStore("Fotos", "readonly");
    const request = store.getAll();

    request.onerror = e => reject("Erro ao carregar fotos: " + e.target.error);

    request.onsuccess = e => resolve(request.result || []);
  });
}

// ===============================
// LIMPAR O BANCO DO ROTEIRO ATUAL
// ===============================
function clearCurrentDB() {
  return new Promise((resolve, reject) => {
    if (!CURRENT_DB_NAME) return resolve();

    const req = indexedDB.deleteDatabase(CURRENT_DB_NAME);

    req.onerror = e => reject("Erro ao limpar DB: " + e.target.error);

    req.onsuccess = e => resolve();
  });
}

// ===============================
// EXPORTS OPCIONAIS
// ===============================
// window.initIndexedDB = initIndexedDB;
// window.saveAnswerToDB = saveAnswerToDB;
// window.savePhotoToDB = savePhotoToDB;
// window.getAllPhotosFromDB = getAllPhotosFromDB;
// window.clearCurrentDB = clearCurrentDB;