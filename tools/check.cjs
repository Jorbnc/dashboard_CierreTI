const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {scopes} = require('../src/adapter');
const fields = require('../src/fields.json');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const manifest = json('artifacts/cierre-gastos-ti.manifest.json');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(fs.readFileSync(path.join(root, 'artifacts/cierre-gastos-ti.pbiviz'))), manifest.sha256);
for (const [file, digest] of Object.entries(manifest.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, file))), digest, `Fuente modificada: ${file}`);
for (const business of Object.keys(scopes)) {
  const prefix = `powerbi/${business}/${business}`;
  assert.equal(json(`${prefix}.pbip`).artifacts[0].report.path, `${business}.Report`);
  assert.equal(json(`${prefix}.Report/definition.pbir`).datasetReference.byPath.path, `../${business}.SemanticModel`);
  const table = read(`${prefix}.SemanticModel/definition/tables/Cierre.tmdl`);
  assert.ok(table.includes(`fxCierreXlsx(Workbook, SourceName, "${business}")`));
  assert.ok(table.includes('File.Contents(pWorkbookPath)'));
  assert.ok(!table.includes('pDataFile'));
  const expressions = read(`${prefix}.SemanticModel/definition/expressions.tmdl`);
  assert.ok(expressions.includes('expression pWorkbookPath ='));
  for (const fn of require('./configure-xlsx.cjs').FUNCTIONS) {
    const source = read(`powerquery/${fn}.pq`).trim().split('\n').map(line => '\t\t' + line).join('\n');
    assert.ok(expressions.includes(`expression ${fn} =\n${source}\n`), `Funcion M desactualizada: ${fn}`);
  }
  assert.ok(!table.includes('Web.Contents'));
  const bindings = json(`${prefix}.Report/definition/pages/cierreti000000000001/visuals/cierrevisual000000001/visual.json`).visual;
  assert.equal(bindings.visualType, manifest.guid);
  for (const field of Object.keys(fields)) {
    assert.ok(table.includes(`\tcolumn ${field}\n`));
    assert.equal(bindings.query.queryState[field].projections[0].queryRef, `Cierre.${field}`);
  }
  const resource = json(`${prefix}.Report/CustomVisuals/${manifest.guid}/resources/${manifest.guid}.pbiviz.json`);
  assert.deepEqual(resource.capabilities.privileges, []);
  assert.equal(resource.visual.version, manifest.version);
  assert.ok(!resource.content.js.includes('2609_dashboard_data.xlsx'), 'El paquete no debe contener datos de la fuente');
}
console.log('4 PBIP: enlaces, aislamiento, versiones y hashes coherentes. Validación estructural, no sustituye Desktop.');
