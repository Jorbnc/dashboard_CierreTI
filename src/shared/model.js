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
  const api = {sum, ratio, relative, metrics, comparison};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.CierreModel = api;
})();
