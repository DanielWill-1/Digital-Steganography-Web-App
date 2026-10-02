# Route A — Standards-Compatible Artistic QR

**Status: active route. `A1`–`A3` are COMPLETE and frozen. `A4` is software implemented: its
foundation audit (which fixed the Rule-3 penalty bug), its 96-configuration generalization, and
its physical-testing tooling are done. Physical validation is PENDING real data, so Route A is
NOT YET COMPLETE.**

---

## Primary objective

Investigate:

> How closely can a standards-compatible QR symbol resemble a target logo while remaining
> decodable by ordinary QR scanners?

Example concept:

```text
Visual appearance:
Google-style G

Decoded content:
google.com
```

The goal is **not** merely placing a logo in the centre of a QR code. Centre-logo QR
generation is a well-known technique and is not what this route is about.

The goal is to study whether **the QR module arrangement itself** can be optimised toward
the appearance of a target image, while the symbol remains a valid QR code that ordinary
scanners decode correctly.

This distinction is the whole route. A centre logo is decoration on top of an unchanged
symbol. Route A is about changing which modules are dark and which are light, within the
freedom QR's error correction actually provides.

---

## Main constraints

QR has mandatory structures. They are not stylistic choices and they cannot be optimised
away.

| Structure | Version 1 count | Why it is fixed |
| :--- | ---: | :--- |
| Finder patterns | 3 × 49 modules | Scanners locate and orient the symbol from them |
| Separators | included in the 8 × 8 corner blocks | Keep finders visually isolated |
| Timing patterns | 10 modules | Establish the module grid |
| Format information | 30 modules (two 15-bit copies) | Record ECC level and mask, BCH-protected |
| Fixed dark module | 1 module | Required by the specification |
| Data + ECC | 208 modules | The actual payload and its redundancy |

For Version 1 that is 441 modules total, of which **233 are immutable structure** and
**208 carry data and error correction**. Only the 208 data/ECC modules are candidates for
modification, and even those are constrained: change too many and the error correction can
no longer recover the payload.

The project must eventually model QR module roles explicitly, in a role map that is
maintained separately from the bit matrix. Until that exists, "modify a module" is an
ambiguous instruction.

---

## Experiment roadmap

Order is not negotiable. See the ordering rules in
[`RESEARCH_ROADMAP.md`](RESEARCH_ROADMAP.md). The roadmap is intentionally compressed:

```text
A1   baseline ECC/mask visual study                     ✅ complete (control)
→ A2  controlled target-directed modification            ✅ implemented
→ A3  codeword-aware optimization + synthetic robustness
→ A4  multi-logo + physical validation + final analysis
```

`A0` (freeze and validate the encoder) is historical baseline validation, not a separate
active experiment.

---

## A0 — Freeze and validate the current Version 1 encoder (historical)

**Status: historical.** The encoder was validated during the documentation pass against the
specification using an out-of-repository harness (see
[`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md#verified-capabilities)), and `A1`'s test suite now
provides a repeatable, in-project version of several of those checks (role counts, format
consistency, capacity, penalty regressions). No module modification happens here.

---

## A1 — Mask/ECC visual-similarity baseline

**Status: COMPLETE — frozen as the control baseline.** The experiment lives in
[`../experiments/route-a/A1/`](../experiments/route-a/A1/README.md); that README is the
authoritative record of the method, metrics, and default-run result. This section remains
the specification. A1 must not be retrofitted with any A2 modification logic.

### Research question

> Given the same Version 1 payload and a target logo, how much visual similarity can be
> obtained using only valid QR error-correction levels and mask choices, without changing
> any encoded module?

This is the purest measurement in the whole route. Nothing is modified. Every candidate is
a legitimate QR symbol produced by the existing encoder. The only question is how much
visual agreement the *legitimate* degrees of freedom already provide.

If the answer is "very little", that is a finding of the first order: it means the
difficulty is inherent to QR geometry rather than to the optimiser.

### Payload

Use a tiny payload that fits all four Version 1 ECC levels. A useful controlled example:

```text
g.co
```

Four UTF-8 bytes, comfortably within the H-level limit of 7 bytes, so payload size is
identical across every candidate and cannot confound the comparison.

### Candidates

```text
ECC levels:  L, M, Q, H
Masks:       0, 1, 2, 3, 4, 5, 6, 7
```

This produces:

```text
4 × 8 = 32 candidates
```

### What to record for every candidate

| Field | Notes |
| :--- | :--- |
| ECC level | L / M / Q / H |
| Mask | 0–7 |
| Full target similarity | over all 441 modules |
| Mutable-region similarity | over the 208 data/ECC modules only |
| Mandatory-module conflict count | positions where target and QR structure disagree |
| Theoretical similarity ceiling | best possible for this target given immutable structure |
| QR penalty rule 1 | |
| QR penalty rule 2 | |
| QR penalty rule 3 | |
| QR penalty rule 4 | |
| Total QR penalty | sum of the four rules |
| Whether the normal QR algorithm would select this mask | i.e. is it the minimum-penalty mask |
| `jsQR` detection result | located, yes/no |
| `jsQR` exact-payload result | decoded payload equals expected, yes/no |
| Independent decoder result | OpenCV `QRCodeDetector` |
| Decoded payload | the actual string returned, verbatim |
| Generated PNG | path to the candidate image |

A candidate counts as correctly decoded only when the recovered payload **exactly**
matches the original payload. Detection alone is insufficient.

Note that "whether the standard algorithm would select this mask" is not a quality signal
by itself. It records which candidate the specification's own rule would have produced, so
that any later deviation can be quantified against it.

---

## Target normalisation for A1

Target images are converted into a deterministic 21 × 21 binary representation so that
they are directly comparable to a QR matrix.

Initial process:

```text
input image
↓
square fit / crop
↓
grayscale
↓
downsample to 21 × 21
↓
threshold
↓
binary target matrix
```

Represent as:

```text
T[row][column] ∈ {0, 1}
```

Display both:

- the source target image,
- the normalised 21 × 21 experimental target.

Both must be shown, because the normalisation is lossy and a reader must be able to see
what the metric was actually measuring. A target that normalises badly will score badly
for reasons that have nothing to do with QR.

Every normalisation choice — the crop rule, the resampling filter, the threshold
value or method — must be recorded in the experiment manifest, because each one changes
the result. See [`RESEARCH_METHODOLOGY.md`](RESEARCH_METHODOLOGY.md).

---

## QR role map

The future experimental QR code must maintain a role map separate from the bit matrix.

Conceptual roles:

```text
FINDER
SEPARATOR
TIMING
FORMAT
DARK_MODULE
DATA
ECC
REMAINDER
```

Version 1 does not use alignment patterns. Future larger QR versions may add additional
structural categories.

The role map is important because function modules must not accidentally be treated as
ordinary modifiable modules. A single changed finder module does not degrade readability
gracefully; it can break the symbol's definition entirely.

For Version 1 the role map is fully determined by geometry:

```text
FINDER + SEPARATOR   192 modules   (3 × 8 × 8 corner blocks)
TIMING                10 modules   (row 6 cols 8–12, col 6 rows 8–12)
FORMAT                30 modules   (two 15-bit copies)
DARK_MODULE            1 module    (row 13, col 8)
DATA + ECC           208 modules   (26 codewords × 8 bits)
REMAINDER              0 modules   (Version 1 has no remainder bits)
```

These counts were confirmed against the specification during the documentation pass. They
are the denominators the A1 metrics must use.

---

## Similarity metrics

Several metrics, not one arbitrary percentage. Each has a defined denominator.

### Full matrix similarity

For candidate QR matrix `Q` and target `T`:

```text
S_full = 1 - mismatching_modules / 441
```

because:

```text
21 × 21 = 441
```

`S_full` includes the 233 immutable modules. A target whose logo shape conflicts with the
finder patterns will be penalised by `S_full` no matter how good the optimiser is. That is
a real property of the target, but it is not the property the optimiser controls.

### Mutable-region similarity

Measure similarity only over modules that are candidates for later modification — the 208
data and ECC modules.

```text
S_mutable = 1 - mismatches_in_mutable_region / 208
```

This prevents mandatory QR structure from dominating the score, and is the metric that
actually reflects what `A2` and later can change.

Report `S_full` and `S_mutable` together. Either alone is misleading.

### Fixed-module conflict count

Count locations where the target requests one state but QR structure requires the other.

This provides information about how compatible a chosen target is with QR geometry, before
any modification is attempted. A logo that conflicts with 80 immutable modules is a
fundamentally harder target than one that conflicts with 12, and that should be visible in
the results rather than discovered later.

### Theoretical visual ceiling

Calculate the maximum similarity theoretically possible if every modifiable location
perfectly matched the target while immutable QR structures remained unchanged.

```text
ceiling = (immutable modules already matching the target + all 208 mutable modules)
          / 441
```

This value is important for comparing logos fairly: it separates "this target is hard
because of QR geometry" from "this candidate is a poor fit for a target that could have
been matched well".

---

## A2 — Controlled target-directed module modification

**Status: IMPLEMENTED.** The experiment lives in
[`../experiments/route-a/A2/`](../experiments/route-a/A2/README.md); that README is the
authoritative record. This section remains the specification.

**Research question:**

> How much can selected non-function modules of a valid Version 1 QR symbol be changed
> toward a target logo before reliable decoding begins to fail?

Begin changing QR modules toward the target image, using a **deterministic seeded** ordering
that is deliberately *not* an optimiser — A3 changes where modifications go.

**Do not change mandatory structural modules.** Only `DATA`, `ECC`, and `REMAINDER` modules
may change, and only where `Q != T`.

Measure:

- module changes (`actual_modified_modules`, `modified_fraction_of_eligible`),
- visual improvement (`similarity_before/after/gain`),
- affected codewords (`affected_codeword_count`, `max_flips_in_single_codeword`, …),
- decode success, kept separate as `EXACT` / `WRONG_PAYLOAD` / `NO_DETECTION` /
  `DECODER_ERROR`.

The purpose is to empirically locate the visual/readability boundary — the point at which a
symbol stops being a QR code in any useful sense. That is the single most valuable result
this route can produce.

Default run (`g.co`, synthetic circle, base A1-H-M6): 85 trials; jsQR and OpenCV both 33/85
exact with identical curves; first observed failure at budget 10, sustained failure from
budget 16. Budget 0 is bit-for-bit identical to the A1 base.

---

## A3 — Codeword-aware optimization + synthetic robustness

**Status: IMPLEMENTED.** The experiment lives in
[`../experiments/route-a/A3/`](../experiments/route-a/A3/README.md); that README is the
authoritative record. This section remains the specification.

Default run: A3 reaches the A2 similarity at every budget while affecting roughly a quarter
to a fifth of the codewords; A2 fails from ~budget 13 while A3 decodes exactly to budget 40
(58.50% similarity, 7 codewords) under both jsQR and OpenCV. The synthetic robustness suite
(925 cases) is recorded separately; A3 makes no physical-robustness claim.

**Important research insight:**

QR Reed–Solomon repair operates over codeword symbols, not over an abstract count of
changed visual modules. Therefore:

```text
number of module flips
```

is not sufficient. Track:

```text
affected Reed–Solomon codewords
```

as well. `A2` already records per-trial codeword damage for exactly this reason.

Two candidates may modify different numbers of visible modules but affect radically
different numbers of protected symbols. Flipping two modules that fall inside the same
codeword costs one codeword of error budget; flipping two modules in two different
codewords costs two. A naive module-count metric treats those as identical.

A3 therefore changes *where* modifications go: prefer positions that increase visual
similarity while minimising damaging codeword distribution, rather than A2's seeded order.
This becomes a constrained optimisation problem — maximise visual similarity subject to the
number of corrupted Reed–Solomon codewords staying within what the chosen ECC level can
repair.

Note that the relationship between modules and codewords is not local — a codeword's eight
bits are scattered across the matrix by the QR placement pattern, so visual proximity and
error-budget proximity are unrelated.

### Synthetic robustness (consolidated from the former A4)

Test generated candidates under controlled transformations:

- scaling, downscaling, rotation,
- blur, Gaussian noise,
- contrast and brightness changes,
- JPEG compression,
- perspective distortion, partial obstruction, uneven illumination.

Record decoding **rates** rather than anecdotal success. Every transformation needs its
parameters recorded exactly — "blurred" is not a transformation, "Gaussian blur, σ = 1.4"
is.

The purpose is to find out whether the visual optimisation has traded away margin that would
have been needed in the real world. A candidate that is 3% more similar and 40% less robust
under mild blur is a worse symbol, not a better one.

---

## A4 — Multi-target + physical validation + final analysis

**Status: SOFTWARE IMPLEMENTED; physical data PENDING.** The experiment lives in
[`../experiments/route-a/A4/`](../experiments/route-a/A4/README.md); that README, plus
[`../experiments/route-a/A4/BUG_AUDIT.md`](../experiments/route-a/A4/BUG_AUDIT.md) and
[`ROUTE_A_FINAL_REPORT.md`](ROUTE_A_FINAL_REPORT.md), are the authoritative records.

A4.0 audited the foundations (finding and fixing the Rule-3 penalty bug), A4.1 ran a
96-configuration generalization (8 targets × 3 payloads × 4 ECC) in which A3 reaches a
both-decoder-exact operating point in 96/96 configurations and outperforms A2 at 94/96 matched
budgets, and A4.2 provides the screen/print/recorder tooling. A4.3 generates the final
tables. **Physical results do not exist yet and are not fabricated.**

A4 consolidates the final Route A evaluation: multi-target generalization, physical validation,
and the cross-experiment analysis.

### Multi-logo evaluation

Test multiple target classes — simple letters, geometric logos, circular logos, sparse and
dense logos, monochrome logos, and multicolour logos after binary normalisation — and
determine whether some classes are fundamentally more compatible with QR geometry. The
theoretical similarity ceiling from `A1` is what makes this fair: targets can be ranked by
how much headroom QR geometry leaves them, which is a property of the target, not of any
particular method.

### Physical / camera validation

Move from synthetic testing to phone screens, printed symbols, camera capture, and
variation in angle, distance, lighting, and device. Results must keep these two claims
separate and never merge them:

```text
digital image decoding
camera / physical decoding
```

A symbol that decodes flawlessly from a PNG and fails from a photograph of a phone screen
has failed, and the result must say so. Physical conditions are inherently less reproducible
than synthetic ones, so each capture must record device, distance, angle, lighting, and
whether the display was a screen or paper.

### Comparison with existing artistic QR approaches

A literature review is required for any novelty claim, and it has not been done. The
techniques in this space are long-established and well-published; the honest expectation is
that this route reproduces known trade-offs with its own measurements rather than
discovering new ones.

### Final Route A analysis

Compare the A1 baseline, the A2 seeded modification, and the A3 codeword-aware method across
the multi-logo and physical results, and state what the measurements do and do not support.
An optimiser with a stated objective function (visual similarity + structural validity +
decode robustness + error-budget awareness) is only justified here if A1–A3 make the
trade-off weights answerable. Do not prematurely introduce ML or generative methods.

---

## Relationship with the current implementation

- The baseline is `qr_app copy.html`, which contains the in-repo Version 1 encoder.
- `A1` uses that encoder via a faithful port (the application is not modified) to generate
  all 32 candidates; `A2` builds on A1's base candidates and shared modules.
- No experiment modifies `qr_app copy.html`. Experiments are separate artefacts under
  `experiments/route-a/`.
- `qr_app.html` (the `qrcodejs` page) is not part of Route A. It cannot serve as a baseline
  because it does not expose the mask or the matrix.

---

## Key limitations specific to Route A

- Version 1 only, byte mode only, at most 17 UTF-8 bytes.
- 208 mutable modules is a small search space, and the error budget is smaller still.
- Immutable structure is 53% of the symbol and cannot be optimised.
- Digital decodability is not camera decodability.
- No novelty claim is available before the A4 literature comparison.
