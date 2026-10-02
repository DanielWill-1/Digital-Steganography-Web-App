# Start Here

A short, plain-language guide to StegoCode. No QR-code or error-correction background
required.

---

## What is StegoCode?

StegoCode is a **browser-based research studio for visually integrated machine-readable codes
and image steganography**. It studies the trade-offs between:

```text
visual appearance
machine readability
error correction
data capacity
digital robustness
camera robustness
hiddenness
```

Everything runs in the browser (no server, no accounts). The repository contains working
applications **and** an ongoing research programme built around them.

## What problem are we exploring?

Can something that a machine must read — a QR code, or a data payload hidden in a photo — also
*look like* something a person wants to look at (a logo, an ordinary image)? And what does
that cost in reliability?

The project deliberately measures before it optimises. Conservative baselines come first.

## What are Routes A / B / C?

Three distinct research directions, each relaxing a different constraint:

```text
Route A — Standards-Compatible Artistic QR
  A normal QR symbol, pushed toward a target logo.
  Ordinary QR scanners must still read it.        (StegoCode scanner NOT needed)

Route B — Custom Logo Code
  A custom machine-readable symbol built to look like a logo.
  Ordinary QR compatibility is abandoned; a dedicated StegoCode scanner is allowed.

Route C — Image Steganography
  Data hidden in the pixels of an ordinary image.
  There is no visible code at all; the image just looks like a normal image.
```

They are not ranked; they serve different goals.

## What have we learned so far?

Route A is the most advanced. Its experiments are labelled A1–A4:

- **A1 (baseline):** with ordinary, fully-valid QR generation, mask and error-correction
  choices alone already move a QR about halfway toward a target, but mandatory QR structure
  caps how far that can go.
- **A2:** deliberately changing QR modules toward the target raises resemblance, but *random*
  changes break decoding quickly.
- **A3 (the key result):** the same changes, concentrated into fewer error-correction
  codewords, keep decoding alive much longer. Under the controlled test, A3 survived to more
  than three times the modifications A2 tolerated at the same visual similarity.
- **A4 (generalization):** across **96 configurations** (8 target types × 3 payload lengths ×
  4 error-correction levels), A3 reached a both-decoder-exact result in **96/96** cases and
  **outperformed the matched random baseline in 94/96** (tied 2, lost 0). Higher error
  correction tolerated more change (H > Q > M > L).

A correctness audit during A4 also **found and fixed a real bug** in the QR penalty
calculation (it had never been firing). This affected only recorded penalty values, not
decoding or similarity results.

All of this is **software and synthetic** so far. Route A has **not** yet been tested with real
screens, printers, and cameras.

## What is currently unfinished?

```text
Route A / A4 — physical validation is PENDING real data collection.
Route B — not started (planned).
Route C — has a working baseline (the protected LSB codec); robust-embedding research is planned.
```

Route A cannot be called scientifically complete until real physical scans exist. No physical
results have been invented.

## What are we doing next?

```text
CURRENT:   finish Route A's physical validation (real screen / print / camera trials)
THEN:      Route B / B1 — build the custom optical-code foundation
LATER:     Route C robust-steganography research
```

## What should the end product look like?

A single studio — **StegoCode Studio** — offering three tools:

```text
Artistic QR          (Route A)  standard scanners work
Logo Code            (Route B)  maximum logo integration, StegoCode scanner
Image Steganography  (Route C)  invisible payload in an ordinary image
```

A user picks the tool that matches the trade-off they want. A rough mental model:

```text
Need ordinary phone QR compatibility?      -> Route A
Need the symbol to look much more like a logo? -> Route B
Need the data to be visually hidden?       -> Route C
```

Cryptography (encryption, signatures) is a **separate, optional layer** applied to the payload
before any of these encodings. None of the routes is encryption, and none of it is implemented
yet.

---

## Where to read next

- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — the one-page current status.
- [`RESEARCH_ROADMAP.md`](RESEARCH_ROADMAP.md) — the full three-route programme.
- [`ROUTE_A_ARTISTIC_QR.md`](ROUTE_A_ARTISTIC_QR.md) — Route A in detail (A1–A4).
- [`ROUTE_B_CUSTOM_LOGO_CODE.md`](ROUTE_B_CUSTOM_LOGO_CODE.md) — Route B in detail.
- [`ROUTE_C_IMAGE_STEGANOGRAPHY.md`](ROUTE_C_IMAGE_STEGANOGRAPHY.md) — Route C in detail.
- [`../experiments/README.md`](../experiments/README.md) — where results live.
