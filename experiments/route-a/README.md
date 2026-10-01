# Route A — Standards-Compatible Artistic QR

**Status: active route. Next experiment: `A1` — planned, not yet implemented.**

---

## Route goal

Determine how closely a standards-compatible QR symbol can resemble a target logo while
remaining decodable by ordinary QR scanners.

The goal is **not** placing a logo in the centre of a QR code. The goal is to study whether
the QR module arrangement itself can be optimised toward the appearance of a target image,
while the symbol remains a valid QR code that ordinary scanners decode correctly.

Full specification: [`../../docs/ROUTE_A_ARTISTIC_QR.md`](../../docs/ROUTE_A_ARTISTIC_QR.md).

---

## Current status

```text
A0 — Freeze and validate the current Version 1 encoder       REQUIRED, NOT COMPLETED
A1 — Mask/ECC visual-similarity baseline                     PLANNED, NOT IMPLEMENTED
A2 — Controlled target-directed module modification          PLANNED
A3 — Codeword-aware optimization                             PLANNED
A4 — Synthetic robustness testing                            PLANNED
A5 — Physical camera testing                                 PLANNED
A6 — Logo-aware optimization algorithm                       PLANNED
A7 — Multi-logo evaluation                                   PLANNED
A8 — Comparison with existing artistic QR approaches         PLANNED
```

Nothing in this route has been implemented. This directory contains a README and an empty
`results/` placeholder. There is no `A1/` directory.

A partial, out-of-repository verification of the baseline encoder was performed during the
documentation pass — module role counts, generator roots, RS syndromes, all 32 format
codewords, all 32 ECC × mask matrices, capacity limits, and mask selection. That harness was
deliberately not committed, and it is **not** `A0`: `A0` requires a repeatable, in-project
procedure with recorded output and independent decoder confirmation.

---

## Planned experiments

### A0 — Freeze and validate the current Version 1 encoder

Establish a trustworthy baseline before any artistic modification. Verify matrix
dimensions, payload encoding, ECC generation, mask generation, format information, capacity
enforcement, and independent decoding. No optimisation.

### A1 — Mask/ECC visual-similarity baseline

**The next implementation milestone.**

> Given the same Version 1 payload and a target logo, how much visual similarity can be
> obtained using only valid QR error-correction levels and mask choices, without changing
> any encoded module?

Fixed payload `g.co` (4 UTF-8 bytes, fits all four ECC levels), four ECC levels × eight
masks = 32 candidates. Record similarity metrics, per-rule QR penalties, and independent
decoder results for each.

### A2 — Controlled target-directed module modification

Locate the visual/readability boundary empirically by changing non-structural modules
toward the target and measuring where decoding begins to fail.

### A3 — Codeword-aware optimization

Track affected Reed–Solomon codewords, not just flipped modules. Flipping two modules
inside one codeword costs one codeword of error budget; two modules in two codewords costs
two.

### A4 — Synthetic robustness testing

Scaling, rotation, blur, noise, contrast, brightness, JPEG compression, perspective,
obstruction, uneven illumination. Report decode rates, with exact transformation
parameters.

### A5 — Physical camera testing

Screens, prints, camera capture, angles, distances, lighting, devices. Results kept strictly
separate from `A4`'s digital results.

### A6 — Logo-aware optimization algorithm

Only after `A1`–`A5` establish measurable behaviour. Deterministic first; no ML before the
baselines exist.

### A7 — Multi-logo evaluation

Test logo classes — letters, geometric, circular, sparse, dense, monochrome, multicolour
after binary normalisation — and determine which are fundamentally more compatible with QR
geometry.

### A8 — Comparison with existing artistic QR approaches

Requires a literature review. No novelty is claimed before it.

---

## Metrics

Defined in full in [`../../docs/ROUTE_A_ARTISTIC_QR.md`](../../docs/ROUTE_A_ARTISTIC_QR.md#similarity-metrics).
In summary, all with explicit denominators:

| Metric | Denominator |
| :--- | :--- |
| Full matrix similarity | 441 modules |
| Mutable-region similarity | 208 data/ECC modules |
| Fixed-module conflict count | count of immutable positions disagreeing with the target |
| Theoretical similarity ceiling | best achievable given immutable structure |

Plus, per candidate: the four QR penalty rules reported separately, their total, whether the
standard algorithm would have selected that mask, and decoder results from `jsQR` and an
independent decoder.

The Version 1 module role counts these metrics depend on:

```text
FINDER + SEPARATOR   192    immutable
TIMING                10    immutable
FORMAT                30    immutable
DARK_MODULE            1    immutable
DATA + ECC           208    the mutable set
REMAINDER              0
TOTAL                441
```

---

## Key limitations

- Version 1 only, byte mode only, at most 17 UTF-8 bytes.
- 53% of the symbol is immutable structure and cannot be optimised.
- Only 208 modules are candidates for modification, constrained by the error-correction
  budget.
- Digital decodability is not camera decodability, and must never be reported as such.
- The baseline encoder's mask penalty rule 3 is an approximation of the specification's
  1:1:3:1:1 rule, so per-rule penalties are not directly comparable against another
  implementation's.
- The baseline's `qrMatrix()` does not expose the selected mask or the penalty breakdown;
  `A1` will need to expose or re-derive them.
- The matrix returned by the encoder has no quiet zone; four modules of margin must be
  added to any candidate image before it will scan.
- No novelty claim is available until `A8`.

---

## Dependencies

| Dependency | Status | Needed for |
| :--- | :--- | :--- |
| In-repo Version 1 encoder (`qr_app copy.html`) | Exists | All experiments — the baseline |
| `jsQR` 1.4.0 | Exists (CDN) | Browser decoder |
| OpenCV `QRCodeDetector` | **Does not exist** | Required independent decoder from `A1` onward |
| Target images | **Does not exist** | `A1` |
| Target normalisation to 21 × 21 | **Does not exist** | `A1` |
| QR module role map | **Does not exist** | `A1` and all later experiments |

No dependency may be added without a documented reason and a recorded version.

---

## Relationship with the current implementation

- The baseline is `qr_app copy.html`, which contains the in-repo Version 1 encoder.
- `A0` validates that encoder; `A1` uses it **unchanged** to generate all 32 candidates.
- No experiment modifies `qr_app copy.html`. Experiments live here, under
  `experiments/route-a/`.
- `qr_app.html` (the `qrcodejs` page) is not part of this route. It cannot serve as a
  baseline because it does not expose the mask or the matrix.
