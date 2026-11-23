/* Create PBIP scaffolds once; subsequent releases replace only our visual resources. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {unzipSync} = require('fflate');
const {projects: scopes} = require('../src/adapter');
const fields = require('../src/fields.json');
const {projectPaths, selectedBusinesses} = require('./project-paths.cjs');
const businesses = selectedBusinesses(process.argv.slice(2));
const root = path.resolve(__dirname, '..');
require('./build-lock.cjs').assertBuildAccess(root);
require('./build-manifest.cjs').verify();
const config = require('../pbiviz.json');
const guid = config.visual.guid;
const uuid = () => crypto.randomUUID();
const write = (file, value, createOnly = true) => {
  if (createOnly && fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
};
const schema = (type, version) => `https://developer.microsoft.com/json-schemas/fabric/item/report/definition/${type}/${version}/schema.json`;
const archive = fs.readFileSync(path.join(root, 'dist', `${guid}.${config.visual.version}.pbiviz`));
const entries = unzipSync(archive);
const resourceName = `resources/${guid}.pbiviz.json`;
const decode = key => JSON.parse(Buffer.from(entries[key]).toString('utf8'));
const metadata = decode('package.json'), resource = decode(resourceName);
require('node:assert/strict').deepEqual(resource.capabilities.privileges, [{name:'ExportContent', essential:false}]);
if (metadata.visual.guid !== guid || metadata.visual.version !== config.visual.version)
  throw new Error('Identidad o permisos inesperados en el paquete.');
const columns = Object.keys(fields);
for (const business of businesses) {
  const scope = scopes[business];
  const {name, pbip, report, model} = projectPaths(root, business);
  if (scope.members) for (const [folder,type] of [[report,'Report'],[model,'SemanticModel']]) {
    write(path.join(folder,'.platform'), {
      $schema:'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json',
      metadata:{type, displayName:name}, config:{version:'2.0',logicalId:uuid()},
    });
  }
  write(pbip, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json', version: '1.0',
    artifacts: [{report: {path: `${name}.Report`}}], settings: {enableAutoRecovery: true},
  });
  write(path.join(report, 'definition.pbir'), {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json',
    version: '4.0', datasetReference: {byPath: {path: `../${name}.SemanticModel`}},
  });
  write(path.join(model, 'definition.pbism'), {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json', version: '4.2', settings: {},
  });
  write(path.join(model, 'definition/database.tmdl'), 'database\n\tcompatibilityLevel: 1606\n');
  write(path.join(model, 'definition/model.tmdl'), 'model Model\n\tculture: es-ES\n\tdefaultPowerBIDataSourceVersion: powerBI_V3\n\tsourceQueryCulture: en-US\n\nannotation __PBI_TimeIntelligenceEnabled = 0\n\nref table Cierre\n');
  const initialPath = require('./configure-xlsx.cjs').DEFAULT_PATH.replace('2609_dashboard_data.xlsx','2610_dashboard_data_final.xlsx');
  write(path.join(model, 'definition/expressions.tmdl'), `expression pWorkbookPath = "${initialPath}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n\tlineageTag: ${uuid()}\n`);
  const table = ['table Cierre', `\tlineageTag: ${uuid(business + ':table')}`, ''];
  for (const [column, type] of Object.entries(fields)) {
    table.push(`\tcolumn ${column}`, `\t\tdataType: ${type}`, `\t\tlineageTag: ${uuid(business + ':' + column)}`,
      '\t\tsummarizeBy: none', `\t\tsourceColumn: ${column}`, '');
  }
  table.push(require('./configure-xlsx.cjs').partition(business));
  write(path.join(model, 'definition/tables/Cierre.tmdl'), table.join('\n'));
  write(path.join(report, 'definition/version.json'), {$schema: schema('versionMetadata', '1.0.0'), version: '2.0.0'});
  const reportPath = path.join(report, 'definition/report.json');
  const definition = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath)) : {$schema: schema('report', '3.3.0'), themeCollection: {}, settings: {exportDataMode: 'None'}};
  definition.themeCollection ||= {};
  const registration = {name: guid, type: 'CustomVisual', items: [{name: `${guid}.pbiviz.json`, path: `${guid}.pbiviz.json`, type: 'CustomVisualMetadata'}]};
  if (!(definition.resourcePackages || []).some(p => p.name === guid)) {
    definition.resourcePackages = [...(definition.resourcePackages || []), registration];
    write(reportPath, definition, false);
  }
  write(path.join(report, 'CustomVisuals', guid, 'package.json'), metadata, false);
  write(path.join(report, 'CustomVisuals', guid, resourceName), resource, false);
  const page = 'cierreti000000000001', instance = 'cierrevisual000000001';
  write(path.join(report, 'definition/pages/pages.json'), {$schema: schema('pagesMetadata', '1.0.0'), pageOrder: [page], activePageName: page});
  write(path.join(report, `definition/pages/${page}/page.json`), {$schema: schema('page', '2.1.0'), name: page, displayName: scope.entity, displayOption: 'FitToPage', height: 960, width: 1600});
  const literal = Value => ({expr: {Literal: {Value}}});
  write(path.join(report, `definition/pages/${page}/visuals/${instance}/visual.json`), {
    $schema: schema('visualContainer', '2.13.0'), name: instance,
    position: {x: 0, y: 0, z: 0, width: 1600, height: 960, tabOrder: 0},
    visual: {visualType: guid, query: {queryState: Object.fromEntries(columns.map(field => [field, {projections: [{
      field: {Column: {Expression: {SourceRef: {Entity: 'Cierre'}}, Property: field}}, queryRef: `Cierre.${field}`, nativeQueryRef: field,
    }]}]))}, visualContainerObjects: {
      ...Object.fromEntries(['title', 'background', 'border', 'visualHeader'].map(name => [name, [{properties: {show: literal('false')}}]])),
      padding: [{properties: Object.fromEntries(['top', 'bottom', 'left', 'right'].map(side => [side, literal('0D')]))}],
    }, drillFilterOtherVisuals: false},
  });
}
fs.mkdirSync(path.join(root, 'artifacts'), {recursive: true});
fs.writeFileSync(path.join(root, 'artifacts/cierre-gastos-ti.pbiviz'), archive);
fs.copyFileSync(path.join(root, '.tmp/drop/visual.js.LICENSE.txt'), path.join(root, 'artifacts/THIRD_PARTY_LICENSES.txt'));
require('./configure-xlsx.cjs').configure(root, businesses);
const sources = {};
for (const folder of ['src', 'tools', 'style', 'powerquery']) {
  for (const file of fs.readdirSync(path.join(root, folder), {recursive: true})) {
    const relative = `${folder}/${file}`.replaceAll('\\', '/');
    if (relative.startsWith('src/generated/') || !fs.statSync(path.join(root, relative)).isFile()) continue;
    sources[relative] = fs.statSync(path.join(root, relative)).size;
  }
}
for (const file of ['package.json', 'package-lock.json', 'capabilities.json', 'pbiviz.json', 'tsconfig.json']) sources[file] = fs.statSync(path.join(root, file)).size;
write(path.join(root, 'artifacts/cierre-gastos-ti.manifest.json'), {guid, version: config.visual.version, apiVersion: config.apiVersion,
  bytes: archive.length, dataEmbedded: false, businesses, sourceFiles: sources, desktopValidated: false, servicePublished: false}, false);
console.log(`PBIP preparados: ${businesses.join(', ')}. Parámetros y diseños existentes conservados; falta validación en Desktop/Service.`);
