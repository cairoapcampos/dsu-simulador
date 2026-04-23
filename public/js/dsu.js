// dsu.js
// Implementa a estrutura Disjoint Set Union (Union-Find) pura, sem dependências de visualização ou interface.
// Fornece métodos para união, busca, restauração de estados e histórico de operações.

/**
 * Classe DisjointSetUnion
 * Representa a estrutura de dados Union-Find (DSU).
 */
export class DisjointSetUnion {
    /**
     * Cria uma nova instância do DSU.
     * @param {number} size - Número de elementos
     */
    constructor(size) {
        this.size = size;
        this.parent = Array.from({ length: size }, (_, i) => i);
        this._initExtraArrays();
        this.history = [this._createFullState()];
    }

    /**
     * Encontra o representante do conjunto de x.
     * @param {number} x
     * @returns {number}
     */
    find(x) {
        while (this.parent[x] !== x) x = this.parent[x];
        return x;
    }

    /**
     * Une os conjuntos de u e v.
     * @param {number} u
     * @param {number} v
     */
    union(u, v) {
        u = this.find(u);
        v = this.find(v);
        if (u !== v) this.parent[v] = u;
    }

    /**
     * Cria uma cópia do estado atual para o histórico.
     * @returns {{parent: number[]}}
     */
    // Para subclasses: sobrescreva este método para inicializar arrays extras
    _initExtraArrays() { }

    // Para subclasses: sobrescreva para informar campos extras a salvar/restaurar
    _getStateFields() { return []; }

    // Cria um snapshot completo do estado (parent + extras)
    _createFullState() {
        const state = { parent: this.parent.slice() };
        for (const field of this._getStateFields()) {
            state[field] = this[field].slice();
        }
        return state;
    }

    // Aplica um snapshot completo do estado
    _applyFullState(state) {
        this.parent = state.parent.slice();
        for (const field of this._getStateFields()) {
            this[field] = state[field].slice();
        }
    }

    createState() {
        return this._createFullState();
    }

    /**
     * Aplica um estado salvo anteriormente.
     * @param {{parent: number[]} | number[]} state
     */
    applyState(state) {
        // Suporte legado: se for array, só parent
        if (Array.isArray(state)) {
            this.parent = state.slice();
        } else {
            this._applyFullState(state);
        }
    }

    /**
     * Restaura o estado do DSU para um passo anterior.
     * @param {number} stepIdx
     */
    restore(stepIdx) {
        this.applyState(this.history[stepIdx]);
    }

    /**
     * Salva o estado atual no histórico.
     */
    snapshot() {
        this.history.push(this.createState());
    }

    /**
     * Substitui um estado existente do histórico pelo estado atual.
     * @param {number} stepIdx
     */
    replaceSnapshot(stepIdx) {
        if (stepIdx < 0 || stepIdx >= this.history.length) return;
        this.history[stepIdx] = this.createState();
    }

    /**
     * Reseta o DSU para o estado inicial.
     */
    reset() {
        this.parent = Array.from({ length: this.size }, (_, i) => i);
        this._initExtraArrays();
        this.history = [this._createFullState()];
    }

    /**
     * Retorna o vetor de pais atual.
     * @returns {number[]}
     */
    getParent() {
        return this.parent.slice();
    }

    /**
     * Aplica um novo vetor de pais ao DSU.
     * @param {number[]} parent
     */
    setParent(parent) {
        if (!Array.isArray(parent) || parent.length !== this.size) {
            throw new Error(`Vetor parent inválido: esperado array com ${this.size} posições.`);
        }
        this.parent = parent.slice();
    }
    /**
     * Retorna o histórico de estados do DSU.
     * @returns {number[][]}
     */
    getHistory() {
        return this.history.map(state => (Array.isArray(state) ? state : state.parent).slice());
    }

    /**
     * Retorna os ranks quando a variação do DSU usa rank.
     * @returns {number[] | null}
     */
    getRank() {
        return null;
    }

    /**
     * Retorna os tamanhos quando a variação do DSU usa size.
     * @returns {number[] | null}
     */
    getSizeArray() {
        return null;
    }
}

/**
 * DSU com Union by Size
 */
export class DisjointSetUnionBySize extends DisjointSetUnion {
    _initExtraArrays() {
        this.sizeArr = Array(this.size).fill(1);
    }
    _getStateFields() { return ['sizeArr']; }
    union(u, v) {
        u = this.find(u);
        v = this.find(v);
        if (u === v) return;
        if (this.sizeArr[u] < this.sizeArr[v]) {
            this.parent[u] = v;
            this.sizeArr[v] += this.sizeArr[u];
        } else if (this.sizeArr[u] > this.sizeArr[v]) {
            this.parent[v] = u;
            this.sizeArr[u] += this.sizeArr[v];
        } else {
            // Empate: raiz do primeiro argumento fica abaixo da raiz do segundo
            this.parent[u] = v;
            this.sizeArr[v] += this.sizeArr[u];
        }
    }
    getSizeArray() {
        return this.sizeArr.slice();
    }
}

/**
 * DSU com Union by Rank
 */
export class DisjointSetUnionByRank extends DisjointSetUnion {
    _initExtraArrays() {
        this.rank = Array(this.size).fill(0);
    }
    _getStateFields() { return ['rank']; }
    union(u, v) {
        u = this.find(u);
        v = this.find(v);
        if (u === v) return;
        if (this.rank[u] < this.rank[v]) {
            this.parent[u] = v;
        } else if (this.rank[u] > this.rank[v]) {
            this.parent[v] = u;
        } else {
            // Empate: raiz do primeiro argumento fica abaixo da raiz do segundo
            this.parent[u] = v;
            this.rank[v]++;
        }
    }
    getRank() {
        return this.rank.slice();
    }
}


// Mixin para Path Compression
const PathCompression = {
    find(x) {
        if (this.parent[x] !== x) {
            this.parent[x] = this.find(this.parent[x]);
        }
        return this.parent[x];
    }
};

/**
 * DSU com Union by Size + Path Compression
 */
export class DisjointSetUnionBySizePathCompression extends DisjointSetUnionBySize { }
Object.assign(DisjointSetUnionBySizePathCompression.prototype, PathCompression);

/**
 * DSU com Union by Rank + Path Compression
 */
export class DisjointSetUnionByRankPathCompression extends DisjointSetUnionByRank { }
Object.assign(DisjointSetUnionByRankPathCompression.prototype, PathCompression);

/**
 * DSU com apenas Path Compression (sem Union by Size/Rank)
 */
export class DisjointSetUnionPathCompression extends DisjointSetUnion {
    /**
     * Find sem compressão de caminho (uso didático no union).
     * @param {number} x
     * @returns {number}
     */
    findNoCompression(x) {
        while (this.parent[x] !== x) x = this.parent[x];
        return x;
    }

    /**
     * União ingênua sem disparar compressão de caminho.
     * (A compressão fica visível apenas quando o usuário executa find.)
     * @param {number} u
     * @param {number} v
     */
    union(u, v) {
        u = this.findNoCompression(u);
        v = this.findNoCompression(v);
        if (u !== v) this.parent[v] = u;
    }
}
Object.assign(DisjointSetUnionPathCompression.prototype, PathCompression);
