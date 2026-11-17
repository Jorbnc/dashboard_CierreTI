const path = require('node:path');
const assert = require('node:assert/strict');
const {scopes} = require('../src/adapter');

// Desktop-saved project names are independent of the financial business key.
const projectNames = {banco_chile: 'Gastos TI BR CL', banco_peru: 'Gastos TI BR PE'};
function projectPaths(root, business) {
  assert.ok(Object.hasOwn(scopes, business), 'Negocio desconocido');
  const name = projectNames[business] || business;
  const directory = path.join(root, 'powerbi', business);
  return {name, directory, pbip: path.join(directory, `${name}.pbip`),
    report: path.join(directory, `${name}.Report`), model: path.join(directory, `${name}.SemanticModel`)};
}
function selectedBusinesses(args = []) {
  if (!args.length) return Object.keys(scopes);
  assert.ok(args.length === 2 && args[0] === '--business' && Object.hasOwn(scopes, args[1]),
    'Uso: --business <negocio>; omitir para los cuatro proyectos');
  return [args[1]];
}
module.exports = {projectPaths, selectedBusinesses};
