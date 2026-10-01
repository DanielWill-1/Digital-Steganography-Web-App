# Steganography Technical Notes

Implementation notes for the protected LSB codec in `stego_app.html`.

These notes describe the implementation that actually exists. Every claim was checked
against the source, and the codec was independently exercised during the documentation
pass — see [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md#verified-capabilities)
for what that verification covered.

Line numbers refer to `stego_app.html` as of commit `4b6b180`. Function names are the
stable reference; line numbers will drift.

---

## Entry points

| Entry point | Line | Role |
| :--- | ---: | :--- |
| `encodeMessage()` | 307 | UI handler: frame, protect, embed, download |
| `decodeMessage()` | 338 | UI handler: extract, repair, verify, display |
| `makePacket(text)` | 217 | Frame a payload |
| `protectPacket(packet)` | 225 | Expand into protected blocks |
| `readProtectedPacket(bytes)` | 235 | Parse, repair, and verify an extracted byte stream |
| `loadImage(file, callback)` | 299 | Decode a user-selected file into an `Image` |

The page has two panels — encode and read — sharing one hidden `<canvas>` (line 23).

---

## Packet layout

```text
payload (UTF-8 text)
│
├── magic            "STG"                    3 bytes   (0x53 0x54 0x47)
├── version          format version           1 byte    (currently 1)
├── length           payload byte count       2 bytes   (big-endian)
├── CRC-16           over header + payload    2 bytes   (big-endian)
└── UTF-8 data       the payload              N bytes
     │
     ▼
protected blocks   (3 data bytes + CRC-8 + 2 parity symbols = 6 symbols each)
     │
     ▼
RGB LSB embedding  (bit 0 of every non-alpha byte, raster order, MSB first)
```

Header size is 6 bytes. Total packet size is `8 + payloadLength`.

```javascript
const MAGIC = [0x53, 0x54, 0x47];   // line 50  "STG"
const FORMAT_VERSION = 1;           // line 51
const DATA_BYTES_PER_BLOCK = 3;     // line 52
const CODEWORD_BYTES = 6;           // line 53
```

The packet is length-framed rather than sentinel-terminated, which means a decode either
yields the exact payload or fails loudly. There is no way to silently return a truncated
payload.

---

## Framing

`makePacket(text)` — line 217.

```javascript
const payload = utf8Bytes(text);
if (payload.length > 0xffff) throw new Error('Message is too long. The maximum is 65,535 UTF-8 bytes.');
const header = [...MAGIC, FORMAT_VERSION, payload.length >> 8, payload.length & 0xff];
const packetCrc = crc16([...header, ...payload]);
return [...header, packetCrc >> 8, packetCrc & 0xff, ...payload];
```

- The length is the **UTF-8 byte count**, not the character count. `utf8Bytes` (line 209)
  uses `TextEncoder`.
- The length field is 16 bits, big-endian, so the format's own limit is 65,535 bytes.
  Realistically the image's pixel count is the binding limit.
- The CRC-16 covers the header **and** the payload, so a corrupted length field is caught
  as well as corrupted data.

`bytesToText(bytes)` — line 213 — decodes with `new TextDecoder('utf-8', { fatal: true })`.
Fatal mode means invalid UTF-8 throws rather than being replaced with `U+FFFD`, so a
corrupted payload can never be displayed as plausible-looking text with replacement
characters in it.

---

## CRC behaviour

`crc8(bytes)` — line 135.

```javascript
let crc = 0;
for (const byte of bytes) {
  crc ^= byte;
  for (let bit = 0; bit < 8; bit++) {
    crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
}
```

MSB-first, polynomial `0x07`, initial value `0x00`, no reflection, no final XOR. This is
**CRC-8/SMBUS**.

`crc16(bytes)` — line 146.

```javascript
let crc = 0xffff;
for (const byte of bytes) {
  crc ^= byte << 8;
  for (let bit = 0; bit < 8; bit++) {
    crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
}
```

MSB-first, polynomial `0x1021`, initial value `0xFFFF`, no reflection, no final XOR. This
is **CRC-16/CCITT-FALSE**.

Neither CRC is cryptographic. They detect accidental corruption; they provide no
protection against a deliberate modification, because an attacker who knows the format can
simply recompute them.

Verified against the standard check vectors for the ASCII string `123456789`:

```text
crc8("123456789")  = 0xF4    (CRC-8/SMBUS check value)
crc16("123456789") = 0x29B1  (CRC-16/CCITT-FALSE check value)
```

Both matched.

---

## GF(256) arithmetic

Lines 56–78.

```javascript
const GF_EXP = new Uint8Array(510);
const GF_LOG = new Uint8Array(256);
let gfValue = 1;
for (let i = 0; i < 255; i++) {
  GF_EXP[i] = gfValue;
  GF_LOG[gfValue] = i;
  gfValue <<= 1;
  if (gfValue & 0x100) gfValue ^= 0x11d;
}
for (let i = 255; i < GF_EXP.length; i++) GF_EXP[i] = GF_EXP[i - 255];
```

- Primitive polynomial `0x11d` = `x⁸ + x⁴ + x³ + x² + 1` — the same field QR uses.
- `GF_EXP` has 510 entries so products of two logarithms (maximum 254 + 254) index
  directly with no modulo.
- `gfMultiply` (line 67), `gfDivide` (line 71), `gfPower` (line 76) are the three
  operations the coding matrix needs. Unlike the QR encoder, this codec needs division
  because it builds a *systematic* matrix by inversion.

---

## Protected block structure

The codec uses a **systematic (6, 4) Reed–Solomon code over GF(256)** built from a
Vandermonde matrix.

`createCodingMatrix()` — line 125.

```javascript
const vandermonde = Array.from({ length: CODEWORD_BYTES }, (_, row) =>
  Array.from({ length: 4 }, (_, column) => gfPower(row + 1, column))
);
const topInverse = invertMatrix(vandermonde.slice(0, 4));
return matrixMultiply(vandermonde, topInverse);
```

- The raw Vandermonde matrix evaluates at points `1, 2, 3, 4, 5, 6`, with columns
  `x⁰, x¹, x², x³`.
- Multiplying by the inverse of the top 4 × 4 block makes the code **systematic**: the
  first four output symbols are the four input symbols unchanged, and only the last two
  rows produce new values.
- Because the six evaluation points are distinct, the resulting code is **MDS** with
  minimum distance `6 − 4 + 1 = 3`. It can therefore correct **one** symbol error and
  detect two. That is exactly the behaviour implemented and observed.

`matrixMultiply` (line 80) and `invertMatrix` (line 92) are standard GF(256) matrix
operations. `invertMatrix` does Gauss–Jordan elimination on an augmented `[A | I]` matrix
and throws `'Reed-Solomon matrix is singular.'` if a pivot column is all zeros — which
cannot happen for a Vandermonde matrix with distinct points, but the guard is present.

`encodeCodeword(dataBytes)` — line 157.

```javascript
const block = [dataBytes[0], dataBytes[1], dataBytes[2], crc8(dataBytes)];
const codeword = block.slice();
for (let parityRow = 4; parityRow < CODEWORD_BYTES; parityRow++) {
  let parity = 0;
  for (let column = 0; column < block.length; column++) {
    parity ^= gfMultiply(CODING_MATRIX[parityRow][column], block[column]);
  }
  codeword.push(parity);
}
```

So one protected block carries:

```text
symbol 0   payload byte 1
symbol 1   payload byte 2
symbol 2   payload byte 3
symbol 3   CRC-8 of symbols 0–2
symbol 4   RS parity symbol 1
symbol 5   RS parity symbol 2
```

Note that the fourth data symbol is a **CRC-8**, not a fourth payload byte. This is a
deliberate design choice: it reduces the code to (6, 3) for payload purposes, giving a 100%
redundancy overhead, in exchange for a cheap and independently checkable integrity test on
the payload portion of every block.

The CRC-8 also makes the repair path unambiguous in practice: a candidate codeword is only
accepted if **both** the RS structure and the CRC-8 agree.

`protectPacket(packet)` — line 225.

```javascript
for (let offset = 0; offset < packet.length; offset += 3) {
  const data = packet.slice(offset, offset + 3);
  while (data.length < 3) data.push(0);
  protectedBytes.push(...encodeCodeword(data));
}
```

The packet is chunked into 3-byte groups; the final group is zero-padded to 3 bytes so it
can be encoded. The padding is discarded at decode time because the decoder slices the
reassembled packet to `packetLength`.

Protected length is `6 × ceil(packetLength / 3)`.

---

## Repair logic

`isValidCodeword(codeword)` — line 170.

Recomputes all six symbols from the first four via the coding matrix and requires an exact
match, **and** requires `crc8(codeword[0..2]) === codeword[3]`.

The RS check alone is sufficient to define a valid codeword; the CRC-8 check is an
additional, independent constraint on the payload portion.

`repairCodeword(received)` — line 185.

```javascript
if (received.every(value => value !== null) && isValidCodeword(received)) {
  return { codeword: received, corrected: false };
}
```

If the block is already valid, it is returned untouched with `corrected: false`. This
matters: a clean decode is reported as clean, not as a successful repair.

Otherwise the codec searches exhaustively:

```javascript
for (let position = 0; position < CODEWORD_BYTES; position++) {
  for (let value = 0; value < 256; value++) {
    const candidate = original.slice();
    candidate[position] = value;
    if (isValidCodeword(candidate)) {
      candidateCount++;
      if (candidateCount > 1) throw new Error('A block has ambiguous Reed-Solomon corrections.');
      repairedCodeword = candidate;
    }
  }
}
if (candidateCount !== 1) throw new Error('A block has more than one damaged symbol.');
return { codeword: repairedCodeword, corrected: true };
```

`6 × 256 = 1536` candidate tests per damaged block. For a six-symbol codeword this is
cheaper and far easier to audit than a Berlekamp–Massey / Forney decoder, which is why the
brute-force approach was chosen.

Three distinct outcomes:

| Situation | Behaviour |
| :--- | :--- |
| Block already valid | Returned as-is, `corrected: false` |
| Exactly one symbol damaged | Exactly one candidate is valid; repaired, `corrected: true` |
| More than one symbol damaged | No candidate or an ambiguous candidate; throws |

The "ambiguous" case is a guard, not an observed failure mode: for an MDS code with
distance 3, a received word at distance 1 from a codeword is at distance ≥ 2 from every
other codeword, so at most one candidate can ever be valid. The check exists to make that
assumption explicit rather than implicit.

**Note on the failure message.** `'A block has more than one damaged symbol.'` is raised
when `candidateCount === 0`, which also covers a block damaged in one symbol in a way that
lands outside the code's structure, or a block whose contents were never valid codewords
at all. The message is an interpretation, not a diagnosis. Both cases are failures and both
are handled safely — no wrong payload is ever returned — but the wording overstates what
is known.

---

## Decoding

`readProtectedPacket(bytes)` — line 235.

```text
1. require at least 12 bytes (two blocks) or throw
   'The image does not contain a complete protected header.'

2. repair the first two blocks, take the first three symbols of each
   -> firstData[0..5] = magic(3) + version(1) + length(2)

3. if magic or version does not match, throw 'No StegoCode packet was found.'

4. payloadLength = firstData[4] << 8 | firstData[5]
   packetLength  = 8 + payloadLength
   blockCount    = ceil(packetLength / 3)
   requiredBytes = blockCount * 6
   if bytes.length < requiredBytes, throw 'The protected payload is incomplete.'

5. for every block up to requiredBytes:
      repair it, append its first three symbols, count corrections

6. cleanPacket = packet.slice(0, packetLength)
   expectedCrc = cleanPacket[6] << 8 | cleanPacket[7]
   content     = cleanPacket.slice(0, 6) ++ cleanPacket.slice(8)
   if crc16(content) !== expectedCrc, throw
     'The packet checksum failed after correction.'

7. return { payload: utf8 decode of cleanPacket.slice(8), correctedBlocks }
```

Points worth noting:

- **The first two blocks are repaired twice** — once to read the header and again in the
  main loop. Harmless (repair is idempotent and deterministic), and the second pass is what
  increments `correctedBlocks`.
- **The 12-byte minimum is exact.** A 6-byte header occupies two 3-byte groups, so the
  shortest possible packet is 8 + 0 = 8 bytes → 3 blocks → 18 bytes; but the header alone
  needs only 2 blocks, and the code checks for 12 before reading. The `requiredBytes` check
  then enforces the real length. The 12-byte check exists so the header read cannot
  underflow.
- **CRC-16 is checked after correction**, not before. This is the right order: a payload
  that needed repair must still verify, and the verification covers the whole packet
  including the length field.
- **The reassembled packet may contain trailing padding bytes** from the last group; they
  are removed by `slice(0, packetLength)` before the CRC is computed. Note that `content`
  is built from `cleanPacket`, so the padding never participates in the CRC.
- **`correctedBlocks` is returned to the UI**, which reports "Repaired N damaged blocks"
  or "Reed-Solomon parity verified". A user can therefore tell a clean decode from a
  repaired one.

---

## Bit traversal and embedding

`bytesToBits(bytes)` — line 266. Most significant bit first:

```javascript
for (const byte of bytes) {
  for (let bit = 7; bit >= 0; bit--) bits.push((byte >> bit) & 1);
}
```

`extractBits(data, bitCount)` — line 284.

```javascript
for (let index = 0; index < data.length && bits.length < bitCount; index++) {
  if ((index + 1) % 4 === 0) continue;
  bits.push(data[index] & 1);
}
```

- The input is the raw RGBA byte array from `ImageData.data`, so its length is
  `width × height × 4`.
- **Channel order is R, G, B, A.** Index `4k + 3` is alpha, and `(index + 1) % 4 === 0`
  skips exactly those bytes.
- **The alpha channel is never read or written.** The stated reason in the source comment
  is to avoid transparency side effects; the practical effect is that only 3 bits per pixel
  are available, and the output image's alpha is preserved exactly as the input's.
- **Traversal is raster order**: left to right, top to bottom, byte by byte within each
  pixel.

`encodeMessage()` — line 307 — embeds:

```javascript
const capacity = (imageData.data.length / 4) * 3;
if (bits.length > capacity) { alert(`Image is too small. This protected message needs ${bits.length} bits, but the image holds ${capacity}.`); return; }
let bitIndex = 0;
for (let index = 0; index < imageData.data.length && bitIndex < bits.length; index++) {
  if ((index + 1) % 4 === 0) continue;
  imageData.data[index] = (imageData.data[index] & 0xfe) | bits[bitIndex++];
}
```

- Capacity is exactly `pixels × 3` bits, and it is checked before any modification, so a
  failed encode leaves the source image untouched.
- LSB replacement is `(byte & 0xfe) | bit`, which changes the channel value by at most ±1.

`decodeMessage()` — line 338 — extracts:

```javascript
const availableBytes = Math.floor(((imageData.data.length / 4) * 3) / 8);
const rawBytes = bitsToBytes(extractBits(imageData.data, availableBytes * 8));
```

The decoder reads as many bits as the image can hold, then hands the byte stream to
`readProtectedPacket`, which stops after `requiredBytes`. **Extra capacity in a larger
image is simply unused.**

Note that the decoder has **no knowledge of the original image dimensions**. It reads from
the start of the raster in raster order, so any change to width, height, or pixel ordering
shifts the entire bit stream. This is the mechanism behind the resize/crop limitations.

---

## Capacity calculation

```text
bits available       = (width × height × 4 / 4) × 3 = width × height × 3
protected bytes      = floor(bits / 8)
blocks               = floor(protected bytes / 6)
payload bytes        = blocks × 3 − 8      (8-byte header, less the final block's padding)
```

Worked example for a 64 × 64 image (used in the verification harness):

```text
pixels                = 4096
bits available        = 12288
protected bytes       = 1536
blocks                = 256
payload capacity      ≈ 760 UTF-8 bytes
```

A test payload of 24 characters / 32 UTF-8 bytes produced a 40-byte packet and 84
protected bytes (14 blocks), comfortably within that.

The encode path reports capacity in **bits** and the decode path in **bytes**; both are
derived from the same pixel count.

---

## Image format expectations

- **Input must decode to the same pixel values it was encoded from.** The application
  accepts `image/*` at the file picker and states the lossless requirement in the UI
  (line 22), but it cannot enforce it.
- **The input is decoded through `Image` + `canvas.drawImage` + `getImageData`**, so any
  format the browser can decode can be *loaded*. A JPEG can therefore be loaded and even
  encoded successfully — the loss happens on the way *out* if the result is ever
  re-encoded lossily.
- **Output is always PNG**, via `canvas.toDataURL('image/png')`, downloaded as
  `encoded_image.png`. PNG is lossless, so the embedding survives the write.
- **The canvas is untransformed.** No scaling, no smoothing, no colour-space conversion is
  requested. The canvas is resized to the image's native dimensions before `drawImage`
  (lines 314–316 and 343–345).
- **Browser colour management is the one uncontrolled variable.** `getImageData` returns
  pixel values in the canvas's colour space; if a browser applies a colour-space conversion
  on `drawImage`, bit 0 may not survive. This is not a defect in the codec but it is a
  real, environment-dependent risk that no amount of in-page checking can rule out.
- **Alpha is preserved** because it is never written.

---

## Browser APIs involved

| API | Line | Use |
| :--- | ---: | :--- |
| `TextEncoder` | 210 | payload → UTF-8 bytes |
| `TextDecoder` (`fatal: true`) | 214 | UTF-8 bytes → payload, strict |
| `URL.createObjectURL` / `revokeObjectURL` | 301–302 | loading the user's file |
| `Image` | 300 | decoding the file |
| `canvas.getContext('2d')` | 45 | raster access |
| `ctx.drawImage` | 316, 345 | file → raster |
| `ctx.getImageData` | 317, 346 | raster → RGBA array |
| `ctx.putImageData` | 325 | modified raster → canvas |
| `canvas.toDataURL('image/png')` | 327 | PNG output |
| `Uint8Array` / `Uint8ClampedArray` | throughout | bit and byte handling |

No network API is used. `stego_app.html` makes no request of any kind.

---

## Deviations, shortcuts, and limitations

Recorded, not fixed.

1. **The reported encode status counts characters, not bytes** (line 333:
   `Encoded ${text.length} characters`). For multi-byte payloads this understates the
   actual byte length. Display-only.
2. **`loadImage`'s error handler writes to the decode status element** (line 303), even
   when the load was initiated by the encode panel. A failed encode-side image load
   therefore shows its message in the wrong panel. Cosmetic.
3. **`received.every(value => value !== null)`** in `repairCodeword` (line 186) is
   vestigial: `extractBits` produces plain numbers, never `null`. Harmless.
4. **The `'more than one damaged symbol'` message also covers "no valid codeword found"**,
   as described above.
5. **Redundancy overhead is 100%** — six embedded symbols per three payload bytes. Chosen
   for a simple, auditable repair path rather than efficiency.
6. **No interleaving.** A block's six symbols occupy twelve consecutive pixel bytes, so
   damage in one region concentrates in one block. Spreading blocks across the image would
   be a straightforward robustness improvement and is listed as future Route C work.
7. **No capacity field in the packet.** Capacity is derived from image dimensions, so a
   decoder cannot know in advance whether an image *should* contain a packet.
8. **Repair is bounded to one symbol per block**, with no erasure handling and no
   soft-decision information, even though the LSB channel's reliability could in principle
   be estimated from the pixel values around each bit.
9. **The payload is trivially discoverable.** Anyone who reads bit 0 of each non-alpha byte
   and recognises the `STG` magic can extract it. There is no key, no obfuscation, and no
   encryption. Hiding is not protection.
10. **No tests in the repository.** Correctness was established by an external harness
    during the documentation pass, not by anything committed.
