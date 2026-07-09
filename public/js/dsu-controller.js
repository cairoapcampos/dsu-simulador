// dsu-controller.js
// Responsável por orquestrar a visualização e o controle dos eventos do DSU na interface.
// Inicializa o DSU, o grafo Cytoscape e conecta os botões de interação.

import {
    DisjointSetUnion,
    DisjointSetUnionPathCompression,
    DisjointSetUnionBySizePathCompression,
    DisjointSetUnionByRankPathCompression
} from './dsu.js';
import { createGraph, renderGraph, renderStatus, renderParentSizeTable, renderElementRankTable } from './dsu-visual.js';

// Nomes dos nós e lista de uniões a serem realizadas


// Modos originais (8 nós)
const baseLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const defaultUnions = [
    [0, 1], [2, 3], [4, 5], [6, 7], [1, 3], [5, 1], [7, 5]
];
// Ordem escolhida para preservar fidelidade algorítmica:
// os passos finais usam nós comuns/folhas, e o find descobre as raízes.
// union(B, A) => [1, 0]
// union(D, C) => [3, 2]
// union(F, E) => [5, 4]
// union(H, G) => [7, 6]
// union(D, B) => [3, 1]
// union(F, B) => [5, 1]
// union(H, F) => [7, 5]
const optimizedUnions = [
    [1, 0], // B, A
    [3, 2], // D, C
    [5, 4], // F, E
    [7, 6], // H, G
    [3, 1], // D, B
    [5, 1], // F, B
    [7, 5]  // H, F
];
let labels = baseLabels;
let unions = defaultUnions;
let step = 0;
let dsu = new DisjointSetUnion(labels.length);
let pathCompressionAnimation = null;

const elements = {
    cy: document.getElementById('cy'),
    modeSelect: document.getElementById('dsuMode'),
    stepBtn: document.getElementById('stepBtn'),
    prevBtn: document.getElementById('prevBtn'),
    resetBtn: document.getElementById('resetBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    findBox: document.getElementById('findBox'),
    findInput: document.getElementById('findInput'),
    findBtn: document.getElementById('findBtn'),
    pcPrevBtn: document.getElementById('pcPrevBtn'),
    pcNextBtn: document.getElementById('pcNextBtn'),
    explanation: document.getElementById('explicacao-passo')
};

const modeConfig = {
    naive: {
        unions: defaultUnions,
        hasPathCompression: false,
        createDSU: () => new DisjointSetUnion(baseLabels.length),
        labels: baseLabels
    },
    pc: {
        unions: defaultUnions,
        hasPathCompression: true,
        createDSU: () => new DisjointSetUnionPathCompression(baseLabels.length),
        labels: baseLabels
    },
    sizepc: {
        unions: optimizedUnions,
        hasPathCompression: true,
        createDSU: () => new DisjointSetUnionBySizePathCompression(baseLabels.length),
        labels: baseLabels
    },
    rankpc: {
        unions: optimizedUnions,
        hasPathCompression: true,
        createDSU: () => new DisjointSetUnionByRankPathCompression(baseLabels.length),
        labels: baseLabels
    },
};

let cy = createGraph(elements.cy, labels);

// Função auxiliar para destacar caminho do find
function getFindPath(x) {
    const parent = dsu.getParent();
    const path = [];
    let curr = x;
    while (parent[curr] !== curr) {
        path.push(curr);
        curr = parent[curr];
    }
    path.push(curr);
    return path;
}

function highlightFindPath(path) {
    // Limpa destaques anteriores
    cy.nodes().removeClass('find-path');
    path.forEach(idx => cy.getElementById(labels[idx]).addClass('find-path'));
}

function formatPath(path) {
    return path.map(idx => labels[idx]).join(' -> ');
}

function getPathSummaryLines(path, root) {
    return [
        `Caminho percorrido: <b>${formatPath(path)}</b>.`,
        `Raiz encontrada: <b>${labels[root]}</b>.`
    ];
}

function getPathCompressionChanges(path, previousParent, root) {
    return path
        .filter(node => node !== root && previousParent[node] !== root)
        .map(node => ({
            node,
            previousParent: previousParent[node],
            currentParent: root
        }));
}

function renderFindExplanation(x, path, root, compressionChanges) {
    const explanationParts = [
        `Busca (find) para <b>${labels[x]}</b> concluída.`,
        ...getPathSummaryLines(path, root)
    ];

    if (compressionChanges.length > 0) {
        const formattedChanges = formatCompressionChanges(compressionChanges);
        explanationParts.push(`Path Compression: ${formattedChanges}.`);
    } else {
        explanationParts.push('Path Compression: nenhum parent mudou, pois o caminho já estava comprimido.');
    }

    elements.explanation.innerHTML = explanationParts.join('<br>');
}

function formatCompressionChanges(compressionChanges) {
    return compressionChanges
        .map(change => `<b>${labels[change.node]}</b>: ${labels[change.previousParent]} -> ${labels[change.currentParent]}`)
        .join(', ');
}

function getPathCompressionFrame(animation, frameIndex) {
    const parent = animation.previousParent.slice();
    for (let i = 0; i < frameIndex; i++) {
        const change = animation.compressionChanges[i];
        parent[change.node] = change.currentParent;
    }
    return parent;
}

function applyParentFrame(parentFrame) {
    dsu.setParent(parentFrame);
}

function persistCompletedCompression() {
    if (!pathCompressionAnimation) return;
    if (
        !pathCompressionAnimation.persisted
        && pathCompressionAnimation.frameIndex === pathCompressionAnimation.compressionChanges.length
    ) {
        dsu.replaceSnapshot(step);
        pathCompressionAnimation.persisted = true;
    }
}

function setPathCompressionButtons() {
    const prevBtn = elements.pcPrevBtn;
    const nextBtn = elements.pcNextBtn;
    if (!prevBtn || !nextBtn) {
        setMainActionButtons();
        return;
    }

    if (!pathCompressionAnimation || pathCompressionAnimation.compressionChanges.length === 0) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        setMainActionButtons();
        return;
    }

    prevBtn.disabled = pathCompressionAnimation.frameIndex === 0;
    nextBtn.disabled = pathCompressionAnimation.frameIndex === pathCompressionAnimation.compressionChanges.length;
    setMainActionButtons();
}

function setMainActionButtons() {
    const compressionInProgress = pathCompressionAnimation
        && pathCompressionAnimation.frameIndex < pathCompressionAnimation.compressionChanges.length;

    if (elements.stepBtn) elements.stepBtn.disabled = compressionInProgress;
    if (elements.prevBtn) elements.prevBtn.disabled = compressionInProgress;
    if (elements.findBtn) elements.findBtn.disabled = compressionInProgress;
}

function clearPathCompressionAnimation() {
    pathCompressionAnimation = null;
    setPathCompressionButtons();
}

function renderPathCompressionFrame() {
    if (!pathCompressionAnimation) return;

    const animation = pathCompressionAnimation;
    const frameParent = getPathCompressionFrame(animation, animation.frameIndex);
    const previousFrameParent = animation.frameIndex > 0
        ? getPathCompressionFrame(animation, animation.frameIndex - 1)
        : null;

    applyParentFrame(frameParent);
    renderGraph(labels, frameParent, cy, previousFrameParent);
    const isSizePcMode = elements.modeSelect && elements.modeSelect.value === 'sizepc';
    const isRankPcMode = elements.modeSelect && elements.modeSelect.value === 'rankpc';
    renderStatus(
        labels,
        frameParent,
        unions,
        0,
        'status',
        'explicacao-passo',
        previousFrameParent,
        isRankPcMode ? null : dsu.getRank(),
        isSizePcMode ? null : dsu.getSizeArray()
    );
    highlightFindPath(animation.path);

    if (animation.compressionChanges.length === 0) {
        renderFindExplanation(animation.x, animation.path, animation.root, animation.compressionChanges);
    } else if (animation.frameIndex === 0) {
        elements.explanation.innerHTML = [
            `Busca (find) para <b>${labels[animation.x]}</b> preparada.`,
            ...getPathSummaryLines(animation.path, animation.root),
            'Clique em <b>Próximo Passo</b> ao lado de Buscar para aplicar a compressão.'
        ].join('<br>');
    } else if (animation.frameIndex < animation.compressionChanges.length) {
        const appliedChanges = animation.compressionChanges.slice(0, animation.frameIndex);
        elements.explanation.innerHTML = [
            `Path Compression - passo <b>${animation.frameIndex}</b> de <b>${animation.compressionChanges.length}</b>.`,
            ...getPathSummaryLines(animation.path, animation.root),
            `Parent comprimido até agora: ${formatCompressionChanges(appliedChanges)}.`
        ].join('<br>');
    } else {
        const appliedChanges = animation.compressionChanges.slice(0, animation.frameIndex);
        renderFindExplanation(animation.x, animation.path, animation.root, appliedChanges);
    }

    setPathCompressionButtons();
    persistCompletedCompression();
}

// Atualiza toda a visualização (grafo e tabela)
function updateAll(previousParentOverride = null, previousSizeOverride = null) {
    const previousParent = previousParentOverride || (step > 0 ? dsu.getHistory()[step - 1] : null);
    const rank = dsu.getRank();
    const sizeArray = dsu.getSizeArray();
    const isSizePcMode = elements.modeSelect && elements.modeSelect.value === 'sizepc';
    const isRankPcMode = elements.modeSelect && elements.modeSelect.value === 'rankpc';
    renderGraph(labels, dsu.getParent(), cy, previousParent);
    renderStatus(
        labels,
        dsu.getParent(),
        unions,
        step,
        'status',
        'explicacao-passo',
        previousParent,
        isRankPcMode ? null : rank,
        isSizePcMode ? null : sizeArray
    );

    // Renderiza a segunda tabela apenas se o modo for 'sizepc' ou 'rankpc'
    const parentSizeDiv = document.getElementById('status-parent-size');
    if (parentSizeDiv) {
        if (elements.modeSelect && elements.modeSelect.value === 'sizepc') {
            const previousSizeArray = previousSizeOverride
                || (step > 0 && dsu.history && dsu.history[step - 1] && !Array.isArray(dsu.history[step - 1])
                    ? dsu.history[step - 1].sizeArr
                    : null);
            const sizeBoldIdx = [];
            if (previousSizeArray && sizeArray) {
                const parent = dsu.getParent();
                for (let i = 0; i < sizeArray.length; i++) {
                    if (sizeArray[i] !== previousSizeArray[i] && parent[i] === i) sizeBoldIdx.push(i);
                }
            }
            parentSizeDiv.innerHTML = renderParentSizeTable(labels, dsu.getParent(), sizeArray, sizeBoldIdx);
        } else if (elements.modeSelect && elements.modeSelect.value === 'rankpc') {
            const rankBoldIdx = [];
            if (rank && dsu.history) {
                let lastChangedIdx = null;
                const upper = Math.min(step, dsu.history.length - 1);
                for (let s = 1; s <= upper; s++) {
                    const prevState = dsu.history[s - 1];
                    const currState = dsu.history[s];
                    if (!prevState || !currState || Array.isArray(prevState) || Array.isArray(currState)) continue;
                    if (!Array.isArray(prevState.rank) || !Array.isArray(currState.rank)) continue;
                    for (let i = 0; i < currState.rank.length; i++) {
                        if (currState.rank[i] !== prevState.rank[i]) {
                            lastChangedIdx = i;
                            break;
                        }
                    }
                }
                if (lastChangedIdx !== null) rankBoldIdx.push(lastChangedIdx);
            }
            parentSizeDiv.innerHTML = renderElementRankTable(labels, dsu.getParent(), rank, rankBoldIdx);
        } else {
            parentSizeDiv.innerHTML = '';
        }
    }

    renderPseudocode();
}

// Atualiza o painel de pseudocódigo com o estado atual das operações
function renderPseudocode() {
    const pcContent = document.getElementById('pc-content');
    if (!pcContent) return;

    let html = '';
    const mode = elements.modeSelect ? elements.modeSelect.value : 'naive';
    const history = dsu.history || [];

    if (step === 0) {
        html += renderInitialPseudocode(mode);
        if (unions.length > 0) {
            html += '<div class="pc-separator"></div>';
            html += renderUpcomingUnionPseudocode(mode, 0, history[0]);
        }
    } else if (step < unions.length) {
        html += renderUpcomingUnionPseudocode(mode, step, history[step]);
    } else {
        html += '<div class="pc-line pc-done" style="font-style:italic;font-size:0.82em;">Todas as unions foram executadas.</div>';
        html += '<div class="pc-separator"></div>';
        html += '<div class="pc-line pc-done" style="font-style:italic;font-size:0.82em;">// concluído</div>';
    }
    pcContent.innerHTML = html;
}

function renderInitialPseudocode(mode) {
    if (labels.length === 0) return '';

    let html = '';
    const firstLabel = labels[0];
    const lastLabel = labels[labels.length - 1];

    html += renderMakeSetBlock(firstLabel, mode);

    if (labels.length > 2) {
        html += '<div class="pc-spacer"></div>';
        html += '<div class="pc-line pc-done"><b>...</b></div>';
        html += '<div class="pc-spacer"></div>';
    }

    if (labels.length > 1) {
        html += renderMakeSetBlock(lastLabel, mode);
    }

    return html;
}

function renderMakeSetBlock(label, mode) {
    let html = `<div class="pc-line pc-done">make_set(<b>${label}</b>):</div>`;
    html += `<div class="pc-sub">parent[<b>${label}</b>] = <b>${label}</b></div>`;
    if (mode === 'sizepc') {
        html += `<div class="pc-sub">size[<b>${label}</b>] = <b>1</b></div>`;
    } else if (mode === 'rankpc') {
        html += `<div class="pc-sub">rank[<b>${label}</b>] = <b>0</b></div>`;
    }
    html += '<div class="pc-spacer"></div>';
    return html;
}

function renderUpcomingUnionPseudocode(mode, unionIndex, currentState) {
    const [u, v] = unions[unionIndex];
    const stateBefore = currentState || dsu.createState();
    const projectedState = projectUnionState(mode, stateBefore, u, v);
    const parentBefore = getParentState(stateBefore);
    const parentAfter = getParentState(projectedState);
    const rootU = pcGetRoot(parentBefore, u);
    const rootV = pcGetRoot(parentBefore, v);

    if (mode === 'sizepc') {
        return renderSizePseudocodeStep(u, v, rootU, rootV, stateBefore, projectedState);
    }
    if (mode === 'rankpc') {
        return renderRankPseudocodeStep(u, v, rootU, rootV, stateBefore, projectedState);
    }
    return renderBasicPseudocodeStep(u, v, rootU, rootV, parentAfter);
}

function projectUnionState(mode, stateBefore, u, v) {
    const config = modeConfig[mode] || modeConfig.naive;
    const projectedDSU = config.createDSU();
    projectedDSU.applyState(stateBefore);
    projectedDSU.union(u, v);
    return projectedDSU.createState();
}

// Percorre o vetor de pais sem modificar o DSU (uso exclusivo do painel)
function pcGetRoot(parent, x) {
    while (parent[x] !== x) x = parent[x];
    return x;
}

function getParentState(state) {
    return Array.isArray(state) ? state : state.parent;
}

function renderBasicPseudocodeStep(u, v, rootU, rootV, parentAfter) {
    let html = '';
    html += `<div class="pc-line pc-current">union(<b>${labels[u]}</b>, <b>${labels[v]}</b>):</div>`;
    html += `<div class="pc-sub">rx = find(<b>${labels[u]}</b>)  <span class="pc-comment">#Parent <b>${labels[rootU]}</b></span></div>`;
    html += `<div class="pc-sub">ry = find(<b>${labels[v]}</b>)  <span class="pc-comment">#Parent <b>${labels[rootV]}</b></span></div>`;
    if (rootU === rootV) {
        html += '<div class="pc-sub pc-sub-note">rx = ry (mesmo conjunto)</div>';
        return html;
    }

    html += '<div class="pc-sub">se rx ≠ ry:</div>';
    if (parentAfter && parentAfter[rootV] !== rootV) {
        html += `<div class="pc-sub pc-sub-nested">parent[<b>${labels[rootV]}</b>] = <b>${labels[rootU]}</b></div>`;
    } else if (parentAfter && parentAfter[rootU] !== rootU) {
        html += `<div class="pc-sub pc-sub-nested">parent[<b>${labels[rootU]}</b>] = <b>${labels[rootV]}</b></div>`;
    }
    return html;
}

function renderSizePseudocodeStep(u, v, rootU, rootV, previousState, currentState) {
    const prevSize = previousState && !Array.isArray(previousState) ? previousState.sizeArr : null;
    const currSize = currentState && !Array.isArray(currentState) ? currentState.sizeArr : null;
    const sizeU = prevSize ? prevSize[rootU] : null;
    const sizeV = prevSize ? prevSize[rootV] : null;
    const attachedUToV = rootU !== rootV && getParentState(currentState)[rootU] === rootV;
    const attachedVToU = rootU !== rootV && getParentState(currentState)[rootV] === rootU;

    let html = '';
    html += `<div class="pc-line pc-current">union(<b>${labels[u]}</b>, <b>${labels[v]}</b>):</div>`;
    html += `<div class="pc-sub">rx = find(<b>${labels[u]}</b>)  <span class="pc-comment">#Parent <b>${labels[rootU]}</b></span></div>`;
    html += `<div class="pc-sub">ry = find(<b>${labels[v]}</b>)  <span class="pc-comment">#Parent <b>${labels[rootV]}</b></span></div>`;
    html += `<div class="pc-sub">${rootU === rootV ? 'se rx == ry: retorna' : 'se rx == ry: retorna  <span class="pc-comment">#não</span>'}</div>`;
    if (rootU === rootV) return html;

    html += `<div class="pc-sub ${sizeU < sizeV ? 'pc-current' : ''}">se size[rx] &lt; size[ry]:  <span class="pc-comment">#${sizeU} &lt; ${sizeV}</span></div>`;
    html += `<div class="pc-sub pc-sub-nested ${attachedUToV ? 'pc-current' : ''}">parent[rx] = ry</div>`;
    html += `<div class="pc-sub pc-sub-nested ${attachedUToV ? 'pc-current' : ''}">size[ry] += size[rx]${attachedUToV && currSize ? `  <span class="pc-comment">#${currSize[rootV]}</span>` : ''}</div>`;
    html += `<div class="pc-sub ${sizeU >= sizeV ? 'pc-current' : ''}">senão:</div>`;
    html += `<div class="pc-sub pc-sub-nested ${attachedVToU ? 'pc-current' : ''}">parent[ry] = rx</div>`;
    html += `<div class="pc-sub pc-sub-nested ${attachedVToU ? 'pc-current' : ''}">size[rx] += size[ry]${attachedVToU && currSize ? `  <span class="pc-comment">#${currSize[rootU]}</span>` : ''}</div>`;
    return html;
}

function renderRankPseudocodeStep(u, v, rootU, rootV, previousState, currentState) {
    const prevRank = previousState && !Array.isArray(previousState) ? previousState.rank : null;
    const currRank = currentState && !Array.isArray(currentState) ? currentState.rank : null;
    const rankU = prevRank ? prevRank[rootU] : null;
    const rankV = prevRank ? prevRank[rootV] : null;
    const currentParent = getParentState(currentState);
    const attachedUToV = rootU !== rootV && currentParent[rootU] === rootV;
    const equalRank = rootU !== rootV && rankU === rankV;

    let html = '';
    html += `<div class="pc-line pc-current">union(<b>${labels[u]}</b>, <b>${labels[v]}</b>):</div>`;
    html += `<div class="pc-sub">rx = find(<b>${labels[u]}</b>)  <span class="pc-comment">#Parent <b>${labels[rootU]}</b></span></div>`;
    html += `<div class="pc-sub">ry = find(<b>${labels[v]}</b>)  <span class="pc-comment">#Parent <b>${labels[rootV]}</b></span></div>`;
    html += `<div class="pc-sub">${rootU === rootV ? 'se rx == ry: retorna' : 'se rx == ry: retorna  <span class="pc-comment">#não</span>'}</div>`;
    if (rootU === rootV) return html;

    html += `<div class="pc-sub ${rankU < rankV ? 'pc-current' : ''}">se rank[rx] &lt; rank[ry]:  <span class="pc-comment">#${rankU} &lt; ${rankV}</span></div>`;
    html += `<div class="pc-sub pc-sub-nested ${rankU < rankV ? 'pc-current' : ''}">parent[rx] = ry</div>`;
    html += `<div class="pc-sub ${rankU > rankV ? 'pc-current' : ''}">senão se rank[rx] &gt; rank[ry]:  <span class="pc-comment">#${rankU} &gt; ${rankV}</span></div>`;
    html += `<div class="pc-sub pc-sub-nested ${rankU > rankV ? 'pc-current' : ''}">parent[ry] = rx</div>`;
    html += `<div class="pc-sub ${equalRank ? 'pc-current' : ''}">senão:</div>`;
    html += `<div class="pc-sub pc-sub-nested ${equalRank && attachedUToV ? 'pc-current' : ''}">parent[rx] = ry</div>`;
    html += `<div class="pc-sub pc-sub-nested ${equalRank && attachedUToV ? 'pc-current' : ''}">rank[ry]++${equalRank && attachedUToV && currRank ? `  <span class="pc-comment">#${currRank[rootV]}</span>` : ''}</div>`;
    return html;
}

// Troca o modo do DSU conforme o drop-down
function setDSUMode(mode) {
    clearPathCompressionAnimation();
    // Limpa destaques amarelos dos nós ao trocar o modo
    cy.nodes().removeClass('find-path');
    const config = modeConfig[mode] || modeConfig.naive;
    unions = config.unions;
    labels = config.labels;
    dsu = config.createDSU();
    step = 0;
    cy = createGraph(elements.cy, labels);
    updateAll();
    // Exibe ou esconde campo de busca conforme o modo
    if (elements.findBox) {
        if (config.hasPathCompression) {
            elements.findBox.classList.remove('d-none');
            elements.findBox.classList.add('d-flex');
        } else {
            elements.findBox.classList.remove('d-flex');
            elements.findBox.classList.add('d-none');
        }
    }
}


// Inicializa a visualização e modo
if (elements.modeSelect) {
    elements.modeSelect.onchange = function () {
        setDSUMode(this.value);
    };
}
setDSUMode(elements.modeSelect ? elements.modeSelect.value : 'naive');

function nextUnionStep() {
    if (step < unions.length) {
        clearPathCompressionAnimation();
        const previousParent = dsu.getParent();
        const previousSizeArray = dsu.getSizeArray();
        let [u, v] = unions[step];
        dsu.union(u, v);
        step++;
        dsu.snapshot();
        updateAll(previousParent, previousSizeArray);
    }
}

function previousUnionStep() {
    if (step > 0) {
        clearPathCompressionAnimation();
        step--;
        dsu.restore(step);
        cy.nodes().removeClass('find-path');
        updateAll();
    }
}

function resetUnionSteps() {
    clearPathCompressionAnimation();
    step = 0;
    dsu.reset();
    cy.nodes().removeClass('find-path');
    updateAll();
}

async function toggleFullscreen() {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (error) {
        alert('Não foi possível alternar para tela cheia neste navegador.');
    }
}

function runFind() {
    let x = parseInt(elements.findInput.value, 10);
    if (isNaN(x) || x < 0 || x >= labels.length) {
        alert('Selecione um nó válido.');
        return;
    }
    const previousParent = dsu.getParent();
    const path = getFindPath(x);
    const root = path[path.length - 1];
    const compressionChanges = getPathCompressionChanges(path, previousParent, root);
    pathCompressionAnimation = {
        x,
        path,
        root,
        previousParent,
        compressionChanges,
        frameIndex: compressionChanges.length > 0 ? 0 : compressionChanges.length,
        persisted: false
    };
    renderPathCompressionFrame();
}

function previousCompressionStep() {
    if (!pathCompressionAnimation || pathCompressionAnimation.frameIndex === 0) return;
    pathCompressionAnimation.frameIndex--;
    renderPathCompressionFrame();
}

function nextCompressionStep() {
    if (!pathCompressionAnimation) return;
    if (pathCompressionAnimation.frameIndex < pathCompressionAnimation.compressionChanges.length) {
        pathCompressionAnimation.frameIndex++;
        renderPathCompressionFrame();
    }
}

function bindClick(element, handler) {
    if (element) element.onclick = handler;
}

bindClick(elements.stepBtn, nextUnionStep);
bindClick(elements.prevBtn, previousUnionStep);
bindClick(elements.resetBtn, resetUnionSteps);
bindClick(elements.findBtn, runFind);
bindClick(elements.pcPrevBtn, previousCompressionStep);
bindClick(elements.pcNextBtn, nextCompressionStep);

if (elements.fullscreenBtn) {
    bindClick(elements.fullscreenBtn, toggleFullscreen);
    document.addEventListener('fullscreenchange', function () {
        elements.fullscreenBtn.textContent = document.fullscreenElement ? 'Sair da Tela Cheia' : 'Tela Cheia';
    });
}
