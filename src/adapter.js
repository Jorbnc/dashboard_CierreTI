'use strict';
const fields = require('./fields.json');
const portfolios = require('./shared/portfolios.json');
const scopes = {
  banco_chile: {entity: 'Banco Ripley Chile', brand: 'bank', units: ['MMCLP'], default: 'MMCLP'},
  banco_peru: {entity: 'Banco Ripley Perú', brand: 'bank', units: ['MSoles', 'MMCLP'], default: 'MSoles'},
  retail_chile: {entity: 'Retail Chile', brand: 'retail', units: ['MMCLP'], default: 'MMCLP'},
  retail_peru: {entity: 'Retail Perú', brand: 'retail', units: ['MMCLP'], default: 'MMCLP'},
};
function requireThat(condition, message) { if (!condition) throw new Error(message); }
const monetary = ['actual', 'forecast', 'budget', 'prior'];

function fromRows(rows, memberOnly = false) {
  requireThat(Array.isArray(rows) && rows.length > 0, 'No se recibieron series mensuales.');
  const tag = String(rows[0].id).split('|');
  if (tag.length > 1) {
    const key = tag[0], p = portfolios[key];
    requireThat(!memberOnly && p && rows.every(r => r.id.startsWith(key + '|') && p.members.includes(r.business)
      && ['source','year','cutoff','sheet'].every(k => r[k] === rows[0][k])), 'Entrega consolidada inconsistente.');
    const members = Object.fromEntries(p.members.map(m => [m, fromRows(rows.filter(r => r.business === m)
      .map(r => ({...r, id:r.id.slice(key.length + 1)})), true)]));
    const choices = {[key]:p.members, ...Object.fromEntries((p.groups || []).map(g => [g,portfolios[g].members])),
      ...Object.fromEntries(p.members.map(m => [m,[m]]))};
    return {schema:3, business:key, entity:p.entity, brand:p.brand, default_currency:'MMCLP',
      year:rows[0].year, cutoff:rows[0].cutoff, source:rows[0].source, sheet:rows[0].sheet,
      currencies:{}, choices, members, aliases:{}};
  }
  const first = rows[0], scope = scopes[first.business];
  requireThat(scope, 'Negocio no reconocido.');
  requireThat(first.entity === scope.entity && first.brand === scope.brand && first.default_currency === scope.default, 'Identidad o moneda del negocio incorrecta.');
  requireThat(Number.isInteger(first.year) && first.year >= 2000 && Number.isInteger(first.cutoff) && first.cutoff >= 1 && first.cutoff <= 12, 'Cierre inválido.');
  requireThat(first.expected_rows === rows.length, 'Entrega incompleta o filtrada; no se muestran totales parciales.');
  const common = ['business', 'entity', 'brand', 'default_currency', 'year', 'cutoff', 'source', 'sheet', 'expected_rows'];
  const result = {schema: 3, business: first.business, entity: first.entity, brand: first.brand,
    default_currency: first.default_currency, year: first.year, cutoff: first.cutoff, source: first.source,
    sheet: first.sheet, currencies: {}, aliases: {}, history_notes: []};
  const groups = new Map(), ids = new Set();
  for (const row of rows) {
    for (const key of common) requireThat(row[key] === first[key], 'Se mezclaron negocios, cierres o fuentes.');
    for (const [field, type] of Object.entries(fields)) {
      const value = row[field];
      if (type === 'string') requireThat(typeof value === 'string', `Campo de texto inválido: ${field}.`);
      else if (type === 'int64') requireThat(Number.isInteger(value), `Campo entero inválido: ${field}.`);
      else requireThat(value === null || (typeof value === 'number' && Number.isFinite(value)), `Importe inválido: ${field}.`);
    }
    requireThat(!ids.has(row.id), 'Identificador duplicado.'); ids.add(row.id);
    requireThat(scope.units.includes(row.unit) && row.month >= 1 && row.month <= 12, 'Moneda o mes fuera de alcance.');
    requireThat(['total', 'type', 'category'].includes(row.level), 'Nivel desconocido.');
    requireThat(row.level === 'total' ? row.kind === '' && row.category === ''
      : ['Capex', 'Opex', ...(first.business === 'retail_chile' ? ['CO'] : [])].includes(row.kind) &&
        (row.level === 'category' ? row.category.length > 0 : row.category === ''), 'Clasificación inválida.');
    requireThat(row.budget !== null && (row.month <= first.cutoff
      ? row.actual !== null && row.forecast === null : row.actual === null && row.forecast !== null), 'Serie REAL/FCST/PPTO incompleta o fuera del cierre.');
    const key = JSON.stringify([row.unit, row.level, row.kind, row.category]);
    if (!groups.has(key)) groups.set(key, {row, months: new Map()});
    const group = groups.get(key);
    for (const field of ['label', 'history_note', 'range_execution_forecast', 'range_budget', 'range_prior'])
      requireThat(row[field] === group.row[field], 'Metadatos de serie inconsistentes.');
    requireThat(!group.months.has(row.month), 'Mes duplicado en una serie.'); group.months.set(row.month, row);
  }
  for (const {row, months} of groups.values()) {
    requireThat(months.size === 12, 'Faltan meses; no se completa con ceros.');
    const series = Object.fromEntries(monetary.map(key => [key, Array.from({length: 12}, (_, i) => months.get(i + 1)[key])]));
    requireThat(series.prior.every(v => v === null) || series.prior.every(Number.isFinite), 'Histórico parcial.');
    if (series.prior.every(v => v === null)) series.prior = null;
    requireThat(row.level !== 'category' || series.prior === null ||
      (first.business.startsWith('retail_') && first.source === '2610_dashboard_data_final.xlsx'), 'No hay histórico validado por categoría.');
    const currency = result.currencies[row.unit] ||= {unit: row.unit, types: {}, history_note: row.history_note,
      ranges: {execution_forecast: row.range_execution_forecast, budget: row.range_budget, prior: row.range_prior || null}};
    requireThat(currency.history_note === row.history_note && currency.ranges.execution_forecast === row.range_execution_forecast &&
      currency.ranges.budget === row.range_budget && (currency.ranges.prior || '') === row.range_prior, 'Rangos de fuente inconsistentes.');
    if (row.level === 'total') currency.total = series;
    else {
      const group = currency.types[row.kind] ||= {rows: []};
      if (row.level === 'type') group.series = series;
      else {
        group.rows.push({category: row.category, label: row.label, series});
        if (row.category !== row.label) result.aliases[row.category] = row.label;
      }
    }
  }
  const reconciles = (total, components, keys) => {
    for (const key of keys) for (let i = 0; i < 12; i++) {
      const expected = total[key]?.[i];
      if (expected == null) continue;
      requireThat(components.every(s => s[key]?.[i] != null), 'Componentes incompletos.');
      const actual = components.reduce((sum, s) => sum + s[key][i], 0);
      requireThat(Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-9), 'No cuadra la composición de las series.');
    }
  };
  requireThat(Object.keys(result.currencies).length === scope.units.length, 'Faltan monedas del negocio.');
  for (const currency of Object.values(result.currencies)) {
    requireThat(currency.total && currency.types.Capex?.series && currency.types.Opex?.series, 'Falta Total, CAPEX u OPEX.');
    for (const group of Object.values(currency.types)) {
      requireThat(group.series && group.rows.length, 'Faltan categorías o subtotal.');
      reconciles(group.series, group.rows.map(r => r.series), group.rows.some(r => r.series.prior) ? monetary : monetary.filter(k => k !== 'prior'));
    }
    reconciles(currency.total, Object.values(currency.types).map(g => g.series), monetary);
  }
  return result;
}

function fromDataView(view) {
  requireThat(!view?.metadata?.segment, 'Se requiere la entrega completa de Power BI.');
  requireThat(view?.table?.columns && view.table.rows, 'Faltan campos del modelo.');
  const columns = Object.keys(fields).map(field => {
    const matches = view.table.columns.map((c, i) => c.roles?.[field] ? i : -1).filter(i => i >= 0);
    requireThat(matches.length === 1, `Enlace faltante o duplicado: ${field}.`);
    return [field, matches[0]];
  });
  // Power BI can represent empty grouping strings as BLANK; normalize text only.
  return fromRows(view.table.rows.map(row => Object.fromEntries(columns.map(([field, i]) =>
    [field, row[i] == null && fields[field] === 'string' ? '' : row[i] ?? null]))));
}
module.exports = {fromRows, fromDataView, scopes, portfolios, projects: {...scopes, ...portfolios}};
