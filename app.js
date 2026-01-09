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

// -------------------------------------------
// SELEÇÃO DO ROTEIRO
// -------------------------------------------
async function selectRoteiro(tipo) {
  // window.ROTEIROS é preenchido pelo import no index.html
  if (!window.ROTEIROS || !window.ROTEIROS[tipo]) {
    console.error("Roteiro não carregado:", tipo);
    alert("Erro: Dados do roteiro não encontrados.");
    return;
  }

  APP_STATE.tipoRoteiro = tipo;
  APP_STATE.roteiro = window.ROTEIROS[tipo];
  APP_STATE.respostas = {};
  APP_STATE.fotos = {};
  APP_STATE.fotoIndex = {};

  showSpinner();
  // Inicializa o banco de dados para o tipo selecionado
  if (typeof initIndexedDB === "function") {
    try {
      await initIndexedDB(tipo);
    } catch (e) {
      console.warn("Erro ao iniciar IndexedDB, operando em memória:", e);
    }
  }
  hideSpinner();

  // Define o título na tela
  const label = document.getElementById("roteiro-atual-label");
  if (label) {
    const nomes = { geral: "Geral", pge: "PGE", aa: "Acidentes Ambientais" };
    label.textContent = nomes[tipo] || "Formulário";
  }

  // Prepara o formulário
  montarSecoes();
  
  if (tipo === "pge") {
    montarLocaisPGE();
    document.getElementById("local_pge_box")?.classList.remove("hidden");
  } else {
    document.getElementById("local_pge_box")?.classList.add("hidden");
  }

  renderFormulario();
  showScreen("screen-formulario");
}

// -------------------------------------------
// RENDERIZAÇÃO DO FORMULÁRIO
// -------------------------------------------
function renderFormulario(secaoFiltrada = null) {
  const container = document.getElementById("conteudo_formulario");
  if (!container) return;
  container.innerHTML = "";

  let perguntas = APP_STATE.roteiro || [];

  // Filtro de Seção
  if (secaoFiltrada) {
    perguntas = perguntas.filter(p => (p.secao || p.Secao) === secaoFiltrada);
  }

  if (perguntas.length === 0) {
    container.innerHTML = `<div class="p-4 text-gray-500 text-center">Nenhuma pergunta disponível nesta seção.</div>`;
    return;
  }

  const card = document.createElement("div");
  card.className = "bg-white rounded-xl shadow p-4 space-y-6";

  perguntas.forEach((p) => {
    const div = document.createElement("div");
    div.id = `group_${p.id}`;
    div.className = "border-b pb-4 last:border-0";

    const label = document.createElement("label");
    label.className = "block font-bold text-gray-700 mb-2";
    label.innerHTML = p.pergunta || p.Pergunta;
    div.appendChild(label);

    const inputArea = criarInputParaPergunta(p);
    div.appendChild(inputArea);

    card.appendChild(div);
  });

  container.appendChild(card);
  applyConditionalLogic();
}

// -------------------------------------------
// CRIAÇÃO DOS CAMPOS (INPUTS)
// -------------------------------------------
function criarInputParaPergunta(p) {
  const wrapper = document.createElement("div");
  const tipo = (p.tipo || p.TipoInput || "").toLowerCase();
  const idPerg = p.id;
  const opcoes = p.opcoes || [];

  if (tipo === "radio") {
    opcoes.forEach(op => {
      const lbl = document.createElement("label");
      lbl.className = "flex items-center space-x-2 mb-2 cursor-pointer";
      lbl.innerHTML = `<input type="radio" name="${idPerg}" value="${op}" class="w-5 h-5 text-blue-600"> <span>${op}</span>`;
      lbl.querySelector("input").onchange = () => autosave(idPerg, op);
      wrapper.appendChild(lbl);
    });
  } 
  else if (tipo === "textarea") {
    const ta = document.createElement("textarea");
    ta.className = "w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500";
    ta.rows = 3;
    ta.oninput = () => autosave(idPerg, ta.value);
    wrapper.appendChild(ta);
  }
  else if (tipo === "file") {
    const btn = document.createElement("button");
    btn.className = "flex items-center justify-center w-full bg-blue-100 text-blue-700 p-4 rounded-lg border-2 border-dashed border-blue-300 hover:bg-blue-200 transition";
    btn.innerHTML = `📸 Capturar Foto`;
    btn.onclick = () => abrirCamera(idPerg);
    wrapper.appendChild(btn);

    const lista = document.createElement("div");
    lista.id = `fotos_${idPerg}`;
    lista.className = "mt-2 flex flex-wrap gap-2";
    wrapper.appendChild(lista);
  }
  else {
    const inp = document.createElement("input");
    inp.type = tipo === "number" ? "number" : "text";
    inp.className = "w-full border rounded-lg p-2";
    inp.oninput = () => autosave(idPerg, inp.value);
    wrapper.appendChild(inp);
  }

  return wrapper;
}

// -------------------------------------------
// LÓGICA DE SEÇÕES E CONDICIONAIS
// -------------------------------------------
function montarSecoes() {
  const sel = document.getElementById("secao_select");
  if (!sel) return;
  const secoes = [...new Set((APP_STATE.roteiro || []).map(p => p.secao || p.Secao))].filter(Boolean);
  sel.innerHTML = `<option value="">Todas as Seções</option>` + secoes.map(s => `<option value="${s}">${s}</option>`).join("");
  sel.onchange = (e) => renderFormulario(e.target.value);
}

function autosave(id, valor) {
  APP_STATE.respostas[id] = valor;
  if (typeof saveAnswerToDB === "function") saveAnswerToDB(id, valor);
  applyConditionalLogic();
}

function applyConditionalLogic() {
  // Lógica para esconder/mostrar perguntas dependentes (ex: 4.1 se 4 for 'Outro')
  const roteiro = APP_STATE.roteiro || [];
  roteiro.forEach(p => {
    if (p.pergunta.includes(".1")) { // Exemplo simples: perguntas .1 dependem da anterior
      const idBase = p.id.split("_")[0] + "_" + (parseInt(p.id.split("_")[1]) - 1).toString().padStart(2, '0');
      const group = document.getElementById(`group_${p.id}`);
      if (group) {
        const respPai = APP_STATE.respostas[idBase];
        group.classList.toggle("hidden", !respPai || (respPai !== "Sim" && !respPai.includes("Outro")));
      }
    }
  });
}
