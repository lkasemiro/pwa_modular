// ============================================================
// INDEXEDDB.JS – PERSISTÊNCIA OFFLINE (CEDAE)
// ============================================================

// ------------------------------------------------------------
// 1. CONSTANTES DO BANCO
// ------------------------------------------------------------
const DB_NAME = "CEDAE_VistoriasDB";
const DB_VERSION = 2;

const STORE_RESPOSTAS = "vistorias";
const STORE_FOTOS = "fotos";

// ------------------------------------------------------------
// 2. API CENTRAL DO BANCO
// ------------------------------------------------------------
const DB_API = {

    // --------------------------------------------------------
    // ABERTURA / UPGRADE DO BANCO
    // --------------------------------------------------------
    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORE_RESPOSTAS)) {
                    db.createObjectStore(STORE_RESPOSTAS, { keyPath: "db_id" });
                }

                if (!db.objectStoreNames.contains(STORE_FOTOS)) {
                    const store = db.createObjectStore(STORE_FOTOS, { keyPath: "foto_id" });
                    // Índice fundamental para o funcionamento do getFotosPergunta
                    store.createIndex("pergunta_id", "pergunta_id", { unique: false });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("Erro ao abrir IndexedDB");
        });
    },

    // --------------------------------------------------------
    // SALVAR ESTADO COMPLETO DA VISTORIA
    // --------------------------------------------------------
    async saveVisita(estado) {
        try {
            const db = await this.openDB();
            const tx = db.transaction(STORE_RESPOSTAS, "readwrite");
            const store = tx.objectStore(STORE_RESPOSTAS);

            // Clonagem defensiva
            const dados = JSON.parse(JSON.stringify(estado));
            dados.db_id = "visita_atual";
            dados.ultima_atualizacao = new Date().toISOString();

            return new Promise((resolve, reject) => {
                const req = store.put(dados);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject("Erro ao salvar vistoria");
            });

        } catch (err) {
            console.error("Erro ao salvar vistoria:", err);
        }
    },

    // --------------------------------------------------------
    // CARREGAR ÚLTIMA VISTORIA SALVA
    // --------------------------------------------------------
    async loadVisita() {
        try {
            const db = await this.openDB();
            const tx = db.transaction(STORE_RESPOSTAS, "readonly");
            const store = tx.objectStore(STORE_RESPOSTAS);
            const req = store.get("visita_atual");

            return new Promise((resolve) => {
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) { return null; }
    },

    // --------------------------------------------------------
    // SALVAR FOTO
    // --------------------------------------------------------
      async saveFoto(fotoId, blob, idPergunta) {
        const db = await this.openDB();
        const tx = db.transaction(STORE_FOTOS, "readwrite");
        const store = tx.objectStore(STORE_FOTOS);

        // MELHORIA: Fallback para tipoRoteiro caso APP_STATE falhe
        const tipo = (typeof APP_STATE !== 'undefined') ? APP_STATE.tipoRoteiro : "desconhecido";

        return new Promise((resolve, reject) => {
            const req = store.put({
                foto_id: fotoId,
                pergunta_id: idPergunta,
                tipo_roteiro: tipo, 
                blob: blob,
                timestamp: new Date().toISOString()
            });
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject();
        });
    },


    // --------------------------------------------------------
    // OBTER FOTOS DE UMA PERGUNTA
    // --------------------------------------------------------
   async getFotosPergunta(idPergunta) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_FOTOS, "readonly");
        const store = tx.objectStore(STORE_FOTOS);
        
        // Tenta usar o índice pergunta_id
        try {
            const index = store.index("pergunta_id");
            const req = index.getAll(idPergunta);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        } catch (e) {
            console.warn("Índice pergunta_id não encontrado, tentando busca manual...");
            // Fallback caso o índice não tenha sido criado no onupgradeneeded
            const req = store.getAll();
            req.onsuccess = () => {
                const filtradas = req.result.filter(f => f.pergunta_id === idPergunta);
                resolve(filtradas);
            };
        }
    });
}
}
// ------------------------------------------------------------
// 3. FUNÇÕES GLOBAIS USADAS PELO APP.JS
// ------------------------------------------------------------

window.saveAnswerToDB = () => {
    if (typeof APP_STATE === "undefined") return;
    DB_API.saveVisita(APP_STATE).catch(err => console.error(err));
};

window.savePhotoToDB = (fotoId, blob, idPergunta) => {
    return DB_API.saveFoto(fotoId, blob, idPergunta);
};

window.DB_API = DB_API;
// ------------------------------------------------------------
// 4. EXPOSIÇÃO GLOBAL (SE NECESSÁRIO)
// ------------------------------------------------------------
window.DB_API = DB_API;
window.DB_NAME = DB_NAME;

