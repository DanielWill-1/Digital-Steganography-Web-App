# Agent Context

**This document is written for a future agentic coding system entering this repository
with no prior context.** Read it first. It is the shortest path to understanding what
exists, what must not be broken, what is planned, and what is out of bounds.

---

## Current status, stated plainly

```text
CURRENT ACTIVE RESEARCH ROUTE: ROUTE A
NEXT IMPLEMENTATION TARGET: EXPERIMENT A1
A1 IMPLEMENTATION STATUS: NOT STARTED
```

There is no target-logo optimiser in this repository. There is no similarity metric
implementation, no QR role map, no target normalisation code, and no OpenCV pipeline. If
you are here to implement `A1`, none of it exists yet.

---

## What StegoCode currently is

A browser-only project with no build step, no framework, no package manager, and no
server. Three standalone HTML files, each fully self-contained apart from two CDN script
tags.

Two working implementations:

1. **Protected image steganography** — `stego_app.html`. Hides a UTF-8 payload in the RGB
   least-significant bits of a lossless image, with `STG` packet framing, CRC-16, and
   GF(256) protected blocks that repair one damaged symbol per block.
2. **Standalone Version 1 QR encoding and scanning** — `qr_app copy.html`. A from-scratch
   QR encoder (21 × 21, byte mode, Reed–Solomon ECC, all eight masks, ISO-style penalty
   scoring, canvas rendering) plus scanning via `jsQR`.

One historical implementation: `qr_app.html` — the same QR Studio interface, but
generating codes through the `qrcodejs` library instead of the in-repo encoder.

---

## What already works

Both implementations were verified end-to-end during the documentation pass that produced
this `docs/` directory, by loading their real source into Node with a minimal DOM stub and
testing the codec and encoder functions directly:

**`stego_app.html` — 23/23 checks passed**

- Exact UTF-8 round trip, including multi-byte characters.
- CRC-8 and CRC-16 match the standard check values (`0xF4`, `0x29B1`).
- Single-symbol repair succeeds at every position within a block.
- Multiply damaged blocks are rejected, never returning a wrong payload.
- Header guards reject unknown versions and images with no packet.
- Packet and protected-length arithmetic is correct.

**`qr_app copy.html` — 59/59 checks passed**

- Module role map: 192 finder/separator, 10 timing, 30 format, 1 dark module, 208
  data/ECC, 0 remainder — 441 total.
- Generator polynomials have all required roots at every ECC level.
- Reed–Solomon syndromes are zero for L/M/Q/H.
- All 32 format codewords are distinct, BCH-valid, and decode back to the right ECC level
  and mask; the encoder matches an independently written BCH(15,5) encoder.
- All 32 ECC × mask matrices pass structural validation, and an independently written
  extractor reproduces the exact codeword bitstream from each.
- Capacity enforcement is exact: 17/14/11/7 bytes for L/M/Q/H.
- Mask selection correctly picks the minimum-penalty mask.

The harness that produced those results was **deliberately not committed**. It lives
outside the repository. `A0` is the milestone that turns this kind of ad-hoc verification
into a repeatable, in-project procedure with recorded output.

---

## Which files contain the working implementations

| File | Contains | Lines |
| :--- | :--- | ---: |
| `stego_app.html` | The protected LSB codec — packet framing, CRCs, GF(256), the (6,4) RS code, embedding, extraction, repair | 356 |
| `qr_app copy.html` | The standalone Version 1 QR encoder — GF(256), RS ECC, BCH format info, matrix construction, all 8 masks, penalty scoring, canvas rendering — plus the `jsQR` scan path | 686 |
| `qr_app.html` | The `qrcodejs`-based QR page and the same scan path | 479 |

Supporting documentation:

| File | Contents |
| :--- | :--- |
| `docs/CURRENT_IMPLEMENTATION.md` | What the code does, the exact difference between the two QR pages, network behaviour |
| `docs/QR_V1_TECHNICAL_NOTES.md` | The QR encoder function by function, with line references |
| `docs/STEGANOGRAPHY_TECHNICAL_NOTES.md` | The LSB codec function by function, packet layout diagram |
| `docs/ROUTE_A_ARTISTIC_QR.md` | Route A: objective, constraints, `A0`–`A8`, metrics, normalisation |
| `docs/RESEARCH_METHODOLOGY.md` | Rules every experiment must follow |
| `docs/EXPERIMENT_FORMAT.md` | Folder conventions, manifest schema, the A1 CSV schema |
| `docs/TERMINOLOGY.md` | Definitions; keeps encryption/encoding and steganography/QR distinct |
| `docs/LIMITATIONS.md` | What the code cannot do |

---

## Which files must not be casually rewritten

**`stego_app.html`** — the protected codec. The packet layout, the CRC polynomials, the
(6,4) code structure, and the six-symbol block are all documented and verified. Changing
the framing in place invalidates
[`STEGANOGRAPHY_TECHNICAL_NOTES.md`](STEGANOGRAPHY_TECHNICAL_NOTES.md) and the verified
baseline. Route C work belongs in a separate experiment directory with this codec as the
comparison baseline.

**`qr_app copy.html`** — the in-repo Version 1 encoder. This is the baseline every Route A
experiment depends on. `A0` exists specifically to freeze and validate it before any
artistic modification. Rewriting it silently invalidates `A0`. If `A1` needs the selected
mask index or the per-rule penalties exposed, that is a *deliberate, documented* change —
not a refactor.

**`qr_app.html`** — a working page. Historical relative to the encoder, but not dead code.
Do not delete it.

**Do not rename `qr_app copy.html`.** The space in the filename is a filesystem artefact,
and renaming tracked files carries risk on this case-insensitive, OneDrive-synced working
tree. If a rename is genuinely wanted, do it as its own deliberate change with the
documentation updated in the same commit.

**Do not move the three HTML files out of the repository root.** Keeping them there is a
deliberate decision: they are the working applications and they open directly from a file
path. `docs/` and `experiments/` are additions, not a reorganisation.

---

## What Route A, B, and C mean

```text
Route A — standards-compatible artistic QR
          A valid QR symbol pushed toward a target logo's appearance.
          Ordinary QR scanners must still decode it.

Route B — custom logo-readable optical code
          A machine-readable code designed to look like a logo.
          QR compatibility is NOT required; a dedicated scanner is allowed.

Route C — image steganography
          Data hidden inside the image signal itself, in pixel values.
          Not an optical code at all.
```

The distinction that must not be blurred:

```text
Route A: visually stylized but overt optical code
Route B: custom logo-shaped optical code
Route C: data hidden in the image signal itself
```

---

## Which route is currently active

**Route A.** It is the only route with an active implementation target.

- Route B has no implementation, no baseline, and no design decisions made. Do not start
  it.
- Route C has a working implementation (the LSB codec) but its research directions are all
  future work. Do not start them.

---

## A1 objective

The central research question:

> Given a Version 1 QR payload and target image, how much visual similarity can be achieved
> using only valid ECC/mask choices before modifying any QR modules?

In full:

> Given the same Version 1 payload and a target logo, how much visual similarity can be
> obtained using only valid QR error-correction levels and mask choices, without changing
> any encoded module?

This is a measurement, not an optimisation. Nothing is modified. Every candidate is a
legitimate QR symbol produced by the existing encoder. The result says how much visual
agreement QR's own degrees of freedom already provide.

The recommended payload is `g.co` — four UTF-8 bytes, which fits all four ECC levels, so
payload size is constant across all 32 candidates and cannot confound the comparison.

Full specification: [`ROUTE_A_ARTISTIC_QR.md`](ROUTE_A_ARTISTIC_QR.md#a1--maskecc-visual-similarity-baseline).

---

## A1 constraints

A future implementation agent **must**:

- preserve the existing applications — do not modify them to make the experiment
  convenient;
- build the experiment separately, under `experiments/route-a/A1/`;
- use a 21 × 21 normalised target;
- enumerate all eight masks;
- compare L/M/Q/H when payload capacity allows;
- produce up to 32 candidates;
- calculate similarity metrics with stated denominators;
- calculate QR penalties, reporting the four rules separately;
- maintain a QR module role map;
- validate exact payload equality with `jsQR`;
- support independent OpenCV validation;
- export reproducible results — `results.csv` plus `manifest.json`;
- record the normalisation procedure exactly.

A future implementation agent **must not**:

- modify QR modules toward the target (that is `A2`);
- implement Route B;
- implement Route C upgrades;
- add cryptography;
- add machine learning or generative methods;
- add a runtime dependency without a documented reason;
- report detection as decoding, or digital decoding as camera decoding.

---

## Known facts about the baseline that A1 depends on

These were established by inspection and verification during the documentation pass. They
are the numbers `A1` must use.

```text
Version 1 matrix                     21 × 21 = 441 modules
Finder + separator                   192 modules  (3 × 8 × 8)      immutable
Timing                                10 modules                  immutable
Format information                    30 modules  (two 15-bit)     immutable
Fixed dark module                      1 module  (row 13, col 8)  immutable
Immutable total                      233 modules                  = 52.8% of the symbol
Data + ECC                           208 modules  (26 codewords)  the only mutable set
Remainder bits                         0 modules
```

```text
ECC level   ECC codewords   data codewords   max UTF-8 bytes
L                    7              19               17
M                   10              16               14
Q                   13              13               11
H                   17               9                7
```

```text
Selected mask for payload "g.co" (reference only, NOT an A1 result)
L -> mask 2     M -> mask 0     Q -> mask 6     H -> mask 0
```

Two implementation facts that will affect `A1`'s design:

1. **`qrMatrix(text, correction)` returns only the matrix.** It does not expose the
   selected mask index or the per-rule penalties, both of which `A1` must record. `A1` will
   need to either expose them or re-derive the selection in the experiment code.
2. **The matrix returned by `qrMatrix` has no quiet zone.** The quiet zone is added as
   canvas padding during rendering. Any candidate PNG written directly from the matrix
   needs four modules of margin added, or it will not scan.

Also relevant: the implementation's mask penalty **rule 3 is an approximation** of the
specification's 1:1:3:1:1 rule. Per-rule penalty columns are therefore not directly
comparable against another implementation's without that caveat. See
[`LIMITATIONS.md`](LIMITATIONS.md) and
[`QR_V1_TECHNICAL_NOTES.md`](QR_V1_TECHNICAL_NOTES.md#rule-3--finder-like-pattern-lines-360366).

---

## Future order

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

Future agents should not skip directly to advanced optimisation unless explicitly
instructed. In particular:

- Do not start `A2` (module modification) before `A1` has produced measured baseline data.
  Without the baseline, there is nothing to compare a modification against.
- Do not start `A6` (an optimiser) before `A1`–`A5` establish measurable behaviour.
- Do not introduce machine learning at any point before the deterministic baselines exist.
- Do not claim novelty before `A8`'s literature review.

---

## Standing rules for any change in this repository

1. **Preserve first.** Working implementations are assets.
2. **Measure second.** No claim without a recorded measurement.
3. **Optimize third.** Deterministic baselines before heuristics.
4. **Local first.** Browser-only, no server, no accounts, no cloud dependency. Nothing in
   the research plan changes that.
5. **No new dependencies** without a documented reason and a recorded version.
6. **No cryptography, no ML, no generative methods** before the deterministic baselines
   exist.
7. **Cryptography and encoding are separate concerns.** QR is not encryption.
8. **Exact payload equality is the only definition of a successful decode.**
9. **Digital decoding and camera decoding are different claims.** Never merge them.
10. **Report failures.** A candidate that does not decode is data.

---

## Where to start

1. Read this file.
2. Read [`CURRENT_IMPLEMENTATION.md`](CURRENT_IMPLEMENTATION.md) to know what exists.
3. Read [`ROUTE_A_ARTISTIC_QR.md`](ROUTE_A_ARTISTIC_QR.md) for the `A0` and `A1`
   specifications.
4. Read [`EXPERIMENT_FORMAT.md`](EXPERIMENT_FORMAT.md) for where results go and in what
   shape.
5. Read [`RESEARCH_METHODOLOGY.md`](RESEARCH_METHODOLOGY.md) for the rules.
6. Read [`QR_V1_TECHNICAL_NOTES.md`](QR_V1_TECHNICAL_NOTES.md) before touching the
   encoder.

If you are asked to implement `A1`, do `A0` first. An unvalidated baseline is not a
baseline.
