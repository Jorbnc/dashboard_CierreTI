// Binary64 expansion summation, including the half-even final correction used by math.fsum.
// Used for validation only: published cells are never rounded or reconstructed from totals.
(Values as list) as number =>
let
    Finite = (x as any) as logical =>
        Value.Is(x, type number) and not Number.IsNaN(x) and Number.Abs(x) <> #infinity,
    Partials = List.Accumulate(Values, {}, (partials, value) =>
        let
            seed = if Finite(value) then value
                else error Error.Record("Cierre.Number", "Nonfinite or nonnumeric summand.", null),
            folded = List.Accumulate(partials, [x = seed, parts = {}], (state, part) =>
                let
                    large = if Number.Abs(state[x]) < Number.Abs(part) then part else state[x],
                    small = if Number.Abs(state[x]) < Number.Abs(part) then state[x] else part,
                    hi = large + small,
                    lo = small - (hi - large),
                    kept = if lo <> 0 then state[parts] & {lo} else state[parts]
                in if Finite(hi) then [x = hi, parts = List.Buffer(kept)]
                    else error Error.Record("Cierre.Number", "Overflow in finite sum.", null))
        in List.Buffer(folded[parts] & (if folded[x] <> 0 then {folded[x]} else {}))),
    Count = List.Count(Partials),
    Collapsed = if Count = 0 then [hi = 0, lo = 0, remaining = 0, stopped = true]
        else List.Accumulate(List.Reverse(List.Numbers(0, Count - 1)),
            [hi = Partials{Count - 1}, lo = 0, remaining = Count - 1, stopped = false],
            (state, i) => if state[stopped] then state else
                let
                    hi = state[hi] + Partials{i},
                    lo = Partials{i} - (hi - state[hi])
                in [hi = hi, lo = lo, remaining = i, stopped = lo <> 0]),
    SameSign = Collapsed[remaining] > 0 and
        ((Collapsed[lo] < 0 and Partials{Collapsed[remaining] - 1} < 0) or
         (Collapsed[lo] > 0 and Partials{Collapsed[remaining] - 1} > 0)),
    TwiceLow = Collapsed[lo] * 2,
    Corrected = Collapsed[hi] + TwiceLow,
    Result = if SameSign and Corrected - Collapsed[hi] = TwiceLow then Corrected else Collapsed[hi]
in
    if Finite(Result) then Result
    else error Error.Record("Cierre.Number", "Nonfinite sum.", null)
