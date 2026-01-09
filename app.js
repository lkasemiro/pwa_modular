// ===========================================
// APP.JS – PWA SUPERVISÃO AMBIENTAL (V13)
// Foco: Performance Offline e Georreferenciamento
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
    respostas: {}, 
    fotos: {}, 
    geolocalizacao_inicio: { lat: null, lng: null },
    geolocalizacao_sublocal: { lat: null, lng: null }
};

// --- NAVEGAÇÃO E UI ---
const showScreen = (id) => {
    const screens = ["screen-cadastro", "screen-select-roteiro", "screen-formulario", "screen-historico"];
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle("hidden", s !== id);
    });

    // Atualiza visual das abas de navegação
    const btnForm = document.getElementById("btn-form");
    const btnHist = document.getElementById("btn-hist");
    
    if (id === "screen-historico") {
        btnHist?.classList.add("border-[#0C3C78]", "text-[#0C3C78]");
        btnForm?.classList.remove("border-[#0C3C78]", "text-[#0C3C78]");
    } else {
        btnForm?.classList.add("border-[#0C3C78]", "text-[#0C3C78]");
        btnHist?.classList.remove("border-[#0C3C78]", "text-[#0C3C78]");
    }
};

const showMessage = (msg, ok = false) => {
    const box = document.getElementById("message-box");
    if (!box) return alert(msg);
    box.textContent = msg;
    box.className = `fixed top-4 left-1/2 -translate-x-1/2 p-4 rounded shadow-lg z-50 ${ok ? 'bg-green-600' : 'bg-red-500'} text-white font-bold`;
    box.classList.remove("hidden");
    setTimeout(() => box.classList.add("hidden"), 3000);
};

// --- GEOLOCALIZAÇÃO SILENCIOSA ---
function capturarGPS(tipo) {
    if (!navigator.geolocation) return;

    const geoOptions = { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
    };

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude.toFixed(6);
            const lng = pos.coords.longitude.toFixed(6);
            
            if (tipo === 'inicial') {
                APP_STATE.geolocalizacao_inicio = { lat, lng };
                const display = document.getElementById('display-coords-inicial');
                if (display) display.textContent = `${lat}, ${lng}`;
            } else if (tipo === 'sublocal') {
                APP_STATE.geolocalizacao_sublocal = { lat, lng };
                console.log("📍 Coordenadas do Sublocal capturadas.");
            }
        },
        (err) => console.warn("GPS Indisponível no momento."),
        geoOptions
    );
}

// --- CADASTRO INICIAL ---
function initCadastro() {
    const btn = document.getElementById("btn-cadastro-continuar");
    if (!btn) return;

    btn.onclick = () => {
        const fields = ["avaliador", "local", "data_visita"];
        const values = fields.reduce((acc, f) => ({ ...acc, [f]: document.getElementById(f).value.trim() }), {});

        if (Object.values(values).some(v => !v || v === "Selecionar Local...")) {
            return showMessage("Preencha todos os campos corretamente.", false);
        }

        Object.assign(APP_STATE, values);
        showScreen("screen-select-roteiro");
    };
}

// --- SELEÇÃO DE ROTEIRO ---
async function selectRoteiro(tipo) {
    const roteirosMap = {
        'pge': (typeof ROTEIRO_PGE !== 'undefined') ? ROTEIRO_PGE : null,
        'geral': (typeof ROTEIRO_GERAL !== 'undefined') ? ROTEIRO_GERAL : null
    };

    const roteiroSelecionado = roteirosMap[tipo];
    if (!roteiroSelecionado) return showMessage("Erro: Roteiro não carregado.");

    APP_STATE.tipoRoteiro = tipo;
    APP_STATE.roteiro = roteiroSelecionado;

    renderFormulario();
    showScreen("screen-formulario");
}

// --- FORMULÁRIO DINÂMICO ---
function renderFormulario() {
    const container = document.getElementById("conteudo_formulario");
    if (!container) return;
    
    container.innerHTML = "";
    APP_STATE.roteiro.forEach(p => {
        const div = document.createElement("div");
        div.className = "card mb-4 border-l-4 border-blue-500 shadow-sm bg-white p-4 rounded-xl";
        div.id = `group_${p.id}`;
        
        // Se for uma pergunta de sublocal no PGE, dispara captura de GPS
        let onChangeGPS = "";
        if (p.Pergunta.toLowerCase().includes("sublocal")) {
            onChangeGPS = `onchange="capturarGPS('sublocal')"`;
        }

        div.innerHTML = `
            <label class="block font-bold text-gray-700 mb-2">${p.Pergunta}</label>
            <div id="input_container_${p.id}"></div>
        `;
        
        const inputWrapper = div.querySelector(`#input_container_${p.id}`);
        inputWrapper.appendChild(criarInput(p, onChangeGPS));
        container.appendChild(div);
    });
}

function criarInput(p, extraAttr) {
    const tipo = (p.TipoInput || "text").toLowerCase();
    const input = document.createElement(tipo === "textarea" ? "textarea" : "input");
    input.className = "w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-[#0C3C78]";
    if (extraAttr) input.setAttribute("onchange", "capturarGPS('sublocal')");
    input.oninput = (e) => { APP_STATE.respostas[p.id] = e.target.value; };
    return input;
}

// --- HISTÓRICO E PERSISTÊNCIA ---
function salvarVistoriaNoHistorico() {
    const historico = JSON.parse(localStorage.getItem("historico_vistorias") || "[]");
    
    const novaEntrada = {
        id: Date.now(),
        local: APP_STATE.local,
        avaliador: APP_STATE.avaliador,
        data: APP_STATE.data_visita || new Date().toLocaleDateString('pt-BR'),
        coordenadas: APP_STATE.geolocalizacao_inicio
    };

    historico.push(novaEntrada);
    localStorage.setItem("historico_vistorias", JSON.stringify(historico));
    
    showMessage("Vistoria salva com sucesso!", true);
    exibirHistorico();
}

function exibirHistorico() {
    showScreen('screen-historico');
    const container = document.getElementById('lista-historico');
    if (!container) return;

    const visitas = JSON.parse(localStorage.getItem("historico_vistorias") || "[]");
    container.innerHTML = visitas.length === 0 
        ? '<p class="text-center text-gray-400 py-6 text-sm">Nenhum registro encontrado.</p>'
        : visitas.reverse().map(v => `
            <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-[#0C3C78] flex justify-between items-center mb-2">
                <div>
                    <p class="font-bold text-sm text-gray-800">${v.local}</p>
                    <p class="text-[10px] text-gray-500">${v.data} | Lat: ${v.coordenadas?.lat || 'N/D'}</p>
                </div>
                <div class="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">✓ SALVO</div>
            </div>
        `).join("");
}

// --- INICIALIZAÇÃO ---
function initApp() {
    const sel = document.getElementById("local");
    if (sel) {
        sel.innerHTML = LOCAIS_VISITA.map(l => `<option value="${l}">${l}</option>`).join("");
    }
    initCadastro();
    showScreen("screen-cadastro");
}

// Exposição Global
window.selectRoteiro = selectRoteiro;
window.exibirHistorico = exibirHistorico;
window.showScreen = showScreen;
window.capturarGPS = capturarGPS;
window.finalizarVistoria = salvarVistoriaNoHistorico;

document.addEventListener("DOMContentLoaded", initApp);
