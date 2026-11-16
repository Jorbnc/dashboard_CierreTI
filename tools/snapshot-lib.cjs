const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {fromRows, scopes} = require('../src/adapter');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
function filesUnder(root) {
  return fs.readdirSync(root, {recursive: true}).filter(name => fs.statSync(path.join(root, name)).isFile())
    .map(name => name.replaceAll('\\', '/')).sort();
}
const fileHashes = root => Object.fromEntries(filesUnder(root).map(name => [name, hash(fs.readFileSync(path.join(root, name)))]));
const snapshotGuid = business => {
  assert.ok(Object.hasOwn(scopes, business), 'Negocio desconocido');
  return 'CierreSnapshot' + hash('cierre-ti:snapshot:' + business).slice(0, 32).toUpperCase();
};
function validateDatasets(datasets) {
  assert.deepEqual(Object.keys(datasets).sort(), Object.keys(scopes).sort(), 'Se requieren los cuatro negocios');
  let source;
  for (const [business, input] of Object.entries(datasets)) {
    assert.equal(input.schema, 1, 'Esquema no compatible');
    assert.equal(input.business, business, 'Archivo de otro negocio');
    const data = fromRows(input.rows);
    assert.equal(data.business, business, 'Filas de otro negocio');
    const current = {year: data.year, cutoff: data.cutoff, source: data.source, sheet: data.sheet, sha256: data.sha256};
    assert.match(current.sha256, /^[a-f0-9]{64}$/, 'Falta huella de la fuente');
    source ||= current;
    assert.deepEqual(current, source, 'No mezclar generaciones ni fuentes');
  }
  return source;
}
function compareVersions(a, b) {
  for (const version of [a, b]) assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Version de cuatro enteros sin ceros iniciales requerida');
  const aa = a.split('.').map(Number), bb = b.split('.').map(Number);
  assert.ok([...aa, ...bb].every(n => Number.isSafeInteger(n) && n <= 65535), 'Componente de version fuera de rango');
  for (let i = 0; i < 4; i++) if (aa[i] !== bb[i]) return Math.sign(aa[i] - bb[i]);
  return 0;
}
function verifyPreparation(root) {
  const manifest = readJson(path.join(root, 'data/preparation.json'));
  assert.equal(manifest.schema, 1);
  const expected = Object.keys(scopes).flatMap(b => [`data/${b}.json`, `previews/${b}.html`]);
  expected.push('previews/informe_generacion.md');
  assert.deepEqual(Object.keys(manifest.sha256).sort(), expected.sort());
  for (const file of expected) assert.equal(hash(fs.readFileSync(path.join(root, file))), manifest.sha256[file], `Preparacion modificada: ${file}; repetir preparar_powerbi.py`);
  return manifest;
}

function verifyPreview(root, business, input) {
  const html = fs.readFileSync(path.join(root, 'previews', `${business}.html`), 'utf8');
  const preview = JSON.parse(html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const restored = fromRows(input.rows);
  for (const field of ['business', 'year', 'cutoff', 'sha256']) assert.equal(restored[field], preview[field]);
  assert.deepEqual(Object.keys(restored.currencies).sort(), Object.keys(preview.currencies).sort());
  let positions = 0;
  for (const [unit, currency] of Object.entries(preview.currencies)) {
    const other = restored.currencies[unit];
    assert.deepEqual(other.total, currency.total, 'Series totales distintas del HTML'); positions += 48;
    assert.deepEqual(Object.keys(other.types).sort(), Object.keys(currency.types).sort());
    for (const [kind, group] of Object.entries(currency.types)) {
      assert.deepEqual(other.types[kind].series, group.series, 'Series por tipo distintas del HTML');
      assert.deepEqual(other.types[kind].rows, group.rows, 'Series por categoria distintas del HTML');
      positions += 48 * (1 + group.rows.length);
    }
  }
  return positions;
}

module.exports = {hash, readJson, writeJson, filesUnder, fileHashes, snapshotGuid, validateDatasets, compareVersions, verifyPreparation, verifyPreview};
