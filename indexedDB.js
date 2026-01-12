const DB_NAME = "cedae_pwa_db";
const DB_VERSION = 7;
let dbInstance = null;

/**
 * Abre a conexão usando o padrão Singleton para evitar múltiplas conexões abertas.
 */
async function getDB() {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            
            // Boas práticas: Criar stores com índices para buscas rápidas (Performance Sênior)
            if (!db.objectStoreNames.contains("visitas")) {
                db.createObjectStore("visitas", { keyPath: "visita_id" });
            }
            
            if (!db.objectStoreNames.contains("respostas")) {
                const store = db.createObjectStore("respostas", { keyPath: "id", autoIncrement: true });
                store.createIndex("visita_id", "visita_id", { unique: false });
            }

            if (!db.objectStoreNames.contains("imagens")) {
                const store = db.createObjectStore("imagens", { keyPath: "id", autoIncrement: true });
                store.createIndex("visita_id", "visita_id", { unique: false });
            }
        };

        request.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };

        request.onerror = (e) => {
            console.error("Erro crítico no IndexedDB:", e.target.error);
            reject("Erro ao inicializar base de dados offline.");
        };
    });
}

/**
 * Função Sênior: Executa transações de forma genérica e segura.
 * Reduz repetição de código (DRY).
 */
async function performTransaction(storeName, mode, callback) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        
        // O callback é onde a mágica acontece (add, put, get, etc)
        const request = callback(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
        
        // Garante integridade: se a transação falhar por completo
        transaction.onabort = () => reject("Transação abortada pelo sistema.");
    });
}

/**
 * API Pública de manipulação de dados
 */
const DB_API = {
    saveVisita: (dados) => performTransaction("visitas", "readwrite", store => store.put(dados)),
    
    saveResposta: (resposta) => performTransaction("respostas", "readwrite", store => store.add(resposta)),
    
    saveImagem: (imagem) => performTransaction("imagens", "readwrite", store => store.add(imagem)),
    
    getAllVisitas: () => performTransaction("visitas", "readonly", store => store.getAll()),
    
    getRespostasByVisita: async (visitaId) => {
        const db = await getDB();
        return new Promise((resolve) => {
            const tx = db.transaction("respostas", "readonly");
            const index = tx.objectStore("respostas").index("visita_id");
            const request = index.getAll(visitaId);
            request.onsuccess = () => resolve(request.result);
        });
    }
};
