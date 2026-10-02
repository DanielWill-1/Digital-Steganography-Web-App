# A4.2 — Physical Validation Protocol

This document defines the physical screen / print / camera protocol for Experiment A4. It is
deliberately concrete so that results collected later are comparable. **No physical results
are fabricated by the build**; until real trials are imported, A4's physical status is
`PHYSICAL VALIDATION PENDING`.

## What is being tested

For a representative subset of configurations, compare physical scan reliability of:

- `A1_BASE` — the untouched highest-similarity QR;
- `A3_ROBUST` — the codeword-aware candidate meeting the predefined synthetic robustness
  criterion;
- `A3_CLEAN_MAX` — the highest-similarity candidate that decoded exactly under both decoders;
- optionally `A2_MATCHED` — the A2 random baseline at the matched module budget.

Generated QR is **pure black on pure white** only. No colour, no styling (Route A minimizes
logo-shape optimization as the single variable).

## Minimum campaign

```text
4 target categories: simple, letter-like, dense, asymmetrical
A1_BASE + A3_ROBUST (and optionally A3_CLEAN_MAX, A2_MATCHED)
medium: screen AND print
at least 2 symbol sizes
at least 3 conditions (distance / angle / lighting) per candidate
5 scan attempts per condition
at least 2 independent device/scanner setups where available (else state the limitation)
```

## Screen testing (`physical/screen-test.html`)

Open the page, load a candidate PNG, choose a size preset, and enter fullscreen. Display
sizes are recorded as exact CSS pixel widths with the QR module pitch in pixels/module (the
21×21 QR area only, excluding the quiet zone). Do not let the browser zoom scale the symbol.
Brightness is recorded as a user-entered percentage (`unknown` if unknown).

## Print testing (`physical/print-sheet.html`)

Print at **100% / actual size**. Symbol widths of 25 mm, 40 mm, and 60 mm (QR area only,
excluding the quiet zone) are offered; the sheet states which convention is used. A printed
calibration ruler lets the operator verify that 100% scale was preserved. Record printer
model, DPI, paper type, colour/grayscale, print scaling, and the measured physical width.
Keep annotations outside the quiet zone.

## Camera capture dimensions to record

```text
medium: screen | print
scanner device (PHONE_A / PHONE_B ...) and app
symbol size (px on screen / mm on paper)
distance_mm and symbol_width_mm, and distance_to_width_ratio
yaw angle and (optionally) pitch angle
lighting: bright indoor | normal indoor | dim indoor (lux if measured, else the label)
```

## Rules

- **Run exactly the specified number of attempts.** Do not retry until success.
- **Success requires exact payload match**, not detection. Record `EXACT`, `WRONG_PAYLOAD`,
  `NO_DETECTION`, or `ERROR`.
- **Flag wrong-payload events separately.** They are the most informative failure mode.
- Record **`unknown`**, never an invented value.
- Keep captures (optional) under `physical/captures/`, tightly cropped; avoid personal
  backgrounds.
- Report physical results **separately** from digital/synthetic results. Never merge them.
- Wilson 95% intervals are reported per condition; they do not imply population
  generality beyond the tested devices and conditions.

## Recording and export

Use `physical/physical-test-recorder.html`. It persists a draft in `localStorage`, and exports
authoritative `physical_trials.csv` and `physical_session.json`. Import those with:

```bash
python validation/physical_analysis.py
```

which writes `results/physical_summary.csv` and `results/physical_summary.json`. The main A4
page can load `physical_summary.csv` for the final target-level table and charts.
