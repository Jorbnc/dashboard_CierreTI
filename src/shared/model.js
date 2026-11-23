/* Financial windows are explicit: analysis month never changes the source cutoff. */
(() => {
  'use strict';
  function sum(values) {
    if (!values.every(Number.isFinite)) throw new Error('Importe ausente en el período solicitado');
    return values.reduce((total, value) => total + value, 0);
  }
  const ratio = (value, base) => base > 0 ? 100 * value / base : null;
  const relative = (value, base) => base === null ? null : ratio(value - base, base);
  function metrics(series, month, cutoff) {
    for (const key of ['actual', 'forecast', 'budget']) {
      if (!Array.isArray(series[key]) || series[key].length !== 12) throw new Error('Serie anual incompleta');
    }
    if (series.prior !== null && (!Array.isArray(series.prior) || series.prior.length !== 12)) throw new Error('Serie histórica incompleta');
    if (!Number.isInteger(month) || !Number.isInteger(cutoff) || month < 1 || month > cutoff || cutoff > 12) {
      throw new Error('Mes fuera del cierre disponible');
    }
    const actualYtd = sum(series.actual.slice(0, month));
    const budgetYtd = sum(series.budget.slice(0, month));
    const actualAtCutoff = sum(series.actual.slice(0, cutoff));
    const budgetAtCutoff = sum(series.budget.slice(0, cutoff));
    const future = sum(series.forecast.slice(cutoff));
    const budgetFuture = sum(series.budget.slice(cutoff));
    const budgetYear = sum(series.budget);
    return {
      actualMonth: series.actual[month - 1], budgetMonth: series.budget[month - 1],
      actualYtd, budgetYtd, actualAtCutoff, budgetAtCutoff, future, budgetFuture,
      forecastYear: actualAtCutoff + future, budgetYear,
      executedDelta: actualAtCutoff - budgetAtCutoff, projectedDelta: future - budgetFuture,
      available: budgetYear - actualAtCutoff,
      usage: ratio(actualYtd, budgetYear), expected: ratio(budgetYtd, budgetYear),
      priorYtd: series.prior ? sum(series.prior.slice(0, month)) : null,
      priorYear: series.prior ? sum(series.prior) : null,
    };
  }
  function comparison(m, mode) {
    const [actual, budget] = mode === 'month' ? [m.actualMonth, m.budgetMonth]
      : mode === 'annual' ? [m.forecastYear, m.budgetYear] : [m.actualYtd, m.budgetYtd];
    return {actual, budget, delta: actual - budget, percent: relative(actual, budget)};
  }
  // Every selected member is a validated leaf. Add amounts before computing any ratio.
  function portfolioCurrencies(data, scope) {
    const leaves = data.choices[scope].map(key => data.members[key].currencies);
    return Object.fromEntries(Object.keys(leaves[0]).filter(unit => leaves.every(leaf => leaf[unit]))
      .map(unit => [unit, mergeCurrency(unit, leaves.map(leaf => leaf[unit]))]));
  }
  function mergeCurrency(unit, units) {
    if (units.length === 1) return units[0];
    const merge = series => Object.fromEntries(['actual', 'forecast', 'budget', 'prior'].map(key => [
      key, key === 'prior' && series.some(s => !s.prior) ? null : Array.from({length: 12}, (_, i) => {
        const values = series.map(s => s[key][i]);
        return values.every(v => v === null) ? null : sum(values);
      })
    ]));
    const detailedPrior = units.every(u => Object.values(u.types).every(g => g.rows.every(r => r.series.prior)));
    const types = {};
    for (const kind of new Set(units.flatMap(u => Object.keys(u.types)))) {
      const groups = units.map(u => u.types[kind]).filter(Boolean);
      const categories = new Map();
      for (const r of groups.flatMap(g => g.rows)) {
        if (!categories.has(r.category)) categories.set(r.category, {category: r.category, label: r.label, parts: []});
        categories.get(r.category).parts.push(r.series);
      }
      types[kind] = {series: merge(groups.map(g => g.series)), rows: Array.from(categories.values(), r => {
        const series = merge(r.parts);
        if (!detailedPrior) series.prior = null;
        return {category: r.category, label: r.label, series};
      })};
    }
    const total = merge(units.map(u => u.total));
    return {unit, total, types,
      history_note: !total.prior ? 'Histórico completo no disponible para este alcance.'
        : 'Histórico disponible para total, OPEX y CAPEX' + (detailedPrior ? ' y categorías.' : '; no para categorías.'),
      ranges: Object.fromEntries(['execution_forecast','budget','prior'].map(k =>
        [k, units.map(u => u.ranges[k]).filter(Boolean).join(', ')]))};
  }
  const api = {sum, ratio, relative, metrics, comparison, portfolioCurrencies};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.CierreModel = api;
})();
