# Project Status

One-page status. See [`START_HERE.md`](START_HERE.md) for the plain-language overview and
[`RESEARCH_ROADMAP.md`](RESEARCH_ROADMAP.md) for the full programme.

---

## Snapshot

```text
Date:                 2026-10-02
Active route:         A — Standards-Compatible Artistic QR
Active experiment:    A4 — Generalization + physical validation + final analysis
Software status:      implemented
Generalization:       complete (96 configurations)
Physical validation:  PENDING real data collection
Route A status:       NOT YET SCIENTIFICALLY COMPLETE
Next route after A4:  B — Custom Logo Code
```

## Implemented / planned

| | Status |
| :--- | :--- |
| Route A / A1 | ✅ COMPLETE — frozen baseline |
| Route A / A2 | ✅ COMPLETE — frozen seeded-modification baseline |
| Route A / A3 | ✅ COMPLETE — frozen codeword-aware optimizer + synthetic robustness |
| Route A / A4 | ◐ IMPLEMENTED — audit + generalization + tooling done; physical data **pending** |
| Route B / B1–B3 | ☐ PLANNED — not started |
| Route C / C1 (baseline) | ◑ EXISTS — protected LSB codec in `stego_app.html` |
| Route C / C2–C3 | ☐ PLANNED |
| StegoCode Studio (integration) | ☐ PLANNED |

## What works today

- `stego_app.html` — protected LSB steganography (Route C baseline).
- `qr_app copy.html` — in-repo Version 1 QR encoder + `jsQR` scanning (Route A baseline).
- `qr_app.html` — the `qrcodejs` QR page.
- `experiments/route-a/A1`–`A4` — Route A experiments, tests, validators, and recorded results.

## Pending work

1. **Route A physical validation** — collect screen/print/camera trials with the A4 tooling,
   import them (`validation/physical_analysis.py`), and finalize the Route A report.
2. **Route B (B1–B3)** — custom optical-code foundation, logo-aware encoding, robustness
   comparison against Route A. Not started.
3. **Route C (C2–C3)** — robust embedding research and final evaluation. Not started.

## Known bugs

- **A4-BUG-001 — QR penalty Rule 3 was dead code (FIXED).** A strict-equality type error
  (`bit === 0` on booleans) meant Rule 3 never fired. Fixed; penalty values and
  standard-selected masks were regenerated for A1–A3. Decode and similarity results were
  unaffected; A3's default selected candidate was unaffected. Detail:
  [`../experiments/route-a/A4/BUG_AUDIT.md`](../experiments/route-a/A4/BUG_AUDIT.md).

No other confirmed bugs. Cross-browser, mobile, downloads, and camera capture are **NOT
TESTED**; see
[`../experiments/route-a/A4/CROSS_ENVIRONMENT_NOTES.md`](../experiments/route-a/A4/CROSS_ENVIRONMENT_NOTES.md).

## Known limitations

- Route A: Version 1 QR only; immutable structure is ~53% of the symbol; codeword count is a
  structural proxy, not a full decoder model; results so far are synthetic, not physical.
- Route A's advantage is stated for the **tested configurations only** (94/96 matched-budget
  wins among the 96 software-generalization configurations; not a universal claim).
- Route A cannot turn an arbitrary logo into a QR: finder patterns, timing, format
  information, the dark module, the quiet zone, and payload constraints are mandatory.
- Route C's existing LSB codec does not survive lossy transformations (JPEG, resize, crops).
- No cryptography, machine learning, or generative methods are used anywhere in the project.

## Next milestone

```text
Finish Route A physical validation (collect + import + analyse real screen/print/camera trials),
then freeze Route A v1 and finalize the Route A report.
```

After that, begin **Route B / B1 — Custom Code Foundation**. Do not start Route B before Route
A's physical validation is collected, and do not invent an A5 experiment.
