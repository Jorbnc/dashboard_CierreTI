/* Financial snapshots are private releases, never written into tracked PBIP resources. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {parseArgs} = require('node:util');
const {unzipSync, zipSync} = require('fflate');
const {scopes} = require('../src/adapter');
const {readJson, writeJson, filesUnder, fileSizes, snapshotGuid, validateDatasets, compareVersions, verifyPreparation, verifyPreview} = require('./snapshot-lib.cjs');
const {acquireBuildLock} = require('./build-lock.cjs');
const root = path.resolve(__dirname, '..');
const run = (script, args = []) => {
  const result = spawnSync(process.execPath, [script, ...args], {cwd: root, stdio: 'inherit'});
  if (result.status !== 0) throw new Error(`Fallo ${script}: ${result.error || result.status}`);
};

function project(business, stage, config, archive) {
  const source = path.join(root, 'powerbi', business);
  const output = path.join(stage, 'powerbi', business);
  const report = `${business}.Report`, model = `${business}.SemanticModel`;
  const oldGuid = readJson(path.join(root, 'pbiviz.json')).visual.guid;
  const guid = config.visual.guid;
  // Copy definitions only. Never copy Desktop caches or financial model data.
  for (const file of filesUnder(source)) {
    if (!(file === `${business}.pbip` || file.startsWith(`${report}/definition/`) || file === `${report}/definition.pbir`)) continue;
    const dest = path.join(output, file);
    fs.mkdirSync(path.dirname(dest), {recursive: true}); fs.copyFileSync(path.join(source, file), dest);
  }
  const definitionFile = path.join(output, report, 'definition/report.json');
  const definition = readJson(definitionFile);
  assert.ok((definition.resourcePackages || []).every(p => p.name === oldGuid), 'Revisar recursos extra antes de migrar');
  definition.resourcePackages = [{name: guid, type: 'CustomVisual', items: [{name: `${guid}.pbiviz.json`, path: `${guid}.pbiviz.json`, type: 'CustomVisualMetadata'}]}];
  writeJson(definitionFile, definition);
  let visualCount = 0;
  for (const file of filesUnder(path.join(output, report))) {
    if (!file.endsWith('/visual.json')) continue;
    const location = path.join(output, report, file), value = readJson(location);
    assert.equal(value.visual.visualType, oldGuid, 'Revisar visual extra antes de migrar');
    value.visual.visualType = guid;
    delete value.visual.query;
    assert.ok(!value.filterConfig, 'Revisar filtros externos antes de migrar');
    writeJson(location, value); visualCount++;
  }
  assert.equal(visualCount, 1, 'Se requiere la plantilla de una pagina completa');
  const modelPath = path.join(output, model);
  fs.mkdirSync(path.join(modelPath, 'definition/tables'), {recursive: true});
  fs.copyFileSync(path.join(source, model, 'definition.pbism'), path.join(modelPath, 'definition.pbism'));
  fs.writeFileSync(path.join(modelPath, 'definition/database.tmdl'), 'database\n\tcompatibilityLevel: 1606\n');
  fs.writeFileSync(path.join(modelPath, 'definition/model.tmdl'), 'model Model\n\tculture: es-ES\n\tdefaultPowerBIDataSourceVersion: powerBI_V3\n\tsourceQueryCulture: en-US\n\nannotation __PBI_TimeIntelligenceEnabled = 0\n\nref table Entrega\n');
  fs.writeFileSync(path.join(modelPath, 'definition/tables/Entrega.tmdl'), 'table Entrega\n\tisHidden\n\n\tcolumn Estado\n\t\tdataType: string\n\t\tsummarizeBy: none\n\t\tsourceColumn: Estado\n\n\tpartition Entrega = m\n\t\tmode: import\n\t\tsource =\n\t\t\t\t#table(type table [Estado = text], {})\n');
  const entries = unzipSync(archive);
  const resource = readResource(entries, guid);
  assert.equal(resource.visual.guid, guid);
  assert.equal(resource.visual.version, config.visual.version);
  assert.deepEqual(resource.capabilities.privileges, []);
  assert.deepEqual(resource.capabilities.dataRoles, []);
  writeJson(path.join(output, report, 'CustomVisuals', guid, 'package.json'), JSON.parse(Buffer.from(entries['package.json']).toString()));
  writeJson(path.join(output, report, 'CustomVisuals', guid, 'resources', `${guid}.pbiviz.json`), resource);
}
const readResource = (entries, guid) => JSON.parse(Buffer.from(entries[`resources/${guid}.pbiviz.json`]).toString());

function main() {
  const {values} = parseArgs({options: {version: {type: 'string'}}});
  const version = values.version;
  assert.ok(version, 'Uso: npm run release:snapshot -- --version 0.2.0.0');
  compareVersions(version, '0.0.0.0');
  const preparation = verifyPreparation(root);
  const datasets = Object.fromEntries(Object.keys(scopes).map(b => [b, readJson(path.join(root, 'data', `${b}.json`))]));
  const source = validateDatasets(datasets);
  const positions = Object.entries(datasets).reduce((n, [b, data]) => n + verifyPreview(root, b, data), 0);
  console.log(`${positions} posiciones monetarias identicas al HTML, precision completa y nulos incluidos.`);
  const tracked = spawnSync('git', ['ls-files', 'data', 'previews', 'releases', 'src/generated', 'dist', '.tmp'], {cwd: root, encoding: 'utf8'});
  assert.equal(tracked.status, 0, 'Se requiere el repositorio de entrega');
  assert.equal(tracked.stdout.trim(), '', 'Hay archivos financieros o temporales en el indice Git');
  const closure = `${String(source.year).slice(-2)}${String(source.cutoff).padStart(2, '0')}`;
  const id = `${closure}-v${version}`, releases = path.join(root, 'releases'), destination = path.join(releases, id);
  fs.mkdirSync(releases, {recursive: true});
  for (const name of fs.readdirSync(releases)) {
    const file = path.join(releases, name, 'manifest.json');
    if (fs.existsSync(file)) assert.ok(compareVersions(version, readJson(file).version) > 0, 'Aumentar version para cada nueva entrega; no se reemplazan versiones anteriores');
  }
  assert.ok(!fs.existsSync(destination) && !fs.existsSync(destination + '.zip'), 'La entrega ya existe');
  fs.mkdirSync(path.join(root, '.tmp'), {recursive: true});
  const releaseLock = acquireBuildLock(root);
  try {
  const stage = fs.mkdtempSync(path.join(root, '.tmp/snapshot-'));
  const sourceInputs = Object.fromEntries(['src', 'tools', 'style', 'powerbi'].flatMap(folder => filesUnder(path.join(root, folder))
    .map(file => `${folder}/${file}`)).filter(file => !file.startsWith('src/generated/') && !file.includes('/.pbi/'))
    .concat(['package.json', 'package-lock.json', 'pbiviz.json', 'capabilities.json', 'tsconfig.json'])
    .map(file => [file, fs.readFileSync(path.join(root, file))]));
    run(path.join(root, 'tools/prepare.cjs'));
    const packages = {};
    for (const [business, data] of Object.entries(datasets)) {
      const guid = snapshotGuid(business), config = readJson(path.join(root, 'pbiviz.json'));
      config.visual = {...config.visual, name: `cierreSnapshot${business.replaceAll('_', '')}`, guid, version,
        displayName: `Cierre TI - ${scopes[business].entity}`, description: 'Instantanea privada del cierre; datos del negocio incorporados.'};
      const capabilities = {dataRoles: [], dataViewMappings: [], privileges: [], supportsKeyboardFocus: true, supportsLandingPage: true, supportsEmptyDataView: true};
      const capFile = path.join(stage, 'capabilities.json');
      writeJson(capFile, capabilities); config.capabilities = path.relative(root, capFile);
      const configFile = path.join(stage, 'pbiviz.json'); writeJson(configFile, config);
      fs.writeFileSync(path.join(root, 'src/generated/source.ts'), `export const snapshot: {business: string; rows: any[]} | null = ${JSON.stringify({business, rows: data.rows})};\n`);
      run(path.join(root, 'node_modules/typescript/bin/tsc'), ['--noEmit']);
      run(path.join(root, 'node_modules/powerbi-visuals-tools/bin/pbiviz.js'), ['package', '--no-stats', '--pbiviz-file', path.relative(root, configFile)]);
      const archive = fs.readFileSync(path.join(root, 'dist', `${guid}.${version}.pbiviz`));
      fs.mkdirSync(path.join(stage, 'artifacts'), {recursive: true});
      fs.writeFileSync(path.join(stage, 'artifacts', `${business}.pbiviz`), archive);
      project(business, stage, config, archive);
      packages[business] = {guid, bytes: archive.length, rows: data.rows.length};
    }
    fs.copyFileSync(path.join(root, '.tmp/drop/visual.js.LICENSE.txt'), path.join(stage, 'artifacts/THIRD_PARTY_LICENSES.txt'));
    fs.cpSync(path.join(root, 'previews'), path.join(stage, 'previews'), {recursive: true,
      filter: file => file === path.join(root, 'previews') || preparation.files.includes(path.relative(root, file).replaceAll('\\', '/'))});
    for (const file of ['pbiviz.json', 'capabilities.json']) fs.unlinkSync(path.join(stage, file));
    fs.writeFileSync(path.join(stage, 'LEEME.txt'), `Entrega privada ${id}\nContiene cifras financieras: no subir a Git ni publicar en web.\nAbrir powerbi/<negocio>/<negocio>.pbip con Power BI Desktop.\nNo configurar JSON, no vincular campos, no actualizar una fuente externa.\nValidar contra previews/<negocio>.html y revisar previews/informe_generacion.md.\nLa tabla oculta Entrega es tecnica y vacia: las cifras viven en el visual.\nPestanas, mes y moneda funcionan internamente; no se aplica RLS del modelo a los datos incrustados.\nDesktop y Service pendientes de validacion real. Publicacion manual autorizada.\nConservar toda la carpeta: copiar solo el PBIP no basta. No mezclar con entregas anteriores.\n`);
    assert.deepEqual(verifyPreparation(root), preparation, 'La preparacion cambio durante la compilacion');
    for (const [file, bytes] of Object.entries(sourceInputs)) assert.ok(fs.readFileSync(path.join(root, file)).equals(bytes), `Fuente cambiada durante compilacion: ${file}`);
    writeJson(path.join(stage, 'manifest.json'), {schema: 2, mode: 'snapshot', id, version, source, packages,
      dataEmbedded: true, desktopValidated: false, servicePublished: false, sourceFiles: Object.keys(sourceInputs),
      files: fileSizes(stage)});
    run(path.join(root, 'tools/check-snapshot.cjs'), [stage]);
    run(path.join(root, 'tools/test-snapshot.cjs'), [stage]);
    run(path.join(root, 'tools/check-schemas.cjs'), [stage]);
    const manifest = readJson(path.join(stage, 'manifest.json'));
    manifest.validation = {structural: true, monetaryPositions: positions, browsers: ['chromium', 'firefox'], microsoftSchemas: true};
    writeJson(path.join(stage, 'manifest.json'), manifest);
    const zip = zipSync(Object.fromEntries(filesUnder(stage).map(file => [`${id}/${file}`, new Uint8Array(fs.readFileSync(path.join(stage, file)))])), {level: 6});
    fs.renameSync(stage, destination);
    fs.writeFileSync(destination + '.zip', zip);
    console.log(`Entrega privada: ${destination}.zip\nDesktop/Service pendientes; no se publico ni se hizo push.`);
  } finally {
    // Do not leave the last business as the default for the code-only build.
    try {fs.writeFileSync(path.join(root, 'src/generated/source.ts'), 'export const snapshot: {business: string; rows: any[]} | null = null;\n');}
    finally {releaseLock();}
  }
}
if (require.main === module) {try {main();} catch (error) {console.error(error); process.exitCode = 1;}}
module.exports = {project};
