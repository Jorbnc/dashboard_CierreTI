const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {projectPaths, selectedBusinesses} = require('../tools/project-paths.cjs');
const {configure} = require('../tools/configure-xlsx.cjs');
const root = path.resolve(__dirname, '..');

test('Banco Peru usa el proyecto guardado en Desktop, sin cambiar la clave de negocio', () => {
  const project = projectPaths(root, 'banco_peru');
  assert.equal(project.name, 'Gastos TI BR PE');
  assert.equal(path.basename(project.directory), 'banco_peru');
  assert.equal(JSON.parse(fs.readFileSync(project.pbip)).artifacts[0].report.path, 'Gastos TI BR PE.Report');
  assert.equal(JSON.parse(fs.readFileSync(path.join(project.report, 'definition.pbir'))).datasetReference.byPath.path,
    '../Gastos TI BR PE.SemanticModel');
  assert.deepEqual(fs.readdirSync(project.directory).filter(file => file.endsWith('.pbip')), ['Gastos TI BR PE.pbip']);
  for (const suffix of ['.pbip', '.Report', '.SemanticModel'])
    assert.ok(!fs.existsSync(path.join(project.directory, `banco_peru${suffix}`)), 'No recrear el proyecto anterior');
  for (const [folder, id] of [[project.report, '12d40ea0-42ba-4231-b357-bccde621449b'],
    [project.model, '4f7397e9-73e9-4b09-b27f-8d9bad08089b']]) {
    const metadata = JSON.parse(fs.readFileSync(path.join(folder, '.platform')));
    assert.equal(metadata.metadata.displayName, 'Gastos TI BR PE');
    assert.equal(metadata.config.logicalId, id);
  }
  for (const business of ['banco_chile', 'retail_chile', 'retail_peru'])
    assert.equal(projectPaths(root, business).name, business);
});

test('seleccion de un proyecto es explicita y rechaza opciones desconocidas', () => {
  assert.equal(selectedBusinesses().length, 4);
  assert.deepEqual(selectedBusinesses(['--business', 'banco_peru']), ['banco_peru']);
  for (const args of [['banco_peru'], ['--business'], ['--business', 'bad'], ['--all']])
    assert.throws(() => selectedBusinesses(args), /Uso:/);
});

test('configuracion acotada preserva el proyecto Desktop y no crea los otros proyectos', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cierre-renamed-'));
  try {
    fs.cpSync(path.join(root, 'powerquery'), path.join(tmp, 'powerquery'), {recursive: true});
    fs.cpSync(projectPaths(root, 'banco_peru').directory, projectPaths(tmp, 'banco_peru').directory, {recursive: true});
    const files = fs.readdirSync(projectPaths(tmp, 'banco_peru').directory, {recursive: true})
      .map(file => path.join(projectPaths(tmp, 'banco_peru').directory, file)).filter(file => fs.statSync(file).isFile());
    const before = new Map(files.map(file => [file, fs.readFileSync(file)]));
    configure(tmp, ['banco_peru']);
    configure(tmp, ['banco_peru']);
    for (const [file, bytes] of before) assert.ok(fs.readFileSync(file).equals(bytes), path.relative(tmp, file));
    assert.deepEqual(fs.readdirSync(path.join(tmp, 'powerbi')), ['banco_peru']);
  } finally {fs.rmSync(tmp, {recursive: true, force: true});}
});
