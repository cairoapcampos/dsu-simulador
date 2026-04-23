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
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [4, 0], [6, 4]
];
// Ordem e direção conforme especificação e regra de empate:
// union(B, A) => [1, 0]
// union(D, C) => [3, 2]
// union(F, E) => [5, 4]
// union(H, G) => [7, 6]
// union(C, A) => [2, 0]
// union(A, E) => [0, 4]
// union(E, G) => [4, 6]
const optimizedUnions = [
    [1, 0], // B, A
    [3, 2], // D, C
    [5, 4], // F, E
    [7, 6], // H, G
    [2, 0], // C, A
    [0, 4], // A, E
    [4, 6]  // E, G
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
