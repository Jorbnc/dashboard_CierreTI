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
