// Dependency: fxCierreSum. Import each .pq as a function expression.
// Authority: visuals/cierre_mensual.py and visuals/powerbi.py, schema 3 / rows schema 1.
// Excel.Workbook reads cached cells, never recalculates formulas or writes the XLSX.
// https://learn.microsoft.com/powerquery-m/excel-workbook
// Inspect Value.Metadata(result)[CierreDiagnostics] BEFORE further table transformations.
// Diagnostics are not columns and are not persisted by a semantic model automatically.
(Workbook as binary, SourceName as text, Business as text) as table =>
let
    FinalSource = SourceName = "2610_dashboard_data_final.xlsx",
    SheetName = if FinalSource then "BASE" else "Comit#(00E9)",
    ConfirmedSource = "2609_dashboard_data.xlsx",
    BankCapex = {"Core", "J2C", "Partner", "Planilla TI", "RC TI"},
    BankOpex = {"Core", "Cyber", "Partner", "Procesamiento", "Soporte", "Licencias",
        "Telecomunicaciones", "Personal Externo", "Planilla TI", "RC TI"},
    Businesses = [
        banco_peru = [entity = "Banco Ripley Per#(00FA)", source_label = "Banco Per#(00FA)",
            brand = "bank", default_currency = "MSoles",
            units = {[unit = "MMCLP", marker = "Pesos Chilenos"], [unit = "MSoles", marker = "Soles"]},
            categories = [Capex = BankCapex, Opex = BankOpex]],
        banco_chile = [entity = "Banco Ripley Chile", source_label = "Banco Chile",
            brand = "bank", default_currency = "MMCLP",
            units = {[unit = "MMCLP", marker = "Pesos Chilenos"]},
            categories = [Capex = {"Core", "Platun", "J2C", "Partner", "Planilla TI", "RC TI"}, Opex = BankOpex]],
        retail_chile = [entity = "Retail Chile", source_label = "Chile", brand = "retail", default_currency = "MMCLP",
            units = {[unit = "MMCLP", marker = "RETAIL"]},
            categories = [Capex = {"N/A", "Proyectos", "RRHH"}, CO = {"Proyectos"},
                Opex = {"Ciberseguridad", "Licencias", "Procesamiento", "Proyectos", "RRHH", "Soporte", "Telecomunicaciones"}]],
        retail_peru = [entity = "Retail Per#(00FA)", source_label = "Per#(00FA)", brand = "retail", default_currency = "MMCLP",
            units = {[unit = "MMCLP", marker = "RETAIL"]},
            categories = [Capex = {"Proyectos"}, Opex = {"Ciberseguridad", "Licencias", "RRHH", "Soporte", "Telecomunicaciones"}]]
    ],
    Labels = [Core = "Core de tarjetas", Partner = "Accenture",
        #"Planilla TI" = "Personal TI Banco", #"RC TI" = "Personal TI Corporativo"],
    Fail = (message as text) as any => error Error.Record("Cierre.Validation", message,
        [source = SourceName, sheet = SheetName, business = Business]),
    Require = (condition as logical, message as text) as logical => if condition then true else Fail(message),
    All = (checks as list) as logical => List.AllTrue(List.Buffer(checks)),
    N = (value as number) as text => Number.ToText(value, "0", "en-US"),
    Finite = (value as any) as logical =>
        Value.Is(value, type number) and not Number.IsNaN(value) and Number.Abs(value) <> #infinity,
    Amount = (value as any, context as text) as number =>
        if Finite(value) then value else Fail("Importe ausente o no num#(00E9)rico: " & context),
    Equal = (actual as any, expected as number, context as text) as logical =>
        let
            a = Amount(actual, context), e = Amount(expected, context),
            tolerance = List.Max({0.000001, 0.0000000001 * List.Max({Number.Abs(a), Number.Abs(e)})})
        in Require(Number.Abs(a - e) <= tolerance, "No cuadra " & context),
    Suffix = "_dashboard_data.xlsx",
    NameValid = FinalSource or (Text.Length(SourceName) = 4 + Text.Length(Suffix) and
        Text.Lower(Text.Range(SourceName, 4), "en-US") = Suffix and
        Text.Select(Text.Start(SourceName, 4), {"0".."9"}) = Text.Start(SourceName, 4)),
    NameChecked = if Require(NameValid, "La fuente debe identificarse como YYMM_dashboard_data.xlsx") then SourceName else "",
    Year = 2000 + Number.FromText(Text.Start(NameChecked, 2), "en-US"),
    MonthParsed = Number.FromText(Text.Range(NameChecked, 2, 2), "en-US"),
    Cutoff = if Require(MonthParsed >= 1 and MonthParsed <= 12,
        "La fuente debe identificarse como YYMM_dashboard_data.xlsx") then MonthParsed else 0,
    Config = if Record.HasFields(Businesses, Business) then Record.Field(Businesses, Business)
        else Fail("Negocio no reconocido: " & Business),
    Kinds = Record.FieldNames(Config[categories]),
    Buffered = Binary.Buffer(Workbook),
    // Select the worksheet, not a suggested table. Do not promote headers or infer dimensions.
    Navigation = Excel.Workbook(Buffered, [UseHeaders = false, DelayTypes = true, InferSheetDimensions = false]),
    Sheets = Table.SelectRows(Navigation, each [Item] = SheetName and [Kind] = "Sheet"),
    Sheet = if Require(Table.RowCount(Sheets) = 1, "Hoja " & SheetName & " ausente o ambigua") then Sheets{0}[Data] else #table({}, {}),
    // Preserve Excel error cells as values until the owning current/history validation reads them.
    RawRows = List.Buffer(List.Transform(Table.ToRows(Sheet), (row) =>
        List.Buffer(List.Transform(List.Positions(row), (column) => try row{column})))),
    Raw = (row as number, column as number) as any =>
        try RawRows{row}{column}[Value] otherwise null,
    // The supported worksheet starts at B1. Hosts may omit its empty column A.
    // Accept only the two unambiguous representations; never guess other offsets.
    OmittedA = Raw(0, 0) = "Pesos Chilenos" and Raw(1, 0) = "Real + Proyecci#(00F3)n",
    HasA = Raw(0, 0) = null and Raw(1, 0) = null and
        Raw(0, 1) = "Pesos Chilenos" and Raw(1, 1) = "Real + Proyecci#(00F3)n",
    Rows = if OmittedA then List.Buffer(List.Transform(RawRows,
        each List.Buffer({[HasError = false, Value = null]} & _)))
        else if HasA then RawRows else Fail("Origen de hoja no compatible: se espera el bloque Pesos Chilenos en B1 y su encabezado en B2"),
    RowCount = List.Count(Rows),
    ColumnName = (column as number) as text =>
        if column <= 26 then Character.FromNumber(64 + column)
        else @ColumnName(Number.IntegerDivide(column - 1, 26)) & Character.FromNumber(65 + Number.Mod(column - 1, 26)),
    Address = (row as number, column as number) as text => ColumnName(column) & N(row),
    Cell = (row as number, column as number) as any =>
        if row < 1 or row > RowCount or column < 1 or column > List.Count(Rows{row - 1}) then null
        else let read = Rows{row - 1}{column - 1}
        in if read[HasError] then Fail("Error de celda: " & SheetName & "!" & Address(row, column)) else read[Value],
    IsLabel = (row as number, column as number, label as text) as logical =>
        try Cell(row, column) = label otherwise false,
    Amounts = (row as number, start as number) as list => List.Buffer(List.Transform({0..11},
        (month) => Amount(Cell(row, start + month), SheetName & "!" & Address(row, start + month)))),
    // Native Excel dates only. Unsupported serial/text dates fail closed, without epoch/locale guesses.
    CheckDates = (row as number, start as number, year as number) as logical => All(List.Transform({1..12},
        (month) => let value = Cell(row, start + month - 1)
        in Require((Value.Is(value, type datetime) or Value.Is(value, type date)) and
            Date.Year(value) = year and Date.Month(value) = month,
            "Per#(00ED)odo inesperado: " & SheetName & "!" & Address(row, start + month - 1)))),
    Series = (row as number) as record => [execution = Amounts(row, 3), budget = Amounts(row, 18)],
    // The separate FORECAST block is diagnostic only; execution stays in C:N.
    AuditForecast = (header as number, block as number, last as number, unit as text) as list =>
        if not IsLabel(header, 32, "FORECAST") then {} else
        let
            prefix = unit & ", FORECAST AF:AS (encabezado fila " & N(header) & ")",
            audit = try (
                let
                    checked = CheckDates(header, 33, Year),
                    matched = List.Buffer(List.Select({block..last}, each IsLabel(_, 32, Cell(_, 2)))),
                    labels = List.Transform(List.Difference({block..last}, matched), each "B" & N(_) & "/AF" & N(_)),
                    cells = List.Buffer(List.Combine(List.Transform(matched, (row) =>
                        List.Transform({0..11}, (month) =>
                            let reference = try Cell(row, 33 + month), current = Cell(row, 3 + month),
                                valid = not reference[HasError] and Finite(reference[Value]),
                                same = if valid then (try Equal(reference[Value], current, "FORECAST"))[HasError] = false else false
                            in [invalid = if valid then null else Address(row, 33 + month),
                                difference = if valid and not same then Address(row, 3 + month) & "/" & Address(row, 33 + month) else null])))),
                    invalid = List.RemoveNulls(List.Transform(cells, each [invalid])),
                    differences = List.RemoveNulls(List.Transform(cells, each [difference])),
                    annual = List.RemoveNulls(List.Transform(matched, (row) =>
                        let values = try List.Buffer(Amounts(row, 33)),
                            total = if values[HasError] then [HasError = false]
                                else try Equal(Cell(row, 45), fxCierreSum(values[Value]), "FORECAST anual")
                        in if total[HasError] then Address(row, 45) else null)),
                    details = {[label = "etiquetas distintas (filas no comparadas)", cells = labels],
                        [label = "importes ausentes/no num#(00E9)ricos", cells = invalid],
                        [label = "pares con diferencias REAL + Proyecci#(00F3)n/FORECAST", cells = differences],
                        [label = "totales anuales inv#(00E1)lidos", cells = annual]}
                in if checked then List.Buffer(List.Transform(List.Select(details, each List.Count([cells]) > 0),
                    each prefix & ": " & N(List.Count([cells])) & " " & [label] & "; primeras referencias: " &
                        Text.Combine(List.FirstN([cells], 5), ", ") & ".")) else {}),
            findings = if audit[HasError] then {prefix & ": control no evaluable: " & audit[Error][Message] & "."} else audit[Value]
        in List.Buffer({prefix & ": bloque independiente no utilizado. El dashboard conserva REAL + Proyecci#(00F3)n de C:N."} & findings),
    Locate = (marker as text, unit as text) as record =>
        let
            // Independent bounded sections, not a chain of deferred header/match records.
            headers = List.Buffer(List.Select(List.Numbers(2, List.Max({0, RowCount - 2})),
                each IsLabel(_, 2, "Real + Proyecci#(00F3)n"))),
            found = List.Combine(List.Transform(List.Positions(headers), (i) =>
                let
                    header = headers{i},
                    last = if i + 1 < List.Count(headers) then headers{i + 1} - 1 else RowCount,
                    matches = if IsLabel(header - 1, 2, marker) then
                        List.Select(List.Numbers(header + 1, last - header), each IsLabel(_, 2, Config[source_label]))
                        else {}
                in List.Transform(matches, (row) => [block = row, header = header])))
        in if Require(List.Count(found) = 1, "Bloque de " & Config[entity] & " ambiguo o ausente: " & unit)
            then found{0} else [],
    ReadCurrency = (definition as record) as record =>
        let
            unit = definition[unit],
            // Source blocks already use millions of CLP or thousands of PEN.
            divisor = 1,
            location = Locate(definition[marker], unit),
            block = location[block], header = location[header],
            last = block + List.Sum(List.Transform(Record.FieldValues(Config[categories]), each 1 + List.Count(_))),
            types = List.Buffer(List.Transform(Kinds, (kind) =>
                let
                    expected = Record.Field(Config[categories], kind),
                    matches = List.Select(List.Numbers(block + 1, last - block), each IsLabel(_, 2, kind)),
                    parent = if Require(List.Count(matches) = 1, "No se identifica " & kind & " en " & unit)
                        then matches{0} else 0,
                    children = List.Numbers(parent + 1, List.Count(expected)),
                    values = Series(parent),
                    childValues = List.Buffer(List.Transform(children, Series)),
                    checks = All({
                        Require(List.Transform(children, each Cell(_, 2)) = expected, "Cambi#(00F3) el detalle de " & kind & " en " & unit),
                        Require(List.Transform({parent} & children, each Cell(_, 17)) = {kind} & expected,
                            "No coincide el detalle PPTO de " & kind & " en " & unit),
                        All(List.Transform({[start = 3, annual = 15, field = "execution"], [start = 18, annual = 30, field = "budget"]},
                            (scenario) => All({
                                All(List.Transform({0..11}, (month) => Equal(Record.Field(values, scenario[field]){month},
                                    fxCierreSum(List.Transform(childValues, each Record.Field(_, scenario[field]){month})),
                                    unit & " " & kind & " mes " & N(month + 1)))),
                                All(List.Transform({parent} & children, (row) => Equal(Cell(row, scenario[annual]),
                                    fxCierreSum(Amounts(row, scenario[start])), unit & " anual fila " & N(row))))
                            })))
                    })
                in if checks then [kind = kind, parent = parent, children = children,
                    categories = expected, values = values, child_values = childValues, valid = true] else Fail("Detalle no validado"))),
            total = Series(block),
            currentValid = All({
                CheckDates(header, 3, Year), CheckDates(header, 18, Year),
                Require(IsLabel(header, 17, "Presupuesto"), "No se identifica el bloque de presupuesto"),
                Require(Cell(block, 2) = Cell(block, 17), "Los bloques REAL/FCST y PPTO no corresponden a la misma entidad"),
                All(List.Transform(types, each [valid])),
                All(List.Transform({[start = 3, annual = 15, field = "execution"], [start = 18, annual = 30, field = "budget"]},
                    (scenario) => All({
                        All(List.Transform({0..11}, (month) => Equal(Record.Field(total, scenario[field]){month},
                            fxCierreSum(List.Transform(types, each Record.Field([values], scenario[field]){month})),
                            unit & " total mes " & N(month + 1)))),
                        Equal(Cell(block, scenario[annual]), fxCierreSum(Amounts(block, scenario[start])), unit & " anual")
                    })))
            }),
            unavailable = "No disponible: el bloque auxiliar no est#(00E1) identificado como " & N(Year - 1) & " REAL.",
            // Known layouts only: AJ (2609) or AV (2610), never the FORECAST block.
            historyColumns = List.Buffer(List.Select({36, 48}, each IsLabel(header, _, N(Year - 1) & " REAL"))),
            historyColumn = if List.Count(historyColumns) = 1 then historyColumns{0} else 36,
            retail = Text.StartsWith(Business, "retail_"),
            detailedRetail = retail and FinalSource,
            ReadHistory = () as record =>
                let
                    standard = if Require(List.Count(historyColumns) <= 1,
                        "Hist#(00F3)rico ambiguo: m#(00E1)s de un bloque REAL del a#(00F1)o anterior")
                        then List.Count(historyColumns) = 1 else false,
                    exception2609 = not standard and SourceName = ConfirmedSource and Business = "banco_peru" and
                        block = 59 and Year = 2026 and Cutoff = 9 and unit = "MSoles" and
                        IsLabel(57, 2, "Soles") and IsLabel(57, 36, "Soles") and
                        IsLabel(59, 2, "Banco Per#(00FA)") and IsLabel(59, 36, "Banco Per#(00FA)") and
                        IsLabel(58, 36, "Presupuesto") and IsLabel(58, 49, "P26"),
                    exception2610 = standard and SourceName = "2610_dashboard_data.xlsx" and Business = "banco_peru" and
                        block = 59 and Year = 2026 and Cutoff = 10 and unit = "MSoles" and historyColumn = 48 and
                        IsLabel(57, 2, "Soles") and IsLabel(57, 48, "Soles") and
                        IsLabel(59, 2, "Banco Per#(00FA)") and IsLabel(59, 48, "Banco Per#(00FA)") and
                        IsLabel(58, 61, "R25") and (try Date.Year(Cell(58, 49)) = 2026 otherwise false),
                    finalHistory = standard and FinalSource and SheetName = "BASE" and Business = "banco_peru" and
                        block = 59 and Year = 2026 and Cutoff = 10 and unit = "MSoles" and historyColumn = 48,
                    exceptionFinal = finalHistory and IsLabel(57, 2, "Soles") and IsLabel(57, 48, "Soles") and
                        IsLabel(59, 2, "Banco Per#(00FA)") and IsLabel(59, 48, "Banco Per#(00FA)") and
                        IsLabel(58, 61, "R25") and (try Date.Year(Cell(58, 49)) = 2026 otherwise false),
                    needsAdjustment = exception2609 or exception2610,
                    exception = needsAdjustment or exceptionFinal,
                    headerValid = if exception then CheckDates(header, historyColumn + 1, Year)
                        else if standard then CheckDates(header, historyColumn + 1, Year - 1) else Fail(unavailable),
                    parents = List.Transform(Kinds, (kind) =>
                        let candidates = List.Select(List.Numbers(block + 1, last - block + (if retail then 0 else 2)), each IsLabel(_, historyColumn, kind))
                        in if Require(List.Count(candidates) = 1, "Hist#(00F3)rico ambiguo: " & kind)
                            then candidates{0} else 0),
                    rawRows = List.Buffer(List.Transform(parents & {block}, each Amounts(_, historyColumn + 1))),
                    names = Kinds & {"Total"},
                    prior = Record.FromList(List.Transform(rawRows, each List.Buffer(List.Transform(_, (v) => v / divisor))), names),
                    baseValid = All({
                        headerValid,
                        Require(Cell(block, historyColumn) = Cell(block, 2), "Hist#(00F3)rico de otra entidad o sin identificaci#(00F3)n"),
                        All(List.Transform(List.Positions(names), (i) => Equal(Cell((parents & {block}){i}, historyColumn + 13),
                            fxCierreSum(rawRows{i}), "hist#(00F3)rico " & (if names{i} = "Total" then "total" else names{i})))),
                        All(List.Transform({0..11}, (month) => Equal(prior[Total]{month},
                            fxCierreSum(List.Transform(Kinds, (kind) => Record.Field(prior, kind){month})), "hist#(00F3)rico por tipo")))
                    }),
                    // The final workbook already includes No Direccionable in its subtotals.
                    finalSourceValid = if not finalHistory then true else All(List.Transform({
                        [kind = "Capex", parent = 60, children = {61..66}, labels = BankCapex & {"No Direccionable"}],
                        [kind = "Opex", parent = 67, children = {68..77}, labels = BankOpex]
                    }, (group) => All({
                        Require(IsLabel(group[parent], historyColumn, group[kind]) and
                            List.Transform(group[children], each Cell(_, historyColumn)) = group[labels],
                            "Cambi#(00F3) el detalle hist#(00F3)rico final " & group[kind]),
                        All(List.Transform(group[children], (row) => Equal(Cell(row, historyColumn + 13),
                            fxCierreSum(Amounts(row, historyColumn + 1)), "hist#(00F3)rico final anual fila " & N(row)))),
                        All(List.Transform({0..11}, (month) => Equal(Record.Field(prior, group[kind]){month} * divisor,
                            fxCierreSum(List.Transform(group[children], each Amounts(_, historyColumn + 1){month})),
                            "hist#(00F3)rico final con detalle completo mes " & N(month + 1))))
                    }))),
                    added = if needsAdjustment then Amounts(66, historyColumn + 1) else {},
                    scaledAdded = List.Buffer(List.Transform(added, each _ / divisor)),
                    historicalChildren = if needsAdjustment then List.Buffer(List.Transform({61..65}, each Amounts(_, historyColumn + 1))) else {},
                    adjustmentValid = if not needsAdjustment then true else All({
                        Require(List.Transform({61..66}, each Cell(_, historyColumn)) = BankCapex & {"No Direccionable"},
                            "Cambi#(00F3) el detalle hist#(00F3)rico CAPEX en soles"),
                        Equal(Cell(66, historyColumn + 13), fxCierreSum(added), "hist#(00F3)rico No Direccionable anual"),
                        All(List.Transform({0..11}, (month) => Equal(prior[Capex]{month} * divisor,
                            fxCierreSum(List.Transform(historicalChildren, each _{month})),
                            "hist#(00F3)rico CAPEX sin No Direccionable mes " & N(month + 1))))
                    }),
                    adjusted = if not needsAdjustment then prior else Record.TransformFields(prior,
                        List.Transform({"Capex", "Total"}, (kind) => {kind, (values) => List.Buffer(List.Transform({0..11},
                            (month) => fxCierreSum({values{month}, scaledAdded{month}})))})),
                    finalValid = if not needsAdjustment then true else All(List.Transform({0..11}, (month) =>
                        Equal(adjusted[Total]{month}, fxCierreSum({adjusted[Capex]{month}, adjusted[Opex]{month}}),
                            "hist#(00F3)rico ajustado por tipo"))),
                    // A try over a record alone does not catch deferred errors in its lists.
                    // Force every prior scalar and every validation inside this function's try boundary.
                    forced = Table.Buffer(Table.FromRows(List.Transform({0..11}, (month) =>
                        List.Transform(names, (kind) => Record.Field(adjusted, kind){month})), names)),
                    forcedValid = All(List.Transform(Table.ToRows(forced), (row) => All(List.Transform(row, Finite)))),
                    detailValid = if not detailedRetail then true else All(List.Transform(types, (g) => All({
                        All(List.Transform({g[parent]} & g[children], (r) => All({
                            Require(Cell(r, historyColumn) = Cell(r, 2), "Detalle historico Retail distinto"),
                            Equal(Cell(r, historyColumn + 13), fxCierreSum(Amounts(r, historyColumn + 1)), "Historico anual Retail")}))),
                        All(List.Transform({0..11}, (i) => Equal(Record.Field(prior, g[kind]){i},
                            fxCierreSum(List.Transform(g[children], (r) => Cell(r, historyColumn + 1 + i))), "Historico Retail por mes")))
                    }))),
                    valid = All({baseValid, finalSourceValid, adjustmentValid, finalValid, forcedValid, detailValid}),
                    adjustedRecord = Record.FromList(List.Transform(names, each List.Buffer(Table.Column(forced, _))), names)
                in if valid then [prior = adjustedRecord, exception = exception,
                    note = "REAL " & N(Year - 1) & (if exception then " confirmado" else " validado") &
                        (if detailedRetail then " para total, OPEX y CAPEX y categor#(00ED)as." else " para total, OPEX y CAPEX; no para categor#(00ED)as."),
                    adjustment = if needsAdjustment then [category = "No Direccionable",
                        source_range = ColumnName(historyColumn + 1) & "66:" & ColumnName(historyColumn + 12) & "66",
                        added = scaledAdded, original_capex = prior[Capex], original_total = prior[Total]] else null]
                    else Fail("Hist#(00F3)rico no validado"),
            historyTry = try ReadHistory(),
            history = if historyTry[HasError] then [prior = null, exception = false, adjustment = null,
                note = historyTry[Error][Message]] else historyTry[Value],
            visibleNote = if history[prior] <> null then "REAL " & N(Year - 1) &
                (if detailedRetail then " disponible para total, OPEX, CAPEX y categor#(00ED)as." else " disponible para total, OPEX y CAPEX; no para categor#(00ED)as.")
                else "Hist#(00F3)rico " & N(Year - 1) & " no disponible en " & unit & ".",
            ranges = [execution_forecast = "C" & N(block) & ":N" & N(last),
                budget = "R" & N(block) & ":AC" & N(last),
                prior = if history[prior] <> null then ColumnName(historyColumn + 1) & N(block) & ":" &
                    ColumnName(historyColumn + 12) & N(if retail then last else last + 1) else ""],
            groups = {[level = "total", kind = "", category = "", label = "Total", values = total]} &
                List.Combine(List.Transform(types, (group) =>
                    {[level = "type", kind = group[kind], category = "", label = group[kind], values = group[values]]} &
                    List.Transform(List.Positions(group[categories]), (i) =>
                        [level = "category", kind = group[kind], category = group[categories]{i},
                         label = Record.FieldOrDefault(Labels, group[categories]{i}, group[categories]{i}), detailRow = group[children]{i}, values = group[child_values]{i}]))),
            resultRows = List.Combine(List.Transform(groups, (group) => List.Transform({1..12}, (month) => [
                business = Business, entity = Config[entity], brand = Config[brand], default_currency = Config[default_currency],
                year = Year, cutoff = Cutoff, source = SourceName, sheet = SheetName,
                unit = unit, level = group[level], kind = group[kind], category = group[category], label = group[label], month = month,
                actual = if month <= Cutoff then group[values][execution]{month - 1} / divisor else null,
                forecast = if month > Cutoff then group[values][execution]{month - 1} / divisor else null,
                budget = group[values][budget]{month - 1} / divisor,
                prior = if history[prior] = null then null else if group[level] = "category" then
                    (if detailedRetail then Cell(group[detailRow], historyColumn + month) else null) else
                    Record.Field(history[prior], if group[level] = "total" then "Total" else group[kind]){month - 1},
                range_execution_forecast = ranges[execution_forecast], range_budget = ranges[budget], range_prior = ranges[prior],
                history_note = visibleNote
            ])))
        in if currentValid then [unit = unit, rows = resultRows, history = history, ranges = ranges, valid = true,
            findings = List.Combine({AuditForecast(header, block, last, unit),
                if FinalSource and block = 29 and unit = "MMCLP" and not IsLabel(28, 61, "R25") then
                    {"MMCLP: BI28 no contiene R25; encabezado auxiliar no utilizado. " &
                     "El hist#(00F3)rico se valida por AV28, AW28:BH28 y sus cuadraturas."} else {}})]
            else Fail("Datos corrientes no validados"),
    Currencies = List.Buffer(List.Transform(Config[units], ReadCurrency)),
    CurrentValid = All(List.Transform(Currencies, each [valid])),
    FlatRows = List.Buffer(List.Combine(List.Transform(Currencies, each [rows]))),
    ExpectedRows = List.Count(FlatRows),
    IdentifiedRows = List.Transform(List.Positions(FlatRows), (i) =>
        Record.Combine({FlatRows{i}, [id = Business & ":" & N(i), expected_rows = ExpectedRows]})),
    RowType = type table [
        id = text, business = text, entity = text, brand = text, default_currency = text,
        year = Int64.Type, cutoff = Int64.Type, source = text, sheet = text,
        unit = text, level = text, kind = text, category = text, label = text, month = Int64.Type,
        actual = nullable number, forecast = nullable number, budget = nullable number, prior = nullable number,
        range_execution_forecast = text, range_budget = text, range_prior = text, history_note = text, expected_rows = Int64.Type
    ],
    Typed = Table.TransformColumnTypes(Table.FromRecords(IdentifiedRows, RowType, MissingField.Error),
        {{"year", Int64.Type}, {"cutoff", Int64.Type}, {"month", Int64.Type}, {"expected_rows", Int64.Type},
         {"actual", Double.Type}, {"forecast", Double.Type}, {"budget", Double.Type}, {"prior", Double.Type}}, "en-US"),
    ExceptionUsed = List.AnyTrue(List.Transform(Currencies, each [history][exception])),
    HistoryNotes = if not ExceptionUsed then {} else if FinalSource then {
        "Excepci#(00F3)n confirmada para 2610 final, hoja BASE: AW59:BH77 es REAL 2025 en soles bajo " &
        "AV58=2025 REAL y BI58=R25, aunque AW58:BH58 mantiene fechas de 2026. Solo para esta fuente, " &
        "cierre, entidad, moneda, rangos y cuadraturas; no se modifica el XLSX.",
        "No Direccionable ya est#(00E1) incluido en los subtotales hist#(00F3)ricos CAPEX y Total. " &
        "Se valida el detalle completo y los anuales sin sumar AW66:BH66 de nuevo ni ajustar montos."
    } else {
        if SourceName = "2610_dashboard_data.xlsx" then
        "Excepci#(00F3)n confirmada para 2610: AW59:BH77, con totales anuales en BI, es REAL 2025 " &
        "en soles. AV58 dice 2025 REAL y BI58 R25, pero AW58:BH58 conserva fechas de 2026. " &
        "Se interpreta como enero-diciembre de 2025 sin modificar el Excel ni convertir monedas; " &
        "solo para esta fuente, cierre, entidad, moneda, encabezados, rangos y cuadraturas."
        else "Excepci#(00F3)n confirmada por el usuario para esta fuente 2609: el bloque en soles " &
        "AK59:AV77, con totales anuales en AW, corresponde a REAL 2025 aunque AJ58 indique " &
        "Presupuesto, AK58:AV58 contenga fechas de 2026 y AW58 diga P26. No se modifica " &
        "el Excel ni se aplica una conversi#(00F3)n monetaria.",
        "Ajuste autorizado: se incorpora No Direccionable (" &
        (if SourceName = "2610_dashboard_data.xlsx" then "AW66:BH66" else "AK66:AV66") & ") al CAPEX y Total " &
        "REAL 2025 en soles, como ya ocurre en CLP. Posible omisi#(00F3)n manual del subtotal " &
        "original; causa pendiente de confirmar en la fuente. Se conservan los subtotales " &
        "originales en la trazabilidad del ajuste. OPEX 2025 y todos los importes 2026 no cambian."
    },
    AuditRetail = () as list =>
        let
            sections = List.Select(List.Numbers(1, RowCount), each IsLabel(_, 2, "RETAIL")),
            header = if Require(List.Count(sections) = 1, "Secci#(00F3)n RETAIL ausente o ambigua") then sections{0} + 1 else 0,
            countries = {"Chile", "Per#(00FA)", "RETAIL CORP"},
            countryRows = List.Transform(countries, (name) =>
                let matches = List.Select(List.Numbers(header + 1, List.Max({0, RowCount - header})),
                    each IsLabel(_, 2, name) and IsLabel(_, 17, name))
                in if Require(List.Count(matches) = 1, "Subtotal " & name & " ausente o ambiguo") then matches{0} else 0),
            scenarios = List.Transform({[name = "REAL + FCST", start = 3, annual = 15], [name = "PPTO", start = 18, annual = 30]},
                (scenario) =>
                    let
                        values = List.Buffer(List.Transform(countryRows, each Amounts(_, scenario[start]))),
                        annualValid = All(List.Transform({0..2}, (i) => Equal(Cell(countryRows{i}, scenario[annual]),
                            fxCierreSum(values{i}), countries{i} & " " & scenario[name] & " anual"))),
                        findings = List.RemoveNulls(List.Transform({0..11}, (month) =>
                            let
                                corp = values{2}{month}, sum = fxCierreSum({values{0}{month}, values{1}{month}}),
                                difference = corp - sum,
                                tolerance = List.Max({0.000001, 0.0000000001 * List.Max({Number.Abs(corp), Number.Abs(sum)})}),
                                delta = difference,
                                cells = List.Transform(countryRows, each Address(_, scenario[start] + month))
                            in if Number.Abs(difference) <= tolerance then null else scenario[name] & " " & N(Year) & "-" &
                                Text.PadStart(N(month + 1), 2, "0") & ": RETAIL CORP (" & cells{2} & ") menos Chile + Per#(00FA) " &
                                "(" & cells{0} & " + " & cells{1} & ") = " & (if delta >= 0 then "+" else "") &
                                Number.ToText(delta, "0.000000000", "en-US") & " MMCLP. " &
                                "El subtotal Corp no se usa ni se reparte; los HTML usan los bloques pa#(00ED)s validados."))
                    in if annualValid then List.Buffer(findings) else Fail("Subtotal no validado")),
            checks = All({CheckDates(header, 3, Year), CheckDates(header, 18, Year)})
        in if checks then List.Buffer(List.Combine(scenarios)) else Fail("Subtotal no validado"),
    RetailTry = if Config[brand] = "retail" then try AuditRetail() else [HasError = false, Value = {}],
    Findings = List.Combine(List.Transform(Currencies, each [findings])) &
        (if RetailTry[HasError] then {"Control del subtotal RETAIL CORP no evaluable: " & RetailTry[Error][Message] &
        ". No se utiliza este subtotal para completar o corregir los bloques pa#(00ED)s."} else RetailTry[Value]),
    Diagnostics = [source = SourceName, sheet = SheetName, business = Business,
        year = Year, cutoff = Cutoff, history_notes = HistoryNotes, source_findings = Findings,
        currencies = Record.FromList(List.Transform(Currencies, each [
            history_note = [history][note], history_exception = [history][exception],
            history_adjustment = [history][adjustment],
            ranges = [execution_forecast = [ranges][execution_forecast], budget = [ranges][budget],
                prior = if [ranges][prior] = "" then null else [ranges][prior]]
        ]), List.Transform(Currencies, each [unit]))],
    // The final value depends on all mandatory checks, not on unused let assertions.
    // Buffer scalar output cells so optional-history errors cannot escape their try above.
    Result = if CurrentValid and Cutoff >= 1 and
        List.Count(List.Buffer(Findings)) >= 0 then Table.Buffer(Typed)
        else Fail("Validaci#(00F3)n incompleta")
in
    Value.ReplaceMetadata(Result, [CierreDiagnostics = Diagnostics])
