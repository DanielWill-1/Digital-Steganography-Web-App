# StegoCode — Project Overview

StegoCode is a browser-based project that began as a set of small experiments around
machine-readable codes and hidden data, and is now being turned into a reproducible
research project.

It has two parts that must be understood separately:

1. **A working browser application** — two self-contained HTML pages that run entirely
   client-side, with no build step, no framework, and no package manager.
2. **A research programme** — three planned routes of investigation into how far
   machine-readable visual codes can be pushed toward human-meaningful appearance, and
   how much data can be hidden inside ordinary images.

This document describes what the project *is*. For what the code *does*, see
[`CURRENT_IMPLEMENTATION.md`](CURRENT_IMPLEMENTATION.md). For where the research is
going, see [`RESEARCH_ROADMAP.md`](RESEARCH_ROADMAP.md).

---

## Origin questions

The project started from a set of related questions rather than a product brief:

- Can QR-like systems be used as carriers for cryptographic data?
- Can machine-readable codes be integrated into company logos rather than appearing as
  obvious QR grids?
- Could something visually resemble a normal logo — for example a Google-style "G" —
  while scanning to a payload such as `google.com`?
- Can invisible or almost invisible data be embedded directly in image pixels?
- What trade-offs exist between visual fidelity, machine readability, error correction,
  camera robustness, and hiddenness?

Those questions are still the organising principle of the work. What has changed is that
the project now insists on measurement before optimisation.

---

## What exists today

Three standalone HTML pages, each of which opens directly in a browser:

| File | Role | Status |
| :--- | :--- | :--- |
| `stego_app.html` | Protected image steganography: embed and recover a UTF-8 payload in the RGB least-significant bits of a lossless image, with CRC and Reed–Solomon-style repair. | Working, verified |
| `qr_app copy.html` | Standalone Version 1 QR encoder written from scratch (no QR-generation library) plus image and camera scanning via `jsQR`. | Working, verified |
| `qr_app.html` | QR Studio page with the same interface, but generating codes through the third-party `qrcodejs` library instead of the in-repo encoder. | Working, historical |

`qr_app copy.html` is **not** a throwaway duplicate. It is the implementation that
contains the in-repo QR encoder, and it is the file the QR research routes build on. See
[`CURRENT_IMPLEMENTATION.md`](CURRENT_IMPLEMENTATION.md#the-two-qr-pages) for the exact
difference between the two QR pages.

### Verified capabilities

Both implementations were exercised end-to-end during this documentation pass, by
loading their actual source into Node with a minimal DOM stub and testing the codec and
encoder functions directly:

- **Protected steganography** — 23/23 checks: UTF-8 round trip, single-symbol repair in
  every block position, rejection of multiply damaged blocks, header guards, standard
  CRC check values (`CRC-8/SMBUS = 0xF4`, `CRC-16/CCITT-FALSE = 0x29B1`).
- **Version 1 QR encoder** — 59/59 checks: module role map (192 finder/separator, 10
  timing, 30 format, 1 dark module, 208 data/ECC), generator-polynomial roots, zero
  Reed–Solomon syndromes at every ECC level, all 32 format-information codewords, full
  structural validation of all 32 ECC × mask matrices, independent re-extraction of the
  codeword bitstream, capacity enforcement (17/14/11/7 bytes), and minimum-penalty mask
  selection.

The verification harness lives outside the repository and is **not** part of the
deliverable; see [`RESEARCH_METHODOLOGY.md`](RESEARCH_METHODOLOGY.md) for how future
experiments should record evidence.

---

## Repository map

```text
StegoCode/
│
├── README.md                  Project entry point
│
├── stego_app.html             Protected LSB steganography (working application)
├── qr_app copy.html           Standalone Version 1 QR encoder + scanner (working application)
├── qr_app.html                Library-based QR page (working, historical)
│
├── docs/                      Project, research, and implementation documentation
│   ├── PROJECT_OVERVIEW.md
│   ├── CURRENT_IMPLEMENTATION.md
│   ├── RESEARCH_ROADMAP.md
│   ├── RESEARCH_METHODOLOGY.md
│   ├── TERMINOLOGY.md
│   ├── LIMITATIONS.md
│   ├── ROUTE_A_ARTISTIC_QR.md
│   ├── ROUTE_B_CUSTOM_LOGO_CODE.md
│   ├── ROUTE_C_IMAGE_STEGANOGRAPHY.md
│   ├── QR_V1_TECHNICAL_NOTES.md
│   ├── STEGANOGRAPHY_TECHNICAL_NOTES.md
│   ├── EXPERIMENT_FORMAT.md
│   └── AGENT_CONTEXT.md
│
└── experiments/               Research workspace (structure only; no experiments run yet)
    ├── README.md
    ├── route-a/
    │   ├── README.md
    │   └── results/.gitkeep
    ├── route-b/
    │   ├── README.md
    │   └── results/.gitkeep
    └── route-c/
        ├── README.md
        └── results/.gitkeep
```

Two files that are not part of the application or the research structure:

- `todo.md` — an early scratch note about possible enhancements (error correction,
  AES-GCM, a diff canvas). It is listed in `.gitignore` and is historical.
- `prompt.md` — the task specification for the documentation phase that produced this
  `docs/` directory.

---

## Running the project

There is no build step and no dependency installation.

1. Open any of the three HTML files in a modern browser, or serve the directory with any
   static file server.
2. `stego_app.html` and `qr_app copy.html` need no network access for generation.
3. Camera scanning requires a secure context (HTTPS or `localhost`) and browser camera
   permission.
4. `qr_app.html` and `qr_app copy.html` both load `jsQR` from a public CDN for scanning;
   `qr_app.html` additionally loads `qrcodejs`. See
   [`LIMITATIONS.md`](LIMITATIONS.md) and
   [`CURRENT_IMPLEMENTATION.md`](CURRENT_IMPLEMENTATION.md#network-behaviour) for the
   privacy and reliability consequences.

---

## The three research routes

| Route | Question | Compatibility requirement |
| :--- | :--- | :--- |
| **A — Standards-compatible artistic QR** | How closely can a valid QR symbol resemble a target logo while still decoding in ordinary scanners? | Ordinary QR scanners must work |
| **B — Custom logo code** | How much visual freedom is gained by abandoning QR compatibility while keeping practical camera decoding? | A dedicated StegoCode scanner is allowed |
| **C — Image steganography** | How much machine-readable information can be hidden inside an ordinary image while preserving human-visible appearance? | Not an optical code at all — data lives in the image signal |

The distinction that matters most:

```text
Route A: visually stylized but overt optical code
Route B: custom logo-shaped optical code
Route C: data hidden in the image signal itself
```

Full detail: [`ROUTE_A_ARTISTIC_QR.md`](ROUTE_A_ARTISTIC_QR.md),
[`ROUTE_B_CUSTOM_LOGO_CODE.md`](ROUTE_B_CUSTOM_LOGO_CODE.md),
[`ROUTE_C_IMAGE_STEGANOGRAPHY.md`](ROUTE_C_IMAGE_STEGANOGRAPHY.md).

---

## Cryptography is a separate layer

QR encoding is not encryption. Encoding is a representation; encryption is a
confidentiality mechanism. The project keeps them apart deliberately.

Cryptographic payloads (encryption, authentication, signatures, signed URLs, identity
assertions, tamper evidence) may later be carried *inside* any of the three routes, but
they are a separate concern layered on top of the transport, and nothing in the current
implementation provides them.

See [`TERMINOLOGY.md`](TERMINOLOGY.md) for the definitions this project uses, and
[`LIMITATIONS.md`](LIMITATIONS.md) for what the current implementation does not do.

---

## Standing principles

1. **Preserve first.** Working implementations are assets. They are not rewritten for
   tidiness.
2. **Measure second.** No claim about visual similarity, robustness, or hiddenness
   without a recorded measurement.
3. **Optimize third.** Deterministic baselines before heuristics; heuristics before
   optimisation; optimisation before anything learned or generative.
4. **Be conservative in claims.** Detection is not decoding. Digital decoding is not
   camera decoding. A local experiment is not a literature review.

---

## Current status

```text
Current route: Route A
Current stage: documentation / research foundation
Next experiment: A1 — Mask/ECC Visual Similarity Baseline
A1 implementation status: NOT STARTED
```

The immediate long-term research direction:

> Determine how far a standards-compatible QR code can be visually transformed toward a
> target logo while retaining reliable machine readability.
