# Experiments

Research workspace for StegoCode. **Route A's experiments `A1`–`A4` are implemented; `A1`–`A3` are
frozen, and `A4` is software-complete with physical validation pending. The other routes contain
structure only.**

The three subdirectories correspond to the three research routes:

| Directory | Route | Status |
| :--- | :--- | :--- |
| `route-a/` | Standards-compatible artistic QR | Active route. `A1`–`A3` complete (frozen); `A4` software implemented, physical validation **PENDING**. |
| `route-b/` | Custom logo-readable optical code | Planned. No implementation, no design decisions. |
| `route-c/` | Image steganography | Existing implementation (the LSB codec); research directions all future work. |

---

## What is here

```text
experiments/
├── README.md          this file
├── route-a/
│   ├── README.md      route goal, status, experiments, metrics, limitations
│   ├── A1/            baseline experiment (control)
│   ├── A2/            seeded modification experiment
│   ├── A3/            codeword-aware optimization + synthetic robustness
│   ├── A4/            generalization + physical tooling + final analysis
│   └── results/       (empty — placeholder)
├── route-b/
│   ├── README.md
│   └── results/       (empty — placeholder)
└── route-c/
    ├── README.md
    └── results/       (empty — placeholder)
```

Each route's `results/` directory exists so results have an obvious home. A1–A4 keep their recorded
evidence inside their own directories (CSVs + `manifest.json`, plus A3's clean/strategy/codeword
and robustness CSVs and A4's generalization/operating-point/robustness/dataset files, and
`outputs/*.png`). The route-level `results/` directories remain placeholders.

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
