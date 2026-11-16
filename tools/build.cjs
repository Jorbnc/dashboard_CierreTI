const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {acquireBuildLock} = require('./build-lock.cjs');
const root = path.resolve(__dirname, '..');
const release = acquireBuildLock(root);
try {
  for (const [file, args] of [
    ['tools/prepare.cjs', []], ['node_modules/typescript/bin/tsc', ['--noEmit']],
    ['node_modules/powerbi-visuals-tools/bin/pbiviz.js', ['package']], ['tools/build-manifest.cjs', ['record']],
  ]) {
    const result = spawnSync(process.execPath, [path.join(root, file), ...args], {cwd: root, stdio: 'inherit'});
    if (result.status !== 0) throw new Error(`Fallo ${file}: ${result.error || result.status}`);
  }
} finally {release();}
