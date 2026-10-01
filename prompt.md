You are working inside the existing **StegoCode** repository.

# PROJECT CONTEXT

StegoCode is currently a browser-based client-side project containing two main working ideas:

1. Protected image steganography using RGB least-significant-bit embedding with protected payload framing and repair.
2. Standalone Version 1 QR generation and QR scanning.

The project originally started as an experiment around questions such as:

- Can QR-like systems be used as carriers for cryptographic data?
- Can machine-readable codes be integrated into company logos rather than appearing as obvious QR grids?
- Could something visually resemble a normal logo — for example a Google-style "G" — while scanning to a payload such as `google.com`?
- Can invisible or almost invisible data be embedded directly in image pixels?
- What trade-offs exist between visual fidelity, machine readability, error correction, camera robustness, and hiddenness?

The project is now being turned into a serious learning/research project.

This task is **NOT an implementation phase**.

Do not start implementing the new research experiments.

The purpose of this task is:

- preserve everything that already works,
- clean the repository structure without destructive changes,
- document the existing implementation,
- establish the research architecture,
- document all three planned research routes,
- create enough technical context that a future coding agent can enter the repository and immediately understand what exists, what must not be broken, what is planned, why the experiments exist, and how results should be evaluated.

---

# CRITICAL RULES

## 1. PRESERVE EVERYTHING

Do not delete existing functionality.

Do not remove existing working files.

Do not rewrite algorithms simply because a cleaner implementation is possible.

Do not replace the current QR encoder.

Do not replace the current steganography implementation.

Do not migrate the project to a framework.

Do not introduce build tooling unless absolutely required for documentation, which it should not be.

Do not add dependencies.

Do not modify behavior unless required to fix an obvious documentation-related path/reference problem.

Current files such as these must remain available:

- `stego_app.html`
- `qr_app.html`
- `qr_app copy.html`

If files are reorganized, use safe moves and preserve their contents and behavior exactly.

Prefer leaving existing working application files in their current locations unless there is a very strong organizational reason to move them.

When uncertain, preserve rather than modify.

---

# 2. CREATE A SAFETY BASELINE BEFORE REORGANIZATION

Before making repository changes:

1. Inspect the entire repository.
2. Record the existing directory tree.
3. Identify:
   - current HTML applications,
   - JavaScript,
   - CSS,
   - images/assets,
   - libraries,
   - tests,
   - documentation,
   - experimental files,
   - generated files if any.
4. Identify how the existing pages are launched and used.
5. Identify external browser libraries such as `jsQR`.
6. Identify the current QR encoder implementation.
7. Identify the current LSB/protected-payload implementation.
8. Identify duplicate or experimental QR pages and explain their role before changing anything.
9. Check Git status before modifying files.
10. Do not destroy uncommitted user work.

Document the starting state.

If Git is available, recommend creating a preservation commit/tag, but do not force destructive Git operations.

A suitable conceptual milestone name is:

`pre-research-baseline`

Do not reset, checkout, discard, clean, or otherwise destroy user changes.

---

# 3. CLEAN THE REPOSITORY CONSERVATIVELY

Perform only a safe organizational cleanup.

The repository should clearly distinguish:

- current working applications,
- documentation,
- research plans,
- experiments,
- experimental results,
- test/validation utilities.

A reasonable target structure is:

```text
StegoCode/
│
├── README.md
│
├── stego_app.html
├── qr_app.html
├── qr_app copy.html
│
├── docs/
│   ├── PROJECT_OVERVIEW.md
│   ├── CURRENT_IMPLEMENTATION.md
│   ├── RESEARCH_ROADMAP.md
│   ├── RESEARCH_METHODOLOGY.md
│   ├── TERMINOLOGY.md
│   ├── LIMITATIONS.md
│   ├── ROUTE_A_ARTISTIC_QR.md
│   ├── ROUTE_B_CUSTOM_LOGO_CODE.md
│   ├── ROUTE_C_IMAGE_STEGANOGRAPHY.md
│   ├── QR_V1_TECHNICAL_NOTES.md
│   ├── STEGANOGRAPHY_TECHNICAL_NOTES.md
│   ├── EXPERIMENT_FORMAT.md
│   └── AGENT_CONTEXT.md
│
├── experiments/
│   ├── README.md
│   ├── route-a/
│   │   ├── README.md
│   │   └── results/
│   │       └── .gitkeep
│   │
│   ├── route-b/
│   │   ├── README.md
│   │   └── results/
│   │       └── .gitkeep
│   │
│   └── route-c/
│       ├── README.md
│       └── results/
│           └── .gitkeep
│
└── ...
```

Adapt this structure to the repository that actually exists.

Do not create pointless empty nesting.

Do not move working application code simply to make the tree look prettier.

The goal is clarity, not churn.

---

# 4. UPDATE THE ROOT README

Rewrite or improve the root `README.md` so it accurately presents StegoCode as both:

1. a currently working browser application, and
2. an ongoing research/learning project.

The README should include:

## Project title

**StegoCode: Browser-Based Steganography and Visual Machine-Readable Code Research**

## Existing functionality

Document the currently working capabilities:

### Protected image steganography

- RGB least-significant-bit insertion.
- Alpha channel skipped.
- UTF-8 payload handling.
- `STG` magic bytes.
- version information.
- payload length framing.
- CRC-16 integrity.
- block-level protection.
- CRC-8.
- GF(256) parity.
- one-symbol-per-block repair behavior.
- rejection of ambiguous/multiply corrupted blocks.
- lossless image requirements.
- browser-only operation.

### QR Studio

Document the standalone Version 1 QR implementation:

- 21×21 module symbols.
- UTF-8 byte mode.
- mode indicator.
- byte-length indicator.
- Reed–Solomon error-correction codewords.
- finder patterns.
- separators.
- timing patterns.
- quiet zone.
- fixed dark module.
- format information.
- all eight QR masks.
- ISO-style mask penalty evaluation.
- canvas output.
- PNG download.
- Version 1 capacity constraints.
- `jsQR` used for scanning.
- QR generation itself does not use a QR-generation library.

Document existing Version 1 byte-mode capacities:

```text
L = 17 UTF-8 bytes
M = 14 UTF-8 bytes
Q = 11 UTF-8 bytes
H = 7 UTF-8 bytes
```

Clearly state that QR itself is not encryption.

QR is a data representation/transport mechanism.

Cryptographic payloads may later be carried inside QR or other codes, but cryptography and QR encoding must remain conceptually separate.

---

# 5. DEFINE THE THREE RESEARCH ROUTES

The project is now deliberately split into three research routes.

All three must be documented.

---

# ROUTE A — STANDARDS-COMPATIBLE ARTISTIC QR

## Primary objective

Investigate:

> How closely can a standards-compatible QR symbol resemble a target logo while remaining decodable by ordinary QR scanners?

Example concept:

```text
Visual appearance:
Google-style G

Decoded content:
google.com
```

The goal is NOT merely placing a logo in the center of a QR code.

The goal is to study whether the QR module arrangement itself can be optimized toward the appearance of a target image/logo.

Ordinary QR scanners should remain capable of decoding the result.

## Main constraints

Document that QR has mandatory structures such as:

- finder patterns,
- separators,
- timing patterns,
- format information,
- fixed dark module,
- data/error-correction modules.

These must be distinguished from mutable experimental regions.

The project must eventually model QR module roles explicitly.

---

# ROUTE A EXPERIMENT ROADMAP

Document the following research progression.

## A0 — Freeze and validate the current Version 1 encoder

Purpose:

Establish a trustworthy baseline before any artistic modification.

Verify:

- Version 1 matrix dimensions.
- payload encoding.
- ECC generation.
- mask generation.
- format information.
- capacity enforcement.
- independent decoding.
- existing tests.

No optimization yet.

---

## A1 — Mask/ECC visual-similarity baseline

This is the NEXT IMPLEMENTATION EXPERIMENT, but it must NOT be implemented during this documentation task.

Research question:

> Given the same Version 1 payload and a target logo, how much visual similarity can be obtained using only valid QR error-correction levels and mask choices without changing encoded modules?

Use a tiny payload that fits all Version 1 ECC levels.

A useful controlled example is:

```text
g.co
```

because payload size remains fixed while comparing:

```text
L
M
Q
H
```

and masks:

```text
0
1
2
3
4
5
6
7
```

This produces:

```text
4 × 8 = 32 candidates
```

For every candidate record:

- ECC level.
- mask.
- full target similarity.
- mutable-region similarity.
- mandatory-module conflict count.
- theoretical similarity ceiling.
- QR penalty rule 1.
- QR penalty rule 2.
- QR penalty rule 3.
- QR penalty rule 4.
- total QR penalty.
- whether the normal QR algorithm would select this mask.
- `jsQR` detection result.
- `jsQR` exact-payload result.
- independent decoder result.
- decoded payload.
- generated PNG.

A candidate counts as correctly decoded only when the recovered payload exactly matches the original payload.

---

## Target normalization for A1

Target images should initially be converted into a deterministic:

```text
21 × 21
```

binary representation.

Initial process:

```text
input image
↓
square fit/crop
↓
grayscale
↓
downsample to 21×21
↓
threshold
↓
binary target matrix
```

Represent:

```text
T[row][column] ∈ {0, 1}
```

Display both:

- source target image,
- normalized 21×21 experimental target.

---

## QR role map

Future experimental QR code must maintain a role map separate from the bit matrix.

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

Version 1 does not use alignment patterns.

Future larger QR versions may add additional structural categories.

The role map is important because function modules must not accidentally be treated as ordinary modifiable modules.

---

## Similarity metrics

Document several metrics rather than one arbitrary percentage.

### Full matrix similarity

For candidate QR matrix `Q` and target `T`:

```text
S_full =
1 - mismatching_modules / 441
```

because:

```text
21 × 21 = 441
```

### Mutable-region similarity

Measure similarity only over modules that are candidates for later modification.

This prevents mandatory QR structure from dominating the score.

### Fixed-module conflict count

Count locations where the target requests one state but QR structure requires another.

This provides information about how compatible the chosen target is with QR geometry.

### Theoretical visual ceiling

Calculate the maximum similarity theoretically possible if every modifiable location perfectly matched the target while immutable QR structures remained unchanged.

This value is important for comparing logos fairly.

---

## A2 — Controlled target-directed module modification

Research question:

> How many carefully selected target-directed modifications can be introduced before decoding begins to fail?

Begin changing QR modules toward the target image.

Do not change mandatory structural modules.

Measure:

- module changes,
- visual improvement,
- affected codewords,
- decode success,
- decoder confidence where measurable.

The purpose is to empirically locate the visual/readability boundary.

---

## A3 — Codeword-aware optimization

Important research insight:

QR Reed–Solomon repair operates over codeword symbols rather than an abstract count of changed visual modules.

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

Two candidates may modify different numbers of visible modules but affect radically different numbers of protected symbols.

A future optimizer should therefore consider:

> Where can the available error-correction budget create the greatest target-image improvement?

This becomes a constrained optimization problem.

---

## A4 — Synthetic robustness testing

Test generated candidates under controlled transformations:

- scaling.
- downscaling.
- rotation.
- blur.
- Gaussian noise.
- contrast changes.
- brightness changes.
- JPEG compression.
- perspective distortion.
- partial obstruction.
- uneven illumination simulation.

Record decoding rates rather than anecdotal success.

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
camera/physical decoding
```

---

## A6 — Logo-aware optimization algorithm

Only after A1–A5 establish measurable behavior should a serious optimization algorithm be developed.

Potential objective:

```text
visual similarity
+
QR structural validity
+
decode robustness
+
ECC/error-budget awareness
```

Do not prematurely introduce ML or generative methods before establishing deterministic baselines.

---

## A7 — Multi-logo evaluation

Test multiple target classes such as:

- simple letters.
- geometric logos.
- circular logos.
- sparse logos.
- dense logos.
- monochrome logos.
- multicolor logos after binary normalization.

Evaluate whether some types of logos are fundamentally more compatible with QR geometry.

---

## A8 — Comparison with existing artistic QR approaches

Only after internal experiments are reproducible should StegoCode compare its approach against existing aesthetic/artistic QR methods.

Document that eventual literature review is required.

Do not claim novelty before performing that review.

---

# ROUTE B — CUSTOM LOGO CODE

Document Route B separately.

## Objective

Investigate a custom machine-readable visual code designed specifically to resemble logos.

Unlike Route A:

```text
ordinary QR compatibility is not required
```

A dedicated StegoCode scanner may be used.

Concept:

```text
human sees:
logo

StegoCode scanner sees:
structured encoded payload
```

Research areas may include:

- custom registration markers.
- orientation detection.
- synchronization.
- payload regions.
- Reed–Solomon or BCH protection.
- distributed symbols.
- geometric invariants.
- color channels.
- spatial redundancy.
- perspective correction.
- custom finder structures hidden inside logo geometry.
- camera robustness.

Document the central Route B research question:

> How much visual freedom can be gained by abandoning QR compatibility while still maintaining practical camera-based decoding?

Do not implement Route B now.

---

# ROUTE C — IMAGE STEGANOGRAPHY

Route C represents the existing StegoCode LSB work and its future research direction.

## Objective

Investigate:

> How much machine-readable information can be hidden inside an ordinary digital image while preserving human-visible appearance?

Current implementation uses spatial-domain RGB LSB replacement.

Document the distinction:

```text
Route A:
visually stylized but overt optical code

Route B:
custom logo-shaped optical code

Route C:
data hidden in image signal itself
```

Route C currently provides extremely high visual preservation but poor resilience to transformations.

Document existing limitations:

- JPEG damages LSB payloads.
- resizing can destroy embedded bits.
- screenshots destroy direct bit correspondence.
- print/camera recapture does not preserve individual LSBs.
- social-media recompression may destroy data.
- color conversion may destroy data.
- image optimization pipelines may destroy data.

Future Route C research may consider:

- redundant LSB strategies.
- adaptive embedding.
- error-correction improvements.
- transform-domain methods.
- DCT methods.
- DWT methods.
- robust watermarking ideas.
- spatial synchronization.
- camera-survivable embedding.

Do not implement these now.

---

# 6. DOCUMENT THE PROJECT AS A RESEARCH PROGRAM

Create `docs/RESEARCH_ROADMAP.md`.

It should explain the overall progression:

```text
CURRENT SYSTEM
│
├── Existing protected LSB codec
│
└── Existing Version 1 QR encoder/scanner
     │
     ▼
RESEARCH FOUNDATION
│
├── preserve implementations
├── establish validation
├── establish metrics
└── establish reproducibility
     │
     ├────────────── Route A
     │               standards-compatible artistic QR
     │
     ├────────────── Route B
     │               custom logo-readable visual code
     │
     └────────────── Route C
                     robust image steganography
```

Clearly state that cryptography may later be layered onto any route but is a separate concern.

Potential future cryptographic payloads may include:

- encryption.
- authentication.
- signatures.
- signed URLs.
- identity assertions.
- tamper evidence.

But do not currently describe QR itself as cryptography.

---

# 7. CREATE A RESEARCH METHODOLOGY DOCUMENT

Create:

`docs/RESEARCH_METHODOLOGY.md`

Establish rules for future experiments.

## Every experiment must define

- experiment ID.
- date.
- research question.
- hypothesis if applicable.
- inputs.
- payload.
- QR version.
- ECC.
- mask.
- target image.
- normalization method.
- software versions.
- browser.
- decoder.
- test transformations.
- metrics.
- output files.
- conclusions.
- limitations.

## Reproducibility

Experiments should be deterministic whenever possible.

Store random seeds if randomness is introduced.

Generated results should include machine-readable data.

Prefer:

```text
CSV
JSON
PNG
```

over screenshots as primary evidence.

Screenshots may supplement results but must not be the only evidence.

## Decoder independence

Do not validate an encoder solely with its own decoder.

For Route A, use at least:

```text
browser decoder: jsQR
external/independent decoder: OpenCV QRCodeDetector
```

Later additional decoders may be added.

## Exact payload validation

A QR counts as successful only if:

```text
decoded payload === expected payload
```

Detection alone is insufficient.

---

# 8. CREATE AN EXPERIMENT RESULT FORMAT

Create:

`docs/EXPERIMENT_FORMAT.md`

Define future experiment folder conventions.

For example:

```text
experiments/
└── route-a/
    └── A1/
        ├── README.md
        ├── targets/
        ├── outputs/
        ├── results/
        │   ├── results.csv
        │   └── manifest.json
        └── validation/
```

Do not necessarily create `A1/` yet unless useful.

The next coding phase will create it.

Define a recommended A1 CSV schema:

```text
run_id
timestamp
target_name
payload
qr_version
ecc
mask
full_similarity
mutable_similarity
fixed_conflicts
theoretical_ceiling
qr_penalty_1
qr_penalty_2
qr_penalty_3
qr_penalty_4
qr_penalty_total
standard_selected_mask
jsqr_detected
jsqr_payload_correct
opencv_detected
opencv_payload_correct
decoded_payload
candidate_file
```

---

# 9. CREATE TECHNICAL NOTES FOR THE EXISTING QR ENCODER

Create:

`docs/QR_V1_TECHNICAL_NOTES.md`

Inspect the actual implementation and document it accurately.

Do not merely repeat generic QR theory.

Map documentation to the source code that actually exists.

Document:

- entry points.
- payload conversion.
- byte mode.
- capacity checks.
- terminator behavior.
- padding.
- error-correction generation.
- GF(256) implementation.
- matrix construction.
- finder placement.
- separator placement.
- timing placement.
- format-data placement.
- fixed dark module.
- masking.
- penalty scoring.
- selected mask.
- canvas rendering.
- quiet zone.
- output scaling.
- scanning code.
- external dependencies.

Note any deviations, shortcuts, limitations, or assumptions.

Do not silently "fix" them during this documentation task.

---

# 10. CREATE TECHNICAL NOTES FOR STEGANOGRAPHY

Create:

`docs/STEGANOGRAPHY_TECHNICAL_NOTES.md`

Inspect and document the existing implementation.

Describe:

- bit traversal order.
- RGB channel usage.
- alpha skipping.
- payload framing.
- UTF-8 conversion.
- CRC behavior.
- GF(256) operations.
- protected-block structure.
- repair logic.
- corruption rejection.
- capacity calculation.
- image format expectations.
- browser APIs involved.

Include a concise packet layout diagram.

Example style:

```text
payload
│
├── magic
├── version
├── length
├── UTF-8 data
└── CRC
     │
     ▼
protected blocks
     │
     ▼
RGB LSB embedding
```

Ensure documentation reflects the real implementation rather than assumptions.

---

# 11. CREATE A TERMINOLOGY DOCUMENT

Create:

`docs/TERMINOLOGY.md`

Define terms such as:

- steganography.
- watermarking.
- encryption.
- encoding.
- error correction.
- Reed–Solomon.
- GF(256).
- QR module.
- QR codeword.
- finder pattern.
- quiet zone.
- mask.
- error-correction level.
- optical code.
- visual similarity.
- mutable module.
- immutable/function module.
- payload.
- target logo.
- decoder robustness.

This is important because future agentic coding must not confuse:

```text
encryption
```

with:

```text
encoding
```

or:

```text
steganography
```

with:

```text
QR representation
```

---

# 12. CREATE A LIMITATIONS DOCUMENT

Create:

`docs/LIMITATIONS.md`

Be technically conservative.

Document current limitations without marketing language.

Important examples:

### QR

- Version 1 only.
- byte mode only.
- limited payload.
- no larger versions.
- no alignment patterns.
- no numeric optimization.
- no alphanumeric optimization.
- no Kanji mode.
- scanner behavior can differ between implementations.
- successful digital decoding does not guarantee camera decoding.

### LSB

- requires essentially lossless pixel preservation.
- lossy compression destroys payload reliability.
- resize/crop/transcoding may break payload.
- no guarantee of camera recapture robustness.
- one-symbol repair limit per protected block.
- arbitrary/multiple corruption may be unrecoverable.

---

# 13. CREATE `AGENT_CONTEXT.md`

This is one of the most important deliverables.

Create:

`docs/AGENT_CONTEXT.md`

It should be written specifically for future agentic coding systems.

It should summarize:

## What StegoCode currently is.

## What already works.

## Which files contain the working implementations.

## Which files must not be casually rewritten.

## What Route A, B, and C mean.

## Which route is currently active.

State clearly:

```text
CURRENT ACTIVE RESEARCH ROUTE: ROUTE A
```

and:

```text
NEXT IMPLEMENTATION TARGET: EXPERIMENT A1
```

## A1 objective

Quote the central research question:

> Given a Version 1 QR payload and target image, how much visual similarity can be achieved using only valid ECC/mask choices before modifying any QR modules?

## A1 constraints

Future implementation agent must:

- preserve existing applications.
- build experiment separately.
- use 21×21 normalized target.
- enumerate all eight masks.
- compare L/M/Q/H when payload capacity allows.
- produce up to 32 candidates.
- calculate similarity metrics.
- calculate QR penalties.
- maintain QR module role map.
- validate exact payload with `jsQR`.
- support independent OpenCV validation.
- export reproducible results.
- avoid premature target-directed module modification.
- avoid Route B and Route C implementation during A1.
- avoid adding cryptography during A1.
- avoid ML during A1.

## Future order

Clearly state:

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

Future agents should not skip directly to advanced optimization unless explicitly instructed.

---

# 14. CREATE ROUTE-SPECIFIC README FILES

Create:

```text
experiments/route-a/README.md
experiments/route-b/README.md
experiments/route-c/README.md
```

Each should summarize:

- route goal.
- current status.
- planned experiments.
- metrics.
- key limitations.
- dependencies.
- relationship with current implementation.

Route A README should clearly mark:

```text
A1 — planned, not yet implemented
```

at the end of this task.

---

# 15. CLEAN UP DUPLICATE/AMBIGUOUS FILE NAMING CAREFULLY

There is currently a file named:

```text
qr_app copy.html
```

Do not delete it.

Inspect whether it differs from `qr_app.html`.

Document the difference.

If they are genuinely distinct implementations, keep both and describe them.

If one is clearly a historical copy, still preserve it.

You may move historical copies into an archival location only if:

- Git history/status is safe,
- references are updated,
- no functionality is lost,
- and the reason is documented.

Otherwise leave it where it is.

Do not rename files merely for aesthetics if doing so introduces risk.

---

# 16. SECURITY AND PRIVACY DOCUMENTATION

Document that StegoCode currently operates client-side.

State whether:

- images are uploaded anywhere,
- payloads leave the browser,
- camera data is transmitted,
- external libraries make network calls.

Verify actual behavior from source rather than assuming.

If third-party scripts are loaded remotely, document that separately from application data upload behavior.

Do not make absolute privacy claims that are not supported by the implementation.

---

# 17. NO IMPLEMENTATION OF A1 YET

This is critical.

At the end of this task:

DO NOT have a working target-logo optimizer.

DO NOT add target-directed QR mutation.

DO NOT add similarity algorithms unless only included as documentation/pseudocode.

DO NOT add OpenCV execution pipelines yet.

DO NOT change the QR generation algorithm for artistic output.

DO NOT implement Route B.

DO NOT implement Route C upgrades.

DO NOT add encryption.

DO NOT add ML.

DO NOT add cryptographic signing.

This phase is strictly:

```text
PRESERVE
↓
INSPECT
↓
ORGANIZE
↓
DOCUMENT
↓
DEFINE RESEARCH PLAN
```

The next prompt will implement Experiment A1.

---

# 18. FINAL VERIFICATION

After modifications:

1. Review Git diff.
2. Confirm existing working HTML applications remain intact.
3. Check that no application code was unintentionally rewritten.
4. Check that no working asset disappeared.
5. Check documentation links.
6. Check Markdown formatting.
7. Confirm all three routes are documented.
8. Confirm Route A is marked current.
9. Confirm A1 is marked next.
10. Confirm A1 itself was NOT implemented.
11. Confirm no dependencies were added.
12. Confirm no files were deleted without explicit necessity.
13. If any file was moved, provide old → new paths.
14. Run any existing lightweight tests/syntax checks that do not modify the system.
15. Do not attempt broad refactors while fixing documentation issues.

---

# REQUIRED FINAL REPORT

At the end, provide a concise but complete report containing:

## 1. Repository assessment

What existed before changes.

## 2. Preservation actions

What was intentionally left untouched.

## 3. Repository organization

Show the final relevant directory tree.

## 4. Documentation created

List every new/updated documentation file and its purpose.

## 5. Existing implementation status

State whether:

- steganography functionality remains intact,
- QR functionality remains intact,
- scanning functionality remains intact.

## 6. Research structure

Summarize:

```text
Route A — standards-compatible artistic QR
Route B — custom logo-readable optical code
Route C — image steganography
```

## 7. Current research state

Explicitly report:

```text
Current route: Route A
Current stage: documentation/research foundation
Next experiment: A1 — Mask/ECC Visual Similarity Baseline
A1 implementation status: NOT STARTED
```

## 8. Changes made

List:

- files added,
- files edited,
- files moved,
- files deleted.

Ideally there should be no destructive deletions.

## 9. Verification

Report any checks/tests performed.

## 10. Risks or ambiguities discovered

Especially note:

- duplicate QR files,
- undocumented algorithms,
- source-code assumptions,
- missing tests,
- questionable external dependencies,
- anything future agents should know.

---

# GUIDING PRINCIPLE

StegoCode should evolve from a collection of interesting browser experiments into a reproducible research project without sacrificing the implementations that already work.

Preserve first.

Measure second.

Optimize third.

The immediate long-term research direction is:

> Determine how far a standards-compatible QR code can be visually transformed toward a target logo while retaining reliable machine readability.

The immediate next coding milestone after this documentation phase will be:

> **Route A — Experiment A1: generate all valid Version 1 ECC/mask candidates for a fixed payload, compare them against a normalized 21×21 target logo, validate decoding independently, and export reproducible measurements.**