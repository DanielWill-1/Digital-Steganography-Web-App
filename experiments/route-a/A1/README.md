# A1 — Mask/ECC Visual Similarity Baseline

**Route A · Experiment A1 · QR Version 1 · 21 × 21**

Status: **implemented; default experiment run and validated by two independent decoders.**
Next planned experiment: **A2 — controlled target-directed module modification (NOT implemented).**

A1 is the control experiment. It measures how much visual similarity ordinary, fully valid
Version 1 QR encoding provides through ECC-level and mask selection **alone**. It does not
modify a single QR module.

---

## Objective

The research question, answerable by measurement:

> Given the same Version 1 QR payload and a target logo, how much visual similarity can be
> obtained using only valid QR error-correction levels and the eight standard QR masks,
> without changing any encoded module?

---

## Scope

In scope:

- the four valid Version 1 ECC levels (L, M, Q, H) and all eight standard masks;
- a deterministic 21 × 21 binary target derived from an image (or a built-in synthetic
  target);
- similarity metrics with stated denominators;
- the four standard QR mask-penalty components, reported separately;
- jsQR validation of every candidate, with exact-payload checking;
- an independent OpenCV `QRCodeDetector` validation utility;
- machine-readable export (`manifest.json`, `results.csv`, candidate PNGs).

Explicitly **out of scope** (these are A2 and later):

- modifying any QR module toward the target;
- spending error-correction budget;
- flipping codewords, changing data placement, or moving finder patterns;
- any aesthetic trick (rounded modules, colour, gradients, overlaid logos).

> **A1 must not modify any QR module after generation.** The role map exists to measure
> target compatibility and to prepare later work — not to enable mutation here.

---

## Usage

Open `experiment-a1.html` **directly in a browser** — double-click it, or drag it into a
browser window. No server and no build step are required.

The scripts are plain classic `<script src>` files (they share a `StegoA1` namespace)
precisely so the page works from a `file://` origin. Serving it over a local server also
works if you prefer:

```bash
cd <repository root>
python -m http.server 8080
# then open http://127.0.0.1:8080/experiments/route-a/A1/experiment-a1.html
```

`jsQR` 1.4.0 is loaded from the same public CDN the existing QR apps use, so an internet
connection is needed for the in-page decode check. Nothing is uploaded; all processing is
local. If the CDN is unreachable the experiment still runs, but jsQR validation is reported
as unavailable (the OpenCV validator is the independent check in any case).

### Headless default run

```bash
cd experiments/route-a/A1
node tests/run-default-experiment.js
```

Writes `outputs/*.png`, `results/results.csv`, and `results/manifest.json`. jsQR is
included only when a local copy is provided, so no dependency is added:

```bash
# Windows (cmd)
set A1_JSQR_PATH=C:\path\to\jsQR.js && node tests/run-default-experiment.js
# POSIX
A1_JSQR_PATH=/path/to/jsQR.js node tests/run-default-experiment.js
```

### Independent validation

```bash
python validation/validate_opencv.py outputs --expected "g.co" --csv results/opencv_results.csv
```

---

## Default controlled experiment

| Input | Value |
| :--- | :--- |
| Payload | `g.co` |
| UTF-8 bytes | 4 (fits all four ECC levels: 17/14/11/7) |
| Target | built-in synthetic `circle` (defined in `js/target-grid.js`) |
| Expected candidates | 4 ECC × 8 masks = 32 |

`g.co` is used because it fits every level, so payload size is constant across all 32
candidates and cannot confound the comparison. The built-in targets make the default run
reproducible without a binary fixture; a real logo can be uploaded instead and is
normalised with the identical pipeline.

---

## Target normalisation

Deterministic, recorded exactly, and shown in the UI (`js/target-grid.js`):

| Step | Method |
| :--- | :--- |
| Fit | centre-crop to square (never stretched) |
| Grayscale | Rec. 601 luma: `(299R + 587G + 114B) / 1000` |
| Downsample | box average to 21 × 21 |
| Threshold | `luma < 128 → dark (1)`, `luma >= 128 → light (0)` |
| Convention | `1` = target wants a dark module |

The integer luma coefficients are deliberate: `0.299 + 0.587 + 0.114` in IEEE-754 is
`0.9999999999999999`, which would misclassify exactly-128 pixels. No adaptive thresholding
is used. Both the uploaded source and the normalised 21 × 21 target are displayed, because
normalisation is lossy and the metric must be inspectable.

---

## QR module role map

`js/qr-role-map.js` maintains a role grid parallel to the bit matrix. Version 1 counts were
verified against the documented baseline:

```text
FINDER          147   immutable
SEPARATOR        45   immutable
TIMING           10   immutable
FORMAT           30   immutable
DARK_MODULE       1   immutable
DATA + ECC      208   mutable (DATA/ECC distinguished per ECC level)
REMAINDER         0
TOTAL           441
```

Immutable structure is 233 modules (52.8%); the mutable set is exactly the 208 data/ECC
modules. DATA is distinguished from ECC by replaying the placement order (the first
`data_codewords × 8` positions are DATA, the rest ECC).

---

## Encoder reuse

`qr_app copy.html`'s encoder is wrapped in an IIFE and cannot be imported, and the project's
rules forbid rewriting the application for an experiment's convenience. A1 therefore
contains a **faithful port** in `js/qr-experiment.js` — the same functions (GF(256), RS
ECC, BCH format, mask, placement) with additive extensions only:

- explicit `eccLevel` + `mask` inputs;
- the role map;
- the four penalty rules reported separately;
- exposed codewords;
- a pure rasteriser shared by browser and Node.

Faithfulness is enforced by tests: the port reproduces the exact documented per-mask penalty
totals for `g.co` at all four levels, and all 32 candidates decode identically under jsQR
and OpenCV. The port is verified against the baseline, not merely asserted to match it.

---

## Metrics

| Metric | Denominator | Formula |
| :--- | :--- | :--- |
| Full similarity | 441 modules | `matches / 441` |
| Mutable similarity | 208 data/ECC modules | `mutable_matches / 208` |
| Fixed conflicts | 233 immutable modules | count of immutable positions disagreeing with the target |
| Fixed conflict ratio | 233 | `fixed_conflicts / 233` |
| Theoretical ceiling | 441 | `(208 + fixed_matches) / 441` |
| Ceiling gap | — | `theoretical_ceiling − full_similarity` |

The theoretical ceiling is a structural upper bound under the defined mutability model. It
is **not** claimed to be reachable under valid QR encoding.

---

## Penalties

`qrPenaltyBreakdown` returns the four ISO-style rules separately plus their total; the total
equals the baseline encoder's single `qrPenalty` score. Rule 3 was dead code before A4.0
(boolean compared with `=== 0`) and is now fixed, so the penalty columns and the
standard-selected mask were regenerated (see [`../A4/BUG_AUDIT.md`](../A4/BUG_AUDIT.md)).
The standard mask per level is the lowest-total-penalty mask (ties resolve to the lowest
index, as in the baseline).

---

## Default experiment result

Run: `A1-20261002-1` · 2026-10-02 · payload `g.co` · target `synthetic-circle`.

All values are from `results/results.csv` (do not treat them as general claims — one
target, one payload).

```text
Candidates generated:   32 / 32   (no level skipped — g.co fits all four)
jsQR exact decode:      32 / 32
OpenCV exact decode:    32 / 32   (see validation/opencv_results.csv)

Highest full similarity:     A1-H-M6   49.43%
Highest mutable similarity:  A1-H-M5   55.29%
Lowest total QR penalty:     A1-Q-M0   287   (corrected, A4.0)
Standard-selected mask per ECC:  L → 3, M → 6, Q → 0, H → 2   (corrected, A4.0)
Theoretical ceiling (of the best full-similarity candidate, H-M6): 70.52%
```

Full table, sorted by full similarity (penalty column and `standard` flag are the corrected
A4.0 values):

| candidate | ECC | mask | full | mutable | fixed conflicts | ceiling | penalty | standard | jsQR |
| :--- | :---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: | :---: |
| A1-H-M6 | H | 6 | 49.43% | 55.29% | 130 | 70.52% | 370 | | exact |
| A1-M-M2 | M | 2 | 48.98% | 51.44% | 124 | 71.88% | 360 | | exact |
| A1-Q-M2 | Q | 2 | 48.53% | 53.37% | 130 | 70.52% | 341 | | exact |
| A1-Q-M6 | Q | 6 | 48.53% | 53.37% | 130 | 70.52% | 348 | | exact |
| A1-H-M5 | H | 5 | 48.53% | 55.29% | 134 | 69.61% | 475 | | exact |
| A1-M-M7 | M | 7 | 47.62% | 53.37% | 134 | 69.61% | 565 | | exact |
| A1-H-M1 | H | 1 | 47.62% | 49.52% | 126 | 71.43% | 417 | | exact |
| A1-L-M2 | L | 2 | 47.17% | 51.44% | 132 | 70.07% | 437 | | exact |
| A1-Q-M7 | Q | 7 | 47.17% | 49.52% | 128 | 70.98% | 397 | | exact |
| A1-L-M4 | L | 4 | 46.71% | 53.37% | 138 | 68.71% | 368 | | exact |
| A1-L-M6 | L | 6 | 46.71% | 54.33% | 140 | 68.25% | 381 | | exact |
| A1-L-M7 | L | 7 | 46.71% | 51.44% | 134 | 69.61% | 484 | | exact |
| A1-M-M4 | M | 4 | 46.71% | 49.52% | 130 | 70.52% | 341 | | exact |
| A1-L-M5 | L | 5 | 46.26% | 51.44% | 136 | 69.16% | 403 | | exact |
| A1-Q-M5 | Q | 5 | 46.26% | 54.33% | 142 | 67.80% | 449 | | exact |
| A1-H-M2 | H | 2 | 46.26% | 48.56% | 130 | 70.52% | 306 | yes | exact |
| A1-H-M3 | H | 3 | 46.26% | 47.60% | 128 | 70.98% | 402 | | exact |
| A1-H-M4 | H | 4 | 46.26% | 49.52% | 132 | 70.07% | 640 | | exact |
| A1-M-M5 | M | 5 | 45.80% | 50.48% | 136 | 69.16% | 348 | | exact |
| A1-M-M6 | M | 6 | 45.80% | 48.56% | 132 | 70.07% | 292 | yes | exact |
| A1-L-M1 | L | 1 | 45.35% | 49.52% | 136 | 69.16% | 361 | | exact |
| A1-M-M1 | M | 1 | 45.35% | 49.52% | 136 | 69.16% | 396 | | exact |
| A1-Q-M1 | Q | 1 | 45.35% | 48.56% | 134 | 69.61% | 592 | | exact |
| A1-Q-M3 | Q | 3 | 45.35% | 49.52% | 136 | 69.16% | 424 | | exact |
| A1-Q-M4 | Q | 4 | 45.35% | 47.60% | 132 | 70.07% | 568 | | exact |
| A1-H-M7 | H | 7 | 45.35% | 49.52% | 136 | 69.16% | 450 | | exact |
| A1-L-M3 | L | 3 | 44.90% | 47.60% | 134 | 69.61% | 333 | yes | exact |
| A1-M-M3 | M | 3 | 44.90% | 47.60% | 134 | 69.61% | 485 | | exact |
| A1-L-M0 | L | 0 | 43.54% | 42.79% | 130 | 70.52% | 445 | | exact |
| A1-Q-M0 | Q | 0 | 43.54% | 43.75% | 132 | 70.07% | 287 | yes | exact |
| A1-H-M0 | H | 0 | 43.54% | 43.75% | 132 | 70.07% | 413 | | exact |
| A1-M-M0 | M | 0 | 43.08% | 45.67% | 138 | 68.71% | 312 | | exact |

---

## Interpretation

Facts derivable from the run above:

- Highest full similarity (49.43%) was obtained by **H / mask 6**. The standard
  minimum-penalty mask for H was mask 2, so for H the visually closest candidate was *not*
  the mask the readability-oriented penalty function selects.
- For Q, the highest full similarity (48.53%) was shared by masks 2 and 6, while Q's
  standard-selected mask was mask 0 (43.54%) — so for this target the standard penalty choice
  is visually *worse* than the best Q masks.
- Across all 32 candidates, full similarity ranged roughly 43%–49% while the structural
  ceiling for this target is about 68%–72%. Ordinary ECC/mask choice therefore captures only
  part of the available headroom; the rest would require module modification, which is A2.
- Every candidate remained a valid symbol: 32/32 exact under both jsQR and OpenCV.

The penalty values and standard-selected masks above were regenerated after the A4.0 Rule-3
fix; similarity and decode results are unchanged by that fix (penalty is a structural metric
and does not affect validity).

What these statements do **not** support: any general claim such as "mask 6 is better for
logos". That would require multiple targets (A4).

---

## Output

| Output | Produced by | Notes |
| :--- | :--- | :--- |
| `results/manifest.json` | UI / harness | configuration actually used: payload, normalisation, encoder, decoders, environment |
| `results/results.csv` | UI / harness | one row per candidate, all metrics and penalties |
| `results/opencv_results.csv` | `validate_opencv.py` | independent decoder results, mergeable with the browser CSV |
| `outputs/A1_<ecc>_mask<n>.png` | UI / harness | lossless PNG, 4-module quiet zone, integer module scale, black/white only |
| `targets/<target>-21x21.png` | harness | the normalised target, for inspection |

The manifest records the target normalisation, the payload, the encoder source, the decoder
versions, and the render settings, so a row in `results.csv` can be understood without the
original author present.

---

## Validation

Primary evidence is machine-readable (`results.csv`, `manifest.json`, candidate PNGs) and is
confirmed by two independent decoders:

```text
browser decoder:    jsQR 1.4.0                    32/32 exact
independent decoder: OpenCV QRCodeDetector 4.12.0 32/32 exact
```

Detection is never treated as decoding: success requires the recovered payload to equal
`g.co` exactly. Failures, had there been any, would be recorded in the CSV with the wrong
payload preserved verbatim.

Tests:

```bash
cd experiments/route-a/A1
node tests/run-tests.js                      # 25 checks, jsQR round trip skipped without A1_JSQR_PATH
set A1_JSQR_PATH=C:\path\to\jsQR.js && node tests/run-tests.js   # 25 checks incl. all-32 jsQR round trip
```

The suite covers: role-map counts and per-level DATA/ECC split; 21 × 21 dimensions; 32
candidates for `g.co`; capacity filtering (10/12/18-byte payloads); forced masks 0–7 and
their distinctness; format information consistency (both copies agree, decode to the right
level+mask, and are BCH-valid under GF(2) division); the four penalty rules against the
documented per-mask totals for `g.co`; similarity/conflict/ceiling metrics on synthetic role
maps; normalisation (threshold exactness, centre-crop, synthetic targets); raster quiet zone
and scale; CSV escaping; and manifest shape.

---

## Known issues and limitations

- **Version 1 only, byte mode only, at most 17 UTF-8 bytes.** Payloads above a level's limit
  are skipped, not failed — the UI and summary list exactly which levels were skipped and
  why.
- **Rule 3 was dead code before A4.0.** The surrounding-light test compared a boolean with
  `=== 0`, so Rule 3 never fired and every recorded `penalty_rule_3` was 0. A4.0 fixed this
  and regenerated the penalty columns and standard-selected masks above; similarity and
  decode were unaffected. See [`../A4/BUG_AUDIT.md`](../A4/BUG_AUDIT.md) (A4-BUG-001).
- **The role map's DATA/ECC split** is derived from placement order; it is correct for
  Version 1 and has no remainder-bit handling (Version 1 has none).
- **The theoretical ceiling is a structural bound, not an achievable target.** It assumes
  every mutable module could match, which valid encoding generally cannot guarantee.
- **One target, one payload is not a finding about masks in general.** A4's target corpus
  generalizes across target classes.
- **Digital decoding ≠ camera decoding.** A1 says nothing about physical scanning; that is
  A4.2 (physical validation), whose data is still pending.
- **`jsQR` is loaded from a CDN**, matching the existing apps. If it fails to load, the run
  can still proceed but jsQR validation is recorded as unavailable.

---

## Experiment record

| Field | Value |
| :--- | :--- |
| `experiment_id` | A1 |
| `date` | 2026-10-02 |
| `research_question` | How much visual similarity do valid ECC levels and masks provide without modifying any module? |
| `hypothesis` | n/a (measurement, not a test of a stated hypothesis) |
| `inputs` | built-in synthetic target (code-defined); payload `g.co` |
| `payload` | `g.co` |
| `qr_version` | 1 |
| `ecc` | L, M, Q, H |
| `mask` | 0–7 |
| `target_image` | synthetic `circle`, 21 × 21 |
| `normalization_method` | centre-crop, Rec. 601 luma, box average, threshold 128 |
| `software_versions` | repository commit recorded in `manifest.json` |
| `browser` | recorded in `manifest.json` for UI runs; `n/a` for harness runs |
| `decoder` | jsQR 1.4.0; OpenCV QRCodeDetector 4.12.0 |
| `test_transformations` | n/a (A1 applies none) |
| `metrics` | full similarity, mutable similarity, fixed conflicts, theoretical ceiling, four penalty rules |
| `output_files` | `results/results.csv`, `results/manifest.json`, `results/opencv_results.csv`, `outputs/*.png` |
| `conclusions` | see Interpretation — limited to this target/payload |
| `limitations` | see Known issues and limitations |

---

## Directory

```text
experiments/route-a/A1/
├── README.md                  this file
├── package.json               test-only: declares ESM for Node; no dependencies
├── experiment-a1.html         the experiment UI (loads the js/ files as classic scripts)
├── js/                        plain classic scripts sharing a StegoA1 namespace, so the
│   │                          page works from file:// and the same files load in Node
│   ├── qr-role-map.js         Version 1 module role map
│   ├── qr-experiment.js       faithful encoder port + role map + penalty breakdown + rasteriser
│   ├── target-grid.js         deterministic 21×21 normalisation + synthetic targets
│   ├── metrics.js             similarity / conflict / ceiling metrics
│   ├── experiment-runner.js   candidate generation, metrics, jsQR validation
│   └── export-results.js      manifest.json, results.csv, browser downloads
├── validation/
│   └── validate_opencv.py     independent OpenCV decoder check
├── tests/
│   ├── run-tests.js           25 deterministic checks (+ optional jsQR round trip)
│   ├── run-default-experiment.js  headless default run
│   └── png.js                 dependency-free PNG writer for the harness
├── outputs/                   generated candidate PNGs (harness)
├── results/                   results.csv, manifest.json, opencv_results.csv
└── targets/                   normalised target images
```
