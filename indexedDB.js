const DB_NAME = "cedae_pwa_db";
const DB_VERSION = 7;

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("visitas")) db.createObjectStore("visitas", { keyPath: "visita_id" });
            if (!db.objectStoreNames.contains("respostas")) {
                const store = db.createObjectStore("respostas", { keyPath: "id", autoIncrement: true });
                store.createIndex("visita_id", "visita_id");
            }
            if (!db.objectStoreNames.contains("imagens")) {
                const store = db.createObjectStore("imagens", { keyPath: "id", autoIncrement: true });
                store.createIndex("visita_id", "visita_id");
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
 
