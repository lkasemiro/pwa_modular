// ===========================================
// APP.JS – PWA MODULAR PROGRESSIVO
// Câmera em tela dedicada
// ===========================================

const LOCAIS_VISITA = [
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
  colaborador: "",
  data: "",

  local_visita: "",
  tipoRoteiro: null,
  roteiro: null,

  respostas: {},
  fotos: {},
  fotoIndex: {},

  currentScreen: "cadastro"
};

let stream = null;
let currentPhotoInputId = null;
let selectedLocal = "";
let selectedForm = null;

// ------------------------------
// UI BASE
// ------------------------------
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
  setTimeout(() => box.classList.add("hidden"), 3000);
}

function showSpinner() {
  const sp = document.getElementById("loading-spinner");
  if (sp) sp.classList.remove("hidden");
}
function hideSpinner() {
  const sp = document.getElementById("loading-spinner");
  if (sp) sp.classList.add("hidden");
}

function atualizarHeaderInfo() {
  const av = document.getElementById("info_avaliador");
  const loc = document.getElementById("info_local_visita");
  const dt = document.getElementById("info_data_visita");
  if (av) av.textContent = APP_STATE.avaliador || "";
  if (loc) loc.textContent = APP_STATE.local_visita || "";
  if (dt) dt.textContent = APP_STATE.data || "";
}

function goTo(screen) {
  APP_STATE.currentScreen = screen;
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  const el = document.getElementById(`screen-${screen}`);
  if (el) el.classList.remove("hidden");

  if (screen !== "camera") {
    stopCamera();
  }

  atualizarHeaderInfo();
}
window.goTo = goTo;

// ------------------------------
// CADASTRO
// ------------------------------
function carregarMetaDoLocalStorage() {
  APP_STATE.avaliador   = localStorage.getItem("avaliador")   || "";
  APP_STATE.colaborador = localStorage.getItem("colaborador") || "";
  APP_STATE.data        = localStorage.getItem("data")        || "";

  const av = document.getElementById("avaliador");
  const co = document.getElementById("colaborador");
  const dt = document.getElementById("data_visita");
  if (av) av.value = APP_STATE.avaliador;
  if (co) co.value = APP_STATE.colaborador;
  if (dt) dt.value = APP_STATE.data;
}

function initCadastro() {
  const btn = document.getElementById("btn-cadastro-continuar");
  if (!btn) return;

  btn.onclick = () => {
    const av = document.getElementById("avaliador");
    const co = document.getElementById("colaborador");
    const dt = document.getElementById("data_visita");

    APP_STATE.avaliador   = av ? av.value.trim() : "";
    APP_STATE.colaborador = co ? co.value.trim() : "";
    APP_STATE.data        = dt ? dt.value.trim() : "";

    if (!APP_STATE.avaliador || !APP_STATE.colaborador || !APP_STATE.data) {
      showMessage("Preencha avaliador, colaborador e data da visita.");
      return;
    }

    localStorage.setItem("avaliador", APP_STATE.avaliador);
    localStorage.setItem("colaborador", APP_STATE.colaborador);
    localStorage.setItem("data", APP_STATE.data);

    showMessage("Dados salvos. Agora selecione o local da visita.", true);
    goTo("local");
  };
}

// ------------------------------
// TELA LOCAIS
// ------------------------------
function initLocaisScreen() {
  const container = document.getElementById("lista_locais");
  const btnCont = document.getElementById("btn-local-continuar");
  if (!container || !btnCont) return;

  container.innerHTML = "";

  LOCAIS_VISITA.forEach(local => {
    const wrap = document.createElement("div");
    wrap.className = "w-full sm:w-1/2 lg:w-1/3 p-2";

    const btn = document.createElement("button");
    btn.className =
      "w-full h-24 sm:h-28 bg-[#003366] text-white rounded-xl shadow-md " +
      "flex items-center justify-center text-sm sm:text-base font-semibold " +
      "hover:bg-[#0055A4] active:scale-95 transition text-center px-2";
    btn.textContent = local;

    btn.addEventListener("click", () => {
      selectedLocal = local;
      APP_STATE.local_visita = local;

      document.querySelectorAll("[data-local-card]").forEach(el => {
        el.classList.remove("ring-4", "ring-[#00A85A]");
      });
      wrap.classList.add("ring-4", "ring-[#00A85A]");

      btnCont.disabled = false;
    });

    wrap.setAttribute("data-local-card", local);
    wrap.appendChild(btn);
    container.appendChild(wrap);
  });

  btnCont.disabled = !selectedLocal;
  btnCont.onclick = () => {
    if (!selectedLocal) {
      showMessage("Selecione um local.", false);
      return;
    }
    showMessage(`Local selecionado: ${selectedLocal}`, true);
    goTo("form-select");
  };
}

// ------------------------------
// TELA SELEÇÃO FORMULÁRIO
// ------------------------------
function initFormSelectScreen() {
  const container = document.getElementById("lista_formularios");
  const btnCont = document.getElementById("btn-form-select-continuar");
  if (!container || !btnCont) return;

  container.innerHTML = "";
  selectedForm = null;

  const formularios = [
    { tipo: "geral", rotulo: "Formulário Geral" },
    { tipo: "pge",   rotulo: "PGE – Efluentes" },
    { tipo: "aa",    rotulo: "Acidentes Ambientais" }
  ];

  formularios.forEach(f => {
    const wrap = document.createElement("div");
    wrap.className = "w-full sm:w-1/2 lg:w-1/3 p-2";

    const btn = document.createElement("button");
    btn.className =
      "w-full h-24 sm:h-28 bg-[#003366] text-white rounded-xl shadow-md " +
      "flex items-center justify-center text-sm sm:text-base font-semibold " +
      "hover:bg-[#0055A4] active:scale-95 transition text-center px-2";
    btn.textContent = f.rotulo;

    btn.addEventListener("click", () => {
      selectedForm = f.tipo;
      APP_STATE.tipoRoteiro = f.tipo;

      document.querySelectorAll("[data-form-card]").forEach(el => {
        el.classList.remove("ring-4", "ring-[#00A85A]");
      });
      wrap.classList.add("ring-4", "ring-[#00A85A]");

      btnCont.disabled = false;
    });

    wrap.setAttribute("data-form-card", f.tipo);
    wrap.appendChild(btn);
    container.appendChild(wrap);
  });

  btnCont.disabled = !selectedForm;
  btnCont.onclick = () => {
    if (!selectedForm) {
      showMessage("Selecione um formulário.", false);
      return;
    }
    carregarRoteiroEIrParaFormulario();
  };
}

// ------------------------------
// CARREGAR ROTEIRO
// ------------------------------
async function carregarRoteiroEIrParaFormulario() {
  const tipo = APP_STATE.tipoRoteiro;
  if (!tipo) {
    showMessage("Tipo de formulário não definido.", false);
    return;
  }

  APP_STATE.roteiro = ROTEIROS[tipo];
  APP_STATE.respostas = {};
  APP_STATE.fotos = {};
  APP_STATE.fotoIndex = {};

  showSpinner();
  await initIndexedDB(tipo);
  hideSpinner();

  const label = document.getElementById("roteiro-atual-label");
  if (label) {
    label.textContent =
      tipo === "pge" ? "Programa de Gerenciamento de Efluentes (PGE)" :
      tipo === "geral" ? "Formulário Geral" :
      "Acidentes Ambientais";
  }

  montarSecoes();

  if (tipo === "pge") {
    montarLocaisPGE();
    document.getElementById("local_pge_box")?.classList.remove("hidden");
    document.getElementById("sublocal_box")?.classList.remove("hidden");
  } else {
    document.getElementById("local_pge_box")?.classList.add("hidden");
    document.getElementById("sublocal_box")?.classList.add("hidden");
  }

  renderFormulario();
  atualizarHeaderInfo();
  goTo("formulario");
}

// ------------------------------
// PGE: local + sublocal
// ------------------------------
function montarLocaisPGE() {
  const sel = document.getElementById("local_pge_select");
  const roteiro = APP_STATE.roteiro || [];
  if (!sel) return;

  const locais = [...new Set(roteiro.map(p => p.Local))].filter(Boolean).sort();
  sel.innerHTML = `
    <option value="">Selecione o local</option>
    ${locais.map(l => `<option value="${l}">${l}</option>`).join("")}
  `;

  sel.onchange = () => {
    montarSublocaisPGE();
    renderFormulario();
  };

  const subSel = document.getElementById("sublocal_select");
  if (subSel) {
    subSel.innerHTML = `<option value="">Selecione o local primeiro</option>`;
    subSel.onchange = () => renderFormulario();
  }
}

function montarSublocaisPGE() {
  const selLocal = document.getElementById("local_pge_select");
  const selSub = document.getElementById("sublocal_select");
  const roteiro = APP_STATE.roteiro || [];
  if (!selLocal || !selSub) return;

  const local = selLocal.value;
  if (!local) {
    selSub.innerHTML = `<option value="">Selecione o local primeiro</option>`;
    return;
  }

  const subs = [...new Set(
    roteiro.filter(p => p.Local === local).map(p => p.Sublocal)
  )].filter(Boolean).sort();

  selSub.innerHTML = `
    <option value="">Selecione o sublocal</option>
    ${subs.map(s => `<option value="${s}">${s}</option>`).join("")}
  `;
}

// ------------------------------
// SEÇÕES
// ------------------------------
function montarSecoes() {
  const sel = document.getElementById("secao_select");
  const roteiro = APP_STATE.roteiro || [];
  if (!sel) return;

  const secoes = [...new Set(
    roteiro.map(p => p.Secao || p["Seção"] || p.secao)
  )].filter(Boolean);

  sel.innerHTML = `
    <option value="">Todas as seções</option>
    ${secoes.map(s => `<option value="${s}">${s}</option>`).join("")}
  `;
  sel.onchange = () => renderFormulario(sel.value || null);
}

// ------------------------------
// FORMULÁRIO
// ------------------------------
function renderFormulario(secaoFiltrada = null) {
  const container = document.getElementById("conteudo_formulario");
  if (!container) return;
  container.innerHTML = "";

  const roteiro = APP_STATE.roteiro || [];
  let perguntas = roteiro;

  if (APP_STATE.tipoRoteiro === "pge") {
    const selLocal = document.getElementById("local_pge_select");
    const selSub = document.getElementById("sublocal_select");
    const locR = selLocal ? selLocal.value : "";
    const subR = selSub ? selSub.value : "";

    if (!locR) {
      container.innerHTML = `
        <div class="bg-gray-100 text-gray-500 text-center py-10 rounded-xl shadow">
          Selecione o local do PGE.
        </div>`;
      return;
    }
    perguntas = perguntas.filter(p => p.Local === locR);

    if (!subR) {
      container.innerHTML = `
        <div class="bg-gray-100 text-gray-500 text-center py-10 rounded-xl shadow">
          Selecione o sublocal.
        </div>`;
      return;
    }
    perguntas = perguntas.filter(p => p.Sublocal === subR);
  }

  if (secaoFiltrada) {
    perguntas = perguntas.filter(p =>
      (p.Secao || p["Seção"] || p.secao) === secaoFiltrada
    );
  }

  if (!perguntas.length) {
    container.innerHTML = `
      <div class="bg-gray-100 text-gray-500 text-center py-10 rounded-xl shadow">
        Nenhuma pergunta encontrada para esse filtro.
      </div>`;
    return;
  }

  const card = document.createElement("div");
  card.className = "bg-white rounded-xl shadow p-4";

  perguntas.forEach(p => {
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

    const inputEl = criarInputParaPergunta(p);
    g.appendChild(inputEl);

    card.appendChild(g);
  });

  container.appendChild(card);
  applyConditionalLogic();
}

function criarInputParaPergunta(p) {
  const tipoRaw = p.TipoInput || p.Tipoinput || p.tipoinput || "";
  const tipo = tipoRaw.toLowerCase();
  const idPerg = p.id;
  const valorSalvo = APP_STATE.respostas[idPerg] || "";
  const wrapper = document.createElement("div");
  wrapper.className = "mt-2";

  const opcoesStr =
    p.Opcoes || p["Opções"] || p.opcoes || p.opcao || p.opções || "";
  const opcoes = opcoesStr.split(";").map(o => o.trim()).filter(Boolean);

  if (tipo === "radio") {
    opcoes.forEach(op => {
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
      .map(v => v.trim())
      .filter(Boolean);

    opcoes.forEach(op => {
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
        ].map(i => i.value);
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
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "w-full border rounded p-2 text-sm";
    inp.value = valorSalvo;
    inp.addEventListener("input", () => autosave(idPerg, inp.value));
    wrapper.appendChild(inp);
  }

  return wrapper;
}

// ------------------------------
// AUTOSAVE + CONDICIONAL
// ------------------------------
function autosave(idPergunta, valor) {
  APP_STATE.respostas[idPergunta] = valor;
  saveAnswerToDB(idPergunta, valor);
  applyConditionalLogic();
}

function applyConditionalLogic() {
  const roteiro = APP_STATE.roteiro || [];
  roteiro.forEach(p => {
    const cond = p.Condicao || p["Condição"] || p.condicao || p.cond || "";
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

// ------------------------------
// CÂMERA – tela dedicada
// ------------------------------
function abrirCamera(idPergunta) {
  currentPhotoInputId = idPergunta;
  goTo("camera");
  startCamera();
}

async function startCamera() {
  const video = document.getElementById("video");
  const placeholder = document.getElementById("camera-placeholder");
  const toggleBtn = document.getElementById("btn-camera-toggle");
  const captureBtn = document.getElementById("btn-camera-capture");

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
  } catch (err) {
    console.error(err);
    showMessage("Não foi possível acessar a câmera. Verifique permissões.", false);
    return;
  }

  if (video) {
    video.srcObject = stream;
    video.classList.remove("hidden");
  }
  if (placeholder) placeholder.classList.add("hidden");
  if (toggleBtn) toggleBtn.textContent = "Desligar Câmera";
  if (captureBtn) captureBtn.disabled = false;
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  const video = document.getElementById("video");
  const placeholder = document.getElementById("camera-placeholder");
  const toggleBtn = document.getElementById("btn-camera-toggle");
  const captureBtn = document.getElementById("btn-camera-capture");

  if (video) video.classList.add("hidden");
  if (placeholder) placeholder.classList.remove("hidden");
  if (toggleBtn) toggleBtn.textContent = "Iniciar Câmera";
  if (captureBtn) captureBtn.disabled = true;
}

function capturarFoto() {
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
      stopCamera();
      goTo("formulario");
    },
    "image/jpeg",
    0.7
  );
}

function salvarFotoBlob(idPergunta, blob) {
  if (!idPergunta) return;

  if (!APP_STATE.fotoIndex[idPergunta]) APP_STATE.fotoIndex[idPergunta] = 1;
  const idx = APP_STATE.fotoIndex[idPergunta]++;
  const fotoId = `${idPergunta}_foto_${String(idx).padStart(3, "0")}`;

  savePhotoToDB(fotoId, blob, idPergunta);
  if (!APP_STATE.fotos[idPergunta]) APP_STATE.fotos[idPergunta] = [];
  APP_STATE.fotos[idPergunta].push(fotoId);

  atualizarListaFotos(idPergunta);
  showMessage(`Foto ${fotoId} salva!`, true);
}

function atualizarListaFotos(idPergunta) {
  const box = document.getElementById(`fotos_${idPergunta}`);
  if (!box) return;
  const arr = APP_STATE.fotos[idPergunta] || [];
  box.innerHTML = arr.map(id => `<div>📸 ${id}</div>`).join("");
}

function initCameraScreen() {
  const toggleBtn = document.getElementById("btn-camera-toggle");
  const captureBtn = document.getElementById("btn-camera-capture");
  const voltarBtn  = document.getElementById("btn-camera-voltar");

  if (toggleBtn) {
    toggleBtn.onclick = () => {
      if (stream) stopCamera();
      else startCamera();
    };
  }
  if (captureBtn) captureBtn.onclick = capturarFoto;
  if (voltarBtn) {
    voltarBtn.onclick = () => {
      stopCamera();
      goTo("formulario");
    };
  }
}

// ------------------------------
// EXPORTAÇÃO
// ------------------------------
function baixarRelatorioCSVAtual() {
  if (!APP_STATE.roteiro) {
    showMessage("Nenhum formulário carregado.", false);
    return;
  }

  const headers = [
    "local_visita",
    "data_visita",
    "avaliador",
    "colaborador",
    "tipo_formulario",
    "local_roteiro",
    "sublocal",
    "secao",
    "id_pergunta",
    "pergunta",
    "resposta"
  ];

  const linhas = APP_STATE.roteiro.map(p => {
    const secao = p.Secao || p["Seção"] || p.secao || "";
    const locR  = p.Local || "";
    const sub   = p.Sublocal || "";
    const id    = p.id;
    const perg  = (p.Pergunta || "").replace(/"/g, '""');
    const resp  = String(APP_STATE.respostas[p.id] || "").replace(/"/g, '""');

    return [
      `"${APP_STATE.local_visita}"`,
      `"${APP_STATE.data}"`,
      `"${APP_STATE.avaliador}"`,
      `"${APP_STATE.colaborador}"`,
      `"${APP_STATE.tipoRoteiro}"`,
      `"${locR}"`,
      `"${sub}"`,
      `"${secao}"`,
      `"${id}"`,
      `"${perg}"`,
      `"${resp}"`
    ].join(",");
  });

  const csv = headers.join(",") + "\n" + linhas.join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const localSafe = (APP_STATE.local_visita || "local").replace(/\s+/g, "_");
  const dataSafe  = APP_STATE.data || "data";
  a.href = url;
  a.download = `respostas_${localSafe}_${dataSafe}_${APP_STATE.tipoRoteiro}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showMessage("CSV gerado para o formulário atual.", true);
}

async function baixarFotosZipAtual() {
  try {
    showSpinner();
    const fotos = await getAllPhotosFromDB();
    if (!fotos || !fotos.length) {
      showMessage("Não há fotos salvas neste formulário.", false);
      return;
    }

    const zip = new JSZip();
    const pasta = zip.folder("fotos");

    fotos.forEach(f => {
      const nome = `FOTO_${f.fotoId}.jpeg`;
      pasta.file(nome, f.blob);
    });

    const conteudo = await zip.generateAsync({ type: "blob" });
    const localSafe = (APP_STATE.local_visita || "local").replace(/\s+/g, "_");
    const dataSafe  = APP_STATE.data || "data";
    saveAs(conteudo, `fotos_${localSafe}_${dataSafe}_${APP_STATE.tipoRoteiro}.zip`);
    showMessage("ZIP de fotos do formulário atual gerado.", true);
  } catch (e) {
    console.error(e);
    showMessage("Erro ao gerar ZIP de fotos.", false);
  } finally {
    hideSpinner();
  }
}

// ------------------------------
// RECOMEÇAR
// ------------------------------
async function recomeçar() {
  if (!confirm("Deseja realmente concluir esta visita e iniciar outro local?")) return;

  APP_STATE.tipoRoteiro = null;
  APP_STATE.roteiro = null;
  APP_STATE.respostas = {};
  APP_STATE.fotos = {};
  APP_STATE.fotoIndex = {};
  APP_STATE.local_visita = "";
  selectedLocal = "";
  selectedForm = null;

  await clearCurrentDB();

  showMessage("Visita concluída. Selecione um novo local.", true);
  initLocaisScreen();
  goTo("local");
}

function initFinalButtons() {
  document.getElementById("btn-exportar-csv-atual")?.addEventListener("click", baixarRelatorioCSVAtual);
  document.getElementById("btn-exportar-fotos-atual")?.addEventListener("click", baixarFotosZipAtual);
  document.getElementById("btn-recomecar")?.addEventListener("click", recomeçar);
}

// ------------------------------
// INIT
// ------------------------------
function initApp() {
  carregarMetaDoLocalStorage();
  initCadastro();
  initLocaisScreen();
  initFormSelectScreen();
  initCameraScreen();
  initFinalButtons();
  goTo("cadastro");
}

window.addEventListener("load", initApp);

