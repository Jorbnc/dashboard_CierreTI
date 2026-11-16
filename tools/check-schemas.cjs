/* Only public Microsoft schemas are downloaded; all definitions stay local. */
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const root = path.resolve(__dirname, '..');
const delivery = process.argv[2] ? path.resolve(process.argv[2]) : root;
async function main() {
  const ajv = new Ajv({strict: false, allErrors: true, loadSchema: async uri => {
    if (!uri.startsWith('https://developer.microsoft.com/json-schemas/')) throw new Error(`Origen inesperado: ${uri}`);
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Esquema no disponible: ${response.status} ${uri}`);
    return response.json();
  }});
  const schemas = new Map(); let count = 0;
  for (const name of fs.readdirSync(path.join(delivery, 'powerbi'), {recursive: true})) {
    const file = path.join(delivery, 'powerbi', name);
    if (!fs.statSync(file).isFile() || !/\.(json|pbip|pbir|pbism)$/.test(file) || name.includes('CustomVisuals')) continue;
    const value = JSON.parse(fs.readFileSync(file));
    if (!value.$schema) continue;
    if (!schemas.has(value.$schema)) schemas.set(value.$schema, await ajv.compileAsync({$ref: value.$schema}));
    const validate = schemas.get(value.$schema);
    if (!validate(value)) throw new Error(`${name}: ${JSON.stringify(validate.errors)}`);
    count++;
  }
  console.log(`${count} definiciones válidas contra ${schemas.size} esquemas oficiales. No ejecuta Desktop/TMDL.`);
}
main().catch(error => {console.error(error); process.exitCode = 1;});
