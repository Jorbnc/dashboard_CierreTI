const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {fixture} = require('./adapter.test.cjs');
const {scopes, fromRows} = require('../src/adapter');
const {snapshotGuid, validateDatasets, compareVersions, verifyPreparation, verifyPreview, writeJson} = require('../tools/snapshot-lib.cjs');
const {assertBuildAccess, acquireBuildLock} = require('../tools/build-lock.cjs');
const datasets = () => Object.fromEntries(Object.keys(scopes).map(b => [b, {schema: 1, business: b, rows: fixture(b)}]));
test('snapshot mantiene cuatro identidades estables y versiones monotonas', () => {
  const guids = Object.keys(scopes).map(snapshotGuid);
  assert.equal(new Set(guids).size, 4);
  assert.equal(snapshotGuid('banco_peru'), snapshotGuid('banco_peru'));
  assert.throws(() => snapshotGuid('desconocido'));
  assert.equal(compareVersions('0.2.0.1', '0.2.0.0'), 1);
  assert.equal(compareVersions('0.2.0.0', '0.2.0.0'), 0);
  assert.throws(() => compareVersions('0.02.0.0', '0.0.0.0'));
});
test('rechaza mezclas de negocio, fuente, corte y series parciales antes de compilar', () => {
  assert.equal(validateDatasets(datasets()).cutoff, 5);
  const wrong = datasets(); wrong.banco_peru = wrong.banco_chile;
  assert.throws(() => validateDatasets(wrong), /otro negocio/);
  const mixed = datasets(); mixed.banco_peru.rows.forEach(r => {r.source = 'other.xlsx';});
  assert.throws(() => validateDatasets(mixed), /mezclar/);
  const partial = datasets(); partial.retail_chile.rows.pop();
  assert.throws(() => validateDatasets(partial), /incompleta/);
});
test('la preparacion vincula JSON, previews e informe de una generacion', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-test-'));
  try {
    const files = [];
    for (const b of Object.keys(scopes)) for (const file of [`data/${b}.json`, `previews/${b}.html`]) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive: true}); fs.writeFileSync(path.join(dir, file), 'fixture'); files.push(file);
    }
    fs.writeFileSync(path.join(dir, 'previews/informe_generacion.md'), 'fixture'); files.push('previews/informe_generacion.md');
    for (const file of files) {
      const baseline = path.join(dir, '.tmp/preparation-reference', file);
      fs.mkdirSync(path.dirname(baseline), {recursive: true}); fs.copyFileSync(path.join(dir, file), baseline);
    }
    writeJson(path.join(dir, 'data/preparation.json'), {schema: 2, files});
    verifyPreparation(dir);
    fs.writeFileSync(path.join(dir, 'previews/banco_peru.html'), 'changed');
    assert.throws(() => verifyPreparation(dir), /Preparacion modificada/);
  } finally {fs.rmSync(dir, {recursive: true, force: true});}
});
test('bloqueo compartido impide compilar modelo y snapshot en paralelo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-lock-test-'));
  const release = acquireBuildLock(dir);
  try {
    assertBuildAccess(dir);
    assert.throws(() => acquireBuildLock(dir), /compilacion activa/);
    const token = process.env.CIERRE_BUILD_TOKEN;
    delete process.env.CIERRE_BUILD_TOKEN;
    assert.throws(() => assertBuildAccess(dir), /compilacion activa/);
    process.env.CIERRE_BUILD_TOKEN = token;
  } finally {release(); fs.rmSync(dir, {recursive: true, force: true});}
});
test('comparacion exacta detecta diferencias que el redondeo visual oculta', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-preview-test-'));
  try {
    const input = datasets().banco_chile, preview = fromRows(input.rows);
    fs.mkdirSync(path.join(dir, 'previews'));
    fs.writeFileSync(path.join(dir, 'previews/banco_chile.html'), `<script id="report-data" type="application/json">${JSON.stringify(preview)}</script>`);
    assert.equal(verifyPreview(dir, 'banco_chile', input), 240);
    for (const row of input.rows) if (row.month === 2) row.actual *= 1 + 1e-10;
    fromRows(input.rows);
    assert.throws(() => verifyPreview(dir, 'banco_chile', input), /Series totales/);
  } finally {fs.rmSync(dir, {recursive: true, force: true});}
});
