# QR Version 1 Technical Notes

Implementation notes for the standalone Version 1 QR encoder in `qr_app copy.html`.

These notes map to the source code that actually exists. They do not restate generic QR
theory. Every claim below was checked against the file, and the encoder was independently
verified against the specification during the documentation pass — see
[`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md#verified-capabilities) for what
that verification covered.

Line numbers refer to `qr_app copy.html` as of commit `4b6b180`. Function names are the
stable reference; line numbers will drift.

---

## Entry points

| Entry point | Line | Role |
| :--- | ---: | :--- |
| `generateQr()` | 460 | UI handler; validates input, calls `qrMatrix`, renders, updates status |
| `qrMatrix(text, correction)` | 430 | Orchestrator: codewords → 8 masks → penalty → best matrix |
| `downloadQr()` | 497 | PNG export from the rendered canvas |
| `decodeImage(image)` | 529 | Uploaded-image scanning |
| `scanCameraFrame()` | 552 | Camera scan loop |
| `startCamera()` / `stopCamera()` | 616 / 643 | Camera lifecycle |

The generator is invoked from the *Generate QR code* button, on `change` of the size and
correction selects, and on Ctrl/Cmd+Enter in the textarea (lines 656–662).

The whole script is wrapped in an IIFE (line 206). Nothing is exported to the global
scope; the only global dependency is `jsQR`.

---

## Constants

```javascript
const QR_SIZE = 21;                                  // line 250
const QR_TOTAL_CODEWORDS = 26;                       // line 251
const QR_ECC_CODEWORDS = { L: 7, M: 10, Q: 13, H: 17 };   // line 252
const QR_ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };    // line 253
```

These are the Version 1 parameters, hard-coded. There is no version parameter anywhere in
the encoder, which is a deliberate consequence of supporting Version 1 only.

Derived data capacity:

| Level | ECC codewords | Data codewords | Data bits | Max UTF-8 bytes |
| :--- | ---: | ---: | ---: | ---: |
| L | 7 | 19 | 152 | 17 |
| M | 10 | 16 | 128 | 14 |
| Q | 13 | 13 | 104 | 11 |
| H | 17 | 9 | 72 | 7 |

---

## GF(256) field

Lines 254–267 build log/antilog tables in the same way as the stego codec:

```javascript
const QR_EXP = new Uint8Array(512);
const QR_LOG = new Uint8Array(256);
let qrFieldValue = 1;
for (let i = 0; i < 255; i++) {
  QR_EXP[i] = qrFieldValue;
  QR_LOG[qrFieldValue] = i;
  qrFieldValue <<= 1;
  if (qrFieldValue & 0x100) qrFieldValue ^= 0x11d;
}
for (let i = 255; i < QR_EXP.length; i++) QR_EXP[i] = QR_EXP[i - 255];
```

- Primitive polynomial `0x11d` = `x⁸ + x⁴ + x³ + x² + 1`, the field QR uses.
- `QR_EXP` is 512 entries so `QR_EXP[QR_LOG[a] + QR_LOG[b]]` never needs a modulo.
- `qrMultiply(a, b)` (line 265) is the only field operation needed by the encoder; QR
  generation needs no division or matrix inversion, unlike the stego codec.

---

## Payload conversion and bit stream

`qrCodewords(text, correction)` — line 305.

```text
mode indicator        0100            (4 bits, byte mode)
character count       8 bits          (byte-mode count indicator, Version 1–9)
data                  UTF-8 bytes, 8 bits each
terminator            up to four 0 bits
byte alignment        zero bits until the length is a multiple of 8
pad codewords         0xEC, 0x11, 0xEC, 0x11, ... to fill data capacity
```

Details that matter:

- **Byte mode indicator** is written as the literal array `[0, 1, 0, 0]` (line 309) with a
  comment. It is not computed.
- **Character count is 8 bits** (line 310), which is the correct byte-mode count width for
  Versions 1–9. Since only Version 1 is generated, this is correct unconditionally.
- **The count is a byte count**, not a character count, because the data is UTF-8 encoded
  first (line 306). A multi-byte character consumes multiple bytes of capacity.
- **Capacity is checked before padding** (line 314):

  ```javascript
  if (bits.length > dataCapacity * 8) {
    throw new Error(`Version 1-${correction} supports only ${dataCapacity - 2} UTF-8 bytes in byte mode.`);
  }
  ```

  The check is on total bit length against data capacity, which is exact. The message
  computes the byte limit as `dataCapacity − 2`, which is a derived shortcut: the 12-bit
  header occupies 1.5 bytes, so the largest whole number of bytes that fits is
  `dataCapacity − 2` at all four levels. Correct, but the derivation is not in the source.
- **Terminator** (line 317) writes `min(4, remaining bits)` zeros. The `min` matters: if
  fewer than 4 bits remain, only those are written.
- **Byte alignment** (line 318) pads to a multiple of 8.
- **Pad codewords** (line 320) alternate starting with `0xEC`, matching the specification.

`qrBitsToBytes(bits)` (line 295) packs the bit array MSB-first. Its inner read
`(bits[i + j] || 0)` tolerates a short final byte, which cannot occur here because the
stream is byte-aligned before this point.

---

## Error-correction generation

`qrGeneratorPolynomial(eccLength)` — line 269.

Builds the generator polynomial as a product of `(x − αⁱ)` for `i = 0 … eccLength − 1` by
repeated multiply-and-XOR expansion. Coefficients are stored highest-degree first.

`qrReedSolomon(data, eccLength)` — line 283.

Textbook polynomial long division:

```text
remainder = data || eccLength zeros
for each data symbol:
    factor = remainder[i]
    if factor is zero, skip
    remainder[i .. i+genLen] ^= generator * factor
return the last eccLength symbols
```

This is systematic encoding: the returned ECC codewords append directly to the data
codewords with no transformation, which is what the QR specification requires.

Verification performed: for every ECC level, the concatenated `data || ecc` polynomial
evaluates to zero at `α⁰ … α^(n−1)`. That is the defining property of a valid RS codeword
and it held for all four levels.

---

## Matrix construction

`qrBuildMatrix(codewords, correction, mask)` — line 382.

The matrix starts as a 21 × 21 array of `null` (line 383). `null` means "not yet written";
the data placement pass uses it to identify free modules. Function modules are written
first, then data, then the mask is applied inline during data placement.

### Finder patterns and separators

`finder(top, left)` — line 385.

Loops `row = -1 … 7` and `column = -1 … 7` relative to each finder origin, and writes:

- `dark = true` inside the 7 × 7 region for the border ring and the 3 × 3 centre,
- `dark = false` for everything else in the 8 × 8 block, which is the separator.

Placed at `(0, 0)`, `(0, 14)`, and `(14, 0)` (lines 393–395). Bounds are clipped, so the
`-1` offsets at the top-left corner simply do not write.

The finder block is therefore 8 × 8 including its separator, and the three blocks account
for 192 of the 441 modules.

### Timing patterns

Lines 396–399:

```javascript
for (let i = 8; i < QR_SIZE - 8; i++) {
  if (matrix[6][i] === null) setFunction(6, i, i % 2 === 0);
  if (matrix[i][6] === null) setFunction(i, 6, i % 2 === 0);
}
```

For Version 1 this writes `i = 8 … 12`, giving 5 modules in row 6 and 5 in column 6, dark
where the index is even. The `null` guard is defensive: those positions are free here, but
the check makes the ordering of construction steps unimportant.

### Fixed dark module

Line 400: `setFunction(QR_SIZE - 8, 8, true)` → row 13, column 8. The specification places
it at `4 × version + 9` = 13 for Version 1.

### Format information

`qrBchFormat(value)` — line 324. `value` is `(eccBits << 3) | mask`, five bits.

```javascript
let remainder = value << 10;
while (remainder >= 0x400) {
  const shift = Math.floor(Math.log2(remainder)) - 10;
  remainder ^= 0x537 << shift;
}
return ((value << 10) | remainder) ^ 0x5412;
```

- `0x537` is the BCH(15,5) generator polynomial.
- `0x5412` is the fixed format mask.
- The loop shifts the generator to align with the current leading bit, which is an
  equivalent but less common formulation of the standard remainder division.

`QR_ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 }` supplies the two-bit level indicator
that precedes the three mask bits.

Placement (lines 402–410) merges both copies into a single 15-iteration loop:

```text
first copy                              second copy
i = 0…5   -> (row i,      col 8)        i = 0…7   -> (row 8, col 20 − i)
i = 6     -> (row 7,      col 8)        i = 8…14  -> (row 6 + i, col 8)
i = 7     -> (row 8,      col 8)
i = 8     -> (row 8,      col 7)
i = 9…14  -> (row 8,      col 14 − i)
```

Bit index `i` is the LSB-first index, matching the specification's numbering.

Verification performed: all 32 format codewords are distinct, each is divisible by `0x537`
after removing the `0x5412` mask, the encoder agrees with an independently written
BCH(15,5) encoder, and reading the 15 bits back out of the built matrix from both copies
recovers the correct ECC level and mask for every combination. `M` with mask 0 correctly
reduces to the published `0x5412` constant.

### Data and ECC placement

Lines 411–426.

```javascript
let bitIndex = 0;
let upward = true;
for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
  if (right === 6) right--;                    // skip the vertical timing column
  for (let offset = 0; offset < QR_SIZE; offset++) {
    const row = upward ? QR_SIZE - 1 - offset : offset;
    for (let column = right; column >= right - 1; column--) {
      if (matrix[row][column] !== null) continue;
      const bit = bitIndex < dataBits.length ? dataBits[bitIndex++] : 0;
      matrix[row][column] = Boolean(bit ^ (qrMask(mask, row, column) ? 1 : 0));
    }
  }
  upward = !upward;
}
```

- Column pairs are processed right to left, skipping column 6. Mutating `right` inside the
  loop is how the skip is implemented; the loop then continues at column 5.
- Direction alternates upward/downward per column pair, starting upward.
- Within a pair, the right column is written before the left, top to bottom or bottom to
  top according to direction.
- The mask is applied **as the bit is written**, not in a separate pass. Because
  `matrix[row][column]` is set from `null`, the mask is applied exactly once per data
  module and never to function modules.
- The `bitIndex < dataBits.length ? … : 0` fallback writes zero for any module beyond the
  end of the bit stream. For Version 1 there are exactly 208 data/ECC modules and exactly
  26 × 8 = 208 bits, so **the fallback never executes**. It is a correctness-neutral
  guard, and it would need real remainder-bit handling for any other version.

Verification performed: for all 32 ECC × mask combinations, an independently written
extractor — using its own role map rather than the encoder's `null` checks — read the
matrix back, unmasked it, and reproduced the exact codeword bitstream. This confirms the
placement order, the direction alternation, the column-6 skip, and the mask application in
one check.

### Module role counts (Version 1)

| Role | Modules |
| :--- | ---: |
| Finder + separator | 192 |
| Timing | 10 |
| Format information | 30 |
| Fixed dark module | 1 |
| Data + ECC | 208 |
| Remainder | 0 |
| **Total** | **441** |

These counts are the denominators Route A's similarity metrics must use. See
[`ROUTE_A_ARTISTIC_QR.md`](ROUTE_A_ARTISTIC_QR.md#qr-role-map).

---

## Masking

`qrMask(mask, row, column)` — line 333. A `switch` returning the eight standard conditions:

| Mask | Condition |
| :--- | :--- |
| 0 | `(row + column) % 2 === 0` |
| 1 | `row % 2 === 0` |
| 2 | `column % 3 === 0` |
| 3 | `(row + column) % 3 === 0` |
| 4 | `(floor(row / 2) + floor(column / 3)) % 2 === 0` |
| 5 | `(row * column) % 2 + (row * column) % 3 === 0` |
| 6 | `((row * column) % 2 + (row * column) % 3) % 2 === 0` |
| 7 | `((row * column) % 3 + (row + column) % 2) % 2 === 0` |

All eight match the specification. Note the operator precedence in masks 5 and 6: `%`
binds tighter than `+`, so `(row * column) % 2 + (row * column) % 3` is
`((row*column)%2) + ((row*column)%3)`. The `=== 0` then tests the sum, not either term.

Verification performed: all eight masks produce distinct matrices, and the mask is
correctly inverted by an independent reader.

---

## Penalty scoring

`qrPenalty(matrix)` — line 346. Four rules, summed into one score. Lower is better.

### Rule 1 — consecutive runs (lines 349–359)

A shared `linePenalty` helper runs over all 21 rows and all 21 columns. For each run of
length `n ≥ 5` of the same colour: `score += 3 + (n − 5)`.

### Rule 2 — 2 × 2 blocks (lines 370–375)

Every position where all four modules of a 2 × 2 block share a colour adds 3.

### Rule 3 — finder-like pattern (lines 360–366)

Scans each line for the 7-module pattern `1011101`. When found, adds 40 if either the four
modules before it or the four modules after it are all light.

**A4.0 correction (see [`../experiments/route-a/A4/BUG_AUDIT.md`](../experiments/route-a/A4/BUG_AUDIT.md), A4-BUG-001):**
the original implementation tested the surrounding modules with `bit === 0`, but the matrix
stores booleans, so `false === 0` was always false and Rule 3 never fired. It was fixed to
test falsiness. Before the fix every recorded `penalty_rule_3` was 0; after the fix Rule 3
fires on finder-like patterns that have four light modules on one side. A4.0 added
deterministic fixtures covering rows, columns, and the no-light-context case.

The rule remains a documented reading of the specification's 1:1:3:1:1 rule: it treats the
7-module pattern with four light modules on one side as the unit and counts an occurrence
once even if light runs exist on both sides. It does not affect whether a produced symbol is
valid — the mask chosen is still a legal mask, recorded correctly in the format information.

### Rule 4 — dark-module balance (lines 376–378)

```javascript
score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
```

The proportion of dark modules is compared to 50%; every full 5 percentage points of
deviation adds 10. The `/ 5` uses floating-point division, so the 5-point steps are
correct for the 441-module denominator.

### What the score covers

The penalty is computed over the **whole matrix**, function modules included. That matches
the specification, but it means the score is not a measure of the data region alone. For
Route A this matters: a target-directed modification strategy that optimises the data
region may still be penalised by structure it cannot touch.

---

## Mask selection

`qrMatrix(text, correction)` — line 430.

```javascript
let best = null;
for (let mask = 0; mask < 8; mask++) {
  const matrix = qrBuildMatrix(codewords, correction, mask);
  const penalty = qrPenalty(matrix);
  if (!best || penalty < best.penalty) best = { matrix, penalty };
}
return best.matrix;
```

All eight masks are built and scored; the lowest penalty wins. Ties resolve to the lowest
mask index because the comparison is strict `<`. The chosen matrix is returned without the
penalty, and **the selected mask index is not exposed** — `qrMatrix` returns only the
matrix. For `A1` this matters: the experiment needs the mask index and the per-rule
penalties, so the encoder will need to expose them, or the experiment will need to
re-derive the selection. That is an `A1` design decision, not something to change now.

Observed selection for the payload `g.co` (corrected values after the A4.0 Rule-3 fix; for
reference only — not an experiment result):

| Level | Selected mask | Penalties (masks 0–7) |
| :--- | ---: | :--- |
| L | 3 | 445, 361, 437, **333**, 368, 403, 381, 484 |
| M | 6 | 312, 396, 360, 485, 341, 348, **292**, 565 |
| Q | 0 | **287**, 592, 341, 424, 568, 449, 348, 397 |
| H | 2 | 413, 417, **306**, 402, 640, 475, 370, 450 |

(The pre-fix values, with Rule 3 always 0, were L→2, M→0, Q→6, H→0; the Rule-3 fix changed
both the penalty totals and the standard-selected mask.)

---

## Canvas rendering

`qrRender(matrix, pixels)` — line 442.

```javascript
const total = QR_SIZE + 8;                          // 21 + 4 + 4 = 29
const modulePixels = Math.max(1, Math.floor(pixels / total));
const offset = Math.floor((pixels - modulePixels * total) / 2);
```

- The canvas is exactly `pixels × pixels`.
- The background is filled white, giving a four-module quiet zone on every side.
- `modulePixels` is floored, so the symbol is centred with the remainder split as left/top
  padding by `offset`.
- Dark modules are drawn at `#080b16`; light modules are the white background.
- At 220 px: `modulePixels = 7`, the symbol occupies 203 px, and `offset = 8`.
- At 300 px: `modulePixels = 10`, symbol 290 px, `offset = 5`.
- At 420 px: `modulePixels = 14`, symbol 406 px, `offset = 7`.

**The rendered symbol never fills the requested image size exactly.** This is correct
behaviour — an integer module size is required — but the UI does not say so, and the
downloaded PNG is the requested size with white margin, not the symbol size.

The canvas gets an `aria-label` of "Generated Version 1 QR code" (line 456).

### Quiet zone

Four modules, implemented as canvas padding rather than as matrix modules. The matrix
itself is 21 × 21 and contains no quiet zone. Anything consuming the matrix directly —
including any future Route A experiment — must add its own quiet zone or it will produce
unscannable images.

---

## Output scaling and download

`downloadQr()` — line 497.

Finds a `canvas` inside `#qrCode`, sets `href` to `canvas.toDataURL('image/png')`, and
clicks a synthetic `<a download="stegocode-qr.png">`.

The function also contains an `<img>` branch (lines 508–515) that scales an image into a
new canvas. In `qr_app copy.html` only a canvas is ever appended to `#qrCode`, so this
branch is unreachable. It is a leftover from the `qrcodejs`-based version, which rendered
an `<img>` when a canvas was unavailable. Dead code, not a defect.

---

## Scanning code

Identical in `qr_app.html` and `qr_app copy.html`.

`decodeImage(image)` — line 529:

- Scales the image so its longest side is at most 1600 px before decoding.
- Draws to the hidden `#scanCanvas` (created with `willReadFrequently: true`).
- Calls `jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })`.
- On success, shows the text and reveals an *Open link* button when the payload matches
  `/^https?:\/\//i`.

`scanCameraFrame()` — line 552: per-frame decode driven by `requestAnimationFrame`, using
the video element's native resolution. Stops the camera on first successful decode.

`requestCameraStream()` — line 600: requests `facingMode: 'environment'` at 1280 × 720,
falling back to an unconstrained `video: true` request if the constraints are rejected
(common on laptop webcams).

`waitForVideoReady()` — line 571: resolves when video dimensions are available, with an
8-second timeout and cleanup of its listeners.

No scan result is transmitted anywhere. Frames are drawn to a local canvas and discarded.

---

## External dependencies

| Dependency | Version | Source | Used for |
| :--- | :--- | :--- | :--- |
| `jsQR` | 1.4.0 | `cdn.jsdelivr.net` | Decoding only |

`qr_app copy.html` loads no QR-generation library. The encoder is entirely in-repo, which
is the property that makes it usable as a research baseline: the mask, the matrix, and the
codewords are all reachable from the page.

`qr_app.html` additionally loads `qrcodejs` 1.0.0 from `cdnjs.cloudflare.com` for
generation.

---

## Deviations, shortcuts, limitations, and assumptions

Recorded here rather than fixed. Per the documentation phase's scope, none of these were
changed.

1. **Version 1 only, hard-coded.** `QR_SIZE`, `QR_TOTAL_CODEWORDS`, and the ECC tables are
   constants. There is no version abstraction.
2. **Byte mode only.** Mode indicator is the literal `[0, 1, 0, 0]`.
3. **Capacity error message uses a derived constant.** `dataCapacity − 2` is correct for
   Version 1 byte mode at all four levels but is not obviously correct on inspection.
4. **Mask penalty rule 3 was dead code before A4.0** (`bit === 0` on booleans never matched).
   Corrected in A4.0; see the Rule 3 section above and
   [`../experiments/route-a/A4/BUG_AUDIT.md`](../experiments/route-a/A4/BUG_AUDIT.md).
5. **`qrMatrix` does not return the selected mask or the penalty breakdown.** `A1` needs
   both.
6. **No remainder-bit handling.** Correct for Version 1 (there are none), incorrect for any
   other version.
7. **Unreachable `<img>` fallback in `downloadQr()`.**
8. **The rendered image is not filled to the requested size.** Integer module sizing with a
   centred offset leaves white margin.
9. **No ECI, no structured append, no error-correction re-encoding on decode.** The decoder
   is `jsQR`, entirely external.
10. **No tests in the repository.** The encoder's correctness was established by an
    external harness during the documentation pass, not by anything committed.
11. **No independent decoder in the project.** `jsQR` is the only decoder available from
    the application. Route A requires OpenCV `QRCodeDetector` as an independent check; it
    does not exist yet.
