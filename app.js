// ===========================================
// APP.JS – VERSÃO REVISADA (FOCO EM NOVOS BOTÕES)
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
  fotos: {}, // 📸 NOVO: Guardar base64 separado das respostas de texto
  geolocalizacao_inicio: { lat: null, lng: null }
};

// ---------------- UI ----------------
function showScreen(id) {
  ["screen-cadastro", "screen-select-roteiro", "screen-formulario", "screen-historico"]
    .forEach(s => document.getElementById(s)?.classList.toggle("hidden", s !== id));
}

function showMessage(msg, ok = false) {
  const box = document.getElementById("message-box");
  if (!box) return alert(msg);
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
  const roteiro = ROTEIROS[tipo];
  if (!roteiro) return showMessage("Roteiro não encontrado.");

  APP_STATE.tipoRoteiro = tipo;
  APP_STATE.roteiroSelecionado = roteiro;
  APP_STATE.respostas = {};
  APP_STATE.fotos = {}; // Reseta fotos para nova vistoria

  const subBox = document.getElementById("sublocal_box");
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
  const sublocaisUnicos = [...new Set(
    APP_STATE.roteiroSelecionado
      .filter(p => p.Local === APP_STATE.local)
      .map(p => p.Sublocal)
  )];

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
    div.className = `bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-4 ${p.Pai ? 'hidden' : ''}`;

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
  
  // SELECT / RADIO
  if (tipo === "radio" || tipo === "select") {
    const sel = document.createElement("select");
    sel.className = "w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none";
    const opcoes = p.Opcoes.split(";");
    sel.innerHTML = `<option value="">Selecionar...</option>` + 
                   opcoes.map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join("");
    sel.onchange = e => {
      APP_STATE.respostas[p.id] = e.target.value;
      verificarCondicionais(p.id, e.target.value);
    };
    return sel;
  }

  // CHECKBOX GROUP
  if (tipo === "checkboxgroup") {
    const wrap = document.createElement("div");
    const opcoes = p.Opcoes.split(";");
    APP_STATE.respostas[p.id] = [];
    opcoes.forEach(o => {
      const label = document.createElement("label");
      label.className = "flex items-center gap-3 mb-3 text-sm bg-gray-50 p-3 rounded-xl";
      label.innerHTML = `<input type="checkbox" value="${o.trim()}" class="w-5 h-5"> ${o.trim()}`;
      label.querySelector('input').onchange = (e) => {
        const arr = APP_STATE.respostas[p.id];
        if (e.target.checked) arr.push(e.target.value);
        else arr.splice(arr.indexOf(e.target.value), 1);
        verificarCondicionais(p.id, arr.join(";"));
      };
      wrap.appendChild(label);
    });
    return wrap;
  }

  // FILE (CÂMERA)
  if (tipo === "file") {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.capture = "environment"; // Abre a câmera direto no Android/iOS
    inp.className = "text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700";
    inp.onchange = e => {
      const reader = new FileReader();
      reader.onload = () => {
        APP_STATE.fotos[p.id] = reader.result; // Salva no objeto de fotos
        // Se for AA, captura GPS no momento da foto
        if (APP_STATE.tipoRoteiro === 'aa') capturarGPSPergunta(p.id);
      };
      reader.readAsDataURL(e.target.files[0]);
    };
    return inp;
  }

  // DEFAULT (TEXT, NUMBER, TEXTAREA)
  const inp = tipo === "textarea" ? document.createElement("textarea") : document.createElement("input");
  inp.type = tipo;
  inp.className = "w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl";
  if (tipo === "textarea") inp.classList.add("h-24");
  inp.onchange = e => APP_STATE.respostas[p.id] = e.target.value;
  return inp;
}

function verificarCondicionais(idPai, valor) {
  APP_STATE.roteiroSelecionado.forEach(p => {
    if (p.Pai === idPai) {
      const elDiv = document.getElementById(`div_pergunta_${p.id}`);
      if (elDiv) {
        // Suporta checkbox: se o valor da condição estiver contido na resposta
        const mostrar = valor.includes(p.Condicao);
        elDiv.classList.toggle("hidden", !mostrar);
        if (!mostrar) delete APP_STATE.respostas[p.id];
      }
    }
  });
}

// ---------------- GPS ----------------
function capturarGPS(tipo) {
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    if (tipo === "inicial") APP_STATE.geolocalizacao_inicio = { lat, lng };
  }, null, { enableHighAccuracy: true });
}

function capturarGPSPergunta(perguntaId) {
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    APP_STATE.respostas[`gps_${perguntaId}`] = `${lat},${lng}`;
  });
}

// ---------------- SALVAMENTO FINAL ----------------
async function finalizarVistoria() {
  try {
    // 1. Chamar a função do seu novo INDEXEDDB.JS
    // Passamos o roteiro atual para ele saber quais perguntas salvar
    const idGerado = await finalizarVisitaBanco(APP_STATE.roteiroSelecionado);
    
    showMessage(`Vistoria #${idGerado} salva no banco de dados!`, true);
    
    // Opcional: Voltar ao início após 2 segundos
    setTimeout(() => location.reload(), 2000);
  } catch (err) {
    console.error(err);
    showMessage("Erro ao salvar no banco!");
  }
}

// ---------------- INIT ----------------
function initApp() {
  const selLocal = document.getElementById("local");
  if (selLocal) {
    selLocal.innerHTML = LOCAIS_VISITA.map(l => `<option>${l}</option>`).join("");
  }
  showScreen("screen-cadastro");
}

document.addEventListener("DOMContentLoaded", initApp);

