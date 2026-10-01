# Experiments

Research workspace for StegoCode. **This directory contains structure only. No experiment
has been run, and no result exists.**

The three subdirectories correspond to the three research routes:

| Directory | Route | Status |
| :--- | :--- | :--- |
| `route-a/` | Standards-compatible artistic QR | Active route. `A1` is next and **not started**. |
| `route-b/` | Custom logo-readable optical code | Planned. No implementation, no design decisions. |
| `route-c/` | Image steganography | Existing implementation (the LSB codec); research directions all future work. |

---

## What is here

```text
experiments/
├── README.md          this file
├── route-a/
│   ├── README.md      route goal, status, planned experiments, metrics, limitations
│   └── results/       (empty — placeholder)
├── route-b/
│   ├── README.md
│   └── results/       (empty — placeholder)
└── route-c/
    ├── README.md
    └── results/       (empty — placeholder)
```

Each `results/` directory is empty by design. It exists so that results have an obvious
home the moment an experiment produces them, rather than being scattered at the repository
root.

**No experiment directory (`A1/`, `A2/`, …) has been created.** Creating them now would
produce empty scaffolds that invite being filled in without the experiment actually being
designed. The next implementation phase creates `A1/`.

---

## Rules

Every experiment follows:

- [`../docs/RESEARCH_METHODOLOGY.md`](../docs/RESEARCH_METHODOLOGY.md) — what must be
  recorded, how reproducibility is enforced, and the decoder-independence and
  exact-payload rules.
- [`../docs/EXPERIMENT_FORMAT.md`](../docs/EXPERIMENT_FORMAT.md) — folder conventions, the
  `manifest.json` schema, and the recommended `A1` CSV schema.

The three rules that matter most:

1. **An experiment that is not recorded did not happen.**
2. **An encoder validated only by its own decoder is not validated.** Route A requires both
   `jsQR` and an independent decoder (OpenCV `QRCodeDetector`).
3. **Detection is not decoding.** A successful decode requires the recovered payload to
   equal the expected payload exactly.

---

## What must not happen here

- Do not modify `stego_app.html`, `qr_app.html`, or `qr_app copy.html` to make an
  experiment convenient. Experiments adapt; the applications do not.
- Do not implement Route B or Route C work inside a Route A experiment, or vice versa.
- Do not add cryptography, machine learning, or generative methods to any experiment before
  the deterministic baselines exist.
- Do not add a runtime dependency without a documented reason and a recorded version.
- Do not report a synthetic result as a camera result, or a detection as a decode.
