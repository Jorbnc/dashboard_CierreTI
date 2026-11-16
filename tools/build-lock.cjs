const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
function assertBuildAccess(root) {
  const file = path.join(root, '.tmp/build.lock');
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') !== process.env.CIERRE_BUILD_TOKEN)
    throw new Error('Hay otra compilacion activa. No ejecutar build, prepare ni package en paralelo.');
}
function acquireBuildLock(root) {
  fs.mkdirSync(path.join(root, '.tmp'), {recursive: true});
  const file = path.join(root, '.tmp/build.lock'), token = randomUUID();
  let fd;
  try {fd = fs.openSync(file, 'wx');} catch (error) {
    if (error.code === 'EEXIST') throw new Error('Hay otra compilacion activa (.tmp/build.lock).');
    throw error;
  }
  fs.writeFileSync(fd, token); fs.closeSync(fd);
  const previous = process.env.CIERRE_BUILD_TOKEN;
  process.env.CIERRE_BUILD_TOKEN = token;
  return () => {
    if (previous === undefined) delete process.env.CIERRE_BUILD_TOKEN;
    else process.env.CIERRE_BUILD_TOKEN = previous;
    fs.unlinkSync(file);
  };
}
module.exports = {assertBuildAccess, acquireBuildLock};
