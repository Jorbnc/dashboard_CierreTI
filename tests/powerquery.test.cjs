const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {DefaultSettings, TaskUtils} = require('@microsoft/powerquery-parser');
const {expressions, replacePartition, partition, legacyPartition, DEFAULT_PATH, FUNCTIONS} = require('../tools/configure-xlsx.cjs');
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
test('ruta Windows con espacios se conserva literalmente y Cierre usa el parametro', async () => {
  const sources = Object.fromEntries(FUNCTIONS.map(fn => [fn, '(x) => x']));
  const declaration = expressions('', sources).split('\n')[0];
  assert.equal(declaration.match(/= "([^"]*)"/)[1], DEFAULT_PATH);
  assert.ok(path.win32.isAbsolute(DEFAULT_PATH));
  await parses(declaration.replace('expression pWorkbookPath = ', ''), 'Parametro Windows');
  for (const business of ['banco_chile', 'banco_peru', 'retail_chile', 'retail_peru']) {
    assert.ok(partition(business).includes('File.Contents(pWorkbookPath)'));
    assert.ok(!partition(business).includes(DEFAULT_PATH));
  }
});
test('migracion idempotente conserva ruta local y expresiones ajenas', () => {
  const sources = Object.fromEntries(FUNCTIONS.map(fn => [fn, '(x) => x']));
  const previous = 'expression pWorkbookPath = "D:\\Otra carpeta\\2610_dashboard_data.xlsx"\n\tlineageTag: original\n\nexpression Ajena = 42\n';
  const result = expressions(previous, sources);
  assert.equal(result, expressions(result, sources));
  assert.ok(result.includes(previous.trim()));
  assert.equal((result.match(/expression pWorkbookPath/g) || []).length, 1);
  assert.ok(!expressions('expression pDataFile = "old.json"\n', sources).includes('old.json'));
  assert.throws(() => expressions('texto desconocido', sources), /no reconocidas/);
  assert.throws(() => expressions('expression pDataFile = "old.json"\nexpression LocalAudit = Json.Document(File.Contents(pDataFile))\n', sources), /depende de pDataFile/);
  assert.ok(!expressions(previous + '\nexpression fxSHA256 = (x) => x\n', sources).includes('fxSHA256'));
  assert.throws(() => expressions('expression Audit = fxSHA256(null)\n', sources), /depende de fxSHA256/);
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
test('actualizar funciones conserva sus lineageTag y anotaciones guardadas por Desktop', () => {
  const sources = Object.fromEntries(FUNCTIONS.map(fn => [fn, '(x) => x + 1']));
  const previous = FUNCTIONS.map(fn => `expression ${fn} =\n\t\t(x) => x\n\tlineageTag: ${fn}-id\n\n\tannotation Local = keep\n`).join('\n');
  const result = expressions(previous, sources);
  for (const fn of FUNCTIONS) {
    assert.ok(result.includes(`expression ${fn} =\n\t\t(x) => x + 1\n\tlineageTag: ${fn}-id`));
  }
  assert.equal((result.match(/annotation Local = keep/g) || []).length, 2);
  assert.equal(expressions(result, sources), result);
});
test('lector sin fuentes remotas, Python, Node ni cero para invalidos', () => {
  const code = fs.readFileSync(path.join(root, 'powerquery/fxCierreXlsx.pq'), 'utf8');
  assert.ok(code.includes('Excel.Workbook'));
  for (const banned of ['Web.Contents', 'Python.Execute', 'R.Execute', 'otherwise 0', 'pDataFile']) assert.ok(!code.includes(banned), banned);
});
test('lector conserva millones CLP y miles PEN del agregado, sin redondear', () => {
  const code = fs.readFileSync(path.join(root, 'powerquery/fxCierreXlsx.pq'), 'utf8');
  assert.ok(code.includes('divisor = 1,'));
  assert.ok(code.includes('delta = difference,'));
  assert.ok(!/\/\s*1000\b|else 1000|Number\.Round\(/.test(code));
});
test('lector sin hashes mantiene excepcion delimitada y localizador sin fold', () => {
  const reader = fs.readFileSync(path.join(root, 'powerquery/fxCierreXlsx.pq'), 'utf8');
  assert.ok(!/sha256|digest|hash/i.test(reader));
  assert.deepEqual(FUNCTIONS, ['fxCierreSum', 'fxCierreXlsx']);
  assert.ok(reader.includes('SourceName = ConfirmedSource and Business = "banco_peru"'));
  assert.ok(!fs.existsSync(path.join(root, 'powerquery/fxSHA256.pq')));
  const locate = reader.slice(reader.indexOf('    Locate ='), reader.indexOf('    ReadCurrency ='));
  assert.ok(locate.includes('headers = List.Buffer'));
  assert.ok(!locate.includes('List.Accumulate'));
});
test('historico AJ/AV estricto y FORECAST auxiliar solo diagnostico', () => {
  const code = fs.readFileSync(path.join(root, 'powerquery/fxCierreXlsx.pq'), 'utf8');
  assert.ok(code.includes('List.Select({36, 48}'));
  assert.ok(code.includes('Require(List.Count(historyColumns) <= 1'));
  assert.ok(code.includes('CheckDates(header, historyColumn + 1, Year - 1)'));
  assert.ok(code.includes('Amounts(_, historyColumn + 1)'));
  assert.ok(code.includes('historyColumn + 13'));
  assert.ok(code.includes('ColumnName(historyColumn + 12)'));
  assert.ok(code.includes('block = 59 and Year = 2026 and Cutoff = 9'));
  assert.ok(code.includes('Series = (row as number) as record => [execution = Amounts(row, 3), budget = Amounts(row, 18)]'));
  assert.ok(code.includes('findings = AuditForecast(header, block, last, unit)'));
  assert.ok(code.includes('List.Count(List.Buffer(Findings))'));
});
test('excepcion 2610 explicita mantiene comprobaciones y rango propio, sin heredar a otros cierres', () => {
  const code = fs.readFileSync(path.join(root, 'powerquery/fxCierreXlsx.pq'), 'utf8');
  for (const text of ['exception2610 = standard and SourceName = "2610_dashboard_data.xlsx" and Business = "banco_peru"',
    'block = 59 and Year = 2026 and Cutoff = 10 and unit = "MSoles" and historyColumn = 48',
    'IsLabel(58, 61, "R25")', 'Date.Year(Cell(58, 49)) = 2026',
    'if exception then CheckDates(header, historyColumn + 1, Year)',
    'Amounts(66, historyColumn + 1)', 'Cell(66, historyColumn + 13)',
    'ColumnName(historyColumn + 1) & "66:"', 'CAPEX sin No Direccionable',
    'All({baseValid, adjustmentValid, finalValid, forcedValid})']) assert.ok(code.includes(text), text);
});
test('migracion retira solo la columna obsoleta y mantiene las otras identidades', () => {
  const before = 'table Cierre\n\tlineageTag: table-id\n\n';
  const obsolete = '\tcolumn sha256\n\t\tdataType: string\n\t\tlineageTag: old\n\t\tsourceColumn: sha256\n\n';
  const after = '\tcolumn actual\n\t\tdataType: double\n\t\tlineageTag: amount-id\n\n';
  assert.equal(replacePartition(before + obsolete + after + partition('banco_peru'), 'banco_peru'), before + after + partition('banco_peru'));
  assert.ok(!/sha256/i.test(acceptanceQuery({business: 'banco_chile', rows: fixture()})));
});
