// Renderiza uma tabela enxuta: apenas Parent e Size (raízes), sem linha de Nó Comum
export function renderParentSizeTable(labels, parent, sizeArray, boldIdx = []) {
    let table = '<table class="status-table">';
    // Primeira linha: cabeçalho com os labels dos elementos
    table += renderRow('Conjunto', labels, []);
    // Segunda linha: Size (raízes), alinhado aos elementos, com texto na primeira célula
    if (sizeArray) {
        table += renderRow('Size', sizeArray.map((value, idx) => parent[idx] === idx ? value : '-'), boldIdx);
    }
    table += '</table>';
    return table;
}

// Renderiza uma tabela enxuta: Nó Comum e Rank (raízes)
export function renderElementRankTable(labels, parent, rankArray, boldIdx = []) {
    let table = '<table class="status-table">';
    table += renderRow('Conjunto', labels, []);
    if (rankArray) {
        table += renderRow('Rank', rankArray.map((value, idx) => parent[idx] === idx ? value : '-'), boldIdx);
    }
    table += '</table>';
    return table;
}
// dsu-visual.js
// Funções de visualização para o DSU: desenha o grafo e a tabela de status/passos.
// Não contém lógica de controle nem manipulação direta do DSU, apenas visualização.

const GRAPH_LAYOUT = {
    treeWidth: 660,
    rootStartX: 70,
    rootY: 60,
    levelGap: 82,
    childGap: 62
};

export function createGraph(container, labels) {
    return cytoscape({
        container,
        elements: labels.map(l => ({ data: { id: l } })),
        style: [
            {
                selector: 'node', style: {
                    'background-color': 'limegreen',
                    'label': 'data(id)',
                    'color': '#111',
                    'font-size': 22,
                    'font-weight': 'bold',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'border-width': 3,
                    'border-color': '#fff',
                    'width': 48,
                    'height': 48
                }
            },
            {
                selector: '.root-highlight', style: {
                    'border-width': 6,
                    'border-color': '#111',
                }
            },
            {
                selector: 'edge', style: {
                    'width': 3,
                    'line-color': '#111',
                    'target-arrow-color': '#111',
                    'target-arrow-shape': 'triangle',
                    'arrow-scale': 1.25,
                    'curve-style': 'bezier'
                }
            },
            {
                selector: '.gray-edge', style: {
                    'line-color': '#bbb',
                    'target-arrow-color': '#bbb'
                }
            },
            {
                selector: '.find-path', style: {
                    'background-color': 'yellow',
                    'border-color': '#ff0',
                    'border-width': 6
                }
            }
        ],
        layout: { name: 'preset', positions: {} }
    });
}

/**
 * Renderiza o grafo do DSU usando Cytoscape.
 * Destaca em cinza as setas cujo parent foi alterado pela operação atual.
 * @param {string[]} labels - Nomes dos nós
 * @param {number[]} parent - Vetor de pais do DSU
 * @param {object} cy - Instância do Cytoscape
 * @param {number[] | null} previousParent - Vetor de pais antes do passo atual
 */
export function renderGraph(labels, parent, cy, previousParent = null) {
    cy.elements('edge').remove();
    for (let i = 0; i < labels.length; ++i) {
        if (parent[i] !== i) {
            cy.add({ data: { id: labels[i] + labels[parent[i]], source: labels[i], target: labels[parent[i]] } });
        }
    }
    // Destaca as setas criadas ou alteradas pela operação atual.
    cy.edges().removeClass('gray-edge');
    const changedNodes = getChangedNodes(parent, previousParent);
    changedNodes.forEach(node => {
        if (parent[node] !== node) {
            const edgeId = labels[node] + labels[parent[node]];
            const edge = cy.getElementById(edgeId);
            if (edge) edge.addClass('gray-edge');
        }
    });
    let roots = [];
    for (let i = 0; i < labels.length; ++i) if (parent[i] === i) roots.push(i);
    let pos = {};
    let treeSpacing = GRAPH_LAYOUT.treeWidth / roots.length;
    roots.forEach((root, idx) => {
        let x = GRAPH_LAYOUT.rootStartX + idx * treeSpacing;
        let y = GRAPH_LAYOUT.rootY;
        pos[labels[root]] = { x, y };
        let queue = [{ node: root, px: x, py: y }];
        while (queue.length) {
            let { node, px, py } = queue.shift();
            let children = [];
            for (let i = 0; i < labels.length; ++i) if (parent[i] === node && i !== node) children.push(i);
            let startX = px - ((children.length - 1) / 2) * GRAPH_LAYOUT.childGap;
            children.forEach((child, j) => {
                let cx = startX + j * GRAPH_LAYOUT.childGap;
                let cy = py + GRAPH_LAYOUT.levelGap;
                pos[labels[child]] = { x: cx, y: cy };
                queue.push({ node: child, px: cx, py: cy });
            });
        }
    });
    labels.forEach(l => {
        cy.getElementById(l).position(pos[l]);
    });
    cy.layout({ name: 'preset', positions: pos, animate: true, animationDuration: 400 }).run();
    cy.nodes().removeClass('root-highlight');
    for (let i = 0; i < labels.length; ++i) {
        if (parent[i] === i) {
            cy.getElementById(labels[i]).addClass('root-highlight');
        }
    }
}

/**
 * Renderiza a tabela de status dos conjuntos e a explicação do passo atual.
 * @param {string[]} labels - Nomes dos nós
 * @param {number[]} parent - Vetor de pais do DSU
 * @param {Array} unions - Lista de uniões
 * @param {number} step - Passo atual
 * @param {string} containerId - ID do container da tabela
 * @param {string} explicacaoId - ID do container da explicação
 * @param {number[] | null} previousParent - Vetor de pais antes do passo atual
 * @param {number[] | null} rank - Vetor de ranks do DSU
 * @param {number[] | null} sizeArray - Vetor de tamanhos do DSU
 */
export function renderStatus(labels, parent, unions, step, containerId = 'status', explicacaoId = 'explicacao-passo', previousParent = null, rank = null, sizeArray = null) {
    const boldIdx = getChangedNodes(parent, previousParent);
    const table = renderStatusTable(labels, parent, boldIdx, rank, sizeArray);
    const statusDiv = document.getElementById(containerId);
    if (statusDiv) statusDiv.innerHTML = table;

    const explicacao = renderStepExplanation(labels, parent, unions, step, boldIdx, previousParent);
    const expDiv = document.getElementById(explicacaoId);
    if (expDiv) expDiv.innerHTML = explicacao;
}

	function renderStatusTable(labels, parent, boldIdx, rank, sizeArray) {
	    const metadata = rank || sizeArray;
	    const metadataLabel = rank ? 'Rank (raízes)' : 'Size (raízes)';
	    let table = '<table class="status-table">';
	    table += renderRow('Parent', parent.map(parentIdx => labels[parentIdx]), boldIdx);
	    table += renderRow('Nó Comum', labels, boldIdx);

	    if (metadata) {
	        table += renderRow(metadataLabel, metadata.map((value, idx) => parent[idx] === idx ? value : '-'), boldIdx);
	    }
	    table += '</table>';
    return table;
}

function renderStepExplanation(labels, parent, unions, step, boldIdx, previousParent) {
    if (step === 0) {
        return 'Clique em "Próximo Passo" para iniciar as uniões.';
    }

    if (step > unions.length) {
        return 'Todas as uniões foram realizadas.';
    }

    const [u, v] = unions[step - 1];
    const repParent = previousParent || parent;
    const uRep = getRoot(repParent, u);
    const vRep = getRoot(repParent, v);
    if (boldIdx.length === 0) {
        return `Nenhuma alteração: ${labels[vRep]} já estava no conjunto de ${labels[uRep]}.`;
    }

    const changes = boldIdx
        .map(node => `<b>${labels[node]}</b> -> <b>${labels[parent[node]]}</b>`)
        .join(', ');
    const root = getRoot(parent, uRep);

    return [
        `Após unir <b>${labels[uRep]}</b> e <b>${labels[vRep]}</b>, parent atualizado: ${changes}.`,
        `Conjunto resultante: {${getSetMembers(labels, parent, root)}}.`
    ].join('<br>');
}

function renderRow(label, values, boldIdx) {
    const cells = values
        .map((value, idx) => renderCell(value, boldIdx.includes(idx)))
        .join('');
    return `<tr>${renderCell(label, true)}${cells}</tr>`;
}

function renderCell(value, bold = false) {
    const highlightClass = bold ? ' status-cell-highlight' : '';
    return `<td class="status-cell${highlightClass}">${value}</td>`;
}

function getChangedNodes(parent, previousParent) {
    if (!previousParent) return [];
    let changedNodes = [];
    for (let i = 0; i < parent.length; ++i) {
        if (previousParent[i] !== parent[i]) changedNodes.push(i);
    }
    return changedNodes;
}

function getSetMembers(labels, parent, rootIdx) {
    let members = [];
    for (let i = 0; i < parent.length; ++i) {
        if (getRoot(parent, i) === rootIdx) members.push(labels[i]);
    }
    return members.join(', ');
}

function getRoot(parent, idx) {
    let root = idx;
    while (parent[root] !== root) root = parent[root];
    return root;
}
