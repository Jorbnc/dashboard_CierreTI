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
  const names = args.slice(1);
  assert.ok(args[0] === '--business' && names.length && names.every(name => Object.hasOwn(scopes, name))
    && new Set(names).size === names.length, 'Uso: --business <negocio> [<negocio> ...]; omitir para los cuatro proyectos');
  return names;
}
module.exports = {projectPaths, selectedBusinesses};
