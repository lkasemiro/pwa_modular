// ===========================================
// APP.JS – PWA MODULAR ESTABILIZADO
// ===========================================

// -------------------------------------------
// ESTADO GLOBAL
// -------------------------------------------
const LOCAIS_VISITA = [
  "Selecionar Local...",
  "Rio D'Ouro", "São Pedro", "Tinguá - Barrelão", "Tinguá - Serra Velha",
  "Tinguá - Brava/Macucuo", "Tinguá - Colomi", "Tinguá - Boa Esperança",
  "Mantiquira - T1", "Mantiquira - T2", "Xerém I - João Pinto",
  "Xerém II - Entrada", "Xerém III - Plano", "Xerém III - Registro"
];

const APP_STATE = {
  avaliador: "", local: "", colaborador: "", data: "",
  tipoRoteiro: null, roteiro: null,
  respostas: {}, fotos: {}, fotoIndex: {}
};

let mapa = null;
let stream = null;
let currentPhotoInputId = null;

const GEO_STATE = { latitude: null, longitude: null, accuracy: null, timestamp: null };
let userMarker = null;
let accuracyCircle = null;
let topPhotoUrls = [];

// -------------------------------------------
// UI UTILITIES / NAVEGAÇÃO
// -------------------------------------------
function showScreen(id) {
  const telas = ["screen-cadastro", "screen-select-roteiro", "screen-formulario", "screen-final"];
  telas.forEach((t) => {
    const el = document.getElementById(t);
    if (el) el.classList.toggle("hidden", t !== id);
  });
  
  // Se abrir o formulário, garante que o topo de fotos esteja limpo se não for PGE
  if (id === "screen-formulario" && APP_STATE.tipoRoteiro !== "pge") {
    limparFotosTopo();
  }
}

// -------------------------------------------
// GEOLOCALIZAÇÃO (CORRIGIDA PARA APRESENTAÇÕES)
// -------------------------------------------
function obterLocalizacaoAtual() {
  if (!navigator.geolocation) {
    console.warn("Geolocalização não suportada.");
    return;
  }

  // Ajustado para não travar a tela se o GPS demorar
  const geoOptions = {
    enableHighAccuracy: false, // False para ser mais rápido em ambientes fechados
    timeout: 7000,            // 7 segundos de limite
    maximumAge: 30000         // Aceita cache de 30 segundos
  };

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      GEO_STATE.latitude = latitude;
      GEO_STATE.longitude = longitude;
      GEO_STATE.accuracy = accuracy;
      GEO_STATE.timestamp = new Date().toISOString();
      atualizarMapaComLocalizacao(latitude, longitude, accuracy);
    },
    (err) => {
      console.warn("GPS Timeout/Erro (Normal em locais fechados):", err.message);
      // Não mostramos mensagem de erro invasiva aqui para não atrapalhar a UI
    },
    geoOptions
  );
}

function atualizarMapaComLocalizacao(lat, lng, accuracy) {
  if (!mapa) return;
  if (userMarker) mapa.removeLayer(userMarker);
  if (accuracyCircle) mapa.removeLayer(accuracyCircle);

  userMarker = L.marker([lat, lng]).addTo(mapa)
    .bindPopup("📍 Localização da Visita").openPopup();

  accuracyCircle = L.circle([lat, lng], {
    radius: accuracy, color: "#2563eb", fillOpacity: 0.1
  }).addTo(mapa);

  mapa.setView([lat, lng], 16);
}

// -------------------------------------------
// INICIALIZAÇÃO E CADASTRO
// -------------------------------------------
function initApp() {
  console.log("Iniciando App...");
  initLocaisSelect();
  carregarMetaDoLocalStorage();
  initMapa();
  initCadastro();
  initFormButtons();
  
  // Força a exibição da tela inicial
  showScreen("screen-cadastro");
}

function initLocaisSelect() {
  const sel = document.getElementById("local");
  if (sel) sel.innerHTML = LOCAIS_VISITA.map(l => `<option value="${l}">${l}</option>`).join("");
}

function initMapa() {
  const div = document.getElementById("mapa_local");
  if (!div || mapa) return;

  mapa = L.map("mapa_local").setView([-22.9035, -43.2096], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapa);
  
  setTimeout(() => { 
    mapa.invalidateSize();
    obterLocalizacaoAtual(); 
  }, 500);
}

function carregarMetaDoLocalStorage() {
  const fields = ["avaliador", "local", "colaborador", "data_visita"];
  fields.forEach(f => {
    const val = localStorage.getItem(f === "data_visita" ? "data" : f);
    const el = document.getElementById(f);
    if (val && el) {
      el.value = val;
      APP_STATE[f === "data_visita" ? "data" : f] = val;
    }
  });
}

function initCadastro() {
  const btn = document.getElementById("btn-cadastro-continuar");
  if (!btn) return;

  btn.onclick = () => {
    APP_STATE.avaliador = document.getElementById("avaliador").value.trim();
    APP_STATE.local = document.getElementById("local").value.trim();
    APP_STATE.colaborador = document.getElementById("colaborador").value.trim();
    APP_STATE.data = document.getElementById("data_visita").value.trim();

    if (!APP_STATE.avaliador || !APP_STATE.local || APP_STATE.local === "Selecionar Local..." || !APP_STATE.data) {
      alert("Preencha os campos obrigatórios (Avaliador, Local e Data).");
      return;
    }

    localStorage.setItem("avaliador", APP_STATE.avaliador);
    localStorage.setItem("local", APP_STATE.local);
    localStorage.setItem("colaborador", APP_STATE.colaborador);
    localStorage.setItem("data", APP_STATE.data);

    showScreen("screen-select-roteiro");
  };
}

// -------------------------------------------
// EXPOSIÇÃO GLOBAL (Módulos)
// -------------------------------------------
window.initApp = initApp;
window.selectRoteiro = selectRoteiro;
window.voltarParaCadastro = voltarParaCadastro;
window.abrirCamera = abrirCamera;
window.showScreen = showScreen;

// Dispara o app
window.addEventListener("load", initApp);

// ... (Mantenha as demais funções: selectRoteiro, renderFormulario, etc., conforme seu arquivo original)
