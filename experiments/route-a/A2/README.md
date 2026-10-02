# A2 — Controlled Target-Directed QR Modification

**Route A · Experiment A2 · QR Version 1 · 21 × 21**

Status: **implemented; default run validated by two independent decoders.**
This is the first Route A experiment allowed to modify QR modules. It is deliberately **not**
an optimiser — it establishes the empirical modification/damage curve that A3 will build on.

---

## Research question

> How much can selected non-function modules of a valid Version 1 QR symbol be changed
> toward a target logo before reliable decoding begins to fail?

Where A1 asked *how logo-like an untouched QR can be through valid ECC/mask choices alone*,
A2 asks *what happens when we deliberately move QR modules toward the target*.

---

## Difference from A1

| | A1 | A2 |
| :--- | :--- | :--- |
| Modules modified | none | mutable mismatches only |
| Position selection | — | seeded, deliberately non-intelligent |
| Purpose | baseline similarity | modification/damage curve |
| Base | all 32 candidates | one A1 candidate (auto or manual) |
| Output | similarity + penalty per candidate | per-trial similarity, codeword damage, decode |

A1 is the frozen control. A2 never changes A1's algorithm or recorded outputs, and A2's
**budget-0 trial is bit-for-bit identical to the A1 base** (a regression check).

---

## Safety rule

Function/structural modules are **never** modified:

```text
FINDER  SEPARATOR  TIMING  FORMAT  DARK_MODULE   (immutable)
DATA    ECC        REMAINDER                      (modifiable)
```

Eligibility requires both a mutable role **and** `Q[r][c] != T[r][c]`. Setting such a module
to the target value therefore always improves full-target agreement by exactly one position,
so `similarity_gain = actual_modified_modules / 441`. This is tested directly.

---

## Modification strategy

For a chosen base QR `Q` and target `T`:

1. collect `eligiblePositions` — mutable modules where `Q != T`, each recording
   `row, column, original_value, target_value, role`, plus `bit_index`, `codeword_index`,
   `bit_within_codeword`, `codeword_type` where available;
2. shuffle that list with a seeded PRNG (`mulberry32`, no `Math.random`);
3. for budget `N`, modify the **first N** positions toward the target.

Budgets are nested: each larger budget extends the same ordered damage path rather than
drawing a fresh random set. The order is deterministic for a seed and differs between seeds.

This is **seeded/controlled modification, not optimisation**. Position selection does not use
codeword structure — it only *records* it. Intelligent placement is A3.

---

## Seeds

```text
42, 43, 44, 45, 46   (5 trials per budget)
```

## Budgets

Denser near zero, because low-damage behaviour matters most:

```text
0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128
```

Budgets above the eligible count are dropped, and the full eligible set is always added.

## Mutable vs immutable modules

Immutable (233 modules): `FINDER, SEPARATOR, TIMING, FORMAT, DARK_MODULE`.
Mutable (208 modules): `DATA, ECC, REMAINDER`. Because `fixed_conflicts` and
`theoretical_ceiling` depend only on immutable modules, they are unchanged by A2 — a useful
invariant, tested directly.

---

## Metrics

Per trial: `requested_budget`, `actual_modified_modules`, `eligible_mismatches_total`,
`modified_fraction_of_eligible`; `similarity_before/after/gain`;
`mutable_similarity_before/after/gain`; `fixed_conflicts`; `theoretical_ceiling`;
the four `modified_penalty_*` rules and total; `jsqr_detected/payload/payload_correct`;
`decode_status`; and codeword metrics (below).

`decode_status` is one of `EXACT`, `WRONG_PAYLOAD`, `NO_DETECTION`, `DECODER_ERROR` — these
are never merged. Detection is not decoding: `EXACT` requires the payload to match exactly.

## Codeword tracking

Implemented. Every data/ECC module's position in the QR data-placement order gives its bit
index; eight consecutive bits form one codeword, so
`codeword_index = floor(bit_index / 8)` and the DATA/ECC split follows the level. For each
trial we record `affected_codeword_count`, `affected_codeword_indices`,
`affected_data_codeword_count`, `affected_ecc_codeword_count`, and
`max_flips_in_single_codeword`.

A changed *module* is not a Reed–Solomon error *symbol*: several changed modules can land in
one codeword. A2 keeps the two concepts separate and records the difference for A3.

---

## Browser validation

`experiment-a2.html` (light theme, classic scripts, opens from `file://`) runs the same
runner in-page and validates every candidate with `jsQR` 1.4.0. It shows the base, seeds,
filtered budgets, a summary, the per-budget decode table, canvas charts, and a trial
inspector (A1 base / A2 modified / target / difference map, with PNG download).

## OpenCV validation

```bash
python validation/validate_opencv.py
```

Manifest-driven: it reads `results/manifest.json` for the payload and the exact candidate
list, decodes each PNG with `cv2.QRCodeDetector`, writes `results/opencv_results.csv`, and
merges jsQR + OpenCV into `results/results_with_opencv.csv`. Requires OpenCV installed; it
never installs anything.

## Exports

`results/manifest.json` (configuration + every trial), `results/results.csv` (one row per
trial), `results/budget_summary.csv` (per-budget aggregate), plus the OpenCV outputs above.

---

## Default controlled run

Run `A2-20261002-1` · payload `g.co` · target synthetic `circle` · base = highest A1
similarity.

```text
base                  : A1-H-M6  (ECC H / mask 6), A1 full similarity 49.43%
eligible mismatches   : 93
seeds                 : 42, 43, 44, 45, 46
budgets               : 17  (0 … 80, plus the full 93)
total candidates      : 85
jsQR exact            : 33 / 85
OpenCV exact          : 33 / 85
```

Budget summary (from `results/budget_summary.csv`):

| budget | modified | similarity | jsQR exact | wrong | no-detect | affected codewords (mean) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 49.43% | 5/5 | 0 | 0 | 0.0 |
| 1 | 1 | 49.66% | 5/5 | 0 | 0 | 1.0 |
| 2 | 2 | 49.89% | 5/5 | 0 | 0 | 1.8 |
| 4 | 4 | 50.34% | 5/5 | 0 | 0 | 3.6 |
| 6 | 6 | 50.79% | 5/5 | 0 | 0 | 5.2 |
| 8 | 8 | 51.25% | 5/5 | 0 | 0 | 7.0 |
| 10 | 10 | 51.70% | 2/5 | 0 | 3 | 8.0 |
| 12 | 12 | 52.15% | 1/5 | 0 | 4 | 9.4 |
| 16 | 16 | 53.06% | 0/5 | 0 | 5 | 12.6 |
| 20 | 20 | 53.97% | 0/5 | 0 | 5 | 14.6 |
| 24 | 24 | 54.88% | 0/5 | 0 | 5 | 16.4 |
| 32 | 32 | 56.69% | 0/5 | 0 | 5 | 19.4 |
| 40 | 40 | 58.50% | 0/5 | 0 | 5 | 21.4 |
| 48 | 48 | 60.32% | 0/5 | 0 | 5 | 22.8 |
| 64 | 64 | 63.95% | 0/5 | 0 | 5 | 24.8 |
| 80 | 80 | 67.57% | 0/5 | 0 | 5 | 25.4 |
| 93 | 93 | 70.52% | 0/5 | 0 | 5 | 26.0 |

OpenCV gives the identical per-budget curve.

### Observations

- Similarity is **deterministic per budget** (each trial fixes exactly N mismatches), so the
  seeds only change *which* codewords are damaged, not the visual score. The readability
  difference between seeds therefore comes entirely from codeword damage.
- Decoding is perfect through budget 8, partially fails at 10–12, and is **0/5 from budget
  16 onward**.
- **First observed failure:** budget 10. **Largest successful tested budget:** 12.
  **Observed sustained-failure budget:** 16.
- Every failure in this run is `NO_DETECTION`; there were **no `WRONG_PAYLOAD`** results —
  a wrong payload would be the more informative failure mode if it occurred.
- With ECC H (17 ECC codewords), reliable decoding survived roughly 7–9 affected codewords;
  sustained failure began around 12–13.

### Codeword observation

```text
exact trials (jsQR):  mean 3.4 affected codewords, mean 4.2 modified modules
failed trials:        mean 18.9 affected codewords, mean 41.6 modified modules
```

Consistent with the expected mechanism — more damaged codewords means more damage than the
error correction can repair — but this is one target/payload/base and must not be
overinterpreted. It is the motivation for A3.

---

## Known limitations

- Version 1 only; byte mode; ≤17 UTF-8 bytes.
- One target and one payload do not establish general behaviour.
- Seeded modification is **not** optimised; the ordering is arbitrary and reproducible.
- Browser/jsQR decoding is not camera robustness, and OpenCV digital decoding is not physical
  scanning.
- Error correction operates on codewords, not visual modules; module count and codeword count
  are distinct.
- QR decoder behaviour varies by implementation (here jsQR and OpenCV happen to agree).
- The budgets are empirical observations, not theoretical guarantees; a failure at one budget
  does not imply failure at every larger budget in general.
- With multiple bases (optional all-ECC mode) the budget set is the union of the per-base
  budget sets, so low-eligibility bases contribute fewer budgets.

---

## How to reproduce

```bash
cd experiments/route-a/A2
node tests/run-default-experiment.js          # jsQR omitted unless A1_JSQR_PATH is set
set A1_JSQR_PATH=C:\path\to\jsQR.js && node tests/run-default-experiment.js   # Windows
A1_JSQR_PATH=/path/to/jsQR.js node tests/run-default-experiment.js            # POSIX
python validation/validate_opencv.py
node tests/run-tests.js                        # 23 checks (+ optional jsQR round trip)
```

The browser page can be opened directly:

```text
experiments/route-a/A2/experiment-a2.html
```

---

## Interpretation rules

- Report observations, not thresholds. "Sustained failure at budget 16" describes this
  target/payload/base; it is not "the QR limit".
- Never call the seeded selection an optimiser.
- Keep `EXACT`, `WRONG_PAYLOAD`, `NO_DETECTION`, and `DECODER_ERROR` separate.
- Never merge jsQR and OpenCV results, or digital and physical results.
- A2 measures the damage curve. A3 changes *where* modifications go; A2 does not.

---

## Experiment record

| Field | Value |
| :--- | :--- |
| `experiment_id` | A2 |
| `date` | 2026-10-02 |
| `research_question` | How much can non-function modules be changed toward a target before decoding fails? |
| `payload` | `g.co` |
| `qr_version` | 1 |
| `ecc` / `mask` | base A1-H-M6 (auto-selected); manual and all-ECC modes available |
| `target_image` | synthetic `circle`, 21 × 21 |
| `normalization_method` | identical to A1 (centre-crop, Rec. 601 luma, box average, threshold 128) |
| `software_versions` | repository commit recorded in `manifest.json` |
| `decoder` | jsQR 1.4.0; OpenCV QRCodeDetector 4.12.0 |
| `metrics` | similarity before/after/gain, mutable similarity, fixed conflicts, ceiling, penalties, codeword damage, decode status |
| `output_files` | `results/results.csv`, `results/manifest.json`, `results/budget_summary.csv`, `results/opencv_results.csv`, `results/results_with_opencv.csv`, `outputs/*.png` |
| `limitations` | see Known limitations |

---

## Directory

```text
experiments/route-a/A2/
├── README.md                    this file
├── package.json                 test-only ESM config; no dependencies
├── experiment-a2.html           browser UI (loads A1 + A2 classic scripts)
├── js/
│   ├── modification-strategy.js eligibility, codeword map, seeded PRNG/shuffle, budgets, apply
│   ├── metrics-a2.js            codeword impact, decode-status classification
│   ├── robustness-summary.js    per-budget aggregation, failure observations
│   ├── experiment-runner.js     base selection + trial generation
│   └── export-results.js        manifest, results.csv, budget_summary.csv
├── validation/validate_opencv.py  independent decoder + merge
├── tests/
│   ├── run-tests.js             23 deterministic checks (+ optional jsQR round trip)
│   └── run-default-experiment.js  headless default run
├── outputs/                     candidate PNGs
├── results/                     CSVs + manifest
└── targets/                     normalised target
```

A2 reuses A1's QR generation, role map, metrics, rasteriser, target normalisation, and
download helpers; it does not re-implement them.
