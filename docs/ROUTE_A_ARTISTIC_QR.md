# Route A — Standards-Compatible Artistic QR

**Status: active route. `A0` is a baseline requirement; `A1` is the next implementation
milestone and is NOT STARTED.**

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
[`RESEARCH_ROADMAP.md`](RESEARCH_ROADMAP.md).

```text
A0
→ A1
→ A2
→ A3
→ A4
→ A5
→ A6
→ A7
→ A8
```

---

## A0 — Freeze and validate the current Version 1 encoder

**Purpose:** establish a trustworthy baseline before any artistic modification.

Verify:

- Version 1 matrix dimensions.
- payload encoding.
- ECC generation.
- mask generation.
- format information.
- capacity enforcement.
- independent decoding.
- existing tests.

No optimisation yet. No module modification yet.

`A0` is a validation milestone, not a feature milestone. If the encoder is found to be
wrong in some respect, that is `A0`'s finding and it must be recorded before `A1` builds
on it.

**Partial evidence already exists.** The documentation pass that produced this file
verified the encoder against the specification using an independent harness (see
[`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md#verified-capabilities)). That
harness was deliberately kept out of the repository and is not a substitute for `A0`:
`A0` requires a repeatable, in-project validation procedure with recorded output, plus
independent decoder confirmation.

---

## A1 — Mask/ECC visual-similarity baseline

**This is the NEXT IMPLEMENTATION EXPERIMENT. It must not be implemented during the
documentation phase.**

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

**Research question:**

> How many carefully selected target-directed modifications can be introduced before
> decoding begins to fail?

Begin changing QR modules toward the target image.

**Do not change mandatory structural modules.**

Measure:

- module changes,
- visual improvement,
- affected codewords,
- decode success,
- decoder confidence where measurable.

The purpose is to empirically locate the visual/readability boundary — the point at which
a symbol stops being a QR code in any useful sense. That boundary is the single most
valuable result this route can produce, whether or not it is ever exceeded.

---

## A3 — Codeword-aware optimization

**Important research insight:**

QR Reed–Solomon repair operates over codeword symbols, not over an abstract count of
changed visual modules.

Therefore:

```text
number of module flips
```

is not sufficient.

Track:

```text
affected Reed–Solomon codewords
```

as well.

Two candidates may modify different numbers of visible modules but affect radically
different numbers of protected symbols. Flipping two modules that fall inside the same
codeword costs one codeword of error budget; flipping two modules in two different
codewords costs two. A naive module-count metric treats those as identical.

A future optimiser should therefore consider:

> Where can the available error-correction budget create the greatest target-image
> improvement?

This becomes a constrained optimisation problem: maximise visual similarity subject to
the number of corrupted Reed–Solomon codewords staying within what the chosen ECC level
can repair.

Note that the relationship between modules and codewords is not local — a codeword's eight
bits are scattered across the matrix by the QR placement pattern, so visual proximity and
error-budget proximity are unrelated.

---

## A4 — Synthetic robustness testing

Test generated candidates under controlled transformations:

- scaling,
- downscaling,
- rotation,
- blur,
- Gaussian noise,
- contrast changes,
- brightness changes,
- JPEG compression,
- perspective distortion,
- partial obstruction,
- uneven illumination simulation.

Record decoding **rates** rather than anecdotal success. Every transformation needs its
parameters recorded exactly — "blurred" is not a transformation, "Gaussian blur, σ = 1.4"
is.

The purpose is to find out whether the visual optimisation has traded away margin that
would have been needed in the real world. A candidate that is 3% more similar and 40%
less robust under mild blur is a worse symbol, not a better one.

---

## A5 — Physical camera testing

Move from synthetic testing to:

- phone screens,
- printed symbols,
- camera capture,
- different angles,
- different distances,
- different lighting,
- different devices.

Results must distinguish:

```text
digital image decoding
```

from:

```text
camera / physical decoding
```

These are different claims. A symbol that decodes flawlessly from a PNG and fails from a
photograph of a phone screen has failed, and the result must say so.

Camera testing is inherently less reproducible than synthetic testing, so each capture
must record device, distance, angle, lighting conditions, and whether the display was a
screen or paper.

---

## A6 — Logo-aware optimization algorithm

Only after `A1`–`A5` establish measurable behaviour should a serious optimisation
algorithm be developed.

Potential objective:

```text
visual similarity
+
QR structural validity
+
decode robustness
+
ECC / error-budget awareness
```

The weights in that sum are an empirical question, and `A3` is what makes answering it
possible.

**Do not prematurely introduce ML or generative methods before establishing deterministic
baselines.** A gradient-free search over the error budget is the expected first
implementation. Anything learned comes after, if at all.

---

## A7 — Multi-logo evaluation

Test multiple target classes such as:

- simple letters,
- geometric logos,
- circular logos,
- sparse logos,
- dense logos,
- monochrome logos,
- multicolour logos after binary normalisation.

Evaluate whether some types of logos are fundamentally more compatible with QR geometry.

This is where the theoretical similarity ceiling from `A1` pays off: targets can be ranked
by how much headroom QR geometry leaves them, which is a property of the target rather
than of any particular optimiser.

---

## A8 — Comparison with existing artistic QR approaches

Only after internal experiments are reproducible should StegoCode compare its approach
against existing aesthetic/artistic QR methods.

A literature review is required. It is not optional, and it has not been done.

**Do not claim novelty before performing that review.** The techniques used in this space
are long-established and well-published; the honest expectation is that this route
reproduces known trade-offs with its own measurements rather than discovering new ones.

---

## Relationship with the current implementation

- The baseline is `qr_app copy.html`, which contains the in-repo Version 1 encoder.
- `A0` validates that encoder; `A1` uses it unchanged to generate all 32 candidates.
- No experiment modifies `qr_app copy.html`. Experiments are separate artefacts under
  `experiments/route-a/`.
- `qr_app.html` (the `qrcodejs` page) is not part of Route A. It cannot serve as a
  baseline because it does not expose the mask or the matrix.

---

## Key limitations specific to Route A

- Version 1 only, byte mode only, at most 17 UTF-8 bytes.
- 208 mutable modules is a small search space, and the error budget is smaller still.
- Immutable structure is 53% of the symbol and cannot be optimised.
- Digital decodability is not camera decodability.
- No novelty claim is available until `A8`.
