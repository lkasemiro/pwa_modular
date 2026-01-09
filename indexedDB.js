// =====================================================
// indexedDB.js – BANCO COM SUPORTE A GEOLOCALIZAÇÃO
// =====================================================

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    // Versão 3 para suportar a nova estrutura de coordenadas
    const request = indexedDB.open("cedae_pwa_db", 3);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("respostas")) {
        const store = db.createObjectStore("respostas", { keyPath: "key" });
        store.createIndex("tipo", "tipo", { unique: false });
      }

      if (!db.objectStoreNames.contains("fotos")) {
        const store = db.createObjectStore("fotos", { keyPath: "fotoId" });
        store.createIndex("tipo", "tipo", { unique: false });
      }

      // NOVO: Store para armazenar o cabeçalho das visitas realizadas
      if (!db.objectStoreNames.contains("historico_visitas")) {
        db.createObjectStore("historico_visitas", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// -----------------------------------------------------
// SALVAR RESPOSTA (com geolocalização no objeto se necessário)
// -----------------------------------------------------
async function saveAnswerToDB(idPergunta, valor) {
  const tipo = APP_STATE.tipoRoteiro;
  const key = `${tipo}_${idPergunta}`;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("respostas", "readwrite");
    const store = tx.objectStore("respostas");

    store.put({
      key,
      tipo,
      idPergunta,
      valor,
      timestamp: new Date().toISOString()
    });

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// -----------------------------------------------------
// FINALIZAR VISITA: Consolida dados e Coordenadas
// -----------------------------------------------------
async function finalizarERegistrarVisita() {
  const db = await openDB();
  
  const visitaCompleta = {
    id: Date.now(),
    avaliador: APP_STATE.avaliador,
    local: APP_STATE.local,
    data: APP_STATE.data_visita || new Date().toLocaleDateString('pt-BR'),
    tipo: APP_STATE.tipoRoteiro,
    // Puxa as coordenadas capturadas silenciosamente no app.js
    coord_inicial: APP_STATE.geolocalizacao_inicio,
    coord_sublocal: APP_STATE.geolocalizacao_sublocal,
    respostas: APP_STATE.respostas
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("historico_visitas", "readwrite");
    tx.objectStore("historico_visitas").add(visitaCompleta);
    
    tx.oncomplete = () => {
        // Opcional: Salva no localStorage para a aba de histórico rápido
        const histRapido = JSON.parse(localStorage.getItem("historico_vistorias") || "[]");
        histRapido.push(visitaCompleta);
        localStorage.setItem("historico_vistorias", JSON.stringify(histRapido));
        resolve(visitaCompleta);
    };
    tx.onerror = () => reject(tx.error);
  });
}

// -----------------------------------------------------
// GERAÇÃO DE DADOS PARA EXCEL (Com Coordenadas)
// -----------------------------------------------------
async function exportarDadosParaExcel() {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction("historico_visitas", "readonly");
    const store = tx.objectStore("historico_visitas");
    const req = store.getAll();

    req.onsuccess = () => {
      const visitas = req.result;
      
      // Mapeia os dados para o formato de colunas do Excel
      const dadosPlanilha = visitas.map(v => {
        const linha = {
          "Data": v.data,
          "Avaliador": v.avaliador,
          "Unidade/Local": v.local,
          "Roteiro": v.tipo.toUpperCase(),
          "Lat Inicial": v.coord_inicial?.lat || "N/A",
          "Lon Inicial": v.coord_inicial?.lng || "N/A",
          "Lat Sublocal": v.coord_sublocal?.lat || "N/A",
          "Lon Sublocal": v.coord_sublocal?.lng || "N/A"
        };

        // Adiciona cada resposta como uma coluna nova
        Object.keys(v.respostas).forEach(key => {
          linha[`Pergunta_${key}`] = v.respostas[key];
        });

        return linha;
      });

      resolve(dadosPlanilha);
    };
    req.onerror = () => reject(req.error);
  });
}

// -----------------------------------------------------
// LIMPAR DADOS APÓS EXPORTAÇÃO (Segurança)
// -----------------------------------------------------
async function clearAllData() {
  const db = await openDB();
  const tx = db.transaction(["respostas", "fotos"], "readwrite");
  tx.objectStore("respostas").clear();
  tx.objectStore("fotos").clear();
  return new Promise(r => tx.oncomplete = () => r(true));
}
