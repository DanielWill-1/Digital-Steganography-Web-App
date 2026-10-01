# Research Roadmap

This document describes the programme, not the code. It defines the progression from the
current working implementations to a reproducible research project, and the three routes
that programme is divided into.

Status: **planning.** Nothing described here as future work has been started. Every
planned item is marked `[ ]`.

---

## Overall progression

```text
CURRENT SYSTEM
│
├── Existing protected LSB codec
│
└── Existing Version 1 QR encoder/scanner
     │
     ▼
RESEARCH FOUNDATION
│
├── preserve implementations
├── establish validation
├── establish metrics
└── establish reproducibility
     │
     ├────────────── Route A
     │               standards-compatible artistic QR
     │
     ├────────────── Route B
     │               custom logo-readable visual code
     │
     └────────────── Route C
                     robust image steganography
```

The research foundation is not a phase that ends; it is the set of rules every
experiment is held to. Its content lives in
[`RESEARCH_METHODOLOGY.md`](RESEARCH_METHODOLOGY.md) and
[`EXPERIMENT_FORMAT.md`](EXPERIMENT_FORMAT.md).

---

## Why a foundation step exists at all

The current system is two working browser experiments with no recorded measurements.
That is enough to demonstrate an idea and not enough to answer a research question. Three
gaps have to be closed before any optimisation work is meaningful:

| Gap | What is missing today | What closes it |
| :--- | :--- | :--- |
| Validation | The encoder is exercised by hand, not by a recorded procedure | `A0` — freeze and validate the Version 1 encoder |
| Metrics | "Looks similar" is not a measurement | Similarity metrics defined in [`ROUTE_A_ARTISTIC_QR.md`](ROUTE_A_ARTISTIC_QR.md) |
| Reproducibility | Results would live in a chat log or a screenshot | [`EXPERIMENT_FORMAT.md`](EXPERIMENT_FORMAT.md) and [`RESEARCH_METHODOLOGY.md`](RESEARCH_METHODOLOGY.md) |

Without those three, an optimiser can always be made to look good on a single example
and cannot be compared against anything.

---

## Route A — Standards-compatible artistic QR

**Question:** How closely can a standards-compatible QR symbol resemble a target logo
while remaining decodable by ordinary QR scanners?

**Constraint that defines the route:** compatibility is not negotiable. Whatever the
symbol looks like, an ordinary QR scanner must still read it.

**Progression:** `A0` → `A1` → `A2` → `A3` → `A4` → `A5` → `A6` → `A7` → `A8`.

The full milestone set, with objectives, inputs, outputs, and metrics, is in
[`ROUTE_A_ARTISTIC_QR.md`](ROUTE_A_ARTISTIC_QR.md).

**Current position:** `A0` is a documentation-phase statement of intent; `A1` is the next
implementation milestone and is **not started**.

---

## Route B — Custom logo-readable visual code

**Question:** How much visual freedom can be gained by abandoning QR compatibility while
still maintaining practical camera-based decoding?

**Constraint that defines the route:** ordinary QR scanners are no longer a requirement.
A dedicated StegoCode scanner is permitted.

This route is entirely planned. It has no implementation, no baseline, and no measured
results. Detail: [`ROUTE_B_CUSTOM_LOGO_CODE.md`](ROUTE_B_CUSTOM_LOGO_CODE.md).

---

## Route C — Image steganography

**Question:** How much machine-readable information can be hidden inside an ordinary
digital image while preserving human-visible appearance?

**Constraint that defines the route:** the carrier is the image signal, not an optical
pattern. Nothing is meant to be visible.

This route has a working implementation (the protected LSB codec) and a large, clearly
characterised weakness: it does not survive lossy transformation. Detail:
[`ROUTE_C_IMAGE_STEGANOGRAPHY.md`](ROUTE_C_IMAGE_STEGANOGRAPHY.md).

---

## Relationship between the routes

The routes share a foundation but are not a sequence. They differ in where the data
lives and what the viewer is allowed to notice:

| | Route A | Route B | Route C |
| :--- | :--- | :--- | :--- |
| Where the data lives | QR module grid | Custom code geometry | Image pixel values |
| Intended to be seen? | Yes, as a code | Yes, as a logo | No |
| Standard scanner compatible? | Required | Not required | Not applicable |
| Current implementation | Version 1 QR encoder | None | Protected LSB codec |
| Current robustness | Digital decoding verified | Unknown | Poor under lossy transformation |

Findings from one route may inform another — for example, codeword-aware error-budget
reasoning from Route A applies to Route C's redundancy planning — but the routes should
be reported separately, and a result from one route must never be presented as evidence
about another.

---

## Cryptography is layered on, not built in

Cryptography may later be layered onto any route. It is a separate concern and is not
part of the research question of any of the three routes.

Potential future cryptographic payloads:

- encryption,
- authentication,
- signatures,
- signed URLs,
- identity assertions,
- tamper evidence.

None of these exist today. QR itself is **not** cryptography: it is a data
representation and transport mechanism. Encoding a string as a QR symbol provides no
confidentiality, no integrity guarantee beyond Reed–Solomon error correction, and no
authenticity.

Cryptography and QR encoding must remain conceptually separate in the code, the
documentation, and any future claims.

---

## Ordering rules

1. `A0` before anything else in Route A. An unvalidated encoder cannot be a baseline.
2. `A1` before `A2`. Measure what valid ECC and mask choices already buy before changing
   a single module.
3. `A2` before `A3`. Observe where decoding breaks before modelling the error budget.
4. Synthetic robustness (`A4`) before physical camera testing (`A5`). Controlled
   transformations are repeatable; a phone in a room is not.
5. `A1`–`A5` before `A6`. A serious optimiser should be built on measured behaviour, not
   intuition.
6. Literature comparison (`A8`) before any novelty claim.

Future agents should not skip directly to advanced optimisation unless explicitly
instructed to.

---

## What "Route A complete" would mean

Not "an artistic QR generator exists", but:

- [ ] A frozen, independently validated Version 1 encoder baseline (`A0`).
- [ ] Measured similarity and penalty data for all valid ECC × mask candidates (`A1`).
- [ ] An empirical description of the visual/readability boundary (`A2`).
- [ ] Error-budget reasoning in codeword terms, not module-flip counts (`A3`).
- [ ] Synthetic robustness results reported as decode rates (`A4`).
- [ ] Physical camera results separated from digital decoding results (`A5`).
- [ ] An optimiser with a stated objective function and reported trade-off curve (`A6`).
- [ ] Multi-logo evaluation showing which target classes are compatible (`A7`).
- [ ] A literature comparison against existing aesthetic QR methods (`A8`).

---

## What this roadmap is not

- It is not a promise of novelty. No novelty claim is made anywhere in this project
  before `A8`.
- It is not a schedule. No dates are attached, deliberately.
- It is not a claim that the routes will succeed. Route A may find that valid QR
  geometry admits very little target-directed freedom; that is a legitimate and useful
  result and must be reported as such.
- It is not permission to modify the working applications. Research work is built
  alongside them.

---

## Standing principles, restated for the research routes

1. **Preserve first.** `stego_app.html`, `qr_app.html`, and `qr_app copy.html` remain
   working applications throughout. Experiments are separate artefacts.
2. **Measure second.** Every claim comes with a reproducible measurement.
3. **Optimize third.** Deterministic baselines before heuristics.
4. **Local first.** The project runs in a browser with no mandatory server, no accounts,
   and no cloud dependency. Nothing in the research plan changes that.
5. **No premature sophistication.** No machine learning, no generative methods, no
   cryptography, and no new dependencies before the deterministic baselines exist.

---

## Milestone dependency order

```text
A0
→ A1
→ A2
→ A3
→ A4
→ A5
→ A6
→ A7
→ A8
```

Some milestones may legitimately overlap once real findings arrive — `A4` robustness
testing, for example, may reveal that `A2` needs revisiting. That is expected. What is not
acceptable is starting `A6` while `A1` is still unmeasured.
