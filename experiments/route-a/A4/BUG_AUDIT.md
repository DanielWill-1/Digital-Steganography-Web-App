# A4.0 — Bug Audit

Findings from the A4.0 correctness audit of the foundations inherited from A1–A3. Each entry
states whether a bug was confirmed, its cause, the fix, whether historical results were
affected, and the regression test added.

---

## A4-BUG-001 — QR penalty Rule 3 was dead code (CONFIRMED, FIXED)

**Description.** `qrPenaltyBreakdown` (shared by A1/A2/A3/A4) tested the four surrounding
light modules with `bit === 0`. The matrix stores booleans, so `false === 0` is `false` and
the test never matched. Rule 3 therefore never fired: every recorded `penalty_rule_3` in
A1/A2/A3 was 0.

**Affected experiments.** A1, A2, A3 penalty metadata (`qr_penalty_3`, `qr_penalty_total`)
and the standard-selected mask derived from the total.

**Root cause.** Strict-equality type error: `false === 0`.

**Fix.** In `experiments/route-a/A1/js/qr-experiment.js`, the surrounding-light test now uses
falsiness (`!bit`). One shared implementation, so A1–A4 are all corrected.

**Historical results affected?**
- Decode outcomes: **NO.** Penalty is a structural metric and does not affect QR validity.
- Similarity metrics: **NO.**
- Penalty columns and standard-selected mask: **YES** — regenerated (see below).
- A3 optimization output: **NO for the default run.** A3 uses the QR penalty only as a
  deterministic tie-break in packing; for the default configuration the selected candidates
  and all decode/similarity/codeword outcomes were unchanged after the fix. A3's penalty
  columns were regenerated.

Corrected `g.co` per-mask penalty totals and standard-selected masks:

```text
        pre-fix (Rule 3 = 0)                     post-fix
L  [285,321,277,333,288,323,341,284] -> L→2   [445,361,437,333,368,403,381,484] -> L→3
M  [272,316,320,325,301,308,292,325] -> M→0   [312,396,360,485,341,348,292,565] -> M→6
Q  [287,392,301,344,288,329,268,317] -> Q→6   [287,592,341,424,568,449,348,397] -> Q→0
H  [293,337,306,362,360,315,330,330] -> H→0   [413,417,306,402,640,475,370,450] -> H→2
```

**Regeneration.** `python validation/...` / `node tests/run-*` were re-run for A1, A2, A3 so
the recorded penalty values and `standard_selected_mask` reflect the fix. A1/A2/A3 READMEs,
`docs/QR_V1_TECHNICAL_NOTES.md`, and the A1 regression-suite reference arrays were updated.
Historical decode/similarity values were **not** rewritten.

**Regression tests added.** `experiments/route-a/A4/tests/run-tests.js` — Rule 1, Rule 2,
Rule 3 (row, column, before-side, after-side, no-context), Rule 4; and the corrected A1
per-mask penalty regression in `A1/tests/run-tests.js`.

---

## Audits that found NO bug

| Audit | Result |
| :--- | :--- |
| Rule 1 (runs) | Correct (fixture: 21-run → 19; 6-run → 4; alternating → 0). |
| Rule 2 (2×2 blocks) | Correct (2×2 → 3; 3×3 → 12). |
| Rule 4 (dark balance) | Correct (0% → 100; 100% → 100; ≈50% → 0). |
| Role map | Complete: 441 modules, one role each, function 233 + mutable 208 per level, no undefined. |
| Format information | All 32 codewords distinct, BCH-valid (GF(2)), both copies agree, decode to the right ECC/mask. |
| Codeword mapping | `version1DataModuleOrder` covers all 208 mutable bits once; `codeword_index = floor(bit/8)`; DATA/ECC boundary correct per level; function modules never enter the map. |
| Quiet zone | Renderers produce `(21+8)×scale` with a fully white four-module border. |
| CSV / JSON | Escaping handles commas, quotes, newlines, and non-ASCII; UTF-8 byte counts verified. |
| SHA-256 | Matches published test vectors. |

## Perspective pipeline audit (jsQR vs OpenCV) — NOT a pipeline bug

A3 observed jsQR failing `PERSP_05/08/12` while OpenCV decoded them. A4 investigated the
pipeline: the transforms scale to a fixed-size white canvas (no cropping), use linear
interpolation, white border, correct channel order (OpenCV BGR → PNG), and the transformed
PNGs are shared byte-for-byte by both decoders (jsQR reads them via the Node PNG decoder).
OpenCV locates the symbol in every case; jsQR's detector does not. The conclusion is a
**jsQR detector limitation on stronger quadrilateral warps**, not an experiment bug. It is
reported as a decoder-specific observation and **not "fixed"** by weakening the transform.

## Cross-origin / file:// — OK

All A4 scripts are classic `<script src>` files sharing namespaces; no ES modules, so no
`file://` CORS problem. Verified `file://` (no module tags) and `localhost` (HTTP 200 for the
pages, JS modules, and the vendored jsQR).

## jsQR dependency — hardened

jsQR 1.4.0 is pinned under [`../../../../third_party/jsQR/`](../../../../third_party/jsQR/)
(`jsQR.min.js`, `LICENSE`, `VERSION` with the source and SHA-256). A4 pages load the vendored
copy first (works offline and from `file://`) with a documented fallback; the version and hash
are recorded.

## Known minor issues (NOT fixed)

- **Object-URL preview not revoked.** A1–A3 browser pages set `img.src` to a new
  `URL.createObjectURL(file)` without revoking the previous one when a target is replaced.
  This is a small, bounded leak that does not affect results. A4 pages revoke on replace.
  The frozen A1–A3 pages were deliberately left unchanged (see §"preserve A1–A3").
- **A3 blur preset ids** are `BLUR_50/100/150/200` (sigma ×100) rather than the `BLUR_05…`
  naming suggested in one prompt example. This is naming only; the sigma values are 0.5–2.0
  and are recorded in every robustness row.
- **A2/A3 physical-camera features** are intentionally absent — physical testing belongs to A4.

## No "fixing" of unfavourable results

No algorithm was changed because a target, browser, or decoder performed poorly. The only
implementation change was the confirmed Rule-3 bug.
