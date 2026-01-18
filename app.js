/// ============================================================
// APP.JS – VERSÃO INTEGRAL CORRIGIDA (ORGANIZADA POR FLUXO)
// ============================================================



// ============================================================
// 1. CONSTANTES E ESTADO GLOBAL
// ============================================================

const LOCAIS_VISITA = [
    "Rio D'Ouro", "São Pedro", "Tinguá - Barrelão", "Tinguá - Serra Velha",
    "Tinguá - Brava/Macucuo", "Tinguá - Colomi", "Tinguá - Boa Esperança",
    "Mantiquira - T1", "Mantiquira - T2", "Xerém I - João Pinto",
    "Xerém II - Entrada", "Xerém III - Plano", "Xerém III - Registro"
];

let APP_STATE = {
    avaliador: "",
    local: "",
    colaborador: "",
    data: "",
    tipoRoteiro: null,
    sublocal: "",
    respostas: {
        geral: {},
        pge: {},
        aa: {}
    },
    fotos: {}
};

let stream = null;
let currentPhotoInputId = null;



// ============================================================
// 2. CONTROLE DE TELAS E NAVEGAÇÃO
// ============================================================

function showScreen(id) {
    const telas = ["screen-cadastro", "screen-select-roteiro", "screen-formulario", "screen-final"];
    telas.forEach(t => {
        const el = document.getElementById(t);
        if (el) el.classList.toggle("hidden", t !== id);
    });
    window.scrollTo(0, 0);
}



// ============================================================
// 3. BOOTSTRAP DO APLICATIVO
// ============================================================

async function initApp() {
    // 1. Carregar meta dados do LocalStorage
    carregarMetaDoLocalStorage();

    // 2. Tenta carregar dados salvos no IndexedDB (se sua API suportar isso)
    if (window.DB_API && window.DB_API.loadVisita) {
        const dadosSalvos = await DB_API.loadVisita();
        if (dadosSalvos) APP_STATE = dadosSalvos;
    }

    // 3. Popula o seletor de Locais
    const sel = document.getElementById("local");
    if (sel) {
        sel.innerHTML = `<option disabled selected value="">Selecionar Local...</option>` +
            LOCAIS_VISITA.map(l => `<option value="${l}">${l}</option>`).join("");
        if (APP_STATE.local) sel.value = APP_STATE.local;
    }

    // 4. Decisão de Tela Inicial
    if (APP_STATE.local && APP_STATE.avaliador) {
        showScreen("screen-select-roteiro");
    } else {
        showScreen("screen-cadastro");
    }
}
   
// ============================================================
// 4. PERSISTÊNCIA DE RESPOSTAS
// ============================================================

function registrarResposta(idPergunta, valor) {
    const tipo = APP_STATE.tipoRoteiro;
    if (!tipo) return;

    if (!APP_STATE.respostas[tipo]) APP_STATE.respostas[tipo] = {};
    APP_STATE.respostas[tipo][idPergunta] = valor;

    if (window.saveAnswerToDB) window.saveAnswerToDB(idPergunta, valor);

    applyConditionalLogic();
    console.log(`Salvo [${tipo}]: ${idPergunta} = ${valor}`);
}

function carregarMetaDoLocalStorage() {
    ["avaliador", "local", "colaborador", "data"].forEach(key => {
        const val = localStorage.getItem(key);
        if (val) {
            APP_STATE[key] = val;
            const el = document.getElementById(key === "data" ? "data_visita" : key);
            if (el) el.value = val;
        }
    });
}


 carregarMetaDoLocalStorage();
 initCadastro();
// ============================================================
// 5. SELEÇÃO DE ROTEIRO (FLUXO PRINCIPAL)
// ============================================================

async function selectRoteiro(tipo) {

    const mapeamento = {
        geral: window.ROTEIRO_GERAL,
        pge: window.ROTEIRO_PGE,
        aa: window.ROTEIRO_AA
    };

    const selSecao = document.getElementById("secao_select");
    if (selSecao) selSecao.innerHTML = `<option value="">Todas as seções</option>`;

    const dados = mapeamento[tipo];
    if (!dados) return alert("Erro: Roteiro não encontrado.");


    // DEVERIA REMOVER A IMAGEM DE APOIO 
    const img = document.getElementById("container_imagem_apoio_sublocal");
    if (img) img.remove();

    APP_STATE.tipoRoteiro = tipo;
    APP_STATE.roteiro = dados;
    if (!APP_STATE.respostas[tipo]) APP_STATE.respostas[tipo] = {};

    document.getElementById("roteiro-atual-label").textContent = tipo.toUpperCase();

    const boxSub = document.getElementById("sublocal_box");
    if (boxSub) boxSub.classList.toggle("hidden", tipo !== "pge");

    document.getElementById("conteudo_formulario").innerHTML = "";

    if (tipo === "pge") {
        montarSublocaisFiltrados(APP_STATE.local);

        if (APP_STATE.sublocal) {
            document.getElementById("sublocal_select").value = APP_STATE.sublocal;
            exibirImagemApoioSublocal(APP_STATE.sublocal);
            montarSecoes();
            renderFormulario();
        }
    } else {
        APP_STATE.sublocal = "";
        montarSecoes();
        renderFormulario();
    }

    showScreen("screen-formulario");
}



// ============================================================
// 6. SUBLOCAL + SEÇÕES
// ============================================================
function montarSecoes() {
    const sel = document.getElementById("secao_select");
    if (!sel) return;

    let dados = APP_STATE.roteiro;

    if (APP_STATE.tipoRoteiro === "pge") {
        const sub = document.getElementById("sublocal_select").value;
        if (!sub) return;
        dados = dados.filter(p => p.Local === APP_STATE.local && p.Sublocal === sub);
    }

    const secoes = [...new Set(dados.map(p => p.Secao || p["Seção"]))].filter(Boolean).sort();

    sel.innerHTML =
        `<option value="">Todas as seções (${secoes.length})</option>` +
        secoes.map(s => `<option value="${s}">${s}</option>`).join("");

    sel.onchange = () => renderFormulario(sel.value);
}



function montarSublocaisFiltrados(localEscolhido) {
    const selSub = document.getElementById("sublocal_select");

    const subs = [...new Set(
        ROTEIRO_PGE
            .filter(p => p.Local === localEscolhido)
            .map(p => p.Sublocal)
    )].filter(Boolean).sort();

    selSub.innerHTML = subs.length === 0
        ? `<option value="">Nenhum sublocal</option>`
        : `<option value="">Selecione o Sublocal...</option>` +
          subs.map(s => `<option value="${s}">${s}</option>`).join("");

    document.getElementById("conteudo_formulario").innerHTML = "";

    const img = document.getElementById("container_imagem_apoio_sublocal");
    if (img) img.remove();

    selSub.onchange = () => {
        if (selSub.value) {
            APP_STATE.sublocal = selSub.value;
            exibirImagemApoioSublocal(selSub.value);
            montarSecoes();
            renderFormulario();
        }
    };
}

// ============================================================
// 7. IMAGEM DE APOIO (PGE)
// ============================================================

// 1. Limpa qualquer imagem de apoio que já esteja na tela
function exibirImagemApoioSublocal(sublocal) {
    const containerForm = document.getElementById("conteudo_formulario");
    const existente = document.getElementById("container_imagem_apoio_sublocal");
    if (existente) existente.remove();

    if (APP_STATE.tipoRoteiro !== "pge" || !sublocal) return;

    const itemComImagem = window.ROTEIRO_PGE.find(p => 
        p.Local === APP_STATE.local && 
        p.Sublocal === sublocal && 
        p.ImagemApoio && p.ImagemApoio.length > 100
    );

    if (itemComImagem) {
        const divImg = document.createElement("div");
        divImg.id = "container_imagem_apoio_sublocal";
        divImg.className = "bg-white p-2 rounded-2xl shadow-sm mb-6 border-2 border-blue-100";
        divImg.innerHTML = `
            <p class="text-[10px] font-bold text-blue-500 mb-1">IMAGEM DE APOIO</p>
            <img src="${itemComImagem.ImagemApoio}" class="w-full h-auto rounded-lg shadow-inner" 
                 onclick="window.open(this.src, '_blank')">
        `;
        // Insere no topo do formulário
        containerForm.prepend(divImg);
    }
}

// ============================================================
// 8. RENDERIZAÇÃO DO FORMULÁRIO
// ============================================================

function renderFormulario(secaoFiltrada = null) {
    const container = document.getElementById("conteudo_formulario");
    if (!container) return;
    container.innerHTML = "";
    
    let perguntas = APP_STATE.roteiro;
     if (APP_STATE.tipoRoteiro !== "pge") {
        const img = document.getElementById("container_imagem_apoio_sublocal");
        if (img) img.remove();
    }
    if (APP_STATE.tipoRoteiro === "pge") {
        const sub = document.getElementById("sublocal_select").value;
        if (!sub) {
            container.innerHTML = `<div class="text-center p-10 text-gray-400 italic">Selecione um sublocal.</div>`;
            return;
        }
        perguntas = perguntas.filter(p => p.Local === APP_STATE.local && p.Sublocal === sub);
    }

    if (secaoFiltrada) {
        perguntas = perguntas.filter(p => (p.Secao || p["Seção"]) === secaoFiltrada);
    }

    perguntas.forEach(p => {
        const div = document.createElement("div");
        div.id = `group_${p.id}`;
        div.className = "bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-4";
        
       const valorSalvo =
    APP_STATE.respostas[APP_STATE.tipoRoteiro]?.[p.id] ?? "";


        div.innerHTML = `
            <label class="block font-bold text-gray-800 mb-3">${p.Pergunta}</label>
            <div id="input-root-${p.id}"></div>
        `;
        container.appendChild(div);
        renderInput(p, document.getElementById(`input-root-${p.id}`), valorSalvo); 
    });

    applyConditionalLogic();
}


// ============================================================
// 9. INPUTS
// ============================================================
function renderInput(p, container, valorSalvo) {
    const tipoInput = p.TipoInput; 
    container.innerHTML = ""; // Limpa container interno

    if (tipoInput === "text" || tipoInput === "textarea") {
        const input = document.createElement(tipoInput === "text" ? "input" : "textarea");
        input.className = "w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none";
        input.value = valorSalvo || ""; // Garante que não seja undefined
        input.oninput = (e) => registrarResposta(p.id, e.target.value);
        container.appendChild(input);

    } else if (tipoInput === "radio") {
        const opcoes = (p.Opcoes || "").split(";").filter(Boolean);
        opcoes.forEach(opt => {
            const optTrim = opt.trim();
            const checked = valorSalvo === optTrim ? "checked" : "";
            const label = document.createElement("label");
            label.className = "flex items-center gap-3 p-3 border rounded-xl mb-2 hover:bg-gray-50 cursor-pointer";
            label.innerHTML = `
                <input type="radio" name="${p.id}" value="${optTrim}" ${checked} 
                       onchange="registrarResposta('${p.id}', '${optTrim}')" class="w-5 h-5 text-blue-600">
                <span class="text-sm font-medium text-gray-700">${optTrim}</span>
            `;
            container.appendChild(label);
        });

    } else if (tipoInput === "checkboxGroup") {
        const opcoes = (p.Opcoes || "").split(";").filter(Boolean);
        const marcados = (valorSalvo || "").split(";").map(v => v.trim());
        
        opcoes.forEach(opt => {
            const optTrim = opt.trim();
            const isChecked = marcados.includes(optTrim) ? "checked" : "";
            const label = document.createElement("label");
            label.className = "flex items-center gap-3 p-3 border rounded-xl mb-2 hover:bg-gray-50 cursor-pointer";
            label.innerHTML = `
                <input type="checkbox" name="${p.id}" value="${optTrim}" ${isChecked} 
                       onchange="gerenciarMudancaCheckbox('${p.id}')" class="w-5 h-5 text-green-600 rounded">
                <span class="text-sm font-medium text-gray-700">${optTrim}</span>
            `;
            container.appendChild(label);
        }); 

    } else if (tipoInput === "file") {
        container.innerHTML = `
            <div class="space-y-3">
                <button type="button" onclick="abrirCamera('${p.id}')" 
                    class="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm">
                    <span>📷</span> Capturar Foto
                </button>
                <div id="fotos_${p.id}" class="grid grid-cols-4 gap-2 empty:hidden"></div>
            </div>
        `;
        if (typeof atualizarListaFotos === "function") {
            atualizarListaFotos(p.id);
        }
    }
}

function gerenciarMudancaCheckbox(idPergunta) {
    const checkboxes = document.querySelectorAll(`input[name="${idPergunta}"]:checked`);
    const valores = Array.from(checkboxes).map(cb => cb.value.trim());
    registrarResposta(idPergunta, valores.join(";"));
}


// ============================================================
// 10. CONDICIONAIS
// ============================================================

function applyConditionalLogic() {
    const tipo = APP_STATE.tipoRoteiro;
    if (!APP_STATE.roteiro) return;
    
    APP_STATE.roteiro.forEach(p => {
        const cond = p.Condicao || p["Condição"];
        const pai = p.Pai;
        if (cond && pai) {
            const el = document.getElementById(`group_${p.id}`);
            if (el) {
                const valorPai = APP_STATE.respostas[tipo][pai];
                el.classList.toggle("hidden", valorPai !== cond);
            }
        }
    });
}

// ============================================================
// SISTEMA DE CÂMERA E PROCESSAMENTO DE IMAGENS
// ============================================================

/**
 * 1. ACIONA A CÂMERA NATIVA
 */
async function abrirCamera(idPergunta) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Abre a câmera traseira preferencialmente

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            // Inicia o processamento da imagem capturada
            await processarFoto(idPergunta, file);
        }
    };
    input.click();
}

/**
 * 2. REDUZ E COMPRIME A IMAGEM (Otimização de Armazenamento)
 */
async function reduzirImagem(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Retorna Base64 em formato JPEG com 70% de qualidade
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * 3. PROCESSA, CONVERTE E SALVA
 */
async function processarFoto(idPergunta, file) {
    try {
        // Redução para Base64 (usado para visualização rápida e Excel)
        const base64Reduzido = await reduzirImagem(file); 
        
        // Conversão para Blob (Armazenamento mais eficiente no IndexedDB)
        const res = await fetch(base64Reduzido);
        const blob = await res.blob();
        
        const fotoId = `${idPergunta}_${Date.now()}`;

        // Salva no Banco de Dados
        if (window.savePhotoToDB) {
            await window.savePhotoToDB(fotoId, blob, idPergunta, base64Reduzido);
        }

        // Atualiza a galeria na tela
        await atualizarListaFotos(idPergunta);
        
        console.log("📸 Foto processada e salva com sucesso.");
    } catch (err) {
        console.error("Erro no processamento da foto:", err);
    }
}

/**
 * 4. INTERFACE: ATUALIZA A LISTA DE FOTOS NA TELA
 */
async function atualizarListaFotos(idPergunta) {
    const container = document.getElementById(`fotos_${idPergunta}`);
    if (!container) return;

    // Busca fotos diretamente do IndexedDB
    const fotosNoBanco = await DB_API.getFotosPergunta(idPergunta);
    container.innerHTML = "";

    fotosNoBanco.forEach(foto => {
        const imgDiv = document.createElement("div");
        imgDiv.className = "relative w-20 h-20";
        
        // Prioriza o Base64 salvo para performance, senão cria URL temporária do Blob
        const src = foto.base64 || (foto.blob ? URL.createObjectURL(foto.blob) : "");
        
        imgDiv.innerHTML = `
            <img src="${src}" class="w-full h-full object-cover rounded-xl border shadow-sm">
            <button onclick="removerFoto('${foto.foto_id}', '${idPergunta}')" 
                    class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-md active:scale-90 transition-transform">
                ✕
            </button>
        `;
        container.appendChild(imgDiv);
    });
}

/**
 * 5. REMOVE FOTO DO BANCO E DA TELA
 */
async function removerFoto(fotoId, idPergunta) {
    if (!confirm("Deseja excluir esta foto definitivamente?")) return;

    try {
        const db = await DB_API.openDB();
        const tx = db.transaction(['fotos'], 'readwrite');
        const store = tx.objectStore('fotos');

        store.delete(fotoId);

        await tx.complete;
        await atualizarListaFotos(idPergunta);
    } catch (err) {
        console.error("Erro ao remover foto:", err);
        alert("Erro ao excluir a foto.");
    }
}


/**
 * 6. PERSISTÊNCIA GLOBAL (Utilizada pelo processarFoto)
 */
window.savePhotoToDB = async (fotoId, blob, idPergunta, base64) => {
    const db = await DB_API.openDB(); 
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['fotos'], 'readwrite');
        const store = transaction.objectStore('fotos');

        const request = store.put({
            foto_id: fotoId,
            pergunta_id: idPergunta,
            blob: blob,
            base64: base64,
            timestamp: new Date().toISOString()
        });

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e);
    });
};
// ---------------------
// Iniciar cadastro

function initCadastro() {
    document.getElementById("btn-cadastro-continuar").onclick = () => {
        APP_STATE.avaliador = document.getElementById("avaliador").value;
        APP_STATE.local = document.getElementById("local").value;
        APP_STATE.data = document.getElementById("data_visita").value;

        if (!APP_STATE.avaliador || !APP_STATE.local || !APP_STATE.data) return alert("Preencha tudo!");

        localStorage.setItem("avaliador", APP_STATE.avaliador);
        localStorage.setItem("local", APP_STATE.local);
        localStorage.setItem("data", APP_STATE.data);
        
        showScreen("screen-select-roteiro");
    };

    // Se já havia uma vistoria em curso, podemos pular direto para a seleção de roteiro
    if (APP_STATE.local && APP_STATE.avaliador) {
        showScreen("screen-select-roteiro");
    } else {
        showScreen("screen-cadastro");
 }
}

// ============================================================
// 12. EXPORTAÇÃO E RESET
// ============================================================
async function baixarExcelConsolidado() {
    try {
        console.log("📊 Consolidando respostas...");
        const workbook = new ExcelJS.Workbook();
        
        const configuracao = [
            { nome: "Geral", id: "geral", fonte: window.ROTEIRO_GERAL },
            { nome: "PGE", id: "pge", fonte: window.ROTEIRO_PGE },
            { nome: "Acid. Ambientais", id: "aa", fonte: window.ROTEIRO_AA }
        ];

        for (const config of configuracao) {
            if (!config.fonte) continue;
            const sheet = workbook.addWorksheet(config.nome);
            
            sheet.columns = [
                { header: 'SEÇÃO', key: 'secao', width: 20 },
                { header: 'PERGUNTA', key: 'pergunta', width: 50 },
                { header: 'RESPOSTA', key: 'resposta', width: 40 },
                { header: 'FOTOS (ANEXOS)', key: 'fotos', width: 25 }
            ];

            // Pega as respostas salvas para este roteiro específico
            const respostasDoTipo = APP_STATE.respostas[config.id] || {};

            for (const p of config.fonte) {
                // CORREÇÃO PARA PGE: No PGE, só exportamos se a pergunta for do Local e Sublocal selecionados
                if (config.id === "pge") {
                    if (p.Local !== APP_STATE.local || p.Sublocal !== APP_STATE.sublocal) {
                        continue; // Pula perguntas que não são deste sublocal
                    }
                }

                const respostaTexto = respostasDoTipo[p.id] || "";
                
                // Se a pergunta não tem resposta E não tem foto, e você quiser pular, use:
                // if (!respostaTexto) continue;

                const novaLinha = sheet.addRow({
                    secao: p.Secao || p["Seção"] || "",
                    pergunta: p.Pergunta,
                    resposta: String(respostaTexto) // Garante que o Excel trate como texto
                });

                // LÓGICA DE FOTOS (Mantida conforme seu relato de funcionamento)
                try {
                    const fotosNoBanco = await window.DB_API.getFotosPergunta(p.id);
                    if (fotosNoBanco && fotosNoBanco.length > 0) {
                        novaLinha.height = 100;
                        for (let i = 0; i < fotosNoBanco.length; i++) {
                            const arrayBuffer = await fotosNoBanco[i].blob.arrayBuffer();
                            const imageId = workbook.addImage({
                                buffer: arrayBuffer,
                                extension: 'jpeg',
                            });
                            sheet.addImage(imageId, {
                                tl: { col: 3, row: novaLinha.number - 1 },
                                ext: { width: 120, height: 120 }
                            });
                        }
                    }
                } catch (e) { console.error("Erro na foto:", e); }
            }
        }

        // Finalização (Download)
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Use o método nativo se o saveAs falhar
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Relatorio_${APP_STATE.local}_${new Date().getTime()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);

    } catch (err) {
        console.error("Erro crítico:", err);
    }
}

      
// CONFIRMAR NOVA VISTORIA
async function confirmarNovaVistoria() {
    const msg = "Tem certeza que deseja iniciar uma nova vistoria? Todos os dados atuais (respostas e fotos) serão apagados permanentemente.";
    
    if (confirm(msg)) {
        try {
            // 1. Limpa o IndexedDB (Respostas e Fotos)
            const req = indexedDB.deleteDatabase(DB_NAME);
            
            req.onerror = () => {
                console.error("Erro ao apagar banco de dados.");
                alert("Erro ao limpar dados antigos. Tente fechar outras abas do app.");
            };

            req.onsuccess = () => {
                console.log("Banco de dados apagado com sucesso.");
                
                // 2. Limpa o LocalStorage (Dados do cabeçalho: avaliador, local, etc)
                localStorage.clear();

                // 3. Limpa o estado da memória
                APP_STATE.respostas = { geral: {}, pge: {}, aa: {} };
                APP_STATE.fotos = {};
                
                // 4. Recarrega a página para o estado inicial
                location.reload();
            };

            // Caso o banco esteja bloqueado por outra aba aberta
            req.onblocked = () => {
                alert("Por favor, feche outras abas deste aplicativo abertas para poder reiniciar.");
            };

        } catch (err) {
            console.error("Falha ao reiniciar:", err);
            // Fallback caso o IndexedDB falhe
            localStorage.clear();
            location.reload();
        }
    }

}
window.savePhotoToDB = async (fotoId, blob, idPergunta, base64) => {
    const db = await DB_API.openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(['fotos'], 'readwrite');
        const store = tx.objectStore('fotos');

        const req = store.put({
            foto_id: fotoId,
            pergunta_id: idPergunta,
            blob,
            base64,
            timestamp: Date.now()
        });

        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e);
    });
};

// Exemplo de como seu getFotosPergunta pode ser ajustado:
DB_API.getFotosPergunta = async (idPergunta) => {
    const db = await DB_API.openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(['fotos'], 'readonly');
        const store = tx.objectStore('fotos');
        const req = store.getAll();

        req.onsuccess = () => {
            resolve(req.result.filter(f => f.pergunta_id === idPergunta));
        };

        req.onerror = (e) => reject(e);
    });
};

// ------------------------------------------------------------
// VINCULAÇÕES GLOBAIS (FINAL DO ARQUIVO) - Versão Blindada
// ------------------------------------------------------------
window.showScreen = showScreen;
window.selectRoteiro = selectRoteiro;
window.abrirCamera = abrirCamera;
window.removerFoto = removerFoto; // Faltava esta!
window.registrarResposta = registrarResposta;
window.gerenciarMudancaCheckbox = gerenciarMudancaCheckbox;
window.baixarExcelConsolidado = baixarExcelConsolidado; 
window.confirmarNovaVistoria = confirmarNovaVistoria;

document.addEventListener("DOMContentLoaded", initApp);
