const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {projectPaths, selectedBusinesses} = require('../tools/project-paths.cjs');
const {configure} = require('../tools/configure-xlsx.cjs');
const root = path.resolve(__dirname, '..');

const banks = [
  ['banco_chile', 'Gastos TI BR CL', '88d42647-677d-48f3-9b89-68d6fdc0c0d6', 'd741d394-c0ed-4450-9d4c-f1538d62b6c2'],
  ['banco_peru', 'Gastos TI BR PE', '12d40ea0-42ba-4231-b357-bccde621449b', '4f7397e9-73e9-4b09-b27f-8d9bad08089b'],
];
for (const [business, name, reportId, modelId] of banks) test(`${business}: conserva el proyecto guardado en Desktop`, () => {
  const project = projectPaths(root, business);
  assert.equal(project.name, name);
  assert.equal(path.basename(project.directory), business);
  assert.equal(JSON.parse(fs.readFileSync(project.pbip)).artifacts[0].report.path, `${name}.Report`);
  assert.equal(JSON.parse(fs.readFileSync(path.join(project.report, 'definition.pbir'))).datasetReference.byPath.path,
    `../${name}.SemanticModel`);
  assert.deepEqual(fs.readdirSync(project.directory).filter(file => file.endsWith('.pbip')), [`${name}.pbip`]);
  for (const suffix of ['.pbip', '.Report', '.SemanticModel'])
    assert.ok(!fs.existsSync(path.join(project.directory, `${business}${suffix}`)), 'No recrear el proyecto anterior');
  for (const [folder, id] of [[project.report, reportId], [project.model, modelId]]) {
    const metadata = JSON.parse(fs.readFileSync(path.join(folder, '.platform')));
    assert.equal(metadata.metadata.displayName, name);
    assert.equal(metadata.config.logicalId, id);
  }
});

test('Retail conserva dos proyectos independientes con sus nombres originales', () => {
  for (const business of ['retail_chile', 'retail_peru']) {
    const project = projectPaths(root, business);
    assert.equal(project.name, business);
    assert.deepEqual(fs.readdirSync(project.directory).filter(file => file.endsWith('.pbip')), [`${business}.pbip`]);
    assert.equal(JSON.parse(fs.readFileSync(project.pbip)).artifacts[0].report.path, `${business}.Report`);
  }
});

test('seleccion de un proyecto es explicita y rechaza opciones desconocidas', () => {
  assert.equal(selectedBusinesses().length, 7);
  assert.deepEqual(selectedBusinesses(['--business', 'banco_peru']), ['banco_peru']);
  for (const args of [['banco_peru'], ['--business'], ['--business', 'bad'], ['--all']])
    assert.throws(() => selectedBusinesses(args), /Uso:/);
});

for (const [business] of banks) test(`${business}: configuracion acotada conserva todos los metadatos Desktop`, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cierre-renamed-'));
  try {
    fs.cpSync(path.join(root, 'powerquery'), path.join(tmp, 'powerquery'), {recursive: true});
    fs.cpSync(projectPaths(root, business).directory, projectPaths(tmp, business).directory, {recursive: true});
    const files = fs.readdirSync(projectPaths(tmp, business).directory, {recursive: true})
      .map(file => path.join(projectPaths(tmp, business).directory, file)).filter(file => fs.statSync(file).isFile());
    const before = new Map(files.map(file => [file, fs.readFileSync(file)]));
    configure(tmp, [business]);
    configure(tmp, [business]);
    for (const [file, bytes] of before) assert.ok(fs.readFileSync(file).equals(bytes), path.relative(tmp, file));
    assert.deepEqual(fs.readdirSync(path.join(tmp, 'powerbi')), [business]);
  } finally {fs.rmSync(tmp, {recursive: true, force: true});}
});
