// FIPS 180-4 SHA-256 over the exact binary, using documented Desktop M functions.
// https://csrc.nist.gov/pubs/fips/180-4/upd1/final
// https://learn.microsoft.com/powerquery-m/number-functions
// No extension-only Crypto.CreateHash or undocumented Binary.Hash dependency.
(Content as binary) as text =>
let
    Mask = 0xffffffff,
    Modulus = 0x100000000,
    U32 = (x as number) as number => Number.Mod(x, Modulus),
    Xor3 = (a as number, b as number, c as number) as number =>
        Number.BitwiseXor(Number.BitwiseXor(a, b), c),
    Rotate = (x as number, n as number) as number =>
        Number.BitwiseShiftRight(x, n) +
        Number.BitwiseShiftLeft(Number.BitwiseAnd(x, Number.Power(2, n) - 1), 32 - n),
    Bytes = (x as number) as list => List.Transform({24, 16, 8, 0},
        (shift) => Number.BitwiseAnd(Number.BitwiseShiftRight(x, shift), 255)),
    Initial = List.Buffer({
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    }),
    Constants = List.Buffer({
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
        0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
        0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    }),
    Compress = (hash as list, block as binary) as list =>
        let
            octets = List.Buffer(Binary.ToList(block)),
            first = List.Buffer(List.Transform({0..15}, (i) =>
                octets{4 * i} * 0x1000000 + octets{4 * i + 1} * 0x10000 +
                octets{4 * i + 2} * 0x100 + octets{4 * i + 3})),
            words = List.Accumulate({16..63}, first, (w, i) =>
                let
                    x = w{i - 15}, y = w{i - 2},
                    s0 = Xor3(Rotate(x, 7), Rotate(x, 18), Number.BitwiseShiftRight(x, 3)),
                    s1 = Xor3(Rotate(y, 17), Rotate(y, 19), Number.BitwiseShiftRight(y, 10))
                in List.Buffer(w & {U32(w{i - 16} + s0 + w{i - 7} + s1)})),
            rounds = List.Accumulate({0..63}, hash, (h, i) =>
                let
                    a = h{0}, b = h{1}, c = h{2}, d = h{3},
                    e = h{4}, f = h{5}, g = h{6}, last = h{7},
                    s1 = Xor3(Rotate(e, 6), Rotate(e, 11), Rotate(e, 25)),
                    choice = Number.BitwiseXor(Number.BitwiseAnd(e, f),
                        Number.BitwiseAnd(Number.BitwiseXor(e, Mask), g)),
                    t1 = U32(last + s1 + choice + Constants{i} + words{i}),
                    s0 = Xor3(Rotate(a, 2), Rotate(a, 13), Rotate(a, 22)),
                    majority = Xor3(Number.BitwiseAnd(a, b), Number.BitwiseAnd(a, c), Number.BitwiseAnd(b, c)),
                    t2 = U32(s0 + majority)
                in List.Buffer({U32(t1 + t2), a, b, c, U32(d + t1), e, f, g}))
        in List.Buffer(List.Transform({0..7}, (i) => U32(hash{i} + rounds{i}))),
    Compute = (input as binary) as text =>
        let
            buffered = Binary.Buffer(input),
            size = Binary.Length(buffered),
            // Split the bit length into words before multiplication; never round a 64-bit length.
            lengthBytes = Bytes(Number.IntegerDivide(size, 0x20000000)) &
                Bytes(Number.Mod(size, 0x20000000) * 8),
            zeros = Number.Mod(55 - Number.Mod(size, 64) + 64, 64),
            padded = if size <= 9007199254740927 then Binary.Combine({buffered,
                Binary.FromList({128} & List.Repeat({0}, zeros) & lengthBytes)})
                else error Error.Record("SHA256.Length", "Binary length exceeds exact M integer arithmetic.", null),
            // Buffer each eight-word state, not a growing history of intermediate states.
            digest = List.Accumulate(Binary.Split(padded, 64), Initial, Compress)
        in Text.Lower(Binary.ToText(Binary.FromList(List.Combine(List.Transform(digest, Bytes))), BinaryEncoding.Hex), "en-US"),
    // Fail closed on hosts with incompatible bitwise semantics. Public, nonfinancial vectors.
    SelfTest = Compute(#binary({})) = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" and
        Compute(Text.ToBinary("abc", TextEncoding.Utf8)) = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" and
        Compute(Text.ToBinary("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", TextEncoding.Utf8)) =
            "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
in
    if SelfTest then Compute(Content)
    else error Error.Record("SHA256.SelfTest", "SHA-256 known-answer self-test failed; import stopped.", null)
