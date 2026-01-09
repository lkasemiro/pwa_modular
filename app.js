// ===========================================
// APP.JS – PWA SUPERVISÃO AMBIENTAL (V13.1)
// Estável, Offline, Georreferenciado
// ===========================================

const LOCAIS_VISITA = [
  "Selecionar Local...", "Rio D'Ouro", "São Pedro", "Tinguá - Barrelão",
  "Tinguá - Serra Velha", "Tinguá - Brava/Macucuo", "Tinguá - Colomi",
  "Tinguá - Boa Esperança", "Mantiquira - T1", "Mantiquira - T2",
  "Xerém I - João Pinto", "Xerém II - Entrada", "Xerém III - Plano", "Xerém III - Registro"
];

const APP_STATE = {
  avaliador: "",
  local: "",
  data_visita: "",
  tipoRoteiro: null,
  roteiro: null,
  respostas: {},
  fotos: {},
  geolocalizacao_inicio: { lat: null, lng: null },
  geolocalizacao_sublocal: { lat: null, lng: null }
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
    ${ok ? "bg-green-600" : "bg-red-500"} text-white font-bold`;
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

      if (tipo === "sublocal") {
        APP_STATE.geolocalizacao_sublocal = { lat, lng };
        console.log("📍 GPS sublocal:", lat, lng);
      }
    },
    () => console.warn("GPS indisponível."),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// ---------------- CADASTRO ----------------
function initCadastro() {
  const btn = document.getElementById("btn-cadastro-continuar");
  if (!btn) return;

  btn.onclick = () => {
    const avaliador = document.getElementById("avaliador")?.value.trim();
    const local = document.getElementById("local")?.value;
    const data = document.getElementById("data_visita")?.value;

    if (!avaliador || !local || local === "Selecionar Local..." || !data) {
      return showMessage("Preencha todos os campos.", false);
    }

    APP_STATE.avaliador = avaliador;
    APP_STATE.local = local;
    APP_STATE.data_visita = data;

    capturarGPS("inicial");
    showScreen("screen-select-roteiro");
  };
}

// ---------------- ROTEIRO ----------------
function selectRoteiro(tipo) {
  const roteirosMap = {
    pge: typeof ROTEIRO_PGE !== "undefined" ? ROTEIRO_PGE : null,
    geral: typeof ROTEIRO_GERAL !== "undefined" ? ROTEIRO_GERAL : null
  };

  const roteiro = roteirosMap[tipo];
  if (!roteiro) return showMessage("Roteiro não carregado.");

  APP_STATE.tipoRoteiro = tipo;
  APP_STATE.roteiro = roteiro;
  APP_STATE.respostas = {};

  renderFormulario();
  showScreen("screen-formulario");
}

// ---------------- FORMULÁRIO ----------------
function renderFormulario() {
  const container = document.getElementById("conteudo_formulario");
  if (!container) return;
  container.innerHTML = "";

  APP_STATE.roteiro.forEach(p => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-xl shadow-sm border-l-4 border-[#0C3C78] mb-4";

    div.innerHTML = `
      <label class="block font-bold text-gray-700 mb-2">${p.pergunta}</label>
    `;

    let input;

    if (p.tipo === "select" && Array.isArray(p.opcoes)) {
      input = document.createElement("select");
      input.className = "w-full border p-2 rounded-lg focus:ring-2 focus:ring-[#0C3C78]";
      input.innerHTML = `<option value="">Selecionar...</option>` +
        p.opcoes.map(o => `<option value="${o}">${o}</option>`).join("");
    } else {
      input = document.createElement("input");
      input.className = "w-full border p-2 rounded-lg focus:ring-2 focus:ring-[#0C3C78]";
    }

    input.onchange = (e) => {
      APP_STATE.respostas[p.id] = e.target.value;

      // 🔥 GPS do sublocal de forma robusta
      if (p.sublocal && p.sublocal !== "") {
        capturarGPS("sublocal");
      }
    };

    div.appendChild(input);
    container.appendChild(div);
  });
}

// ---------------- HISTÓRICO ----------------
function salvarVistoriaNoHistorico() {
  const historico = JSON.parse(localStorage.getItem("historico_vistorias") || "[]");

  historico.push({
    id: Date.now(),
    local: APP_STATE.local,
    avaliador: APP_STATE.avaliador,
    data: APP_STATE.data_visita,
    coordenadas: APP_STATE.geolocalizacao_inicio
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
    ? `<p class="text-center text-gray-400 py-6 text-sm">Nenhuma vistoria registrada.</p>`
    : visitas.reverse().map(v => `
      <div class="bg-white p-4 rounded-xl shadow border-l-4 border-[#0C3C78] mb-3">
        <p class="font-bold text-sm">${v.local}</p>
        <p class="text-[11px] text-gray-500">
          ${v.data} · ${v.avaliador}<br>
          Lat: ${v.coordenadas.lat || "N/D"}
        </p>
      </div>
    `).join("");
}

// ---------------- INIT ----------------
function initApp() {
  const sel = document.getElementById("local");
  if (sel) sel.innerHTML = LOCAIS_VISITA.map(l => `<option>${l}</option>`).join("");
  initCadastro();
  showScreen("screen-cadastro");
}

// ---------------- GLOBAL ----------------
window.selectRoteiro = selectRoteiro;
window.showScreen = showScreen;
window.exibirHistorico = exibirHistorico;
window.capturarGPS = capturarGPS;
window.finalizarVistoria = salvarVistoriaNoHistorico;

document.addEventListener("DOMContentLoaded", initApp);

