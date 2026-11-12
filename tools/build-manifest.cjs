const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
function current() {
  const files = ['package.json', 'package-lock.json', 'pbiviz.json', 'capabilities.json', 'tsconfig.json', 'tools/prepare.cjs', 'tools/build-manifest.cjs'];
  for (const folder of ['src', 'style']) for (const name of fs.readdirSync(path.join(root, folder), {recursive: true})) {
    const file = `${folder}/${name}`.replaceAll('\\', '/');
    if (!file.startsWith('src/generated/') && fs.statSync(path.join(root, file)).isFile()) files.push(file);
  }
  const {visual} = require('../pbiviz.json');
  return {artifact: hash(`dist/${visual.guid}.${visual.version}.pbiviz`), inputs: Object.fromEntries(files.sort().map(file => [file, hash(file)]))};
}
function verify() {
  const saved = JSON.parse(fs.readFileSync(path.join(root, '.tmp/build-manifest.json')));
  assert.deepEqual(current(), saved, 'Paquete desactualizado; ejecutar npm run build antes de preparar los PBIP.');
}
if (require.main === module) {
  if (process.argv[2] === 'record') fs.writeFileSync(path.join(root, '.tmp/build-manifest.json'), JSON.stringify(current(), null, 2) + '\n');
  else verify();
}
module.exports = {verify};
