# Route A — Standards-Compatible Artistic QR

**Status: active route (`A1`–`A4`). `A1`–`A3` are COMPLETE and frozen. `A4` is software
implemented — its foundation audit, 96-configuration generalization, and physical-testing
tooling are done — but physical validation is PENDING real data, so Route A is NOT YET
COMPLETE.**

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
A1 — baseline ECC/mask visual study                     COMPLETE (control) — jsQR + OpenCV 32/32
A2 — controlled random target-directed modification      COMPLETE (frozen) — jsQR + OpenCV 33/85
A3 — codeword-aware optimization + synthetic robustness  COMPLETE (frozen) — clean 76/150 (both)
A4 — generalization + physical validation + analysis     SOFTWARE IMPLEMENTED — physical data PENDING
```

The roadmap is compressed; `A0` is historical baseline validation, not a separate active
experiment. `A1` lives in [`A1/`](A1/README.md), `A2` in [`A2/`](A2/README.md), `A3` in
[`A3/`](A3/README.md), and `A4` in [`A4/`](A4/README.md). A1 modifies nothing; A2 modifies
mutable mismatches with a deterministic seeded order; A3 packs the same number of mismatches
into far fewer codewords; A4 generalizes and audits rather than adding an optimizer.

---

## Experiments

### A1 — Mask/ECC visual-similarity baseline — COMPLETE

Full record: [`A1/README.md`](A1/README.md).

> Given the same Version 1 payload and a target logo, how much visual similarity can be
> obtained using only valid QR error-correction levels and mask choices, without changing
> any encoded module?

Fixed payload `g.co` (4 UTF-8 bytes, fits all four ECC levels), four ECC levels × eight
masks = 32 candidates, each with similarity metrics, per-rule QR penalties, and independent
decoder results. Default run (synthetic circle): 32/32 generated, jsQR 32/32 exact, OpenCV
32/32 exact; highest full similarity 49.43% (H/mask 6); lowest corrected QR penalty 287
(Q/mask 0).

### A2 — Controlled target-directed module modification — IMPLEMENTED

Full record: [`A2/README.md`](A2/README.md).

> How much can selected non-function modules of a valid Version 1 QR symbol be changed
> toward a target logo before reliable decoding begins to fail?

Starts from an A1 base candidate, collects eligible mutable mismatches, orders them with
fixed seeds (42–46), and applies a dense budget schedule (0…128, filtered against the
eligible count). Function modules are never touched; every change moves a module toward the
target. Codeword damage is recorded but not used to choose positions. Default run: base
A1-H-M6, 93 eligible mismatches, 17 budgets × 5 seeds = 85 trials; jsQR and OpenCV both
33/85 exact; first observed failure at budget 10, sustained failure from budget 16.

### A3 — Codeword-aware optimization + synthetic robustness — IMPLEMENTED

Full record: [`A3/README.md`](A3/README.md).

> Can we obtain the same or greater target-logo similarity as A2 while preserving
> significantly better decoding reliability by concentrating target-directed changes into
> fewer QR/Reed–Solomon codeword symbols?

Under the binary target metric, a fixed module budget fixes the visual gain, so A3 minimises
**distinct affected codewords** instead. Two deterministic strategies: packed module-budget
(greedy densest-codeword packing with a penalty-minimising partial final codeword) and
codeword-budget (K densest codewords). Compared against A2 at matched budgets, then run
through a five-family synthetic degradation suite. Default run: A2 needs ~21 codewords to
reach 58.50% similarity (0/5 exact); A3 reaches it with 7 codewords and decodes exactly under
both jsQR and OpenCV. Codewords are recorded for A3 but never with decoder feedback.

### A4 — Multi-target generalization + physical validation + final analysis — SOFTWARE IMPLEMENTED

Full record: [`A4/README.md`](A4/README.md); audit [`A4/BUG_AUDIT.md`](A4/BUG_AUDIT.md);
cross-environment [`A4/CROSS_ENVIRONMENT_NOTES.md`](A4/CROSS_ENVIRONMENT_NOTES.md).

A4.0 audits the foundations (found and fixed the Rule-3 penalty bug), A4.1 runs a 96-configuration
generalization (8 synthetic targets × 3 payloads × 4 ECC) in which A3 reaches a both-decoder-exact
operating point in 96/96 configurations and outperforms A2 at 94/96 matched budgets (median
similarity gain ≈5.4pp; H 9.1 > Q 7.3 > M 5.4 > L 3.6), A4.2 provides screen/print/recorder
tooling and a protocol, and A4.3 generates the final tables. **Physical data is PENDING and not
fabricated; Route A is not yet complete.**

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

A2 additionally records, per trial: `actual_modified_modules`,
`modified_fraction_of_eligible`, `similarity_before/after/gain`,
`mutable_similarity_before/after/gain`, the four `modified_penalty_*` rules,
`affected_codeword_count` and `max_flips_in_single_codeword`, and a `decode_status` of
`EXACT` / `WRONG_PAYLOAD` / `NO_DETECTION` / `DECODER_ERROR`.

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
- The baseline encoder's mask penalty rule 3 was dead code before A4.0 (a boolean compared
  with `=== 0`) and is now fixed; see
  [`A4/BUG_AUDIT.md`](A4/BUG_AUDIT.md). Per-rule penalties were regenerated for A1/A2/A3.
- The baseline's `qrMatrix()` does not expose the selected mask or the penalty breakdown;
  A1's encoder port exposes both (and reproduces the documented penalty values).
- The matrix returned by the encoder has no quiet zone; four modules of margin must be
  added to any candidate image before it will scan.
- No novelty claim is available before the A4 literature comparison.

---

## Dependencies

| Dependency | Status | Needed for |
| :--- | :--- | :--- |
| In-repo Version 1 encoder (`qr_app copy.html`) | Exists | All experiments — the baseline |
| `jsQR` 1.4.0 | Exists (CDN) | Browser decoder; A1 and A2 |
| OpenCV `QRCodeDetector` | Exists in the environment (4.12.0) | Independent decoder; A1 and A2 `validate_opencv.py` |
| Target images | Built-in synthetic targets; uploads supported | A1 and A2 |
| Target normalisation to 21 × 21 | Implemented in A1 (`js/target-grid.js`) | A1, A2, and later |
| QR module role map | Implemented in A1 (`js/qr-role-map.js`) | A1, A2, and later |
| Seeded modification strategy | Implemented in A2 (`js/modification-strategy.js`) | A2, and A3's baseline |
| Codeword-aware optimizer | Implemented in A3 (`js/codeword-optimizer.js`) | A3 |
| Synthetic transform suite | Implemented in A3 (`validation/synthetic_robustness.py`) | A3, A4 |
| Benchmark target corpus | Implemented in A4 (`js/target-corpus.js`) | A4 |
| Physical-testing tooling | Implemented in A4 (`physical/*.html`, `validation/physical_analysis.py`) | A4 (data pending) |
| jsQR (pinned) | Vendored in `third_party/jsQR/` (1.4.0) | A4 and later; offline support |

No dependency may be added without a documented reason and a recorded version.

---

## Relationship with the current implementation

- The baseline is `qr_app copy.html`, which contains the in-repo Version 1 encoder.
- `A1` uses that encoder via a faithful port (the application is not modified) to generate
  all 32 candidates; `A2` reuses A1's base candidates, role map, metrics, and rasteriser; `A3`
  reuses both and adds only the codeword-aware optimizer and robustness evaluation.
- No experiment modifies `qr_app copy.html`. Experiments live here, under
  `experiments/route-a/`.
- `qr_app.html` (the `qrcodejs` page) is not part of this route. It cannot serve as a
  baseline because it does not expose the mask or the matrix.
