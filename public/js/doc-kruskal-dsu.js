import { DisjointSetUnionByRankPathCompression } from './dsu.js';

const labels = ['A', 'B', 'C', 'D', 'E'];
const positions = {
    A: { x: 70, y: 70 },
    B: { x: 220, y: 70 },
    C: { x: 370, y: 70 },
    D: { x: 70, y: 240 },
    E: { x: 330, y: 240 }
};

const edges = [
    { id: 'AB', source: 'A', target: 'B', weight: 1 },
    { id: 'BC', source: 'B', target: 'C', weight: 2 },
    { id: 'AD', source: 'A', target: 'D', weight: 3 },
    { id: 'DE', source: 'D', target: 'E', weight: 4 },
    { id: 'BE', source: 'B', target: 'E', weight: 5 },
    { id: 'CE', source: 'C', target: 'E', weight: 6 }
];

const componentPalette = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa'];

function createElements() {
    const nodeElements = labels.map((label) => ({
        data: { id: label, label }
    }));

    const edgeElements = edges.map((edge) => ({
        data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: String(edge.weight),
            weight: edge.weight
        }
    }));

    return [...nodeElements, ...edgeElements];
}

function createGraph(container) {
    return cytoscape({
        container,
        elements: createElements(),
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#93c5fd',
                    'label': 'data(label)',
                    'color': '#111827',
                    'font-size': 22,
                    'font-weight': 'bold',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'border-width': 3,
                    'border-color': '#1e3a8a',
                    'width': 54,
                    'height': 54
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 4,
                    'line-color': '#94a3b8',
                    'curve-style': 'bezier',
                    'label': 'data(label)',
                    'font-size': 16,
                    'font-weight': 'bold',
                    'color': '#0f172a',
                    'text-background-color': '#ffffff',
                    'text-background-opacity': 1,
                    'text-background-padding': 3
                }
            },
            {
                selector: '.current-edge',
                style: {
                    'line-color': '#f59e0b',
                    'width': 7
                }
            },
            {
                selector: '.accepted-edge',
                style: {
                    'line-color': '#16a34a',
                    'width': 7
                }
            },
            {
                selector: '.rejected-edge',
                style: {
                    'line-color': '#dc2626',
                    'line-style': 'dashed',
                    'width': 6
                }
            }
        ],
        layout: {
            name: 'preset',
            positions
        }
    });
}

function buildSnapshots() {
    const dsu = new DisjointSetUnionByRankPathCompression(labels.length);
    const snapshots = [];

    snapshots.push({
        step: 0,
        currentEdge: null,
        parent: dsu.getParent(),
        rank: dsu.getRank(),
        accepted: [],
        rejected: [],
        mstWeight: 0,
        message: 'Estado inicial: as arestas já estão ordenadas por peso crescente e cada vértice começa em seu próprio conjunto.'
    });

    edges.forEach((edge, index) => {
        const sourceIndex = labels.indexOf(edge.source);
        const targetIndex = labels.indexOf(edge.target);
        const sourceRoot = dsu.find(sourceIndex);
        const targetRoot = dsu.find(targetIndex);
        const accepted = sourceRoot !== targetRoot;

        if (accepted) {
            dsu.union(sourceIndex, targetIndex);
        }

        const previous = snapshots[snapshots.length - 1];
        const acceptedEdges = accepted ? [...previous.accepted, edge.id] : [...previous.accepted];
        const rejectedEdges = accepted ? [...previous.rejected] : [...previous.rejected, edge.id];

        snapshots.push({
            step: index + 1,
            currentEdge: edge.id,
            parent: dsu.getParent(),
            rank: dsu.getRank(),
            accepted: acceptedEdges,
            rejected: rejectedEdges,
            mstWeight: previous.mstWeight + (accepted ? edge.weight : 0),
            decision: accepted ? 'accepted' : 'rejected',
            details: {
                edge,
                sourceRoot: labels[sourceRoot],
                targetRoot: labels[targetRoot]
            },
            message: accepted
                ? `A aresta (${edge.source}, ${edge.target}, ${edge.weight}) foi aceita, pois ${edge.source} e ${edge.target} estavam em componentes distintos.`
                : `A aresta (${edge.source}, ${edge.target}, ${edge.weight}) foi descartada, pois ${edge.source} e ${edge.target} já pertenciam ao mesmo componente.`
        });
    });

    return snapshots;
}

function getRoot(parent, idx) {
    while (parent[idx] !== idx) idx = parent[idx];
    return idx;
}

function getComponents(parent) {
    const groups = new Map();

    labels.forEach((label, idx) => {
        const root = getRoot(parent, idx);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(label);
    });

    return Array.from(groups.values());
}

function applySnapshot(cy, snapshot) {
    cy.nodes().forEach((node) => {
        const idx = labels.indexOf(node.id());
        const root = getRoot(snapshot.parent, idx);
        const rootOrder = Array.from(new Set(labels.map((_, index) => getRoot(snapshot.parent, index))));
        const color = componentPalette[rootOrder.indexOf(root) % componentPalette.length];
        node.style('background-color', color);
    });

    cy.edges().removeClass('current-edge accepted-edge rejected-edge');
    snapshot.accepted.forEach((edgeId) => cy.getElementById(edgeId).addClass('accepted-edge'));
    snapshot.rejected.forEach((edgeId) => cy.getElementById(edgeId).addClass('rejected-edge'));
    if (snapshot.currentEdge) cy.getElementById(snapshot.currentEdge).addClass('current-edge');
}

function formatEdgeList(edgeIds) {
    if (!edgeIds.length) return 'nenhuma aresta aceita ainda';
    return edgeIds
        .map((edgeId) => {
            const edge = edges.find((item) => item.id === edgeId);
            return `(${edge.source}, ${edge.target}, ${edge.weight})`;
        })
        .join(', ');
}

function renderStatus(snapshot, totalSteps) {
    const statusDiv = document.getElementById('kruskal-status');
    const components = getComponents(snapshot.parent);
    const rankLine = labels
        .map((label, idx) => `${label}: ${snapshot.parent[idx] === idx ? snapshot.rank[idx] : '-'}`)
        .join(' | ');

    const operationInfo = snapshot.details
        ? `
            <div class="kruskal-status-block">
                <strong>Aresta analisada:</strong>
                <span class="kruskal-inline-code">(${snapshot.details.edge.source}, ${snapshot.details.edge.target}, ${snapshot.details.edge.weight})</span><br>
                <strong>find(${snapshot.details.edge.source})</strong> retorna <span class="kruskal-inline-code">${snapshot.details.sourceRoot}</span><br>
                <strong>find(${snapshot.details.edge.target})</strong> retorna <span class="kruskal-inline-code">${snapshot.details.targetRoot}</span><br>
                <strong>Decisão:</strong>
                <span class="${snapshot.decision === 'accepted' ? 'kruskal-accepted' : 'kruskal-rejected'}">
                    ${snapshot.decision === 'accepted' ? 'aceitar a aresta' : 'descartar a aresta'}
                </span>
            </div>
            <div class="kruskal-status-block">
                <strong>Operação aplicada:</strong>
                ${snapshot.decision === 'accepted'
                    ? `<span class="kruskal-inline-code">union(${snapshot.details.edge.source}, ${snapshot.details.edge.target})</span>`
                    : '<span>nenhuma união é realizada, pois a aresta formaria ciclo</span>'}
            </div>
        `
        : `
            <div class="kruskal-status-block">
                <strong>Próxima aresta:</strong>
                <span class="kruskal-inline-code">(${edges[0].source}, ${edges[0].target}, ${edges[0].weight})</span>
            </div>
            <div class="kruskal-status-block">
                <strong>Operação esperada:</strong>
                <span>avaliar a aresta, executar <span class="kruskal-inline-code">find</span> nos dois extremos e decidir se haverá <span class="kruskal-inline-code">union</span></span>
            </div>
        `;

    const componentsList = components
        .map((group) => `<li>{${group.join(', ')}}</li>`)
        .join('');

    statusDiv.innerHTML = `
        <div class="kruskal-step-badge">Passo ${snapshot.step} de ${totalSteps}</div>
        <div class="kruskal-status-block">${snapshot.message}</div>
        ${operationInfo}
        <div class="kruskal-status-block">
            <strong>Componentes atuais:</strong>
            <ul class="kruskal-list">${componentsList}</ul>
        </div>
        <div class="kruskal-status-block">
            <strong>Representação da DSU (parent):</strong>
            <span class="kruskal-inline-code">${labels.map((label, idx) => `${label}->${labels[snapshot.parent[idx]]}`).join(' | ')}</span>
        </div>
        <div class="kruskal-status-block">
            <strong>Rank armazenado nas raízes:</strong>
            <span class="kruskal-inline-code">${rankLine}</span>
        </div>
        <div class="kruskal-status-block">
            <strong>Arestas da MST até agora:</strong>
            <span>${formatEdgeList(snapshot.accepted)}</span>
        </div>
        <div class="kruskal-status-block">
            <strong>Custo acumulado:</strong>
            <span class="kruskal-inline-code">${snapshot.mstWeight}</span>
        </div>
    `;
}

function main() {
    const container = document.getElementById('kruskal-cy');
    if (!container || typeof cytoscape === 'undefined') return;

    const cy = createGraph(container);
    const snapshots = buildSnapshots();
    const totalSteps = snapshots.length - 1;
    let currentStep = 0;

    const prevBtn = document.getElementById('kruskalPrevBtn');
    const nextBtn = document.getElementById('kruskalNextBtn');
    const resetBtn = document.getElementById('kruskalResetBtn');

    function sync() {
        applySnapshot(cy, snapshots[currentStep]);
        renderStatus(snapshots[currentStep], totalSteps);
        prevBtn.disabled = currentStep === 0;
        nextBtn.disabled = currentStep === totalSteps;
    }

    prevBtn.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep -= 1;
            sync();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentStep < totalSteps) {
            currentStep += 1;
            sync();
        }
    });

    resetBtn.addEventListener('click', () => {
        currentStep = 0;
        sync();
    });

    sync();
}

main();
