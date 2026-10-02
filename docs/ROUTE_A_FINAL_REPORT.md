# Route A — Final Report

**STATUS: PHYSICAL VALIDATION PENDING.** This report is factual as far as A1–A4 software and
the multi-target generalization go. It is **not** final until real physical (screen / print /
camera) trials are collected, imported, and analysed. Route A is therefore **NOT YET COMPLETE**.

---

## Research question

How closely can a standards-compatible Version 1 QR symbol resemble a target image while
ordinary QR scanners still decode it — and how much of any gain survives controlled image
degradation and (pending) physical recapture?

## A1 — Valid ECC/mask baseline (COMPLETE / FROZEN)

For `g.co` against a synthetic circle target, all 4 × 8 = 32 valid candidates were generated,
scored, and validated: jsQR 32/32 and OpenCV 32/32 exact. Ordinary ECC/mask choice alone
reaches ~49% full-matrix similarity, capturing only part of the ~68–72% structural ceiling.
Method and record: [`../experiments/route-a/A1/README.md`](../experiments/route-a/A1/README.md).

## A2 — Controlled random target-directed modification (COMPLETE / FROZEN)

Seeded random placement produced a clean damage curve: exact through budget 8, partial at
10–12, and 0/5 from budget 16; successes affected ≈3.4 codewords, failures ≈18.9. Record:
[`../experiments/route-a/A2/README.md`](../experiments/route-a/A2/README.md).

## A3 — Codeword-aware optimization + synthetic robustness (COMPLETE / FROZEN)

Packing the same target-directed changes into fewer codewords reached 58.50% similarity at
budget 40 with 7 codewords and decoded exactly under both decoders, where A2 (≈21 codewords)
failed. The synthetic suite showed the clean-decodable advantage is preserved; the residual
jsQR failures are a detector limitation on stronger perspective warps that OpenCV handles.
Record: [`../experiments/route-a/A3/README.md`](../experiments/route-a/A3/README.md).

## A4 — Generalization, hardening, physical tooling, final analysis (SOFTWARE COMPLETE; PHYSICAL PENDING)

**A4.0 correctness audit.** One real bug found and fixed: QR penalty Rule 3 was dead code
(boolean compared with `=== 0`), so all pre-A4 `penalty_rule_3` values were 0. Penalty values
and standard-selected masks were regenerated for A1–A3; decode and similarity were unaffected.
Role map, format info, codeword mapping, quiet zone, and CSV/JSON were audited and are correct.
The A3 perspective disagreement is a jsQR detector limitation, not a pipeline bug. See
[`../experiments/route-a/A4/BUG_AUDIT.md`](../experiments/route-a/A4/BUG_AUDIT.md).

**A4.1 generalization.** 8 synthetic targets × 3 payloads × 4 ECC = 96 configurations.

```text
A3_CLEAN_MAX both-decoders-exact:        96 / 96
A3_ROBUST (predefined criterion):        94 / 96
A2 vs A3 clean (matched budget):         A3 > A2: 94   A3 = A2: 2   A3 < A2: 0
A3 clean-max similarity gain over A1:    mean 5.95pp, median 5.44pp, min 0.91pp, max 9.07pp
median gain by ECC:                      L 3.63pp · M 5.44pp · Q 7.25pp · H 9.07pp
median gain by payload:                  equal (~5.44pp) for 1/4/7 bytes
```

The A3 advantage held for every target structure, payload length, and ECC level; no tested
structural descriptor strongly predicted the gain (all |correlations| < 0.15, N=96).

**A4.2 physical.** Screen tester, print sheets (25/40/60 mm, calibration ruler), physical
recorder (draft persistence, CSV/JSON import–export), and a Wilson-interval analysis are
implemented. **No physical data has been collected.**

**A4.3 analysis.** Operating points, aggregate comparison, simple correlations, and a dataset
manifest are generated; `tests/verify-dataset.js` cross-checks the CSVs.

Record: [`../experiments/route-a/A4/README.md`](../experiments/route-a/A4/README.md).

## Cross-environment findings

`file://` and `localhost` verified; Node 22.12.0, Python 3.11.0, OpenCV 4.12.0, jsQR 1.4.0
(pinned) verified. Browsers, mobile, downloads, and camera capture are **NOT TESTED**. See
[`../experiments/route-a/A4/CROSS_ENVIRONMENT_NOTES.md`](../experiments/route-a/A4/CROSS_ENVIRONMENT_NOTES.md).

## Main findings

1. The codeword-aware advantage is real, reproducible, and generalizes across the tested
   targets, payloads, and ECC levels.
2. ECC level materially changes how much target-directed modification is tolerable
   (H ≫ Q > M > L).
3. A confirmed penalty-implementation bug was found and corrected, with historical derived
   metrics regenerated and decode/similarity preserved.

## Negative / null findings

- Payload length (1/4/7 bytes) did not change the median similarity gain.
- No simple structural descriptor predicted which targets benefit most.
- jsQR and OpenCV disagree on stronger perspective transforms; the difference is decoder-side.

## Limitations

Version 1 only; binary target metric; synthetic (not real-logo) benchmark targets; codeword
count is a proxy; decoders differ; synthetic degradation is not camera robustness; **physical
results do not exist yet**.

## Route A conclusion

Under software and synthetic evaluation, codeword-aware placement substantially outperforms
random placement at matched visual similarity, and the advantage generalizes across the tested
configuration space. The physical-robustness question — the one that ultimately matters for
real scanners — is **open**, pending collected physical data.
