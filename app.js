// ===========================================
// APP.JS – PWA MODULAR COMPLETO (FINALIZADO)
// ===========================================

// -------------------------------------------
// ESTADO GLOBAL
// -------------------------------------------
const LOCAIS_VISITA = [
  "Selecionar Local...",
  "Rio D'Ouro",
  "São Pedro",
  "Tinguá - Barrelão",
  "Tinguá - Serra Velha",
  "Tinguá - Brava/Macucuo",
  "Tinguá - Columi",
  "Tinguá - Boa Esperança",
  "Mantiquira - T1",
  "Mantiquira - T2",
  "Xerém I - João Pinto",
  "Xerém II - Entrada",
  "Xerém III - Plano",
  "Xerém III - Registro"
];

const APP_STATE = {
  avaliador: "",
  local: "",
  colaborador: "",
  data: "",

  tipoRoteiro: null, // 'geral' | 'pge' | 'aa'
  roteiro: null,

  respostas: {},      // { idPergunta: valor }
  fotos: {},          // { idPergunta: [fotoId, ...] }
  fotoIndex: {}       // { idPergunta: proximoNumero }
};

let mapa = null;
let stream = null;
let currentPhotoInputId = null;

// -------------------------------------------
// UI UTILITIES
// -------------------------------------------
function showScreen(id) {
  const telas = ["screen-cadastro", "screen-select-roteiro", "screen-formulario"];
  telas.forEach((t) => {
    const el = document.getElementById(t);
    if (el) el.classList.toggle("hidden", t !== id);
  });
}

function showMessage(msg, ok = false) {
  const box = document.getElementById("message-box");
  if (!box) {
    alert(msg);
    return;
  }

  box.textContent = msg;
  box.classList.remove("hidden");
  box.classList.toggle("bg-red-500", !ok);
  box.classList.toggle("bg-green-600", ok);
  setTimeout(() => box.classList.add("hidden"), 3500);
}

function showSpinner() {
  document.getElementById("loading-spinner")?.classList.remove("hidden");
}

function hideSpinner() {
  document.getElementById("loading-spinner")?.classList.add("hidden");
}

// -------------------------------------------
// CADASTRO INICIAL
// -------------------------------------------
function carregarMetaDoLocalStorage() {
  APP_STATE.avaliador = localStorage.getItem("avaliador") || "";
  APP_STATE.local = localStorage.getItem("local") || "";
  APP_STATE.colaborador = localStorage.getItem("colaborador") || "";
  APP_STATE.data = localStorage.getItem("data") || "";

  document.getElementById("avaliador").value = APP_STATE.avaliador;
  document.getElementById("local").value = APP_STATE.local;
  document.getElementById("colaborador").value = APP_STATE.colaborador;
  document.getElementById("data_visita").value = APP_STATE.data;
}

function initLocaisSelect() {
  const sel = document.getElementById("local");
  sel.innerHTML = LOCAIS_VISITA.map((l) => `<option value="${l}">${l}</option>`).join("");
}

function initMapa() {
  const div = document.getElementById("mapa_local");
  if (!div) return;

  const defaultLat = -22.9035;
  const defaultLng = -43.2096;

  mapa = L.map("mapa_local").setView([defaultLat, defaultLng], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(mapa);

  setTimeout(() => mapa.invalidateSize(), 250);
}

function initCadastro() {
  const btn = document.getElementById("btn-cadastro-continuar");

  btn.onclick = () => {
    APP_STATE.avaliador = document.getElementById("avaliador").value.trim();
    APP_STATE.local = document.getElementById("local").value.trim();
    APP_STATE.colaborador = document.getElementById("colaborador").value.trim();
    APP_STATE.data = document.getElementById("data_visita").value.trim();

    if (
      !APP_STATE.avaliador ||
      !APP_STATE.local ||
      APP_STATE.local === "Selecionar Local..." ||
      !APP_STATE.colaborador ||
      !APP_STATE.data
    ) {
      showMessage("Preencha todos os campos.");
      return;
    }

    localStorage.setItem("avaliador", APP_STATE.avaliador);
    localStorage.setItem("local", APP_STATE.local);
    localStorage.setItem("colaborador", APP_STATE.colaborador);
    localStorage.setItem("data", APP_STATE.data);

    showMessage("Informações salvas!", true);
    showScreen("screen-select-roteiro");
  };
}

// -------------------------------------------
// SELEÇÃO DO ROTEIRO
// -------------------------------------------
function voltarParaCadastro() {
  showScreen("screen-cadastro");
}

async function selectRoteiro(tipo) {
  APP_STATE.tipoRoteiro = tipo;
  APP_STATE.roteiro = ROTEIROS[tipo];
  APP_STATE.respostas = {};
  APP_STATE.fotos = {};
  APP_STATE.fotoIndex = {};

  showSpinner();
  await initIndexedDB(tipo);
  hideSpinner();

  document.getElementById("roteiro-atual-label").textContent =
    tipo === "pge"
      ? "Programa de Gerenciamento de Efluentes (PGE)"
      : tipo === "geral"
      ? "Formulário Geral"
      : "Acidentes Ambientais";

  montarSecoes();

  // sublocal só no PGE
  if (tipo === "pge") {
    montarSublocais();
    document.getElementById("sublocal_box")?.classList.remove("hidden");
  } else {
    document.getElementById("sublocal_box")?.classList.add("hidden");
  }

  renderFormulario();
  showScreen("screen-formulario");
}

// -------------------------------------------
// SUBLOCAIS – APENAS PGE
// -------------------------------------------
function montarSublocais() {
  const sel = document.getElementById("sublocal_select");
  const roteiro = APP_STATE.roteiro || [];

  const subs = [...new Set(roteiro.map((p) => p.Sublocal))]
    .filter(Boolean)
    .sort();

  sel.innerHTML = `
    <option value="">Selecione o sublocal</option>
    ${subs.map((s) => `<option value="${s}">${s}</option>`).join("")}
  `;

  sel.onchange = () => renderFormulario();
}

// -------------------------------------------
// SEÇÕES
// -------------------------------------------
function montarSecoes() {
  const sel = document.getElementById("secao_select");
  const roteiro = APP_STATE.roteiro || [];

  const secoes = [...new Set(roteiro.map((p) => p.Secao || p["Seção"] || p.secao))].filter(
    Boolean
  );

  sel.innerHTML = `
    <option value="">Todas as seções</option>
    ${secoes.map((s) => `<option value="${s}">${s}</option>`).join("")}
  `;

  sel.onchange = () => renderFormulario(sel.value || null);
}

// -------------------------------------------
// RENDERIZAÇÃO DO FORMULÁRIO
// -------------------------------------------
function renderFormulario(secaoFiltrada = null) {
  const container = document.getElementById("conteudo_formulario");
  container.innerHTML = "";

  const roteiro = APP_STATE.roteiro || [];
  let perguntas = roteiro;

  // filtro por sublocal (PGE)
  if (APP_STATE.tipoRoteiro === "pge") {
    const subsel = document.getElementById("sublocal_select");
    const sub = subsel.value;

    if (!sub) {
      container.innerHTML = `
        <div class="bg-gray-100 text-gray-500 text-center py-10 rounded-xl shadow">
          Selecione um sublocal para visualizar as perguntas.
        </div>`;
      return;
    }

    perguntas = perguntas.filter((p) => p.Sublocal === sub);
  }

  // filtro por seção
  if (secaoFiltrada) {
    perguntas = perguntas.filter(
      (p) => (p.Secao || p["Seção"] || p.secao) === secaoFiltrada
    );
  }

  if (!perguntas.length) {
    container.innerHTML = `
      <div class="bg-gray-100 text-gray-500 text-center py-10 rounded-xl shadow">
        Nenhuma pergunta encontrada.
      </div>`;
    return;
  }

  const card = document.createElement("div");
  card.className = "bg-white rounded-xl shadow p-4";

  perguntas.forEach((p) => {
    const id = p.id;
    const g = document.createElement("div");
    g.className = "form-group mb-6 pb-4 border-b";
    g.id = `group_${id}`;

    const imgSrc = p.ImagemApoio || p["Imagem Apoio"] || "";
    if (imgSrc) {
      const img = document.createElement("img");
      img.src = imgSrc;
      img.className = "mb-3 max-h-48 rounded border shadow object-cover";
      g.appendChild(img);
    }

    const lb = document.createElement("label");
    lb.className = "block font-medium text-gray-800 mb-1";
    lb.textContent = p.Pergunta;
    g.appendChild(lb);

    const inp = criarInputParaPergunta(p);
    g.appendChild(inp);

    card.appendChild(g);
  });

  container.appendChild(card);
  applyConditionalLogic();
}

// -------------------------------------------
// INPUTS
// -------------------------------------------
function criarInputParaPergunta(p) {
  const tipoRaw = p.TipoInput || p.Tipoinput || p.tipoinput || "";
  const tipo = tipoRaw.toLowerCase();
  const idPerg = p.id;
  const valorSalvo = APP_STATE.respostas[idPerg] || "";
  const wrapper = document.createElement("div");
  wrapper.className = "mt-2";

  // util para pegar opções
  const opcoesStr =
    p.Opcoes || p["Opções"] || p.opcoes || p.opcao || p.opções || "";
  const opcoes = opcoesStr.split(";").map((o) => o.trim()).filter(Boolean);

  if (tipo === "radio") {
    opcoes.forEach((op) => {
      const lbl = document.createElement("label");
      lbl.className = "inline-flex items-center mr-4 mb-1";

      const inp = document.createElement("input");
      inp.type = "radio";
      inp.name = idPerg;
      inp.value = op;
      inp.className = "mr-1";
      if (valorSalvo === op) inp.checked = true;

      inp.addEventListener("change", () => autosave(idPerg, op));

      lbl.appendChild(inp);
      lbl.appendChild(document.createTextNode(op));
      wrapper.appendChild(lbl);
    });
  } else if (tipo === "checkboxgroup") {
    const marcados = String(valorSalvo || "")
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean);

    opcoes.forEach((op) => {
      const lbl = document.createElement("label");
      lbl.className = "block mb-1";

      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.name = idPerg;
      inp.value = op;
      inp.className = "mr-2";
      if (marcados.includes(op)) inp.checked = true;

      inp.addEventListener("change", () => {
        const selecionados = [
          ...document.querySelectorAll(`input[name='${idPerg}']:checked`)
        ].map((i) => i.value);
        autosave(idPerg, selecionados.join(";"));
      });

      lbl.appendChild(inp);
      lbl.appendChild(document.createTextNode(op));
      wrapper.appendChild(lbl);
    });
  } else if (tipo === "textarea") {
    const ta = document.createElement("textarea");
    ta.rows = 3;
    ta.className = "w-full border rounded p-2 text-sm";
    ta.value = valorSalvo;
    ta.addEventListener("input", () => autosave(idPerg, ta.value));
    wrapper.appendChild(ta);
  } else if (tipo === "number") {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.className = "w-32 border rounded p-2 text-sm";
    inp.value = valorSalvo;
    inp.addEventListener("input", () => autosave(idPerg, inp.value));
    wrapper.appendChild(inp);
  } else if (tipo === "file") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Abrir Câmera";
    btn.className =
      "bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm";
    btn.addEventListener("click", () => abrirCamera(idPerg));
    wrapper.appendChild(btn);

    const lista = document.createElement("div");
    lista.id = `fotos_${idPerg}`;
    lista.className = "mt-2 space-y-1 text-xs text-gray-600";
    wrapper.appendChild(lista);

    atualizarListaFotos(idPerg);
  } else {
    // texto simples fallback
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "w-full border rounded p-2 text-sm";
    inp.value = valorSalvo;
    inp.addEventListener("input", () => autosave(idPerg, inp.value));
    wrapper.appendChild(inp);
  }

  return wrapper;
}

// -------------------------------------------
// AUTOSAVE – RESPOSTAS
// -------------------------------------------
function autosave(idPergunta, valor) {
  APP_STATE.respostas[idPergunta] = valor;
  saveAnswerToDB(idPergunta, valor); // indexedDB.js
  applyConditionalLogic();
}

// -------------------------------------------
// LÓGICA CONDICIONAL
// -------------------------------------------
function applyConditionalLogic() {
  const roteiro = APP_STATE.roteiro || [];
  roteiro.forEach((p) => {
    const cond =
      p.Condicao || p["Condição"] || p.condicao || p.cond || "";
    const pai = p.Pai || p.pai || "";

    if (!cond || !pai) return;

    const groupEl = document.getElementById(`group_${p.id}`);
    if (!groupEl) return;

    const valorPai = APP_STATE.respostas[pai];
    if (valorPai === cond) {
      groupEl.classList.remove("hidden");
    } else {
      groupEl.classList.add("hidden");
    }
  });
}

// -------------------------------------------
// CÂMERA E FOTOS
// -------------------------------------------
function abrirCamera(idPergunta) {
  currentPhotoInputId = idPergunta;
  const modal = document.getElementById("camera-modal");
  if (!modal) {
    showMessage("Modal de câmera não encontrado no HTML.", false);
    return;
  }
  modal.classList.remove("hidden");
  startCamera();
}

async function startCamera() {
  const video = document.getElementById("video");
  const placeholder = document.getElementById("camera-placeholder");
  const btnText = document.getElementById("camera-btn-text");
  const captureBtn = document.getElementById("capture-photo");

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
  } catch (err) {
    showMessage("Não foi possível acessar a câmera.", false);
    console.error(err);
    return;
  }

  video.srcObject = stream;
  video.classList.remove("hidden");
  placeholder.classList.add("hidden");
  btnText.textContent = "Desligar Câmera";
  captureBtn.disabled = false;
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  const video = document.getElementById("video");
  const placeholder = document.getElementById("camera-placeholder");
  const btnText = document.getElementById("camera-btn-text");
  const captureBtn = document.getElementById("capture-photo");

  if (video) video.classList.add("hidden");
  if (placeholder) placeholder.classList.remove("hidden");
  if (btnText) btnText.textContent = "Iniciar Câmera";
  if (captureBtn) captureBtn.disabled = true;
}

function closeCameraModal() {
  const modal = document.getElementById("camera-modal");
  if (modal) modal.classList.add("hidden");
  stopCamera();
}

document.getElementById("start-camera")?.addEventListener("click", () => {
  if (stream) {
    stopCamera();
  } else {
    startCamera();
  }
});

document.getElementById("close-modal")?.addEventListener("click", closeCameraModal);

document.getElementById("capture-photo")?.addEventListener("click", () => {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  if (!video || !canvas || !stream) {
    showMessage("Câmera não está ativa.", false);
    return;
  }

  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        showMessage("Falha ao capturar imagem.", false);
        return;
      }
      salvarFotoBlob(currentPhotoInputId, blob);
    },
    "image/jpeg",
    0.7
  );
});

function salvarFotoBlob(idPergunta, blob) {
  if (!idPergunta) return;

  if (!APP_STATE.fotoIndex[idPergunta]) APP_STATE.fotoIndex[idPergunta] = 1;
  const idx = APP_STATE.fotoIndex[idPergunta]++;
  const fotoId = `${idPergunta}_foto_${String(idx).padStart(3, "0")}`;

  savePhotoToDB(fotoId, blob, idPergunta); // indexedDB.js

  if (!APP_STATE.fotos[idPergunta]) APP_STATE.fotos[idPergunta] = [];
  APP_STATE.fotos[idPergunta].push(fotoId);

  atualizarListaFotos(idPergunta);
  showMessage(`Foto ${fotoId} salva!`, true);
}

function atualizarListaFotos(idPergunta) {
  const box = document.getElementById(`fotos_${idPergunta}`);
  if (!box) return;
  const arr = APP_STATE.fotos[idPergunta] || [];
  box.innerHTML = arr.map((id) => `<div>📸 ${id}</div>`).join("");
}

// -------------------------------------------
// EXPORTAÇÃO – CSV
// -------------------------------------------
function baixarRelatorioCSV() {
  if (!APP_STATE.roteiro) {
    showMessage("Nenhum roteiro selecionado.", false);
    return;
  }

  const headers = [
    "Secao",
    "Sublocal",
    "Pergunta",
    "Resposta",
    "Avaliador",
    "Colaborador",
    "Local",
    "DataVisita",
    "Roteiro"
  ];

  const linhas = APP_STATE.roteiro.map((p) => {
    const secao = p.Secao || p["Seção"] || p.secao || "";
    const sub = p.Sublocal || "";
    const perg = (p.Pergunta || "").replace(/"/g, '""');
    const resp = String(APP_STATE.respostas[p.id] || "").replace(/"/g, '""');

    return [
      `"${secao}"`,
      `"${sub}"`,
      `"${perg}"`,
      `"${resp}"`,
      `"${APP_STATE.avaliador}"`,
      `"${APP_STATE.colaborador}"`,
      `"${APP_STATE.local}"`,
      `"${APP_STATE.data}"`,
      `"${APP_STATE.tipoRoteiro || ""}"`
    ].join(",");
  });

  const csv = headers.join(",") + "\n" + linhas.join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const localSafe = (APP_STATE.local || "local").replace(/\s+/g, "_");
  const dataSafe = (APP_STATE.data || "data");
  a.href = url;
  a.download = `relatorio_dados_${localSafe}_${dataSafe}_${APP_STATE.tipoRoteiro}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showMessage("CSV gerado com sucesso!", true);
}

// -------------------------------------------
// EXPORTAÇÃO – ZIP DE FOTOS
// -------------------------------------------
async function baixarFotosZip() {
  try {
    showSpinner();
    const fotos = await getAllPhotosFromDB(); // [{fotoId, blob, idPergunta}, ...]
    if (!fotos || !fotos.length) {
      showMessage("Não há fotos salvas neste roteiro.", false);
      return;
    }

    const zip = new JSZip();
    const pasta = zip.folder("fotos");

    fotos.forEach((f) => {
      const nome = `FOTO_${f.fotoId}.jpeg`;
      pasta.file(nome, f.blob);
    });

    const conteudo = await zip.generateAsync({ type: "blob" });
    const localSafe = (APP_STATE.local || "local").replace(/\s+/g, "_");
    const dataSafe = (APP_STATE.data || "data");

    saveAs(conteudo, `fotos_${localSafe}_${dataSafe}_${APP_STATE.tipoRoteiro}.zip`);
    showMessage("ZIP de fotos gerado com sucesso!", true);
  } catch (e) {
    console.error(e);
    showMessage("Erro ao gerar ZIP de fotos.", false);
  } finally {
    hideSpinner();
  }
}

// -------------------------------------------
// RECOMEÇAR
// -------------------------------------------
async function recomeçar() {
  if (!confirm("Deseja realmente limpar tudo e recomeçar?")) return;

  APP_STATE.avaliador = "";
  APP_STATE.local = "";
  APP_STATE.colaborador = "";
  APP_STATE.data = "";
  APP_STATE.tipoRoteiro = null;
  APP_STATE.roteiro = null;
  APP_STATE.respostas = {};
  APP_STATE.fotos = {};
  APP_STATE.fotoIndex = {};

  localStorage.removeItem("avaliador");
  localStorage.removeItem("local");
  localStorage.removeItem("colaborador");
  localStorage.removeItem("data");

  await clearCurrentDB(); // indexedDB.js

  document.getElementById("avaliador").value = "";
  document.getElementById("local").value = "Selecionar Local...";
  document.getElementById("colaborador").value = "";
  document.getElementById("data_visita").value = "";

  showScreen("screen-cadastro");
  showMessage("Dados limpos. Recomece o formulário.", true);
}

// -------------------------------------------
// BOTÕES DA TELA DE FORMULÁRIO
// -------------------------------------------
function initFormButtons() {
  const btnSalvar = document.getElementById("salvar_respostas");
  const btnCSV = document.getElementById("baixar_relatorio_csv");
  const btnZIP = document.getElementById("baixar_fotos_zip");
  const btnRecomecar = document.getElementById("btn-recomecar");

  if (btnSalvar) {
    btnSalvar.onclick = () => {
      showMessage("Respostas já estão sendo salvas automaticamente (autosave).", true);
    };
  }
  if (btnCSV) btnCSV.onclick = baixarRelatorioCSV;
  if (btnZIP) btnZIP.onclick = baixarFotosZip;
  if (btnRecomecar) btnRecomecar.onclick = recomeçar;
}

// -------------------------------------------
// INIT GERAL
// -------------------------------------------
function initApp() {
  initLocaisSelect();
  carregarMetaDoLocalStorage();
  initMapa();
  initCadastro();
  initFormButtons();
}

window.addEventListener("load", initApp);
