# A3 — Codeword-Aware Logo Optimization + Synthetic Robustness

**Route A · Experiment A3 · QR Version 1 · 21 × 21**

Status: **implemented; clean run validated by jsQR and OpenCV, synthetic robustness suite run.**
A3 is the algorithmic heart of Route A: it places the same useful corruption more
intelligently than A2 by concentrating it into fewer Reed–Solomon codewords.

---

## Research question

> Can we obtain the same or greater target-logo similarity as A2 while preserving
> significantly better decoding reliability by concentrating target-directed changes into
> fewer QR/Reed–Solomon codeword symbols?

Secondary question:

> Do symbols produced by this strategy remain more robust than A2's random baseline after
> controlled synthetic image degradation?

## A2 motivation

A2 (seeded random placement) found that successful trials affected a mean of ≈3.4 codewords
while failed trials affected ≈18.9, and that reliability collapsed around budget 10–16. That
suggested the *number of damaged codewords*, not the number of changed modules, is the
quantity that matters.

## Key insight and hypothesis

Under the binary target metric, one corrected mismatch is exactly one new match
(`1/441`), so at a fixed module budget `B` **every** strategy has the same visual gain:

```text
similarity_after = similarity_before + B / 441
```

So A3's innovation is **not** better similarity from the same modules; it is:

> achieve the same visual gain while damaging the fewest distinct encoded codewords.

**Hypothesis (not assumed):** at the same budget and similarity, concentrating modifications
into fewer codewords retains decoding reliability longer than random distribution.

---

## Codeword-aware strategy

Reuses A2's mapping of placed modules to `bit_index / codeword_index / bit_within_codeword /
DATA|ECC` — no second placement implementation.

### STRATEGY A — packed module-budget optimization (primary)

Given budget `B`, select exactly `B` eligible target mismatches while minimising distinct
affected codewords:

1. group eligible mismatches by codeword (`m_i` per codeword);
2. greedily consume the densest codewords first (this is optimal: the minimum codeword count
   is the smallest `k` with `sum of k largest m_i >= B`);
3. for the partial final codeword, brute-force the small subset (`choose r from n <= 8`) that
   minimises the resulting QR penalty.

### STRATEGY B — codeword-budget optimization

For a codeword budget `K`, select the `K` codewords with the most eligible mismatches and
apply all their useful mismatches; sweep `K = 0 … max`. This measures visual gain per damaged
symbol directly.

### Tie-breaking (deterministic)

Larger mismatch count → lower resulting QR penalty → lower codeword index. **No randomness.**
The optimizer is fully deterministic and reproducible.

### No decoder feedback

Candidate generation never calls jsQR or OpenCV. Decoders are used only to validate finished
candidates — never to choose positions.

### QR penalty is a secondary signal

The QR penalty is used only as a deterministic structural tie-break and recorded as a metric.
It is **not** a scan-success probability.

---

## A2 baseline comparison

A2's seeded strategy is reused (not copied): seeds 42–46, identical base/target/payload. At a
matched budget A2 and A3 modify the same number of mismatches, so their **similarity is
identical**; only the positions (and therefore the codeword damage) differ. This is the
central controlled comparison.

---

## Synthetic robustness suite

Five required transform families, applied in isolation (§32–§38), via one Python/OpenCV
pipeline (`validation/synthetic_robustness.py`). Transformed pixels are shared:

```text
resize   : module pitch 8, 6, 4, 3, 2 (area downscale, no upscale), + pristine (12)
blur     : Gaussian sigma 0.5, 1.0, 1.5, 2.0
jpeg     : quality 95, 85, 70, 50, 30 (real encode/decode)
rotation : -10, -5, -2, +2, +5, +10 degrees (expanded white canvas, no clipping)
perspective : quad warp magnitude 0.02, 0.05, 0.08, 0.12
pristine : always included
```

The evaluation set is the A1 base, A2 budgets 8/10/12 (all seeds), and A3 budgets 8/10/12
plus every A3 budget that decoded exactly. Per-case both decoders are recorded.

---

## Metrics

`clean_results.csv` per candidate: strategy, base ECC/mask, module budget,
`actual_modified_modules`, similarity before/after/gain, mutable similarity,
`affected_codeword_count`, `affected_codeword_indices`, `packing_efficiency`,
`max_flips_in_single_codeword`, `mean_flips_per_affected_codeword`, affected DATA/ECC
codewords, the four penalty rules and total, jsQR/OpenCV status.

The penalty fields were regenerated after the A4.0 Rule-3 fix (see
[`../A4/BUG_AUDIT.md`](../A4/BUG_AUDIT.md)). That fix did not change A3's selected candidates
or its decode/similarity/codeword outcomes for the default run, so the result tables below are
unchanged.

`strategy_comparison.csv` per matched budget: A2 codeword mean/min/max, A3 codewords,
`affected_codeword_reduction_vs_a2_mean`, A2/A3 exact.
`robustness_summary.csv` per candidate: jsQR/OpenCV/both exact rates and per-family rates.
Rates always carry their denominators.

---

## Exports

```text
results/manifest.json
results/clean_results.csv
results/strategy_comparison.csv
results/codeword_budget_results.csv
results/robustness_results.csv
results/robustness_summary.csv
results/synthetic_test_manifest.json
results/results_with_opencv.csv        (clean candidates merged with OpenCV)
```

The 925 transformed robustness PNGs under `outputs/robustness/` are regenerated
deterministically by `validation/synthetic_robustness.py` and are git-ignored; the
machine-readable `results/robustness_*.csv` are committed.

---

## Default controlled run

Identical setup to A2: payload `g.co`, synthetic `circle` target, auto base.

```text
base                  : A1-H-M6 (ECC H / mask 6), baseline similarity 49.43%
eligible mismatches   : 93
budgets               : 25   (0…16 dense, then 20, 24, 32, 40, 48, 64, 80, 93)
seeds (A2)            : 42, 43, 44, 45, 46
clean candidates      : 150  (A2 125, A3 25)
codeword-budget cands : 27   (K = 0…26)
jsQR exact            : 76 / 150
OpenCV exact          : 76 / 150
```

A2 vs A3 by budget (from `strategy_comparison.csv`):

| budget | similarity | A2 codewords (mean) | A3 codewords | A2 jsQR exact | A3 jsQR |
| ---: | ---: | ---: | ---: | ---: | :---: |
| 0 | 49.43% | 0.0 | 0 | 5/5 | EXACT |
| 4 | 50.34% | 3.6 | 1 | 5/5 | EXACT |
| 8 | 51.25% | 7.0 | 2 | 5/5 | EXACT |
| 10 | 51.70% | 8.0 | 2 | 2/5 | EXACT |
| 12 | 52.15% | 9.4 | 2 | 1/5 | EXACT |
| 16 | 53.06% | 12.6 | 3 | 0/5 | EXACT |
| 24 | 54.88% | 16.4 | 4 | 0/5 | EXACT |
| 32 | 56.69% | 19.4 | 6 | 0/5 | EXACT |
| 40 | 58.50% | 21.4 | 7 | 0/5 | EXACT |
| 48 | 60.32% | 22.8 | 9 | 0/5 | fail |

**Best observed clean A3 result (both decoders exact):** budget **40**, similarity
**58.50%**, **7** affected codewords (`A3clean_H_mask6_packed_b40`). A2 reaches that
similarity only at budget ≈ 40 with ~21.4 codewords, where it fails 0/5.

**Codeword-budget sweep:** `K = 8` → 44 modified modules, 59.41% similarity, both decoders
exact; `K = 9` (48 modules) fails. So the empirical clean boundary for this configuration is
about **8 damaged codewords**.

## Synthetic robustness results

```text
cases: 37 candidates × 25 presets = 925
OpenCV exact 750/925   jsQR exact 660/925   both exact 660/925
```

| candidate | budget | sim | codewords | jsQR | OpenCV | both |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| A1 base | 0 | 49.43% | 0 | 22/25 | 25/25 | 22/25 |
| A2 random (per seed) | 8 | 51.25% | 5–8 | 22/25 | 25/25 | 22/25 |
| A2 random | 10 | 51.70% | 5–10 | 0–22/25 | 0–25/25 | 0–22/25 |
| A2 random | 12 | 52.15% | 7–11 | 0–22/25 | 0–25/25 | 0–22/25 |
| A3 packed | 8–40 | 51.25–58.50% | 2–7 | 22/25 | 25/25 | 22/25 |

The three cases jsQR cannot decode **even on the pristine A1 base** are the harsher
perspective warps (`PERSP_05`, `PERSP_08`, `PERSP_12`) — OpenCV decodes all three. That caps
the jsQR robustness ceiling at 22/25 = 88% for every clean-decodable candidate.

---

## Observations

- For this target/payload/base: A3 achieves the **same similarity as A2 at every budget** while
  affecting roughly **a quarter to a fifth** of the codewords (e.g. budget 12: 9.4 → 2; budget
  24: 16.4 → 4; budget 40: 21.4 → 7). The hypothesis that codeword packing preserves
  reliability longer is **supported under clean decoding**: A2 fails from ~13, A3 decodes
  exactly to budget 40.
- Under the synthetic suite, once a candidate is clean-decodable its robustness is at the A1
  baseline level (22/25 jsQR, 25/25 OpenCV), dominated by jsQR's inability to decode the
  harsher perspective warps. A2 candidates that fail clean at budgets 10–12 are 0/25.
- Negative results are reported as found; no claim is made that codeword count perfectly
  predicts scanning, or that these results generalise beyond this configuration.

---

## Known limitations

- Version 1 only; binary target metric; one main controlled target; one main payload.
- Codeword count is a structural proxy, not a full decoder model.
- Decoder implementations differ (jsQR struggles with the harsher perspective warps that
  OpenCV handles).
- Synthetic degradations are not physical cameras — A3 makes no physical-robustness claim.
- A3 has not established generality across logos, payloads, or ECC levels (A4).
- Five A2 seeds support descriptive comparison only, not statistical significance.

---

## How to reproduce

```bash
cd experiments/route-a/A3
node tests/run-tests.js                         # optimizer invariants
set A1_JSQR_PATH=... && node tests/run-default-experiment.js   # clean A2 vs A3 (+ jsQR)
python validation/validate_opencv.py            # clean OpenCV + boundary
python validation/synthetic_robustness.py       # transforms + OpenCV
set A1_JSQR_PATH=... && node tests/run-robustness-jsqr.js      # jsQR pass + summary
python validation/synthetic_robustness.py --self-test          # transform self-tests
```

The browser page `experiment-a3.html` opens directly (`file://`) and runs the clean
optimization in-page with jsQR.

---

## Directory

```text
experiments/route-a/A3/
├── README.md
├── package.json
├── experiment-a3.html
├── js/ codeword-optimizer · metrics-a3 · strategy-comparison · robustness-summary · experiment-runner · export-results
├── validation/ synthetic_robustness.py · validate_opencv.py
├── tests/ run-tests.js · run-default-experiment.js · run-robustness-jsqr.js · png-read.js
├── targets/ · outputs/ · results/
```

A3 reuses A1 (QR generation, role map, placement, codeword generation, normalisation,
metrics, rasterisation, CSV utilities, jsQR integration) and A2 (eligible mismatch
extraction, codeword mapping, the seeded random baseline, decode statuses, budget utilities).
It adds only the codeword-aware optimizer, the strategy comparison, and the robustness
evaluation/aggregation.
