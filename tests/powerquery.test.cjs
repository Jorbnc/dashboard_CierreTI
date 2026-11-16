const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {DefaultSettings, TaskUtils} = require('@microsoft/powerquery-parser');
const {expressions, replacePartition, partition, legacyPartition, FUNCTIONS} = require('../tools/configure-xlsx.cjs');
const {acceptanceQuery} = require('../tools/export-powerquery-qa.cjs');
const {fixture} = require('./adapter.test.cjs');
const root = path.resolve(__dirname, '..');
async function parses(code, context) {
  const result = await TaskUtils.tryLexParse(DefaultSettings, code);
  assert.ok(TaskUtils.isParseStageOk(result), `${context}: ${result.error?.message || result.stage}`);
}
for (const fn of FUNCTIONS) test(`sintaxis M oficial: ${fn} (no ejecuta motor M)`, async () => {
  await parses(fs.readFileSync(path.join(root, 'powerquery', `${fn}.pq`), 'utf8'), fn);
});
test('particion nativa y consulta opcional QA tienen sintaxis M valida', async () => {
  await parses(partition('banco_peru').split('\t\tsource =\n')[1], 'Particion');
  await parses(acceptanceQuery({business: 'banco_chile', rows: fixture()}), 'QA');
});
test('migracion idempotente conserva ruta local y expresiones ajenas', () => {
  const sources = Object.fromEntries(FUNCTIONS.map(fn => [fn, '(x) => x']));
  const previous = 'expression pWorkbookPath = "D:\\Datos\\2610_dashboard_data.xlsx"\n\tlineageTag: original\n\nexpression Ajena = 42\n';
  const result = expressions(previous, sources);
  assert.equal(result, expressions(result, sources));
  assert.ok(result.includes(previous.trim()));
  assert.equal((result.match(/expression pWorkbookPath/g) || []).length, 1);
  assert.ok(!expressions('expression pDataFile = "old.json"\n', sources).includes('old.json'));
  assert.throws(() => expressions('texto desconocido', sources), /no reconocidas/);
  assert.throws(() => expressions('expression pDataFile = "old.json"\nexpression LocalAudit = Json.Document(File.Contents(pDataFile))\n', sources), /depende de pDataFile/);
});
test('solo reemplaza particion conocida, sin cambiar columnas ni lineage', () => {
  const prefix = 'table Cierre\n\tlineageTag: keep\n\tcolumn actual\n\t\tdataType: double\n\n';
  const old = prefix + legacyPartition('banco_chile');
  const result = replacePartition(old, 'banco_chile');
  assert.ok(result.startsWith(prefix));
  assert.equal(replacePartition(result, 'banco_chile'), result);
  assert.throws(() => replacePartition(old.replace('Json.Document(File.Contents(pDataFile))', 'Custom()'), 'banco_chile'), /personalizada/);
  assert.throws(() => replacePartition(old.replace('    Typed\n', '    Table.FirstN(Typed, 1)\n'), 'banco_chile'), /personalizada/);
  assert.throws(() => replacePartition(old + '\tpartition Otro = m\n', 'banco_chile'), /una sola/);
  assert.throws(() => partition('unknown'), /desconocido/);
});
test('lector sin fuentes remotas, Python, Node ni cero para invalidos', () => {
  const code = fs.readFileSync(path.join(root, 'powerquery/fxCierreXlsx.pq'), 'utf8');
  assert.ok(code.includes('Excel.Workbook'));
  for (const banned of ['Web.Contents', 'Python.Execute', 'R.Execute', 'otherwise 0', 'pDataFile']) assert.ok(!code.includes(banned), banned);
});
test('SHA de archivo no encadena un fold por cada bloque ni acumula todo el historial', () => {
  const source = fs.readFileSync(path.join(root, 'powerquery/fxSHA256.pq'), 'utf8');
  const compute = source.slice(source.indexOf('    Compute ='), source.indexOf('    // Fail closed'));
  assert.ok(compute.includes('List.Generate('));
  assert.ok(compute.includes('() => List.Buffer({0} & Initial)'));
  assert.ok(compute.includes('(state) => state{0} <= blockCount'));
  assert.ok(compute.includes('else List.Buffer({state{0} + 1} & Compress'));
  assert.ok(compute.includes('List.Range(List.Last(states), 1, 8)'));
  assert.ok(!compute.includes('List.Accumulate'));
  assert.ok(!compute.includes('List.Buffer(states)'));
  const reader = fs.readFileSync(path.join(root, 'powerquery/fxCierreXlsx.pq'), 'utf8');
  const locate = reader.slice(reader.indexOf('    Locate ='), reader.indexOf('    ReadCurrency ='));
  assert.ok(locate.includes('headers = List.Buffer'));
  assert.ok(!locate.includes('List.Accumulate'));
});
test('diagnostico M de volumen: sintaxis y vector publico correcto, no ejecucion nativa', async () => {
  const source = fs.readFileSync(path.join(root, 'powerquery/diagnostics/sha256_stress.pq'), 'utf8');
  await parses(source, 'SHA stress');
  for (const size of [1000000, 2000000]) {
    const hash = require('node:crypto').createHash('sha256').update('a'.repeat(size)).digest('hex');
    assert.ok(source.includes(hash));
    assert.ok(source.includes(`Text.Repeat("a", ${size})`));
  }
});
