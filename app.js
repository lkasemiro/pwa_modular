// ===========================================
// APP.JS – PWA SUPERVISÃO AMBIENTAL (V14.0)
// Estável, Sem Mapa, Com Filtros de Sublocal
// ===========================================

const LOCAIS_VISITA = [
  "Selecionar Local...", "Rio D'Ouro", "São Pedro", "Tinguá - Barrelão",
  "Tinguá - Serra Velha", "Tinguá - Brava/Macucuo", "Tinguá - Colomi",
  "Tinguá - Boa Esperança", "Mantiquira - T1", "Mantiquira - T2",
  "Xerém I - João Pinto", "Xerém II - Entrada", "Xerém III - Plano", "Xerém III - Registro"
];

const APP_STATE = {
  avaliador: "",
  colaborador_gla: "", 
  local: "",
  data_visita: "",
  tipoRoteiro: null,
  roteiroFull: [],
  roteiroFiltrado: [],
  respostas: {},
  geolocalizacao_inicio: { lat: null, lng: null }
};

// ---------------- UI / NAVEGAÇÃO ----------------
function showScreen(id) {
  ["screen-cadastro", "screen-select-roteiro", "screen-formulario", "screen-historico"]
    .forEach(s => {
      const el = document.getElementById(s);
      if (el) el.classList.toggle("hidden", s !== id);
    });
}

function showMessage(msg, ok = false) {
  const box = document.getElementById("message-box");
  if (!box) return alert(msg);
  box.textContent = msg;
  box.className = `fixed top-4 left-1/2 -translate-x-1/2 p-4 rounded-xl shadow-xl z-50 
    ${ok ? "bg-green-600" : "bg-red-500"} text-white font-bold transition-all`;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 3000);
}

// ---------------- GEOLOCALIZAÇÃO ----------------
function capturarGPS(tipo) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      if (tipo === "inicial") {
        APP_STATE.geolocalizacao_inicio = { lat, lng };
        const display = document.getElementById("display-coords-inicial");
        if (display) display.textContent = `${lat}, ${lng}`;
      }
    },
    () => console.warn("GPS indisponível."),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ---------------- CADASTRO ----------------
function initCadastro() {
  const avaliador = document.getElementById("avaliador")?.value.trim();
  const colaboradorGla = document.getElementById("colaborador_gla")?.value.trim();
  const local = document.getElementById("local")?.value;
  const data = document.getElementById("data_visita")?.value;

  if (!avaliador || !colaboradorGla || !local || local === "Selecionar Local..." || !data) {
    return showMessage("Preencha todos os campos corretamente.", false);
  }

  APP_STATE.avaliador = avaliador;
  APP_STATE.colaborador_gla = colaboradorGla;
  APP_STATE.local = local;
  APP_STATE.data_visita = data;

  capturarGPS("inicial");
  showScreen("screen-select-roteiro");
}

// ---------------- ROTEIRO ----------------
function selectRoteiro(tipo) {
  const roteirosMap = {
    pge: typeof ROTEIRO_PGE !== "undefined" ? ROTEIRO_PGE : null,
    geral: typeof ROTEIRO_GERAL !== "undefined" ? ROTEIRO_GERAL : null,
    aa: typeof ROTEIRO_AA !== "undefined" ? ROTEIRO_AA : null
  };

  const roteiro = roteirosMap[tipo];
  if (!roteiro) return showMessage("Roteiro não encontrado no arquivo.");

  APP_STATE.tipoRoteiro = tipo;
  APP_STATE.roteiroFull = roteiro;
  APP_STATE.respostas = {};

  const subBox = document.getElementById("sublocal_box");
  
  if (tipo === 'pge') {
    subBox.classList.remove("hidden");
    popularSublocaisPGE();
  } else {
    subBox.classList.add("hidden");
    APP_STATE.roteiroFiltrado = APP_STATE.roteiroFull;
    renderFormulario();
  }
  showScreen("screen-formulario");
}

function popularSublocaisPGE() {
  const subSelect = document.getElementById("sublocal_select");
  // Filtra sublocais que pertencem ao Local escolhido no cadastro
  const subs = [...new Set(APP_STATE.roteiroFull
    .filter(p => p.Local === APP_STATE.local)
    .map(p => p.Sublocal))];

  subSelect.innerHTML = `<option value="">Selecionar Sublocal...</option>` + 
    subs.map(s => `<option value="${s}">${s}</option>`).join("");

  subSelect.onchange = (e) => {
    APP_STATE.roteiroFiltrado = APP_STATE.roteiroFull.filter(p => p.Sublocal === e.target.value);
    renderFormulario();
  };
}

// ---------------- FORMULÁRIO ----------------
function renderFormulario() {
  const container = document.getElementById("conteudo_formulario");
  if (!container) return;
  container.innerHTML = "";

  APP_STATE.roteiroFiltrado.forEach(p => {
    const div = document.createElement("div");
    div.className = "bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-4 animate-in fade-in";

    // Suporte para Imagem de Apoio do PGE
    let imgHtml = "";
    const imagem = p.ImagemApoio || p.Imagem_Apoio;
    if (imagem && imagem.startsWith("data:image")) {
        imgHtml = `<img src="${imagem}" class="w-full rounded-2xl mb-4 shadow-sm border border-gray-100">`;
    }

    const labelPergunta = p.Pergunta || p.pergunta;

    div.innerHTML = `
      ${imgHtml}
      <label class="block font-bold text-gray-700 mb-3 text-sm">${labelPergunta}</label>
      <div id="input_cont_${p.id}"></div>
    `;

    const inputCont = div.querySelector(`#input_cont_${p.id}`);
    inputCont.appendChild(criarCampoInput(p));
    container.appendChild(div);
  });
}

function criarCampoInput(p) {
    const tipo = (p.TipoInput || p.tipo || "text").toLowerCase();
    const opcoesStr = p.Opcoes || p.opcoes || "";
    
    let input;
    if (tipo === "radio" || tipo === "select") {
        input = document.createElement("select");
        input.className = "w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#0C3C78] outline-none";
        const lista = opcoesStr.includes(";") ? opcoesStr.split(";") : ["Sim", "Não"];
        input.innerHTML = `<option value="">Selecionar...</option>` + 
            lista.map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join("");
    } else {
        input = document.createElement("input");
        input.type = "text";
        input.className = "w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#0C3C78] outline-none";
    }

    input.onchange = (e) => {
        APP_STATE.respostas[p.id] = e.target.value;
        // Lógica de GPS por pergunta para Roteiro de Acidentes (AA)
        if (APP_STATE.tipoRoteiro === 'aa') {
            navigator.geolocation.getCurrentPosition(pos => {
                APP_STATE.respostas[`gps_${p.id}`] = `${pos.coords.latitude},${pos.coords.longitude}`;
            });
        }
    };
    return input;
}

// ---------------- HISTÓRICO ----------------
function salvarVistoriaNoHistorico() {
  const historico = JSON.parse(localStorage.getItem("historico_vistorias") || "[]");
  historico.push({
    id: Date.now(),
    local: APP_STATE.local,
    avaliador: APP_STATE.avaliador,
    colaborador_gla: APP_STATE.colaborador_gla,
    data: APP_STATE.data_visita,
    coordenadas: APP_STATE.geolocalizacao_inicio,
    respostas: APP_STATE.respostas
  });

  localStorage.setItem("historico_vistorias", JSON.stringify(historico));
  showMessage("Vistoria salva com sucesso!", true);
  exibirHistorico();
}

function exibirHistorico() {
  showScreen("screen-historico");
  const container = document.getElementById("lista-historico");
  if (!container) return;
  const visitas = JSON.parse(localStorage.getItem("historico_vistorias") || "[]");

  container.innerHTML = visitas.length === 0
    ? `<p class="text-center text-gray-400 py-10 text-sm italic">Nenhum registro encontrado.</p>`
    : visitas.reverse().map(v => `
      <div class="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-3">
        <div class="flex justify-between items-start mb-2">
            <p class="font-bold text-[#0C3C78]">${v.local}</p>
            <span class="text-[9px] bg-gray-100 px-2 py-1 rounded-full font-bold text-gray-500">${v.data}</span>
        </div>
        <p class="text-[11px] text-gray-500">Avaliador: ${v.avaliador}</p>
        <p class="text-[11px] text-gray-400">📍 ${v.coordenadas.lat || 'S/G'}, ${v.coordenadas.lng || 'S/G'}</p>
      </div>
    `).join("");
}

// ---------------- INIT ----------------
function initApp() {
  const sel = document.getElementById("local");
  if (sel) sel.innerHTML = LOCAIS_VISITA.map(l => `<option>${l}</option>`).join("");
  showScreen("screen-cadastro");
}

// Globais
window.selectRoteiro = selectRoteiro;
window.finalizarVistoria = salvarVistoriaNoHistorico;
window.showScreen = showScreen;
window.exibirHistorico = exibirHistorico;
window.capturarGPS = capturarGPS;
window.initCadastro = initCadastro;

document.addEventListener("DOMContentLoaded", initApp);
