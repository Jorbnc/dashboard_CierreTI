const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {fromRows, scopes, projects} = require('../src/adapter');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
function filesUnder(root) {
  return fs.readdirSync(root, {recursive: true}).filter(name => fs.statSync(path.join(root, name)).isFile())
    .map(name => name.replaceAll('\\', '/')).sort();
}
const fileSizes = root => Object.fromEntries(filesUnder(root).map(name => [name, fs.statSync(path.join(root, name)).size]));
// Published identities are fixed identifiers, not derived from content.
const snapshotGuids = {
  banco_chile: 'CierreSnapshot0CF888D29B1F6CD4C85BEEA3FE3C2E1A',
  banco_peru: 'CierreSnapshot913C3AFB33398380C4FC54507767F4EE',
  retail_chile: 'CierreSnapshot1D0B693704899B360B94BB282D5347BB',
  retail_peru: 'CierreSnapshot082C483EE16C54767CDB95D5B4AD6237',
};
const snapshotGuid = business => {
  assert.ok(Object.hasOwn(scopes, business), 'Negocio desconocido');
  return snapshotGuids[business];
};
function validateDatasets(datasets) {
  assert.deepEqual(Object.keys(datasets).sort(), Object.keys(scopes).sort(), 'Se requieren los cuatro negocios');
  let source;
  for (const [business, input] of Object.entries(datasets)) {
    assert.equal(input.schema, 1, 'Esquema no compatible');
    assert.equal(input.business, business, 'Archivo de otro negocio');
    const data = fromRows(input.rows);
    assert.equal(data.business, business, 'Filas de otro negocio');
    const current = {year: data.year, cutoff: data.cutoff, source: data.source, sheet: data.sheet};
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
function verifyPreparation(root, businesses = Object.keys(scopes)) {
  assert.ok(businesses.length && new Set(businesses).size === businesses.length &&
    businesses.every(b => Object.hasOwn(projects, b)), 'Seleccion de negocios invalida');
  const manifest = readJson(path.join(root, 'data/preparation.json'));
  assert.equal(manifest.schema, 2, 'Repetir preparar_powerbi.py para actualizar la preparacion');
  const expected = businesses.flatMap(b => [`data/${b}.json`, `previews/${b}.html`]);
  expected.push('previews/informe_generacion.md');
  assert.ok(expected.every(file => manifest.files.includes(file)), 'La preparación no contiene todos los proyectos solicitados');
  for (const file of expected) {
    const baseline = path.join(root, '.tmp/preparation-reference', file);
    assert.ok(fs.existsSync(baseline) && fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(baseline)),
      `Preparacion modificada: ${file}; repetir preparar_powerbi.py`);
  }
  return manifest;
}

function verifyPreview(root, business, input) {
  const html = fs.readFileSync(path.join(root, 'previews', `${business}.html`), 'utf8');
  const preview = JSON.parse(html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const restored = fromRows(input.rows);
  return verifyPayload(restored, preview);
}
function verifyPayload(restored, preview) {
  for (const field of ['business', 'year', 'cutoff', 'source', 'sheet']) assert.equal(restored[field], preview[field]);
  assert.deepEqual(Object.keys(restored.currencies).sort(), Object.keys(preview.currencies).sort());
  let positions = 0;
  if (preview.members || restored.members) {
    assert.deepEqual(restored.choices, preview.choices);
    assert.deepEqual(Object.keys(restored.members).sort(), Object.keys(preview.members).sort());
    for (const key of Object.keys(preview.members)) positions += verifyPayload(restored.members[key], preview.members[key]);
  }
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

module.exports = {readJson, writeJson, filesUnder, fileSizes, snapshotGuid, validateDatasets, compareVersions, verifyPreparation, verifyPreview};
