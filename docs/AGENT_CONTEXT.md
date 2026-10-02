# Agent Context

**Canonical, concise context for any agent or developer entering this repository.** Read this
first; it is the shortest path to understanding what exists, what must not be broken, and what
comes next.

For a plain-language overview see [`START_HERE.md`](START_HERE.md); for the one-page status see
[`PROJECT_STATUS.md`](PROJECT_STATUS.md); for the full programme see
[`RESEARCH_ROADMAP.md`](RESEARCH_ROADMAP.md).

---

## Project purpose

**StegoCode is a browser-based research studio for visually integrated machine-readable codes
and image steganography.** It investigates the trade-offs among visual appearance, machine
readability, error correction, data capacity, digital robustness, camera robustness, and
hiddenness.

It is **not** a cryptography project. Encoding (QR, steganography) and cryptography are
separate concerns; cryptography may later be layered onto payloads but is not part of any
route's research question.

The project runs entirely client-side (no server, no accounts, no build step).

## The three routes

```text
Route A — Standards-Compatible Artistic QR
  A valid QR symbol moved toward a target logo; ordinary QR scanners must still read it.
  StegoCode-specific scanning NOT required.   (most advanced: A1–A4)

Route B — Custom Logo Code
  A custom machine-readable symbol built to resemble a logo; QR compatibility abandoned,
  a dedicated StegoCode scanner is allowed.   (PLANNED: B1–B3, not started)

Route C — Image Steganography
  Data hidden in an ordinary image's pixels; no visible code.
  (baseline exists: protected LSB codec in stego_app.html; robust research PLANNED: C1–C3)
```

Routes serve different goals and are not ranked. See [`TERMINOLOGY.md`](TERMINOLOGY.md) for
definitions and [`RESEARCH_ROADMAP.md`](RESEARCH_ROADMAP.md) for the full programme.

---

## Current state

```text
ROUTE A
  A1  COMPLETE / FROZEN   Valid ECC/mask visual-similarity baseline
  A2  COMPLETE / FROZEN   Controlled random target-directed modification
  A3  COMPLETE / FROZEN   Codeword-aware target-directed optimization + synthetic robustness
  A4  IMPLEMENTED         correctness audit ✅ · generalization ✅ · cross-environment audit ✅
                          physical tooling ✅ · physical data PENDING
ROUTE A — NOT YET SCIENTIFICALLY COMPLETE (physical validation pending)

ROUTE B — PLANNED (B1 Custom-code foundation → B2 Logo-aware encoding → B3 Robustness + A comparison)
ROUTE C — EXISTING BASELINE (LSB codec) + PLANNED research (C2 robust embedding → C3 evaluation)

FINAL INTEGRATION — StegoCode Studio (Artistic QR + Logo Code + Image Steganography), PLANNED
```

**Current task:** Route A / A4 physical validation (collect real screen/print/camera trials with
the A4 tooling; import and analyse them). **Not** Route B coding yet.

**Next implementation after Route A:** Route B / **B1 — Custom Code Foundation**.

Do **not** create an A5 experiment. Do **not** start Route B or C implementation during a
documentation or validation task.

## Important existing results (summarize, do not re-derive)

```text
A1:  32 valid candidates for g.co; jsQR 32/32, OpenCV 32/32 exact; ~49% similarity vs a
     ~68–72% structural ceiling.
A2:  seeded random modification — exact to budget 8, partial at 10–12, 0/5 from budget 16;
     successful trials ≈3.4 codewords, failed ≈18.9.
A3:  codeword-aware packing — both-decoder-exact to budget 40 at 58.50% similarity with 7
     codewords (A2 needed ≈21 codewords at that similarity and failed).
A4:  96 configurations (8 synthetic targets × 3 payloads × 4 ECC).
     A3_CLEAN_MAX both-exact: 96/96.  A3_ROBUST: 94/96.
     A2 vs A3 matched budget: A3 > A2 94, tie 2, A3 < A2 0.
     A3 clean-max similarity gain: mean ≈5.95pp, median ≈5.44pp, min ≈0.91pp, max ≈9.07pp.
     Median gain by ECC: H ≈9.07pp > Q ≈7.25pp > M ≈5.44pp > L ≈3.63pp.
     Synthetic robustness: 480 candidates × 10 presets = 4800 cases.
```

Keep claims scoped to these tested configurations. Do not claim physical robustness (no
physical data exists) and do not claim universality for A3.

Recorded evidence lives under [`../experiments/route-a/`](../experiments/route-a/): `A1/`–`A4/`
READMEs, plus [`../docs/ROUTE_A_FINAL_REPORT.md`](ROUTE_A_FINAL_REPORT.md) (STATUS: physical
validation pending).

## Files not to casually rewrite

- **`stego_app.html`** — protected LSB codec (Route C baseline). Framing, CRC polynomials, and
  the (6,4) code are documented and verified.
- **`qr_app copy.html`** — in-repo Version 1 QR encoder, the Route A baseline. Do not rename it
  (the space in the filename is deliberate) and do not move the HTML files out of the root.
- **`qr_app.html`** — the `qrcodejs` page; historical but working, not dead code.
- **A1/A2/A3 experiment code and recorded results** — frozen. Do not retrofit later logic into
  them or rewrite their recorded outputs. (The one deliberate, documented exception is the
  A4.0 penalty correction; see below.)

## Known fixed bug

**A4-BUG-001 — QR penalty Rule 3 was dead code (FIXED).** The surrounding-light test used
`bit === 0` on booleans, which never matched, so Rule 3 never fired. Fixed in the shared
implementation; the derived penalty values and standard-selected masks were regenerated for
A1–A3 (e.g. `g.co` standard masks became L→3, M→6, Q→0, H→2). **Decode and similarity results
were not affected, and A3's default selected candidate was unchanged.** Regression fixtures
were added. Full detail:
[`../experiments/route-a/A4/BUG_AUDIT.md`](../experiments/route-a/A4/BUG_AUDIT.md).

## Standing rules for any change

1. **Preserve first.** Working implementations are assets.
2. **Measure second.** No claim without a recorded measurement.
3. **Optimize third.** Deterministic baselines before heuristics.
4. **Local first.** Browser-only; no server, no accounts, no cloud dependency.
5. **No new dependency** without a documented reason and recorded version.
6. **No cryptography, ML, or generative methods** before the deterministic baselines exist
   (and none exist today).
7. **QR is not encryption; steganography is not encryption.**
8. **Exact payload equality** is the only definition of a successful decode.
9. **Digital decoding and camera decoding are different claims.** Never merge them.
10. **Report failures.** A candidate that does not decode is data.

## Where to start

1. [`START_HERE.md`](START_HERE.md) — the project in plain language.
2. [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — one-page status.
3. [`RESEARCH_ROADMAP.md`](RESEARCH_ROADMAP.md) — the three-route programme.
4. [`ROUTE_A_ARTISTIC_QR.md`](ROUTE_A_ARTISTIC_QR.md), [`ROUTE_B_CUSTOM_LOGO_CODE.md`](ROUTE_B_CUSTOM_LOGO_CODE.md),
   [`ROUTE_C_IMAGE_STEGANOGRAPHY.md`](ROUTE_C_IMAGE_STEGANOGRAPHY.md).
5. [`EXPERIMENT_FORMAT.md`](EXPERIMENT_FORMAT.md) and [`RESEARCH_METHODOLOGY.md`](RESEARCH_METHODOLOGY.md)
   — how experiments record results.
6. The `README.md` inside each [`../experiments/route-a/`](../experiments/route-a/) experiment.
7. [`QR_V1_TECHNICAL_NOTES.md`](QR_V1_TECHNICAL_NOTES.md) before touching the QR encoder.
