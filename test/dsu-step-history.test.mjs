import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceUnionWithHistory, truncateFutureHistory } from '../public/js/dsu-step-history.mjs';

class FakeDSU {
    constructor() {
        this.parent = ['s0'];
        this.history = [this.parent.slice()];
    }

    union(u, v) {
        this.parent = [`${u}-${v}`];
    }

    snapshot() {
        this.history.push(this.parent.slice());
    }

    restore(step) {
        this.parent = this.history[step].slice();
    }
}

test('truncateFutureHistory remove estados futuros apos desfazer', () => {
    const dsu = new FakeDSU();
    dsu.history = [['s0'], ['s1'], ['s2'], ['s3']];

    truncateFutureHistory(dsu, 1);

    assert.deepEqual(dsu.history, [['s0'], ['s1']]);
});

test('advanceUnionWithHistory descarta o futuro antes de avancar de novo', () => {
    const dsu = new FakeDSU();
    const unions = [
        ['a', 'b'],
        ['c', 'd'],
        ['e', 'f']
    ];

    let step = 0;
    step = advanceUnionWithHistory(dsu, step, unions);
    step = advanceUnionWithHistory(dsu, step, unions);
    step = advanceUnionWithHistory(dsu, step, unions);

    assert.equal(step, 3);
    assert.deepEqual(dsu.history, [['s0'], ['a-b'], ['c-d'], ['e-f']]);

    step--;
    dsu.restore(step);
    assert.deepEqual(dsu.parent, ['c-d']);

    step--;
    dsu.restore(step);
    assert.deepEqual(dsu.parent, ['a-b']);

    step = advanceUnionWithHistory(dsu, step, unions);

    assert.equal(step, 2);
    assert.deepEqual(dsu.history, [['s0'], ['a-b'], ['c-d']]);

    step--;
    dsu.restore(step);
    assert.deepEqual(dsu.parent, ['a-b']);
});
