/* Install native M queries without changing report layouts or local workbook paths. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {scopes} = require('../src/adapter');
const fields = require('../src/fields.json');
const DEFAULT_PATH = 'C:\\CierreTI\\datos\\2609_dashboard_data.xlsx';
const FUNCTIONS = ['fxCierreSum', 'fxCierreXlsx'];
const expression = (name, code) => `expression ${name} =\n${code.trim().split('\n').map(line => '\t\t' + line).join('\n')}\n`;
const parameter = () => `expression pWorkbookPath = "${DEFAULT_PATH}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n`;
function partition(business) {
  assert.ok(Object.hasOwn(scopes, business), 'Negocio desconocido');
  return ['\tpartition Cierre = m', '\t\tmode: import', '\t\tsource =',
    '\t\t\t\tlet',
    '\t\t\t\t    SourceName = List.Last(Text.Split(Text.Replace(pWorkbookPath, "\\", "/"), "/")),',
    '\t\t\t\t    Workbook = Binary.Buffer(File.Contents(pWorkbookPath)),',
    `\t\t\t\t    Result = fxCierreXlsx(Workbook, SourceName, "${business}")`,
    '\t\t\t\tin', '\t\t\t\t    Result', ''].join('\n');
}
function legacyPartition(business) {
  const mTypes = {string: 'type text', int64: 'Int64.Type', double: 'type number'};
  const query = ['let', '    Input = Json.Document(File.Contents(pDataFile)),',
    `    Checked = if Input[schema] = 1 and Input[business] = "${business}" then Input[rows] else error "Archivo de otro negocio o esquema no compatible",`,
    `    Scope = if List.Count(Checked) > 0 and List.AllTrue(List.Transform(Checked, each [business] = "${business}" and [expected_rows] = List.Count(Checked))) then Checked else error "Negocio incorrecto o entrega incompleta",`,
    `    Records = Table.FromRecords(Scope, {${Object.keys(fields).map(c => `"${c}"`).join(', ')}}, MissingField.Error),`,
    `    Typed = Table.TransformColumnTypes(Records, {${Object.entries(fields).map(([k, t]) => `{"${k}", ${mTypes[t]}}`).join(', ')}}, "en-US")`,
    'in', '    Typed'];
  return ['\tpartition Cierre = m', '\t\tmode: import', '\t\tsource =', ...query.map(line => '\t\t\t\t' + line), ''].join('\n');
}
function expressions(previous, sources) {
  const blocks = previous.trim() ? previous.trim().split(/\n(?=expression )/).map(block => block.trimEnd()) : [];
  assert.ok(blocks.every(block => /^expression [A-Za-z][A-Za-z0-9_]*\s*=/.test(block)),
    'Expresiones no reconocidas; revisar manualmente antes de migrar');
  const name = block => block.match(/^expression ([A-Za-z][A-Za-z0-9_]*)\s*=/)[1];
  assert.equal(new Set(blocks.map(name)).size, blocks.length, 'Expresiones duplicadas');
  const retained = blocks.filter(block => ![...FUNCTIONS, 'fxSHA256', 'pDataFile'].includes(name(block)));
  assert.ok(!retained.some(block => /\bpDataFile\b/.test(block)),
    'Otra expresion depende de pDataFile: revisar la migracion antes de quitar el parametro');
  assert.ok(!retained.some(block => /\bfxSHA256\b/.test(block)),
    'Otra expresion depende de fxSHA256: retirar esa consulta antes de migrar');
  if (!retained.some(block => name(block) === 'pWorkbookPath')) retained.unshift(parameter().trim());
  return retained.join('\n\n') + '\n\n' + FUNCTIONS.map(fn => expression(fn, sources[fn])).join('\n');
}
function replacePartition(previous, business) {
  assert.equal((previous.match(/^\tpartition /gm) || []).length, 1, 'Se esperaba una sola particion Cierre');
  const start = previous.indexOf('\tpartition Cierre = m\n');
  assert.ok(start >= 0, 'Particion Cierre desconocida');
  const tail = previous.slice(start);
  assert.ok(!/^\t(?:annotation|column|measure|hierarchy) /m.test(tail), 'Hay metadatos despues de la particion: revisar manualmente');
  const normalized = text => text.replaceAll('\r\n', '\n').trimEnd();
  assert.ok([partition(business), legacyPartition(business)].some(known => normalized(tail) === normalized(known)),
    'La particion fue personalizada: no se sobrescribe');
  const columns = previous.slice(0, start).replace(/^\tcolumn sha256\n(?:\t\t[^\n]*\n|\n)*/m, '');
  assert.ok(!/\bsha256\b/i.test(columns), 'Referencia local a la columna retirada: revisar antes de migrar');
  return columns + partition(business);
}
function configure(root) {
  require('./build-lock.cjs').assertBuildAccess(root);
  const sources = Object.fromEntries(FUNCTIONS.map(fn => [fn, fs.readFileSync(path.join(root, 'powerquery', `${fn}.pq`), 'utf8')]));
  const changes = [];
  for (const business of Object.keys(scopes)) {
    const definition = path.join(root, 'powerbi', business, `${business}.SemanticModel/definition`);
    const expr = path.join(definition, 'expressions.tmdl'), table = path.join(definition, 'tables/Cierre.tmdl');
    changes.push([expr, expressions(fs.readFileSync(expr, 'utf8'), sources)]);
    changes.push([table, replacePartition(fs.readFileSync(table, 'utf8'), business)]);
    const visualFile = path.join(root, 'powerbi', business, `${business}.Report/definition/pages/cierreti000000000001/visuals/cierrevisual000000001/visual.json`);
    const visual = JSON.parse(fs.readFileSync(visualFile, 'utf8'));
    delete visual.visual.query.queryState.sha256;
    assert.ok(!/\bsha256\b/i.test(JSON.stringify(visual)), 'Referencia local al campo retirado en el visual');
    changes.push([visualFile, JSON.stringify(visual, null, 2) + '\n']);
  }
  // Validate all projects before writing any; unknown local edits stop the migration.
  for (const [file, value] of changes) if (fs.readFileSync(file, 'utf8') !== value) fs.writeFileSync(file, value);
  const manifest = {schema: 1, mode: 'xlsx', parameters: ['pWorkbookPath'], sheet: 'Comité',
    functions: FUNCTIONS,
    desktopValidated: false, servicePublished: false};
  fs.writeFileSync(path.join(root, 'powerquery/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return changes.map(([file]) => path.relative(root, file));
}
if (require.main === module) {
  configure(path.resolve(__dirname, '..'));
  console.log('4 PBIP conectados a XLSX; pWorkbookPath existente y layouts conservados. Ejecutar Actualizar en Desktop.');
}
module.exports = {configure, expressions, replacePartition, partition, legacyPartition, DEFAULT_PATH, FUNCTIONS};
