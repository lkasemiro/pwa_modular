// =====================================================
// INDEXEDDB.JS – BANCO DE DADOS CEDAE (V4.0)
// =====================================================

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    // Versão 4: Garante que todas as objectStores existam
    const request = indexedDB.open("cedae_pwa_db", 4);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store para respostas individuais (autosave enquanto preenche)
      if (!db.objectStoreNames.contains("respostas")) {
        db.createObjectStore("respostas", { keyPath: "key" });
      }

      // Store para fotos (Base64 pesado ou Blobs)
      if (!db.objectStoreNames.contains("fotos")) {
        db.createObjectStore("fotos", { keyPath: "id" });
      }

      // Store para a vistoria completa finalizada
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
// SALVAR RESPOSTA (Autosave por pergunta)
// -----------------------------------------------------
async function saveAnswerToDB(idPergunta, valor) {
  const db = await openDB();
  const tipo = APP_STATE.tipoRoteiro;
  const key = `${tipo}_${idPergunta}`;

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
// SALVAR FOTO (Tratamento especial para arquivos)
// -----------------------------------------------------
async function savePhotoToDB(idPergunta, base64Data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("fotos", "readwrite");
    tx.objectStore("fotos").put({
      id: `${APP_STATE.tipoRoteiro}_${idPergunta}`,
      data: base64Data,
      timestamp: new Date().toISOString()
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// -----------------------------------------------------
// FINALIZAR VISITA: Consolida tudo
// -----------------------------------------------------
async function finalizarERegistrarVisita() {
  const db = await openDB();
  
  // Criamos o pacote completo da visita
  const visitaCompleta = {
    id: Date.now(),
    avaliador: APP_STATE.avaliador,
    colaborador_gla: APP_STATE.colaborador_gla,
    local: APP_STATE.local,
    sublocal: document.getElementById("sublocal_select")?.value || "N/A",
    data_visita: APP_STATE.data_visita,
    data_registro: new Date().toLocaleString('pt-BR'),
    tipo_roteiro: APP_STATE.tipoRoteiro,
    coordenadas: APP_STATE.geolocalizacao_inicio,
    respostas: APP_STATE.respostas
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("historico_visitas", "readwrite");
    tx.objectStore("historico_visitas").add(visitaCompleta);
    
    tx.oncomplete = () => {
        // Sincroniza com localStorage para o histórico rápido da UI
        const histRapido = JSON.parse(localStorage.getItem("historico_vistorias") || "[]");
        histRapido.push(visitaCompleta);
        localStorage.setItem("historico_vistorias", JSON.stringify(histRapido));
        
        // Limpa respostas temporárias após salvar a visita completa
        clearTemporaryData();
        resolve(visitaCompleta);
    };
    tx.onerror = () => reject(tx.error);
  });
}

// -----------------------------------------------------
// EXPORTAÇÃO PARA EXCEL
// -----------------------------------------------------
async function exportarDadosParaExcel() {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction("historico_visitas", "readonly");
    const store = tx.objectStore("historico_visitas");
    const req = store.getAll();

    req.onsuccess = () => {
      const visitas = req.result;
      
      const dadosPlanilha = visitas.map(v => {
        const linha = {
          "Data Visita": v.data_visita,
          "Data Registro": v.data_registro,
          "Avaliador": v.avaliador,
          "Colaborador GLA": v.colaborador_gla,
          "Unidade": v.local,
          "Sublocal": v.sublocal,
          "Roteiro": v.tipo_roteiro?.toUpperCase(),
          "Latitude": v.coordenadas?.lat || "",
          "Longitude": v.coordenadas?.lng || ""
        };

        // Transforma o objeto de respostas em colunas
        // Se a resposta for uma imagem (Base64), escrevemos "[IMAGEM]" para não travar o Excel
        Object.keys(v.respostas).forEach(id => {
          let valor = v.respostas[id];
          if (valor && valor.length > 500) valor = "[IMAGEM/ARQUIVO]";
          linha[`Pergunta_${id}`] = valor;
        });

        return linha;
      });

      resolve(dadosPlanilha);
    };
    req.onerror = () => reject(req.error);
  });
}

// -----------------------------------------------------
// LIMPEZA
// -----------------------------------------------------
async function clearTemporaryData() {
  const db = await openDB();
  const tx = db.transaction(["respostas", "fotos"], "readwrite");
  tx.objectStore("respostas").clear();
  tx.objectStore("fotos").clear();
}

async function deletarTudo() {
    if(!confirm("Deseja apagar TODO o histórico permanentemente?")) return;
    const db = await openDB();
    const tx = db.transaction(["respostas", "fotos", "historico_visitas"], "readwrite");
    tx.objectStore("respostas").clear();
    tx.objectStore("fotos").clear();
    tx.objectStore("historico_visitas").clear();
    localStorage.removeItem("historico_vistorias");
    alert("Dados apagados.");
    location.reload();
}

