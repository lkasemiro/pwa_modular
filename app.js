// ===========================================
// APP.JS – VERSÃO CORRIGIDA (BOTÕES + HISTÓRICO)
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
  roteiroSelecionado: [],
  respostas: {},
  fotos: {},
  geolocalizacao_inicio: { lat: null, lng: null }
};

// ---------------- UI ----------------
function showScreen(id) {
  ["screen-cadastro", "screen-select-roteiro", "screen-formulario", "screen-historico"]
    .forEach(s => document.getElementById(s)?.classList.toggle("hidden", s !== id));
}

// ---------------- MENSAGENS ----------------
function showMessage(msg, ok = false) {
  const box = document.getElementById("message-box");
  if (!box) return alert(msg);
  box.textContent = msg;
  box.className = `fixed top-4 left-1/2 -translate-x-1/2 p-4 rounded-xl shadow-xl z-50 ${
    ok ? "bg-green-600" : "bg-red-500"
  } text-white font-bold`;
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

  Object.assign(APP_STATE, {
    avaliador,
    colaborador_gla: colaborador,
    local,
    data_visita: data
  });

  capturarGPS("inicial");
  showScreen("screen-select-roteiro");
}

// ---------------- NAVEGAÇÃO ----------------
function voltarParaRoteiros() {
  showScreen("screen-select-roteiro");
}

async function abrirHistorico() {
  showScreen("screen-historico");
  await renderHistorico();
}

// ---------------- ROTEIROS ----------------
function selectRoteiro(tipo) {
  const roteiro = ROTEIROS[tipo];
  if (!roteiro || roteiro.length === 0) {
    return showMessage(`Roteiro "${tipo}" não encontrado ou vazio.`);
  }

  APP_STATE.tipoRoteiro = tipo;
  APP_STATE.roteiroSelecionado = roteiro;
  APP_STATE.respostas = {};
  APP_STATE.fotos = {};

  const subBox = document.getElementById("sublocal_box");

  if (tipo === "pge") {
    subBox.classList.remove("hidden");
    popularSublocaisPGE();
  } else {
    subBox.classList.add("hidden");
    renderPerguntas(roteiro); // 🔥 agora funciona de novo
  }

  showScreen("screen-formulario");
}


function popularSublocaisPGE() {
  const subSelect = document.getElementById("sublocal_select");
  subSelect.innerHTML = "";

  const sublocais = [
    ...new Set(
      APP_STATE.roteiroSelecionado
        .filter(p => getLocalPergunta(p) === APP_STATE.local)
        .map(p => getSublocalPergunta(p))
        .filter(s => s && s.trim() !== "")
    )
  ];

  if (sublocais.length === 0) {
    subSelect.innerHTML = `<option value="">Nenhum sublocal encontrado</option>`;
    return;
  }

  subSelect.innerHTML =
    `<option value="">Escolha o Sublocal...</option>` +
    sublocais.map(s => `<option value="${s}">${s}</option>`).join("");

  subSelect.onchange = (e) => {
    const sub = e.target.value;
    if (!sub) return;

    const filtrado = APP_STATE.roteiroSelecionado.filter(
      p => getSublocalPergunta(p) === sub
    );

    renderPerguntas(filtrado);
  };
}

// ---------------- FORMULÁRIO ----------------
function renderPerguntas(lista) {
  const container = document.getElementById("conteudo_formulario");
  container.innerHTML = "";

  lista.forEach(p => {
    const div = document.createElement("div");
    div.id = `div_${p.id}`;
    div.className = `bg-white p-5 rounded-3xl shadow-sm border mb-4 ${p.Pai ? "hidden" : ""}`;

    div.innerHTML = `
      ${p.ImagemApoio ? `<img src="${p.ImagemApoio}" class="rounded-2xl mb-4">` : ""}
      <label class="font-bold text-sm mb-3 block">${p.Pergunta}</label>
      <div id="wrap_${p.id}"></div>
    `;

    container.appendChild(div);
    document.getElementById(`wrap_${p.id}`).appendChild(gerarComponenteInput(p));
  });
}

// ---------------- GPS ----------------
function capturarGPS(tipo) {
  navigator.geolocation?.getCurrentPosition(pos => {
    APP_STATE.geolocalizacao_inicio = {
      lat: pos.coords.latitude.toFixed(6),
      lng: pos.coords.longitude.toFixed(6)
    };
  });
}

// ---------------- FINALIZAÇÃO ----------------
async function finalizarVistoria() {
  try {
    await finalizarERegistrarVisita();
    showMessage("Vistoria salva com sucesso!", true);
    setTimeout(() => location.reload(), 2000);
  } catch (e) {
    console.error(e);
    showMessage("Erro ao salvar vistoria.");
  }
}

// ---------------- HISTÓRICO ----------------
async function renderHistorico() {
  const container = document.getElementById("lista-historico");
  container.innerHTML = "<p class='text-sm text-gray-400'>Carregando...</p>";

  const db = await openDB();
  const tx = db.transaction("historico_visitas", "readonly");
  const store = tx.objectStore("historico_visitas");
  const req = store.getAll();

  req.onsuccess = () => {
    const dados = req.result;
    if (dados.length === 0) {
      container.innerHTML = "<p class='text-sm text-gray-400'>Nenhuma vistoria registrada.</p>";
      return;
    }

    container.innerHTML = dados.reverse().map(v => `
      <div class="bg-white p-4 rounded-2xl shadow border-l-4 border-[#0C3C78]">
        <p class="font-bold text-sm">${v.local}</p>
        <p class="text-[10px] text-gray-500">${v.data_visita} • ${v.tipo_roteiro?.toUpperCase()}</p>
      </div>
    `).join("");
  };
}

// ---------------- INIT ----------------
function initApp() {
  document.getElementById("local").innerHTML =
    LOCAIS_VISITA.map(l => `<option>${l}</option>`).join("");
  showScreen("screen-cadastro");
}

// ---------------- EXPORTA GLOBAL ----------------
window.initCadastro = initCadastro;
window.selectRoteiro = selectRoteiro;
window.finalizarVistoria = finalizarVistoria;
window.voltarParaRoteiros = voltarParaRoteiros;
window.abrirHistorico = abrirHistorico;

document.addEventListener("DOMContentLoaded", initApp);

