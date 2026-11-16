const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
require('./build-lock.cjs').assertBuildAccess(root);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const provenance = JSON.parse(read('src/shared/provenance.json'));
for (const [file, hash] of Object.entries(provenance.sha256)) {
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'src/shared', file))).digest('hex') !== hash)
    throw new Error(`Copia compartida modificada: ${file}. Sincronizar desde CierreGastosTI.`);
}
const out = path.join(root, 'src/generated'); fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'source.ts'), 'export const snapshot: {business: string; rows: any[]} | null = null;\n');
for (const name of ['app', 'model', 'classic', 'proposal']) {
  let source = read(`src/shared/${name}.js`);
  if (['classic', 'proposal'].includes(name)) {
    const object = `Cierre${name[0].toUpperCase()}${name.slice(1)}`;
    source = source.replace(`globalThis.${object} =`, `const ${object} =`) + `\nmodule.exports = ${object};\n`;
  }
  fs.writeFileSync(path.join(out, `${name}.js`), source);
}
const template = read('src/shared/index.html').match(/<body[^>]*>([\s\S]*?)<script id="report-data"/)[1];
const styles = ['style', 'classic', 'proposal'].map(name => read(`src/shared/${name}.css`)).join('\n')
  .replace(/:root/g, '.cierre-app').replace(/\bbody\b/g, '.cierre-app');
const image = (file, mime) => `data:${mime};base64,${fs.readFileSync(path.join(root, 'src/shared/branding', file)).toString('base64')}`;
const brands = {
  peru: image('peru.svg', 'image/svg+xml'), chile: image('chile.svg', 'image/svg+xml'),
  bank: image('banco_ripley.png', 'image/png'), retail: image('retail_ripley.png', 'image/png'),
};
fs.writeFileSync(path.join(out, 'ui.ts'), `export const markup = ${JSON.stringify(template)};\nexport const styles = ${JSON.stringify(styles + '\n.cierre-app {height:100%;min-height:0;overflow:auto;}')} ;\nexport const brands = ${JSON.stringify(brands)};\n`);
const fields = require('../src/fields.json');
const capabilities = {
  dataRoles: Object.keys(fields).map(name => ({name, displayName: name, kind: 'Grouping'})),
  dataViewMappings: [{conditions: [Object.fromEntries(Object.keys(fields).map(name => [name, {min: 1, max: 1}]))],
    table: {rows: {select: Object.keys(fields).map(name => ({for: {in: name}})), dataReductionAlgorithm: {window: {count: 1000}}}}}],
  privileges: [], supportsKeyboardFocus: true, supportsLandingPage: true, supportsEmptyDataView: true,
};
fs.writeFileSync(path.join(root, 'capabilities.json'), JSON.stringify(capabilities, null, 2) + '\n');
// SDK requires a small PNG icon. This is a bundled brand asset, not a data snapshot.
fs.mkdirSync(path.join(root, 'assets'), {recursive: true});
fs.copyFileSync(path.join(root, 'src/shared/branding/banco_ripley.png'), path.join(root, 'assets/icon.png'));
console.log('UI compartida verificada; capacidades sin acceso de red ni datos incrustados.');
