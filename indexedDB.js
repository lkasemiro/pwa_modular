// =====================================================
// INDEXEDDB.JS – BANCO DE DADOS CEDAE (MODELO FINAL)
// Arquitetura: VISITAS + RESPOSTAS + IMAGENS
// =====================================================

const DB_NAME = "cedae_pwa_db";
const DB_VERSION = 5;

let dbPromise = null;

// -----------------------------------------------------
// ABERTURA / UPGRADE
// -----------------------------------------------------
function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // ---------------- VISITAS ----------------
      // 1 linha = 1 vistoria
      if (!db.objectStoreNames.contains("visitas")) {
        db.createObjectStore("visitas", { keyPath: "visita_id" });
      }

      // ---------------- RESPOSTAS ----------------
      // 1 linha = 1 pergunta respondida
      if (!db.objectStoreNames.contains("respostas")) {
        const store = db.createObjectStore("respostas", {
          keyPath: "id",
          autoIncrement: true
        });
        store.createIndex("visita_id", "visita_id", { unique: false });
        store.createIndex("roteiro", "roteiro", { unique: false });
      }

      // ---------------- IMAGENS ----------------
      // 1 linha = 1 imagem vinculada a pergunta
      if (!db.objectStoreNames.contains("imagens")) {
        const store = db.createObjectStore("imagens", {
          keyPath: "id",
          autoIncrement: true
        });
        store.createIndex("visita_id", "visita_id", { unique: false });
        store.createIndex("pergunta_id", "pergunta_id", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// =====================================================
// SALVAR VISITA (METADADOS)
// =====================================================
async function salvarVisita() {
  const db = await openDB();

  const visita = {
    visita_id: Date.now(),
    avaliador: APP_STATE.avaliador,
    colaborador_gla: APP_STATE.colaborador_gla,
    local: APP_STATE.local,
    data_visita: APP_STATE.data_visita,
    tipo_roteiro: APP_STATE.tipoRoteiro, // geral | aa | pge
    lat_inicial: APP_STATE.geolocalizacao_inicio?.lat || "",
    lng_inicial: APP_STATE.geolocalizacao_inicio?.lng || "",
    data_registro: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("visitas", "readwrite");
    tx.objectStore("visitas").add(visita);

    tx.oncomplete = () => resolve(visita.visita_id);
    tx.onerror = () => reject(tx.error);
  });
}

// =====================================================
// SALVAR RESPOSTA (1 PERGUNTA = 1 LINHA)
// =====================================================
async function salvarResposta(visita_id, p, resposta, gps = null) {
  const db = await openDB();

  const registro = {
    visita_id,
    roteiro: APP_STATE.tipoRoteiro, // geral | aa | pge
    pergunta_id: p.id,
    secao: p.Secao || "",
    pergunta: p.Pergunta,
    resposta,
    lat: gps?.lat || "",
    lng: gps?.lng || ""
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("respostas", "readwrite");
    tx.objectStore("respostas").add(registro);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// =====================================================
// SALVAR IMAGEM (BASE64 VISÍVEL NO EXCEL)
// =====================================================
async function salvarImagem(visita_id, pergunta_id, base64) {
  const db = await openDB();

  const registro = {
    visita_id,
    pergunta_id,
    imagem_base64: base64
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("imagens", "readwrite");
    tx.objectStore("imagens").add(registro);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// =====================================================
// FINALIZAR VISITA (PIPELINE CORRETO)
// =====================================================
async function finalizarVisitaBanco(roteiroPerguntas) {
  // 1️⃣ salva visita
  const visita_id = await salvarVisita();

  // 2️⃣ salva respostas
  for (const p of roteiroPerguntas) {
    const resposta = APP_STATE.respostas[p.id];
    if (resposta !== undefined && resposta !== "") {
      await salvarResposta(visita_id, p, resposta, p.gps);
    }
  }

  // 3️⃣ salva imagens (se existirem)
  if (APP_STATE.fotos) {
    for (const pid in APP_STATE.fotos) {
      await salvarImagem(visita_id, pid, APP_STATE.fotos[pid]);
    }
  }

  return visita_id;
}

// =====================================================
// LEITURA CONSOLIDADA (TABELÃO)
// =====================================================
async function obterBancoConsolidado() {
  const db = await openDB();

  const readAll = (store) =>
    new Promise((resolve) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
    });

  return {
    visitas: await readAll("visitas"),
    respostas: await readAll("respostas"),
    imagens: await readAll("imagens")
  };
}

// =====================================================
// LIMPEZA TOTAL (ADMIN)
// =====================================================
async function apagarBanco() {
  if (!confirm("Apagar TODAS as vistorias salvas neste dispositivo?")) return;
  const db = await openDB();
  const tx = db.transaction(["visitas", "respostas", "imagens"], "readwrite");
  tx.objectStore("visitas").clear();
  tx.objectStore("respostas").clear();
  tx.objectStore("imagens").clear();
  alert("Banco limpo.");
  location.reload();
}
 
