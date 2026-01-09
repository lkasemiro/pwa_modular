// ===========================================
// APP.JS – PWA SUPERVISÃO AMBIENTAL (V12)
// ===========================================

const LOCAIS_VISITA = [
  "Selecionar Local...", "Rio D'Ouro", "São Pedro", "Tinguá - Barrelão", 
  "Tinguá - Serra Velha", "Tinguá - Brava/Macucuo", "Tinguá - Colomi", 
  "Tinguá - Boa Esperança", "Mantiquira - T1", "Mantiquira - T2", 
  "Xerém I - João Pinto", "Xerém II - Entrada", "Xerém III - Plano", "Xerém III - Registro"
];

const APP_STATE = {
  avaliador: "", local: "", colaborador: "", data: "",
  tipoRoteiro: null, roteiro: null,
  respostas: {}, fotos: {}, fotoIndex: {}
};

let mapa = null, userMarker = null, accuracyCircle = null;
const GEO_STATE = { latitude: null, longitude: null, accuracy: null, timestamp: null };

// --- NAVEGAÇÃO E UI ---
const showScreen = (id) => {
  ["screen-cadastro", "screen-select-roteiro", "screen-formulario", "screen-final"]
    .forEach(t => document.getElementById(t)?.classList.toggle("hidden", t !== id));
};

const showMessage = (msg, ok = false) => {
  const box = document.getElementById("message-box");
  if (!box) return alert(msg);
  box.textContent = msg;
  box.className = `fixed top-4 left-1/2 -translate-x-1/2 p-4 rounded shadow-lg z-50 ${ok ? 'bg-green-600' : 'bg-red-500'} text-white`;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 3000);
};

// --- GEOLOCALIZAÇÃO OTIMIZADA ---
function obterLocalizacaoAtual() {
  if (!navigator.geolocation) return;

  // Opções para evitar o erro de Timeout em áreas de sombra (Tinguá)
  const geoOptions = { 
    enableHighAccuracy: false, 
    timeout: 7000, 
    maximumAge: 30000 
  };

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      GEO_STATE.latitude = pos.coords.latitude;
      GEO_STATE.longitude = pos.coords.longitude;
      GEO_STATE.accuracy = pos.coords.accuracy;
      GEO_STATE.timestamp = new Date().toISOString();
      
      console.log("📍 GPS OK:", GEO_STATE.latitude, GEO_STATE.longitude);
      atualizarMapaVisual(GEO_STATE.latitude, GEO_STATE.longitude, GEO_STATE.accuracy);
    },
    (err) => console.warn("Aviso: GPS offline ou sinal fraco. Continuando sem coordenadas."),
    geoOptions
  );
}

function atualizarMapaVisual(lat, lng, acc) {
  if (!mapa) return;
  if (userMarker) mapa.removeLayer(userMarker);
  if (accuracyCircle) mapa.removeLayer(accuracyCircle);

  userMarker = L.marker([lat, lng]).addTo(mapa).bindPopup("Você está aqui").openPopup();
  accuracyCircle = L.circle([lat, lng], { radius: acc, color: '#3b82f6', fillOpacity: 0.1 }).addTo(mapa);
  mapa.setView([lat, lng], 16);
}

// --- CADASTRO INICIAL ---
function initCadastro() {
  const btn = document.getElementById("btn-cadastro-continuar");
  if (!btn) return;

  btn.onclick = () => {
    const fields = ["avaliador", "local", "colaborador", "data_visita"];
    const values = fields.reduce((acc, f) => ({ ...acc, [f]: document.getElementById(f).value.trim() }), {});

    if (Object.values(values).some(v => !v || v === "Selecionar Local...")) {
      return showMessage("Preencha todos os campos corretamente.", false);
    }

    Object.assign(APP_STATE, values);
    fields.forEach(f => localStorage.setItem(f, values[f]));
    
    // Tenta obter localização ao clicar em continuar
    obterLocalizacaoAtual();
    showScreen("screen-select-roteiro");
  };
}

// --- SELEÇÃO DE ROTEIRO ---
async function selectRoteiro(tipo) {
  // Roteiros carregados do arquivo global roteiros.js
  const roteirosMap = {
    'pge': (typeof ROTEIRO_PGE !== 'undefined') ? ROTEIRO_PGE : null,
    'geral': (typeof ROTEIRO_GERAL !== 'undefined') ? ROTEIRO_GERAL : null,
    'aa': (typeof ROTEIRO_AA !== 'undefined') ? ROTEIRO_AA : null
  };

  const roteiroSelecionado = roteirosMap[tipo];
  
  if (!roteiroSelecionado) {
    alert("Erro: Roteiro não encontrado. Verifique se o arquivo roteiros.js foi carregado.");
    return;
  }

  APP_STATE.tipoRoteiro = tipo;
  APP_STATE.roteiro = roteiroSelecionado;

  // Vínculo da localização ao metadado da sessão (Banco de Dados Local)
  const metadataVisita = {
    tipo: tipo,
    local: APP_STATE.local,
    avaliador: APP_STATE.avaliador,
    geolocalizacao: { ...GEO_STATE },
    inicio: new Date().toISOString()
  };

  localStorage.setItem("sessao_ativa", JSON.stringify(metadataVisita));

  renderFormulario();
  showScreen("screen-formulario");
}

// --- FORMULÁRIO DINÂMICO ---
function renderFormulario(secaoFiltrada = null) {
  const container = document.getElementById("conteudo_formulario");
  if (!container) return;
  
  let perguntas = APP_STATE.roteiro || [];

  if (secaoFiltrada) {
    perguntas = perguntas.filter(p => (p.Secao || p["Seção"]) === secaoFiltrada);
  }

  const fragment = document.createDocumentFragment();
  perguntas.forEach(p => {
    const div = document.createElement("div");
    div.className = "mb-6 p-4 bg-white rounded-lg shadow-sm border-l-4 border-blue-500";
    div.id = `group_${p.id}`;
    
    div.innerHTML = `
      ${p.ImagemApoio ? `<img src="${p.ImagemApoio}" class="mb-2 rounded max-h-40">` : ''}
      <label class="block font-bold text-gray-700 mb-2">${p.Pergunta}</label>
      <div id="input_container_${p.id}"></div>
    `;
    
    const inputWrapper = div.querySelector(`#input_container_${p.id}`);
    inputWrapper.appendChild(criarInputParaPergunta(p));
    fragment.appendChild(div);
  });

  container.innerHTML = "";
  container.appendChild(fragment);
  applyConditionalLogic();
}

function criarInputParaPergunta(p) {
  const val = APP_STATE.respostas[p.id] || "";
  const tipo = (p.TipoInput || "text").toLowerCase();
  const el = document.createElement("div");

  if (tipo === "radio") {
    const ops = (p.Opcoes || "").split(";").filter(Boolean);
    el.innerHTML = ops.map(op => `
      <label class="inline-flex items-center mt-2 mr-4 cursor-pointer">
        <input type="radio" name="${p.id}" value="${op}" ${val === op ? 'checked' : ''} class="w-5 h-5 text-blue-600">
        <span class="ml-2 text-gray-700">${op}</span>
      </label>
    `).join("");
    
    el.querySelectorAll('input').forEach(i => i.onchange = (e) => autosave(p.id, e.target.value));
  } else if (tipo === "file") {
    el.innerHTML = `
      <button onclick="abrirCamera('${p.id}')" class="bg-blue-100 text-blue-700 px-4 py-3 rounded-lg flex items-center gap-2 border-2 border-dashed border-blue-300 w-full justify-center">
        📸 Capturar Foto
      </button>
      <div id="fotos_${p.id}" class="mt-2 flex flex-wrap gap-2"></div>
    `;
  } else {
    const input = document.createElement(tipo === "textarea" ? "textarea" : "input");
    input.className = "w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none";
    input.value = val;
    input.oninput = (e) => autosave(p.id, e.target.value);
    el.appendChild(input);
  }
  return el;
}

function autosave(id, valor) {
  APP_STATE.respostas[id] = valor;
  if (typeof saveAnswerToDB === "function") saveAnswerToDB(id, valor);
  applyConditionalLogic();
}

function applyConditionalLogic() {
  APP_STATE.roteiro?.forEach(p => {
    const cond = p.Condicao || p["Condição"];
    const pai = p.Pai;
    if (cond && pai) {
      const el = document.getElementById(`group_${p.id}`);
      el?.classList.toggle("hidden", APP_STATE.respostas[pai] !== cond);
    }
  });
}

// --- INICIALIZAÇÃO DO MAPA ---
function initMapa() {
  const mapDiv = document.getElementById("mapa_local");
  if (!mapDiv || typeof L === 'undefined') return;
  
  mapa = L.map("mapa_local").setView([-22.9035, -43.2096], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(mapa);
  
  setTimeout(() => mapa.invalidateSize(), 500);
}

function initApp() {
  const sel = document.getElementById("local");
  if (sel) sel.innerHTML = LOCAIS_VISITA.map(l => `<option value="${l}">${l}</option>`).join("");
  
  initMapa();
  initCadastro();
  showScreen("screen-cadastro");
}

// Exposição Global para Botões do HTML
window.selectRoteiro = selectRoteiro;
window.initApp = initApp;

document.addEventListener("DOMContentLoaded", initApp);
