# Experiment Result Format

Conventions for storing experiments and their results. These exist so that a result
produced later can be understood, re-run, and challenged without the original author
present.

See [`RESEARCH_METHODOLOGY.md`](RESEARCH_METHODOLOGY.md) for what an experiment must
*record*. This document covers *where* and *in what shape*.

---

## Folder convention

```text
experiments/
└── route-a/
    └── A1/
        ├── README.md            the experiment: question, method, conclusions, limitations
        ├── targets/             normalised target images and their source images
        ├── outputs/             generated candidates (PNGs, matrices)
        ├── results/
        │   ├── results.csv      one row per candidate or per trial
        │   └── manifest.json    the configuration actually used
        └── validation/          independent decoder output, re-runs, checks
```

Rules:

- **One directory per experiment**, named by experiment ID (`A1`, `A2`, `B1`, `C1`).
- **Every experiment directory has a `README.md`.** A directory of outputs without a
  README is not an experiment.
- **`results/` holds machine-readable evidence.** This is the primary evidence and must be
  sufficient on its own to support the experiment's conclusions.
- **`outputs/` holds generated artefacts** — candidate PNGs, matrices, visualisations.
- **`targets/` holds inputs**, including both the original image and its normalised form,
  because the normalisation is lossy and both must be inspectable.
- **`validation/` holds independent checks** — the external decoder's output, re-runs, or
  anything used to confirm the primary results.
- **Do not commit large binary sets** without a reason. If candidate PNGs are numerous,
  commit the ones referenced from `results.csv` and record how the rest were generated.

`A1/` is **not created yet**. It will be created by the next implementation phase. Creating
it now would be an empty scaffold that invites being filled in without the experiment
actually being designed.

---

## `manifest.json`

Records the configuration actually used, not the configuration intended. Every experiment
directory has exactly one, at `results/manifest.json`.

Recommended shape:

```json
{
  "experiment_id": "A1",
  "date": "YYYY-MM-DD",
  "repository_commit": "<git sha>",
  "research_question": "...",
  "payload": "g.co",
  "qr_version": 1,
  "ecc_levels": ["L", "M", "Q", "H"],
  "masks": [0, 1, 2, 3, 4, 5, 6, 7],
  "targets": [
    {
      "name": "example-logo",
      "source_file": "targets/example-logo.png",
      "normalized_file": "targets/example-logo-21x21.png",
      "normalization": {
        "crop": "square fit, centred",
        "grayscale": "luma",
        "resample": "<method>",
        "threshold": "<method and value>"
      }
    }
  ],
  "encoders": [
    { "name": "stegocode-v1-encoder", "source": "qr_app copy.html", "commit": "<sha>" }
  ],
  "decoders": [
    { "name": "jsQR", "version": "1.4.0", "role": "browser decoder" },
    { "name": "OpenCV QRCodeDetector", "version": "<version>", "role": "independent decoder" }
  ],
  "browser": { "name": "<browser>", "version": "<version>", "os": "<os>" },
  "environment": { "notes": "..." },
  "random_seed": null,
  "metrics": {
    "full_similarity": "1 - mismatching_modules / 441",
    "mutable_similarity": "1 - mismatches_in_mutable_region / 208",
    "theoretical_ceiling": "see docs/ROUTE_A_ARTISTIC_QR.md"
  },
  "success_definition": "decoded payload === expected payload",
  "output_files": ["results/results.csv", "outputs/..."],
  "notes": "..."
}
```

The point of the manifest is that a reader can tell, without asking, exactly which payload,
which target, which normalisation, which decoder versions, and which environment produced
the CSV beside it.

---

## Recommended A1 CSV schema

One row per candidate (ECC level × mask × target).

```text
run_id
timestamp
target_name
payload
qr_version
ecc
mask
full_similarity
mutable_similarity
fixed_conflicts
theoretical_ceiling
qr_penalty_1
qr_penalty_2
qr_penalty_3
qr_penalty_4
qr_penalty_total
standard_selected_mask
jsqr_detected
jsqr_payload_correct
opencv_detected
opencv_payload_correct
decoded_payload
candidate_file
```

### Column semantics

| Column | Meaning |
| :--- | :--- |
| `run_id` | Unique identifier for the run; groups rows produced together |
| `timestamp` | ISO-8601 timestamp of the run |
| `target_name` | Key into the manifest's `targets` list |
| `payload` | The exact payload string, quoted as-is |
| `qr_version` | `1` |
| `ecc` | `L`, `M`, `Q`, or `H` |
| `mask` | `0`–`7` |
| `full_similarity` | `1 − mismatches / 441` |
| `mutable_similarity` | `1 − mismatches in the 208 data/ECC modules / 208` |
| `fixed_conflicts` | Positions where target and immutable QR structure disagree |
| `theoretical_ceiling` | Best achievable full similarity for this target given immutable structure |
| `qr_penalty_1` … `qr_penalty_4` | The four penalty rules, **reported separately** |
| `qr_penalty_total` | Their sum, i.e. what mask selection minimises |
| `standard_selected_mask` | `true`/`false` — whether the standard algorithm would pick this mask |
| `jsqr_detected` | `true`/`false` — `jsQR` located a symbol |
| `jsqr_payload_correct` | `true`/`false` — recovered payload exactly equals `payload` |
| `opencv_detected` | `true`/`false` — independent decoder located a symbol |
| `opencv_payload_correct` | `true`/`false` — recovered payload exactly equals `payload` |
| `decoded_payload` | The payload actually returned, verbatim, even when incorrect |
| `candidate_file` | Path to the generated candidate image |

### Why the four penalties are separate columns

`qr_penalty_total` is what the standard mask-selection rule minimises. Reporting only the
total would hide which rule drove the choice — and Route A's whole question is whether a
*different* mask than the standard choice can look better while remaining valid. Rule 3 in
this implementation is an approximation (see
[`QR_V1_TECHNICAL_NOTES.md`](QR_V1_TECHNICAL_NOTES.md#rule-3--finder-like-pattern-lines-360366)),
so per-rule values are also needed to avoid comparing them against another
implementation's totals without that caveat.

### Why `decoded_payload` is recorded even on failure

A wrong payload is the most informative failure mode there is. Recording `false` in
`jsqr_payload_correct` and dropping the actual string throws away the evidence of *how* it
failed — a truncation, a single flipped byte, and pure noise are very different outcomes.

---

## Other experiment types

### Robustness experiments (A4)

One row per transformation trial:

```text
run_id
timestamp
candidate_file
source_run_id          links back to the A1 candidate row
transformation         e.g. "gaussian_blur"
parameter_name
parameter_value
trial_index
jsqr_detected
jsqr_payload_correct
opencv_detected
opencv_payload_correct
decoded_payload
```

Decode **rates** are computed by aggregating this table, not by hand. A transformation is
described by its name *and* its parameters; `transformation = "blur"` with no parameters is
not a reproducible row.

### Physical camera experiments (A5)

Additional columns, because the conditions are not fully controlled and must be recorded:

```text
device
display_type           "screen" | "paper"
distance_cm
angle_deg
lighting_notes
capture_file
```

Physical results must be kept in a separate table or a separate `display_type`-partitioned
view from synthetic results. They must never be aggregated into one "success rate".

### Route C experiments

Not yet defined. Any Route C experiment should record at minimum the payload, the host
image (with a hash), the embedding method and its parameters, the transformation applied
with parameters, the resulting bit error rate, and whether the payload decoded exactly.

---

## Aggregation rules

- Aggregate with code, not by hand. Commit the aggregation step or record the exact
  procedure.
- State the denominator in every rate: `N` trials, `k` successes, `k/N`.
- Never aggregate across decoders. `jsQR` and OpenCV rates are separate results.
- Never aggregate across `display_type`. Digital and physical are separate results.
- Never drop rows because they look like outliers. If a row is excluded, the exclusion
  rule and the number of rows it removed go in the README.

---

## Naming

- Experiment directories: `A1`, `A2`, `B1`, `C1` — uppercase route letter, number.
- Target files: `<name>-21x21.png` for normalised targets, `<name>.png` for sources.
- Candidate files: `<run_id>-<target_name>-<ecc><mask>.png`.
- Runs: `<experiment_id>-<YYYYMMDD>-<n>`.

Names should be reproducible from the manifest, not assigned by hand in an unpredictable
way.
