# A4 — Multi-Target Generalization + Cross-Environment Hardening + Physical Validation + Final Analysis

**Route A · Experiment A4 · the final planned Route A experiment**

Status: **SOFTWARE IMPLEMENTED and generalization complete. Physical validation PENDING real
data collection.** A4 is an evaluation and hardening experiment — it does not add a new
optimizer.

---

## Purpose

A1–A3 established the codeword-aware advantage under one controlled configuration. A4 asks:

> **Does the A3 advantage generalize across target structures, payload lengths, ECC levels,
> decoder environments, and — pending real data — screens, printers, and cameras?**

A4 has four subphases:

```text
A4.0  correctness + cross-environment audit
A4.1  multi-target / multi-payload / multi-ECC generalization
A4.2  physical screen / print / camera validation (tooling + protocol; data pending)
A4.3  final Route A comparative analysis
```

## A4.0 — correctness audit

Full detail in [`BUG_AUDIT.md`](BUG_AUDIT.md). One confirmed bug:

- **A4-BUG-001 — QR penalty Rule 3 was dead code** (`bit === 0` on booleans never matched), so
  every A1–A3 `penalty_rule_3` was 0. Fixed in the shared implementation; the derived penalty
  values and standard-selected masks were regenerated for A1/A2/A3 (decode and similarity were
  unaffected; A3's default selected candidates were unchanged). Regression fixtures added.

Role map, format information, codeword mapping, quiet zone, and CSV/JSON were audited and are
correct. The A3 jsQR-vs-OpenCV perspective disagreement was investigated and shown to be a
**jsQR detector limitation on stronger quad warps**, not a pipeline bug. jsQR is pinned under
`third_party/jsQR/` (offline / `file://`). See [`CROSS_ENVIRONMENT_NOTES.md`](CROSS_ENVIRONMENT_NOTES.md).

## A4.1 — generalization

**Target corpus** (8 deterministic project-owned 21×21 synthetic targets; [`js/target-corpus.js`](js/target-corpus.js)):

| id | name | category |
| :--- | :--- | :--- |
| T01 | circle | simple |
| T02 | g-like | letter-like |
| T03 | diagonal | letter-like |
| T04 | triangle | geometric |
| T05 | cross | geometric |
| T06 | sparse | sparse |
| T07 | dense | dense |
| T08 | asymmetric | asymmetrical |

Fixtures are written to `targets/` with source SHA-256 and matrix hash in
`targets/target_corpus.json`; the canonical 21×21 matrix is the benchmark input.

**Payloads**: `a` (1 byte), `g.co` (4 bytes), `abcdefg` (7 bytes) — all fit every Version 1
ECC level. **ECC**: L / M / Q / H. **Configurations**: 8 × 3 × 4 = **96**.

### Operating points (per configuration)

```text
A1_BASE       the highest-A1-similarity mask at that ECC
A3_CLEAN_MAX  highest tested A3 candidate decoding EXACTLY under BOTH jsQR and OpenCV
A3_ROBUST     highest tested A3 candidate with synthetic both-exact rate
              >= 0.95 x the A1 baseline both-exact rate   (predefined, not tuned)
A2_MATCHED    A2 random seeds 42-46 at the A3_CLEAN_MAX module budget
```

### Results (96 configurations)

```text
A3_CLEAN_MAX (both decoders exact):   96 / 96
A3_ROBUST (predefined criterion):     94 / 96
A2 vs A3 (clean exact, matched budget): A3 > A2: 94   A3 = A2: 2   A3 < A2: 0

A3 clean-max similarity gain over A1:
  mean 5.95pp · median 5.44pp · min 0.91pp · max 9.07pp

median gain by ECC:   L 3.63pp   M 5.44pp   Q 7.25pp   H 9.07pp
median gain by payload:  a / g.co / abcdefg all 5.44pp
median gain by target category: simple 6.34pp, sparse 6.35pp, geometric 5.45pp,
                                letter-like 5.45pp, dense 5.44pp, asymmetrical 5.44pp

descriptor correlations with gain (N=96): |Pearson| and |Spearman| < 0.15 for all of
eligible mismatches, fixed conflicts, theoretical ceiling, top-4 mismatch fraction.
```

The A3 advantage holds across every target structure, payload length, and ECC level. ECC
tolerance grows with the error-correction budget (H > Q > M > L), as expected. Payload length
did not move the median gain. No simple structural descriptor strongly predicts the gain.

**Synthetic robustness** (core subset, 480 candidates × 10 presets = 4800 cases):
jsQR exact 3088/4800, OpenCV exact 3831/4800; the difference is the jsQR perspective cases.

## A4.2 — physical validation (tooling complete, data PENDING)

- [`physical/protocol.md`](physical/protocol.md) — the full protocol.
- [`physical/screen-test.html`](physical/screen-test.html) — single-candidate screen display
  with exact pixel/module dimensions and fullscreen.
- [`physical/print-sheet.html`](physical/print-sheet.html) — printable sheets at 25/40/60 mm
  (QR area), labels outside the quiet zone, a 100 mm calibration ruler.
- [`physical/physical-test-recorder.html`](physical/physical-test-recorder.html) — logs trials,
  persists a draft in `localStorage`, exports `physical_trials.csv` / `physical_session.json`,
  imports sessions, and offers optional live-camera scanning.
- [`validation/physical_analysis.py`](validation/physical_analysis.py) — per-condition rates
  with Wilson 95% intervals.

**No physical results are fabricated.** Until real trials are imported, `physical_summary`
reports `PHYSICAL VALIDATION PENDING` and A4 is not marked complete.

## A4.3 — final analysis

`validation/analyze_results.py` produces `results/operating_points.csv`,
`results/generalization_summary.json`, and `results/dataset_manifest.json`.
`tests/verify-dataset.js` cross-validates the CSVs.

## Result files

```text
results/a4_manifest.json
results/generalization_configs.csv
results/generalization_candidates_with_opencv.csv
results/generalization_bases_with_opencv.csv
results/a2_matched_with_opencv.csv
results/robustness_results.csv            (jsQR + OpenCV, per candidate × transform)
results/robustness_summary.csv
results/synthetic_test_manifest.json
results/operating_points.csv
results/generalization_summary.json
results/dataset_manifest.json
results/physical_summary.json             (PHYSICAL VALIDATION PENDING until data exists)
targets/target_corpus.json + T0x_*.png
```

Candidate PNGs live in `outputs/gen/`; transformed robustness PNGs in `outputs/robustness/`
(git-ignored, regenerable).

## Reproduction

```bash
cd experiments/route-a/A4
node tests/run-tests.js                       # 31 audit / corpus / operating-point / recorder checks
set A1_JSQR_PATH=... && node tests/run-generalization.js   # 96 configs + A3 candidates (jsQR)
python validation/validate_opencv.py          # merge OpenCV into the clean candidates
python validation/analyze_results.py          # (interim) operating points
set A1_JSQR_PATH=... && node tests/run-a2-matched.js        # A2 at A3_CLEAN_MAX budget
python validation/validate_opencv.py          # merge OpenCV into A2 matched
python validation/synthetic_robustness.py     # core synthetic suite (transforms + OpenCV)
set A1_JSQR_PATH=... && node tests/run-robustness-jsqr.js   # jsQR robustness pass + summary
python validation/analyze_results.py          # final operating points / summary / dataset manifest
node tests/verify-dataset.js                  # CSV integrity
python validation/physical_analysis.py        # physical status (PENDING until data)
```

Open `experiment-a4.html` directly (`file://` works) for the interactive subset benchmark,
inspector, cross-environment table, and physical/final-analysis loaders.

## Completion criteria

Software implementation is complete when A1–A4 tests pass, the generalization benchmark and
dataset integrity checks pass, and the physical tooling exists. **Route A is not scientifically
complete** until real physical trials are collected, imported, and analysed:

```text
A4 — IMPLEMENTED
Generalization complete
Cross-environment audit complete
Physical validation pending
ROUTE A — NOT YET COMPLETE
```

## Known limitations

- Version 1 only; binary target metric; synthetic benchmark targets (not real logos).
- Codeword count is a structural proxy, not a full decoder model.
- Decoder implementations differ (jsQR struggles with stronger perspective; OpenCV handles it).
- Synthetic degradation is not physical-camera robustness.
- Generalization covers 8 synthetic targets and 3 payloads; not all logos or scanners.
- Physical results do not exist yet; no physical claim is made.
