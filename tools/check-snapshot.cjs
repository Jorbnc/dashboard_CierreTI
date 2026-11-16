const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {unzipSync} = require('fflate');
const {scopes} = require('../src/adapter');
const {hash, readJson, fileHashes, filesUnder, snapshotGuid} = require('./snapshot-lib.cjs');
function check(directory) {
  const manifest = readJson(path.join(directory, 'manifest.json'));
  assert.equal(manifest.mode, 'snapshot'); assert.equal(manifest.dataEmbedded, true);
  assert.deepEqual(Object.keys(manifest.packages).sort(), Object.keys(scopes).sort());
  const hashes = fileHashes(directory); delete hashes['manifest.json'];
  assert.deepEqual(hashes, manifest.files, 'Entrega modificada o con archivos extra');
  for (const name of Object.keys(hashes)) {
    assert.ok(!name.includes('/.pbi/') && !name.startsWith('data/') && !/\.(xlsx|pbix)$/i.test(name), 'Archivo privado no previsto en la entrega');
  }
  for (const [business, metadata] of Object.entries(manifest.packages)) {
    assert.equal(metadata.guid, snapshotGuid(business));
    const guid = metadata.guid, project = path.join(directory, 'powerbi', business);
    const report = path.join(project, `${business}.Report`), model = path.join(project, `${business}.SemanticModel`);
    assert.equal(readJson(path.join(project, `${business}.pbip`)).artifacts[0].report.path, `${business}.Report`);
    assert.equal(readJson(path.join(report, 'definition.pbir')).datasetReference.byPath.path, `../${business}.SemanticModel`);
    const archive = fs.readFileSync(path.join(directory, 'artifacts', `${business}.pbiviz`));
    assert.equal(hash(archive), metadata.sha256);
    const entries = unzipSync(archive), decode = name => JSON.parse(Buffer.from(entries[name]).toString());
    const resource = decode(`resources/${guid}.pbiviz.json`);
    assert.equal(resource.visual.guid, guid); assert.equal(resource.visual.version, manifest.version);
    assert.deepEqual(resource, readJson(path.join(report, 'CustomVisuals', guid, 'resources', `${guid}.pbiviz.json`)));
    assert.deepEqual(decode('package.json'), readJson(path.join(report, 'CustomVisuals', guid, 'package.json')));
    assert.deepEqual(resource.capabilities.dataRoles, []);
    assert.deepEqual(resource.capabilities.dataViewMappings, []);
    assert.deepEqual(resource.capabilities.privileges, []);
    assert.equal(resource.capabilities.supportsLandingPage, true);
    assert.equal(resource.capabilities.supportsEmptyDataView, true);
    const definitions = filesUnder(path.join(report, 'definition'));
    for (const name of definitions) {
      const value = readJson(path.join(report, 'definition', name));
      if (name.endsWith('/visual.json')) {
        assert.equal(value.visual.visualType, guid);
        assert.ok(!value.visual.query, 'Snapshot con query al modelo');
      }
    }
    assert.deepEqual(readJson(path.join(report, 'definition/report.json')).resourcePackages.map(p => p.name), [guid]);
    const tmdl = filesUnder(model).filter(f => f.endsWith('.tmdl')).map(f => fs.readFileSync(path.join(model, f), 'utf8')).join('\n');
    assert.ok(!/pDataFile|File\.Contents|Web\.Contents|ref table Cierre/.test(tmdl), 'Modelo aun depende de datos externos');
    assert.ok(tmdl.includes('#table(type table [Estado = text], {})'));
    const preview = fs.readFileSync(path.join(directory, 'previews', `${business}.html`), 'utf8');
    const data = JSON.parse(preview.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(data.business, business); assert.equal(data.sha256, manifest.source.sha256);
    assert.equal(data.cutoff, manifest.source.cutoff); assert.equal(data.year, manifest.source.year);
  }
  console.log('Snapshot: cuatro PBIP autonomos, GUIDs por negocio, recursos, previews y hashes verificados.');
  return manifest;
}
if (require.main === module) {try {assert.ok(process.argv[2], 'Indicar carpeta de entrega'); check(path.resolve(process.argv[2]));} catch (e) {console.error(e); process.exitCode = 1;}}
module.exports = {check};
