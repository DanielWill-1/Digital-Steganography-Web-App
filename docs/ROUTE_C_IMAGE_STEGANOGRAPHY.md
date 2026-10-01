# Route C — Image Steganography

**Status: existing implementation (the protected LSB codec in `stego_app.html`). Future
research direction planned, not started.**

Route C represents the existing StegoCode LSB work and its future research direction. It
is the only route with a working implementation today.

---

## Objective

Investigate:

> How much machine-readable information can be hidden inside an ordinary digital image
> while preserving human-visible appearance?

The current implementation uses spatial-domain RGB LSB replacement.

---

## Where Route C sits relative to the other routes

```text
Route A: visually stylized but overt optical code
Route B: custom logo-shaped optical code
Route C: data hidden in the image signal itself
```

Routes A and B produce something a camera is meant to read. Route C produces an ordinary
image that happens to carry data. Nobody is supposed to be able to tell.

---

## Current implementation

A complete description is in
[`STEGANOGRAPHY_TECHNICAL_NOTES.md`](STEGANOGRAPHY_TECHNICAL_NOTES.md). In summary:

- The payload is UTF-8 text, framed as an `STG` packet with a format version, a two-byte
  length, and a CRC-16.
- The packet is split into 3-byte groups; each group gains a CRC-8 byte and two GF(256)
  parity symbols, forming a six-symbol protected block.
- The protected bytes are written into bit 0 of every non-alpha byte of the image raster,
  in raster order, most significant bit first.
- The alpha channel is skipped entirely.
- On decode, each six-symbol block is validated and, if exactly one symbol is damaged, the
  correct value is recovered by exhaustive search. Ambiguous or multiply damaged blocks
  are rejected.
- The output is always PNG.

Verified behaviour (see
[`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md#verified-capabilities)): exact
UTF-8 round trip, single-symbol repair at every position in a block, rejection of
multiply damaged blocks, and standard CRC check values.

---

## The core trade-off

Route C currently provides **extremely high visual preservation** and **poor resilience to
transformation**. Those two facts are the same fact.

Changing bit 0 of a channel moves the intensity by at most ±1 out of 255. That is below
the threshold of human perception in almost any viewing condition, which is why the
embedded image is visually indistinguishable from the original. It is also why the payload
is destroyed by anything that perturbs pixel values at all: there is no margin left.

This is the defining tension of the route, and it is a *quantitative* question:

> How much of the visual margin can be spent to buy how much robustness?

That question cannot be answered without measurements, and no measurements exist yet.

---

## Existing limitations

- JPEG damages LSB payloads.
- Resizing can destroy embedded bits.
- Screenshots destroy direct bit correspondence.
- Print/camera recapture does not preserve individual LSBs.
- Social-media recompression may destroy data.
- Colour conversion may destroy data.
- Image optimisation pipelines may destroy data.

The full list, with the mechanism behind each, is in
[`LIMITATIONS.md`](LIMITATIONS.md).

A structural limitation worth restating here: the codec repairs at most **one damaged
symbol per six-symbol block**. There is no interleaving, so damage concentrated in one
region of the image is far more dangerous than the same number of damaged symbols spread
evenly. This is a design consequence of the simple block structure, not an accident.

---

## Future Route C research directions

**None of these are implemented. None should be implemented as part of Route A work.**

- **Redundant LSB strategies** — write the payload more than once, or spread each block's
  symbols across distant regions of the image, so localised damage does not concentrate in
  one block. This directly attacks the block-locality weakness.
- **Adaptive embedding** — spend more capacity where the image is noisy (where a change is
  least visible) and less where it is smooth. A flat sky has almost no capacity to hide
  changes; a textured region has a great deal.
- **Error-correction improvements** — larger codes, interleaving, erasure-aware decoding,
  soft-decision decoding. The current code is a (6,4) MDS code with a CRC-8; it is simple
  and auditable rather than efficient.
- **Transform-domain methods** — move the payload out of individual pixels and into
  coefficients, where it can survive some degree of re-encoding.
- **DCT methods** — embed in discrete cosine transform coefficients, in the spirit of
  JPEG-domain watermarking.
- **DWT methods** — embed in discrete wavelet transform sub-bands, typically choosing
  bands and coefficient magnitudes that human vision is least sensitive to.
- **Robust watermarking ideas** — this is the closest established literature to what
  Route C would need if it wants camera survivability, and it comes with decades of
  published trade-offs. It should be read before it is reinvented.
- **Spatial synchronisation** — a way for the decoder to re-establish which pixel it is
  reading after a geometric transform. Without this, no amount of error correction helps
  under resize or crop.
- **Camera-survivable embedding** — the hardest target: a payload that survives being
  displayed, photographed, and re-read. This is effectively watermarking against a
  screen-capture channel.

---

## How the directions relate

```text
                    preserve appearance
                            ▲
                            │
   adaptive embedding ──────┤  (spend capacity where it is least visible)
                            │
   redundant LSB /          │  (attack block-locality damage)
   interleaving ────────────┤
                            │
   better error correction ─┤  (survive more damage per block)
                            │
   transform domain ────────┤  (survive re-encoding)
   (DCT / DWT)              │
                            │
   spatial synchronisation ─┤  (survive geometry)
                            │
   camera survivability ────┘  (survive the whole channel)
                            ▼
                      robustness
```

Each step down that list buys robustness with visual margin or capacity. Where the useful
stopping point is cannot be known without measuring the endpoints, and the endpoints have
not been measured.

---

## Metrics Route C would need

Not yet defined as a formal experiment set. At minimum:

- **Visual distortion** — a perceptual metric (PSNR is a weak proxy; SSIM or similar is
  more meaningful) plus a visual difference visualisation.
- **Bit error rate after a named transformation** — with the transformation's parameters
  recorded exactly.
- **Payload survival rate** — the fraction of trials in which the payload decodes exactly.
  Partial recovery is a failure.
- **Capacity** — payload bits per pixel, and how much of that capacity is redundancy.

As with Route A, exact payload equality is the definition of success, and synthetic
results must be reported separately from physical capture results.

---

## Relationship with the current implementation

- The working implementation is `stego_app.html`, unchanged.
- Route C research must not modify `stego_app.html` in place. The packet format and block
  structure are documented and are referenced by the technical notes; changing them in
  place invalidates the documentation and the verified baseline.
- Future work belongs in a separate experiment directory, with the existing codec as the
  comparison baseline.

---

## Dependencies

- No external dependency for the current codec. `stego_app.html` makes no network request
  at all.
- Transform-domain work (DCT/DWT) would require either an in-repo implementation or a new
  dependency. Adding a dependency requires a documented reason.
- Camera-survivability work would require a capture workflow.

---

## Key limitations

- The current codec has no robustness to lossy transformation, at all.
- One-symbol repair per block; no interleaving.
- No camera recapture capability.
- No measurements exist: not one PSNR value, not one bit error rate, not one survival
  rate.
- Route C shares no mechanism with Routes A and B. Findings do not transfer directly.
