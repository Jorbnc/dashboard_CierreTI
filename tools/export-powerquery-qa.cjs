/* Private, optional Desktop acceptance queries. Production never reads this data. */
const fs = require('node:fs');
const path = require('node:path');
const {gzipSync} = require('node:zlib');
const {scopes, fromRows} = require('../src/adapter');
const {verifyPreparation, verifyPreview} = require('./snapshot-lib.cjs');
const fields = require('../src/fields.json');
function acceptanceQuery(input) {
  fromRows(input.rows);
  const encoded = gzipSync(Buffer.from(JSON.stringify(input.rows))).toString('base64');
  const columns = Object.keys(fields).map(name => `"${name}"`).join(', ');
  return `// Referencia privada: ${input.business}. No incorporar a Git ni al modelo publicado.
// Crear una consulta en blanco en Desktop, pegar en Editor avanzado y desactivar su carga.
let
    Expected = Table.FromRecords(Json.Document(Binary.Decompress(Binary.FromText("${encoded}", BinaryEncoding.Base64), Compression.GZip))),
    Actual = Table.SelectColumns(Cierre, {${columns}}, MissingField.Error),
    SortedExpected = Table.ToRecords(Table.Sort(Expected, {{"id", Order.Ascending}})),
    SortedActual = Table.ToRecords(Table.Sort(Actual, {{"id", Order.Ascending}})),
    Count = List.Count(SortedExpected),
    CountOK = Table.RowCount(Actual) = Count,
    Equal = (a as any, b as any) as logical =>
        if a = null or b = null then a = b
        else if Value.Is(a, type number) and Value.Is(b, type number)
        then Number.Abs(a - b) <= List.Max({0.0000000001, Number.Abs(b) * 0.000000000001})
        else a = b,
    Differences = if not CountOK then error "Cantidad de filas distinta de la referencia Python"
        else List.Combine(List.Transform({0..Count - 1}, (i) =>
            List.Transform(List.Select({${columns}}, (key) =>
                not Equal(Record.Field(SortedActual{i}, key), Record.Field(SortedExpected{i}, key))),
                (key) => [id = SortedExpected{i}[id], campo = key,
                    esperado = Record.Field(SortedExpected{i}, key), obtenido = Record.Field(SortedActual{i}, key)]))),
    SHAOK = fxSHA256(Text.ToBinary("", TextEncoding.Utf8)) = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        and fxSHA256(Text.ToBinary("abc", TextEncoding.Utf8)) = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    Result = if not SHAOK then error "SHA256 no coincide con los vectores conocidos"
        else if not List.IsEmpty(Differences) then error Error.Record("Paridad", "Diferencias con Python", List.FirstN(Differences, 20))
        else #table({"Estado", "Negocio", "Filas", "Posiciones monetarias"}, {{"OK", "${input.business}", Count, Count * 4}})
in
    Result
`;
}
function main(root) {
  verifyPreparation(root);
  const output = path.join(root, 'data/qa');
  fs.mkdirSync(output, {recursive: true});
  let positions = 0;
  for (const business of Object.keys(scopes)) {
    const input = JSON.parse(fs.readFileSync(path.join(root, 'data', `${business}.json`)));
    positions += verifyPreview(root, business, input);
    fs.writeFileSync(path.join(output, `${business}.pq`), acceptanceQuery(input));
  }
  console.log(`Referencias privadas para ${positions} posiciones exportadas en data/qa/. Pendiente ejecutar estas consultas en Desktop.`);
}
if (require.main === module) main(path.resolve(__dirname, '..'));
module.exports = {acceptanceQuery};
