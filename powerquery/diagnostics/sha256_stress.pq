// Optional Desktop test: paste in a blank query, disable load, then evaluate.
// Public test data only; never substitute this binary/hash for the real workbook.
let
    Cases = {
        [Caso = "Vacio", Bytes = #binary({}), Esperado = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
        [Caso = "abc", Bytes = Text.ToBinary("abc", TextEncoding.Utf8),
            Esperado = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
        [Caso = "Un millon de a (15626 bloques)", Bytes = Text.ToBinary(Text.Repeat("a", 1000000), TextEncoding.Utf8),
            Esperado = "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"],
        [Caso = "Dos millones de a (31251 bloques)", Bytes = Text.ToBinary(Text.Repeat("a", 2000000), TextEncoding.Utf8),
            Esperado = "bcf7f9d1b4311c3352e60502255ce09a6744df84e8f2c89f79c4b5d74933a95a"]
    },
    Rows = List.Transform(Cases, (item) =>
        let digest = fxSHA256(item[Bytes])
        in [Caso = item[Caso], SHA256 = digest,
            Resultado = if digest = item[Esperado] then "OK" else error "SHA256 distinto del vector conocido"])
in
    Table.Buffer(Table.FromRecords(Rows, type table [Caso = text, SHA256 = text, Resultado = text]))
