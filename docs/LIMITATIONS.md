# Limitations

Written conservatively. These are the things the current implementation cannot do, does
not guarantee, and should not be claimed to do.

No marketing language. Where a limitation is a deliberate design trade-off it is marked
as such; where it is simply not yet built, it is marked as such.

---

## Version 1 QR encoder

### Structural limits

- **Version 1 only.** The matrix is fixed at 21 × 21. Versions 2–40 are not implemented,
  and the code has no concept of a version parameter.
- **No alignment patterns.** Version 1 does not use them, so their absence is correct
  here. Any move to a larger version would require implementing them.
- **No remainder-bit handling.** Version 1 has 208 data modules and 26 codewords, so there
  are no remainder bits. The encoder's fallback of writing zero for any excess bit
  position therefore never executes. It is correct for Version 1 and would need revisiting
  for any other version.

### Encoding modes

- **Byte mode only.** The mode indicator is hard-coded to `0100`.
- **No numeric mode.** Numeric strings are stored at one byte per character instead of
  the roughly 3.3 bits per digit numeric mode would achieve.
- **No alphanumeric mode.** Uppercase-and-symbol strings are stored at one byte per
  character instead of roughly 5.5 bits per character.
- **No Kanji mode.**
- **No ECI or structured-append support.**

### Capacity

- **Small by design.** Because only Version 1 is generated:

  | Level | Maximum UTF-8 bytes |
  | :--- | ---: |
  | L | 17 |
  | M | 14 |
  | Q | 11 |
  | H | 7 |

  These are hard limits of the implementation, enforced by an explicit rejection.
- **Capacity is measured in UTF-8 bytes, not characters.** A message of 10 emoji is 40
  bytes and will be rejected at levels M, Q, and H. The UI counter in
  `qr_app copy.html` reports bytes for exactly this reason.
- **The declared limit is a derived value.** The error message reports
  `dataCapacity − 2` bytes, which is correct for Version 1 byte mode at all four levels,
  but the derivation is not documented in the source.

### Decoding and scanning

- **Scanner behaviour differs between implementations.** A symbol that decodes in `jsQR`
  may fail in another decoder and vice versa. A single decoder result is not evidence of
  general readability.
- **Successful digital decoding does not guarantee camera decoding.** These are separate
  claims and must be reported separately.
- **Scanning depends on a CDN.** `jsQR` is loaded from a public CDN. Without network
  access, scanning does not work at all. Generation in `qr_app copy.html` still works,
  because the encoder is in-repo.
- **Uploaded-image scanning downscales to 1600 px.** Images larger than that are scaled
  down before decoding, which can lose module detail in a densely rendered symbol.
- **Camera scanning requires a secure context.** `getUserMedia` is unavailable on plain
  HTTP origins other than `localhost`.
- **No error reporting beyond success/failure.** The scan path reports whether a code was
  found, not why a near-miss failed.

### Correctness caveats in the implementation

These are documented, not fixed. They do not affect the verified behaviour of the current
output but should be known before extending the code.

- **Mask penalty rule 3 fires correctly but is a documented reading of the rule.** The
  implementation searches each line for the 7-module pattern `1011101` and adds 40 when four
  light modules precede or follow it. A4.0 fixed a bug where the surrounding-light test
  (`bit === 0` on booleans) never matched, making Rule 3 dead code; it now fires. It still
  counts an occurrence once even when light runs exist on both sides, a deliberate reading
  of the specification's 1:1:3:1:1-with-four-light rule. See
  [`../experiments/route-a/A4/BUG_AUDIT.md`](../experiments/route-a/A4/BUG_AUDIT.md).
- **Mask penalty is computed over the whole matrix**, including function modules. This
  matches the specification, but means the penalty is not a measure of the data region
  alone.
- **`downloadQr()` retains an unreachable `<img>` fallback** left over from the
  `qrcodejs`-based version. In `qr_app copy.html` only a canvas is ever appended, so the
  `<img>` branch never runs. It is dead code, not a bug.
- **The rendered symbol does not fill the requested image size.** Module size is
  `floor(pixels / 29)` where 29 = 21 modules + 8 quiet-zone modules. At 220 px the module
  size is 7 and the symbol occupies 203 px of the 220 px canvas, centred. This is correct
  behaviour but is not stated in the UI.
- **`readProtectedPacket`-style hard-coded geometry.** The format-information placement,
  timing positions, and finder positions are all written as literals derived from
  `QR_SIZE = 21`. There is no version-general abstraction.

---

## Protected LSB steganography

### Carrier requirements

- **Requires essentially lossless pixel preservation.** The payload lives in bit 0 of
  each non-alpha byte. Anything that changes pixel values by even ±1 destroys data.
- **Lossy compression destroys the payload.** JPEG, lossy WebP, and lossy re-encoding
  pipelines are not survivable.
- **Resize, crop, or transcoding may break the payload.** The decoder reads from the
  start of the raster in raster order, so any change to dimensions or pixel ordering
  shifts the entire bit stream.
- **Screenshots destroy direct bit correspondence.** A screenshot may be resampled,
  colour-converted, or recompressed by the capture pipeline.
- **Print-and-camera recapture does not preserve individual LSBs.** Print introduces
  halftoning, ink spread, and camera noise far larger than one intensity level.
- **Social-media recompression may destroy the data.** Upload pipelines re-encode
  aggressively.
- **Colour conversion may destroy the data.** A colour-space transform between encode and
  decode can alter the low bits.
- **Image optimisation pipelines may destroy the data.** Any lossy "optimise" step is
  fatal.

The application states this in the UI and restricts the workflow to lossless formats, but
it cannot enforce it: a user can upload a lossy image and the decoder will simply report
failure.

### Error correction

- **One-symbol repair limit per protected block.** Each six-symbol block can repair at
  most one damaged symbol. Two damaged symbols in the same block are rejected outright.
- **Arbitrary or multiple corruption may be unrecoverable.** There is no interleaving, no
  erasure decoding, and no notion of a partial decode.
- **Rejection is not always distinguishable from absence.** A block with two damaged
  symbols and a block containing no valid codeword at all both surface as the same
  failure path. The message "more than one damaged symbol" is an interpretation, not a
  diagnosis.
- **No repair across blocks.** Damage concentrated in one block is worse than the same
  number of damaged symbols spread across many blocks; the codec has no way to
  redistribute.
- **The redundancy overhead is 100%.** Six embedded symbols carry three payload bytes.
  This is a deliberate trade-off for a simple, auditable repair path.
- **No camera recapture robustness whatsoever.** This codec is not a watermark and is not
  designed to be one.

### Capacity and behaviour

- **Capacity is derived from image dimensions, not from an explicit field.** The decoder
  reads as many bits as the image holds and stops when the packet is complete.
- **A larger image does not mean a more robust payload.** Extra capacity is simply unused.
- **Maximum payload is 65,535 UTF-8 bytes** by the two-byte length field, far beyond what
  most images can actually carry. The real limit is the image's pixel count.
- **The reported encode status counts characters, not bytes.** The decode path is exact;
  the status message is a display-only approximation.
- **Encode-side image load errors are reported in the decode panel.** `loadImage`'s error
  handler writes to the decode status element regardless of which panel initiated the
  load. A cosmetic bug, not a correctness one.
- **The codec reads only bit 0.** Any other bit of a pixel may be freely changed without
  affecting the payload, which is exactly why the payload is so fragile and why a
  detection tool would need to look no further than the LSB plane.

---

## Project-wide

- **The three applications have no in-project automated tests.** The Route A experiments under
  `experiments/route-a/A1`–`A4`, however, each ship a Node test suite (`node tests/run-tests.js`).
- **No build tooling for the applications.** The applications are single self-contained HTML
  files. The experiment directories carry a test-only `package.json` (ESM config, no runtime
  dependencies).
- **External dependencies.** `qr_app.html` loads `qrcodejs` from a CDN; `qr_app copy.html` and
  the A1–A3 pages load `jsQR` from a CDN. A4 pins `jsQR` 1.4.0 under `third_party/jsQR/`
  (offline / `file://`), and A1–A4 also support a local `jsQR` for tests.
- **No versioning scheme for the applications.** The only version marker is
  `FORMAT_VERSION = 1` inside the LSB packet format and format-version constants in the QR
  format bits. Neither identifies the application itself.
- **No cryptography.** No encryption, no signatures, no authentication, no key handling.
  A hidden payload is hidden, not protected: anyone who knows the format can read it.
- **A deterministic optimiser exists; machine learning does not.** Route A's A3 introduces a
  deterministic, decoder-independent codeword-aware placement strategy. There is no machine
  learning, no generative method, and no decoder-feedback optimisation, and none is planned
  before the deterministic baselines are established.
- **No literature review has been performed.** No novelty is claimed for any part of this
  project, and none should be claimed without a formal comparison.
- **Route A is not physically validated.** A1–A4 software and synthetic results exist, but no
  real screen/print/camera data has been collected, so no physical-robustness claim is made.
  Route B is planned, not implemented; Route C has a working LSB baseline but its robust
  research (C2–C3) is planned.

---

## Claims that must not be made

- That the LSB payload is secure, encrypted, or private. It is hidden in plain sight at
  best.
- That a hidden payload survives sharing, messaging, or social media.
- That a QR symbol that decodes on screen will scan from a phone camera.
- That the artistic QR direction has been shown to work at any level of visual fidelity.
- That this project is novel. It has not compared itself to prior art.
- That any privacy claim holds when a CDN script fails to load — the correct statement is
  that the *application* does not transmit data, not that no network activity occurs.
