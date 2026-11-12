const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fromRows, fromDataView, scopes} = require('../src/adapter');
const fields = require('../src/fields.json');

function fixture(business = 'banco_chile') {
  const scope = scopes[business], rows = [];
  const kinds = ['Capex', 'Opex', ...(business === 'retail_chile' ? ['CO'] : [])];
  for (const unit of scope.units) {
    for (const [level, kind] of [['total', ''], ...kinds.flatMap(k => [['type', k], ['category', k]])]) {
      for (let month = 1; month <= 12; month++) {
        const amount = (level === 'total' ? kinds.length : 1) * month;
        rows.push({id: `${business}:${rows.length}`, business, entity: scope.entity, brand: scope.brand,
          default_currency: scope.default, year: 2030, cutoff: 5, source: 'sintetico.xlsx', sheet: 'Comité', sha256: 'synthetic',
          unit, level, kind, category: level === 'category' ? 'Ejemplo' : '', label: level === 'category' ? 'Ejemplo' : kind || 'Total', month,
          actual: month <= 5 ? amount : null, forecast: month > 5 ? amount + 0 : null, budget: amount,
          prior: level === 'category' || business.startsWith('retail') ? null : amount / 2,
          range_execution_forecast: 'C:N', range_budget: 'R:AC', range_prior: '', history_note: 'Datos sintéticos.'});
      }
    }
  }
  rows.forEach(row => {row.expected_rows = rows.length;});
  return rows;
}
function dataView(rows) {
  const names = Object.keys(fields).reverse();
  return {metadata: {}, table: {columns: names.map(name => ({roles: {[name]: true}})), rows: rows.map(row => names.map(key => row[key]))}};
}
for (const business of Object.keys(scopes)) test(`reconstruye ${business} con meses, monedas e historia`, () => {
  const payload = fromDataView(dataView(fixture(business).reverse()));
  assert.equal(payload.business, business);
  assert.equal(Object.keys(payload.currencies).length, scopes[business].units.length);
  const total = payload.currencies[scopes[business].default].total;
  assert.equal(total.actual[5], null);
  assert.equal(total.forecast[4], null);
  assert.equal(total.prior === null, business.startsWith('retail'));
});
test('rechaza entrega parcial, filas duplicadas, mezcla y conversiones implícitas', () => {
  const rows = fixture();
  assert.throws(() => fromRows(rows.slice(1)), /incompleta/);
  const duplicate = structuredClone(rows); duplicate[1] = duplicate[0];
  assert.throws(() => fromRows(duplicate), /duplicado/);
  const mixed = structuredClone(rows); mixed[1].business = 'retail_peru';
  assert.throws(() => fromRows(mixed), /mezclaron/);
  const text = structuredClone(rows); text[0].actual = '1';
  assert.throws(() => fromRows(text), /Importe/);
  const unknown = structuredClone(rows); unknown[0].unit = 'USD';
  assert.throws(() => fromRows(unknown), /Moneda/);
});
test('no usa subtotales sin categorías, fechas fuera del cierre ni históricos parciales', () => {
  const broken = fixture(); broken[0].actual += 4;
  assert.throws(() => fromRows(broken), /cuadra/);
  const future = fixture(); future[7].actual = 5;
  assert.throws(() => fromRows(future), /fuera del cierre/);
  const history = fixture(); history[0].prior = null;
  assert.throws(() => fromRows(history), /Histórico parcial/);
});
test('exige entrega final y roles únicos del DataView', () => {
  const view = dataView(fixture()); view.metadata.segment = {};
  assert.throws(() => fromDataView(view), /entrega completa/);
  delete view.metadata.segment; view.table.columns[0].roles = {};
  assert.throws(() => fromDataView(view), /Enlace faltante/);
});
module.exports = {fixture, dataView};
