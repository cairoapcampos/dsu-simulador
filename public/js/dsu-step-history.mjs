export function truncateFutureHistory(dsu, step) {
    if (!dsu || !Array.isArray(dsu.history)) return;
    const keepLength = step + 1;
    if (dsu.history.length > keepLength) {
        dsu.history = dsu.history.slice(0, keepLength);
    }
}

export function advanceUnionWithHistory(dsu, step, unions) {
    truncateFutureHistory(dsu, step);
    const [u, v] = unions[step];
    dsu.union(u, v);
    dsu.snapshot();
    return step + 1;
}
