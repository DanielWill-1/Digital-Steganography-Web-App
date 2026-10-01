# Research Methodology

This document defines the rules every StegoCode experiment follows. It exists so that a
result produced in six months can be understood, reproduced, and challenged by someone
who was not present when it was produced.

It applies to Route A, Route B, and Route C equally.

---

## The three standing rules

1. **An experiment that is not recorded did not happen.**
2. **An encoder validated only by its own decoder is not validated.**
3. **Detection is not decoding.** A successful decode requires the recovered payload to
   equal the expected payload exactly.

---

## Every experiment must define

Each experiment directory contains a `README.md` recording, at minimum:

| Field | Meaning |
| :--- | :--- |
| `experiment_id` | Stable identifier, e.g. `A1`, `A2b`, `C3` |
| `date` | Date the experiment was run |
| `research_question` | The question, in one sentence, answerable by measurement |
| `hypothesis` | Optional. If present, state what result would falsify it |
| `inputs` | Every input file, with paths and hashes where practical |
| `payload` | The exact payload string, quoted |
| `qr_version` | QR version under test, or `n/a` |
| `ecc` | Error-correction level(s) under test, or `n/a` |
| `mask` | Mask(s) under test, or `n/a` |
| `target_image` | The target logo/image and its normalisation method |
| `normalization_method` | Exact procedure used to produce the comparison target |
| `software_versions` | Application version/commit, decoder versions, browser version |
| `browser` | Browser and version, including OS |
| `decoder` | Every decoder used, with version |
| `test_transformations` | The transformations applied, with exact parameters |
| `metrics` | The metrics computed, with their definitions |
| `output_files` | Machine-readable result files and generated artefacts |
| `conclusions` | What the numbers support — and what they do not |
| `limitations` | Known weaknesses of this specific experiment |

If a field does not apply, write `n/a`. Do not omit it. An omitted field is
indistinguishable from a forgotten one.

---

## Reproducibility

### Determinism

Experiments must be deterministic wherever possible. Given the same inputs, the same
experiment must produce the same outputs.

If randomness is genuinely required:

- use a seeded generator,
- record the seed in the manifest,
- record the generator's name and version,
- never reseed from wall-clock time in a way that cannot be reproduced.

### Machine-readable evidence first

Primary evidence is machine-readable:

```text
CSV     tabular per-candidate or per-transformation results
JSON    manifests, configuration, summaries
PNG     generated candidate images
```

Screenshots may **supplement** results. They must not be the only evidence for any
claim, because they cannot be re-parsed, re-aggregated, or independently checked.

### Self-describing runs

Every run writes a `manifest.json` alongside its `results.csv`, recording the
configuration actually used — not the configuration that was intended. See
[`EXPERIMENT_FORMAT.md`](EXPERIMENT_FORMAT.md) for the folder and file conventions.

### Version pinning

Record:

- the git commit of this repository,
- the browser name and version,
- the version of every decoder,
- the version of any tool used to produce inputs or post-process outputs.

A result that cannot be tied to a version is a result that cannot be reproduced.

---

## Decoder independence

Do not validate an encoder solely with its own decoder. A decoder that shares the
encoder's bugs will confirm them.

For Route A, use at least:

```text
browser decoder:            jsQR
external/independent decoder: OpenCV QRCodeDetector
```

The two must be reported separately, never merged into a single "decodes" column.

Later additional decoders may be added — ZXing, a phone's native scanner, a dedicated
hardware scanner. Each addition is recorded in the manifest.

Notes on the two required decoders:

- `jsQR` is the browser decoder already used by `qr_app.html` and `qr_app copy.html`. It
  is convenient and is the closest thing to the project's own scanning path, which makes
  it the *least* independent of the two. That is precisely why it is not sufficient on
  its own.
- `OpenCV QRCodeDetector` is a separate implementation lineage and is the required
  independent check. The prompt for this phase explicitly deferred building an OpenCV
  execution pipeline; it is required for `A1` when that experiment is implemented, not
  before.

---

## Exact payload validation

A QR code counts as successfully decoded only when:

```text
decoded payload === expected payload
```

Detection alone is insufficient. A candidate that a decoder locates but cannot read, or
reads incorrectly, is a failure, and must be recorded as a failure with the incorrect
payload preserved verbatim in the results.

The same rule applies to Route C: a recovered payload that differs from the original by
even one byte is a failed decode, not a partial success.

---

## Reporting failures honestly

- Report decode **rates** over a defined set of trials, not anecdotal successes. "It
  scanned on my phone" is not a result.
- Keep failed candidates. A candidate that does not decode is data.
- Never drop a transformation because the result was poor.
- Never report the best run of several as *the* result without also reporting the others.
- Distinguish clearly between:

```text
digital image decoding
camera / physical decoding
```

A symbol that decodes perfectly from a PNG may fail entirely from a photograph. These are
different claims and must never be conflated.

---

## Metric discipline

- Every metric has a written definition before it is computed. See the metrics section of
  [`ROUTE_A_ARTISTIC_QR.md`](ROUTE_A_ARTISTIC_QR.md).
- Report several metrics, not one composite percentage. A single number hides which
  factor moved.
- State the denominator. "94% similar" is meaningless without saying *similar over what
  set of modules*.
- Where a theoretical bound exists — for example the maximum similarity achievable if
  every modifiable module matched the target — report it alongside the measured value, so
  the reader can see how much of the available headroom was actually used.
- Never tune a metric definition after seeing the results that it produces.

---

## Scope discipline

- Route A experiments must not implement Route B or Route C features.
- Route A experiments must not introduce cryptography.
- No route introduces machine learning or generative methods before the deterministic
  baselines are established and documented.
- No new runtime dependency is added without a documented reason and a recorded version.
- Existing working applications are not modified to make an experiment convenient. The
  experiment adapts.

---

## Reviewing an experiment

Before a result is treated as a finding, check:

- [ ] The research question is stated and answerable by the measurements taken.
- [ ] Inputs and payloads are recorded exactly.
- [ ] The normalisation procedure is recorded exactly and is deterministic.
- [ ] Both decoders were used and reported separately.
- [ ] Success is defined as exact payload equality.
- [ ] Failures and poor results are included, not filtered out.
- [ ] Results are machine-readable and the manifest reflects the actual configuration.
- [ ] The conclusion does not exceed what the numbers support.
- [ ] Limitations specific to the run are written down.
