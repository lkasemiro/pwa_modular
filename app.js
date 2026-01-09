// ===========================================
// APP.JS – VERSÃO DEFINITIVA PARA ROTEIROS
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
  roteiroSelecionado: [], // O array bruto (PGE, Geral ou AA)
  respostas: {},
  geolocalizacao_inicio: { lat: null, lng: null }
};

// ---------------- UI ----------------
function showScreen(id) {
  ["screen-cadastro", "screen-select-roteiro", "screen-formulario", "screen-historico"]
    .forEach(s => document.getElementById(s)?.classList.toggle("hidden", s !== id));
}

function showMessage(msg, ok = false) {
  const box = document.getElementById("message-box");
  box.textContent = msg;
  box.className = `fixed top-4 left-1/2 -translate-x-1/2 p-4 rounded-xl shadow-xl z-50 ${ok ? "bg-green-600" : "bg-red-500"} text-white font-bold`;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 3000);
}

// ---------------- CADASTRO ----------------
function initCadastro() {
  const avaliador = document.getElementById("avaliador").value.trim();
  const colaborador = document.getElementById("colaborador_gla").value.trim();
  const local = document.getElementById("local").value;
  const data = document.getElementById("data_visita").value;

  if (!avaliador || !colaborador || local === "Selecionar Local..." || !data) {
    return showMessage("Preencha todos os campos do cadastro.");
  }

  APP_STATE.avaliador = avaliador;
  APP_STATE.colaborador_gla = colaborador;
  APP_STATE.local = local;
  APP_STATE.data_visita = data;

  capturarGPS("inicial");
  showScreen("screen-select-roteiro");
}

// ---------------- LÓGICA DE ROTEIROS ----------------
function selectRoteiro(tipo) {
  // Pega o roteiro do objeto global ROTEIROS definido no seu roteiros.js
  const roteiro = ROTEIROS[tipo];
  
  if (!roteiro) {
    return showMessage("Erro: Roteiro '" + tipo + "' não encontrado.");
  }

  APP_STATE.tipoRoteiro = tipo;
  APP_STATE.roteiroSelecionado = roteiro;
  APP_STATE.respostas = {};

  const subBox = document.getElementById("sublocal_box");
  const container = document.getElementById("conteudo_formulario");
  container.innerHTML = ""; // Limpa anterior

  if (tipo === 'pge') {
    subBox.classList.remove("hidden");
    popularSublocaisPGE();
  } else {
    subBox.classList.add("hidden");
    renderPerguntas(APP_STATE.roteiroSelecionado);
  }

  showScreen("screen-formulario");
}

function popularSublocaisPGE() {
  const subSelect = document.getElementById("sublocal_select");
  
  // Filtra no roteiro PGE apenas os sublocais que pertencem ao LOCAL selecionado na tela 1
  const sublocaisUnicos = [...new Set(
    APP_STATE.roteiroSelecionado
      .filter(p => p.Local === APP_STATE.local)
      .map(p => p.Sublocal)
  )];

  if (sublocaisUnicos.length === 0) {
    subSelect.innerHTML = `<option value="">Nenhum sublocal para este local</option>`;
    return;
  }

  subSelect.innerHTML = `<option value="">Escolha o Sublocal...</option>` + 
    sublocaisUnicos.map(s => `<option value="${s}">${s}</option>`).join("");

  subSelect.onchange = (e) => {
    const filtrado = APP_STATE.roteiroSelecionado.filter(p => p.Sublocal === e.target.value);
    renderPerguntas(filtrado);
  };
}

// ---------------- RENDERIZAÇÃO ----------------
function renderPerguntas(listaPerguntas) {
  const container = document.getElementById("conteudo_formulario");
  container.innerHTML = "";

  listaPerguntas.forEach(p => {
    const div = document.createElement("div");
    div.id = `div_pergunta_${p.id}`;
    div.className = "bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-4 animate-in fade-in";
    
    // Se tiver pai (pergunta condicional), começa escondida
    if (p.Pai) div.classList.add("hidden");

    // Imagem de Apoio (PGE)
    let imgHtml = "";
    if (p.ImagemApoio && p.ImagemApoio.length > 50) {
      imgHtml = `<img src="${p.ImagemApoio}" class="w-full rounded-2xl mb-4 shadow-md">`;
    }

    div.innerHTML = `
      ${imgHtml}
      <p class="text-[10px] text-blue-500 font-bold uppercase mb-1">${p.Secao || ""}</p>
      <label class="block font-bold text-gray-800 mb-3 text-sm">${p.Pergunta}</label>
      <div id="input_wrapper_${p.id}"></div>
    `;

    container.appendChild(div);
    const wrapper = div.querySelector(`#input_wrapper_${p.id}`);
    wrapper.appendChild(gerarComponenteInput(p));
  });
}

function gerarComponenteInput(p) {
  const tipo = p.TipoInput.toLowerCase();
  let input;

  if (tipo === "radio" || tipo === "select") {
    input = document.createElement("select");
    input.className = "w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500";
    const opcoes = p.Opcoes.split(";");
    input.innerHTML = `<option value="">Selecionar...</option>` + 
      opcoes.map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join("");
  } 
  else if (tipo === "textarea") {
    input = document.createElement("textarea");
    input.className = "w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none h-24";
  }
  else if (tipo === "file") {
    input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.className = "w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100";
  }
  else {
    input = document.createElement("input");
    input.type = tipo === "number" ? "number" : (tipo === "date" ? "date" : "text");
    input.className = "w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none";
  }

  input.onchange = (e) => {
    APP_STATE.respostas[p.id] = e.target.value;
    verificarCondicionais(p.id, e.target.value);
    
    // GPS por pergunta no roteiro AA
    if (APP_STATE.tipoRoteiro === 'aa') {
      navigator.geolocation.getCurrentPosition(pos => {
        APP_STATE.respostas[`gps_${p.id}`] = `${pos.coords.latitude},${pos.coords.longitude}`;
      });
    }
  };

  return input;
}

function verificarCondicionais(idPai, valor) {
  // Procura no roteiro selecionado perguntas que dependem desta
  APP_STATE.roteiroSelecionado.forEach(p => {
    if (p.Pai === idPai) {
      const elDiv = document.getElementById(`div_pergunta_${p.id}`);
      if (elDiv) {
        // Se o valor selecionado for igual à condição (ex: "Sim" ou "Outro")
        if (valor === p.Condicao) {
          elDiv.classList.remove("hidden");
        } else {
          elDiv.classList.add("hidden");
          delete APP_STATE.respostas[p.id]; // Limpa resposta se esconder
        }
      }
    }
  });
}

// ---------------- GPS ----------------
function capturarGPS(tipo) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    if (tipo === "inicial") {
      APP_STATE.geolocalizacao_inicio = { lat, lng };
      document.getElementById("display-coords-inicial").textContent = `${lat}, ${lng}`;
    }
  }, null, { enableHighAccuracy: true });
}

// ---------------- SALVAR ----------------
function finalizarVistoria() {
  const historico = JSON.parse(localStorage.getItem("vistorias_cedae") || "[]");
  const novaVistoria = {
    ...APP_STATE,
    id: Date.now(),
    data_registro: new Date().toLocaleString()
  };
  historico.push(novaVistoria);
  localStorage.setItem("vistorias_cedae", JSON.stringify(historico));
  showMessage("Vistoria finalizada e salva!", true);
  setTimeout(() => location.reload(), 2000);
}

// ---------------- INIT ----------------
function initApp() {
  const selLocal = document.getElementById("local");
  selLocal.innerHTML = LOCAIS_VISITA.map(l => `<option>${l}</option>`).join("");
  showScreen("screen-cadastro");
}

// Vincula funções ao Window para os botões do HTML funcionarem
window.initCadastro = initCadastro;
window.selectRoteiro = selectRoteiro;
window.finalizarVistoria = finalizarVistoria;
window.showScreen = showScreen;

document.addEventListener("DOMContentLoaded", initApp);

