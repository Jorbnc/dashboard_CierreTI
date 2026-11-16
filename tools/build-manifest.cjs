const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const reference = path.join(root, '.tmp/build-reference');
function current() {
  const files = ['package.json', 'package-lock.json', 'pbiviz.json', 'capabilities.json', 'tsconfig.json', 'tools/prepare.cjs', 'tools/build-manifest.cjs'];
  for (const folder of ['src', 'style']) for (const name of fs.readdirSync(path.join(root, folder), {recursive: true})) {
    const file = `${folder}/${name}`.replaceAll('\\', '/');
    if (!file.startsWith('src/generated/') && fs.statSync(path.join(root, file)).isFile()) files.push(file);
  }
  const {visual} = require('../pbiviz.json');
  return {artifact: `dist/${visual.guid}.${visual.version}.pbiviz`, inputs: files.sort()};
}
function record() {
  const manifest = current();
  for (const file of [...manifest.inputs, manifest.artifact]) {
    const dest = path.join(reference, file);
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.copyFileSync(path.join(root, file), dest);
  }
  fs.writeFileSync(path.join(root, '.tmp/build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}
function verify() {
  const saved = JSON.parse(fs.readFileSync(path.join(root, '.tmp/build-manifest.json')));
  const message = 'Paquete desactualizado; ejecutar npm run build antes de preparar los PBIP.';
  assert.deepEqual(current(), saved, message);
  for (const file of [...saved.inputs, saved.artifact])
    assert.ok(fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(reference, file))), `${message} ${file}`);
}
if (require.main === module) {
  if (process.argv[2] === 'record') record();
  else verify();
}
module.exports = {verify};
