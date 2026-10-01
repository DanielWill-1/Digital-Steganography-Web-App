# Route B — Custom Logo Code

**Status: planned. Nothing implemented. No baseline, no measurements, no code.**

---

## Objective

Investigate a custom machine-readable visual code designed specifically to resemble
logos.

Unlike Route A:

```text
ordinary QR compatibility is not required
```

A dedicated StegoCode scanner may be used. That single relaxation is the entire premise of
the route: everything QR spends its visual budget on — three finder patterns, separators,
timing tracks, format information, a fixed dark module — exists to make a *generic*
scanner work without knowing anything about the symbol in advance. If the scanner is
allowed to know what it is looking at, that budget is freed.

Concept:

```text
human sees:
logo

StegoCode scanner sees:
structured encoded payload
```

---

## Central research question

> How much visual freedom can be gained by abandoning QR compatibility while still
> maintaining practical camera-based decoding?

The word doing the work is *practical*. A design that is beautifully free of QR structure
and requires a perfectly flat, perfectly lit, perfectly aligned capture is not a result.
The route is a trade-off study, not a design competition.

---

## Research areas

These are candidate directions, not decisions. Nothing below has been evaluated, and no
option should be presented as chosen.

### Registration and orientation

- Custom registration markers.
- Orientation detection.
- Synchronisation.

QR's finders are large, high-contrast, and visually intrusive. The question is what the
minimum marker set is that still permits reliable location and orientation, and whether
those markers can be embedded in logo geometry rather than added to it.

### Payload structure

- Payload regions.
- Distributed symbols.
- Spatial redundancy.

Where does the data live — a contiguous region, or spread across the whole mark? A
distributed layout is less visually obvious but requires the entire mark to survive
capture.

### Error correction

- Reed–Solomon or BCH protection.

Reed–Solomon is already implemented twice in this repository (QR codewords in
`qr_app copy.html`, the protected-block code in `stego_app.html`), so the arithmetic is
not the hard part. The open question is the code rate: how little redundancy can be used
while still tolerating camera capture.

### Geometry and robustness

- Geometric invariants.
- Perspective correction.
- Camera robustness.

Any real capture involves perspective distortion, which means the decoder needs to
establish a homography from a small number of known points. Those points have to be
findable in the design.

### Colour and dimension

- Colour channels.
- Custom finder structures hidden inside logo geometry.

Colour is tempting because it multiplies the information per unit area, but it also
introduces white balance, colour-space, and printing variability that greyscale QR avoids
entirely.

---

## Why this route is harder than it looks

- **Every relaxation moves work to the scanner.** QR's rigidity is what makes a generic
  decoder possible. A custom code must ship its own decoder, and that decoder must be
  robust to conditions the designer did not anticipate.
- **Logo geometry is arbitrary.** QR's structure is chosen for machine readability. A
  logo's structure is chosen for brand reasons. Finding a payload layout that fits an
  arbitrary logo is a constraint-satisfaction problem, not a design problem.
- **There is no ground truth.** Route A can always ask "does a normal scanner read it?".
  Route B has no external oracle, which makes independent validation genuinely difficult —
  a risk that must be designed around rather than ignored.

---

## Relationship with the current implementation

Almost none, deliberately.

- The existing Version 1 QR encoder is not a starting point for Route B, because the route
  exists to abandon QR structure.
- The existing `jsQR`-based scan path is not a starting point, because it decodes QR and
  nothing else.
- The reusable asset is the **GF(256) and Reed–Solomon arithmetic** already present in
  both applications, which could inform a future custom code's error correction.

Route B does not build on Route A's output. It is a separate design problem that happens
to share a mathematical toolkit.

---

## Planned experiments

None defined yet. Defining them requires decisions that have not been made — marker
strategy, payload layout, and code rate are all open.

A sensible first milestone, when this route is activated, would be a **feasibility
spike**: a single hard-coded custom marker with a single hard-coded payload, captured from
a screen at a fixed distance, decoded successfully. That establishes that the problem is
tractable before any design work begins. It is not defined as a milestone here because
defining it prematurely would prejudge the design.

---

## Metrics

Not yet defined. The metrics will need to be different from Route A's, because Route A
measures agreement with an *existing* standard. Route B would need to measure at least:

- visual similarity to the target logo (probably reusing Route A's similarity definitions),
- decode success rate under controlled transformations,
- decode success rate under real camera capture,
- information density: payload bits per unit area.

Defining these before there is a design to measure would produce numbers that mean
nothing.

---

## Key limitations

- No implementation exists, so every claim about Route B is speculation.
- No decoder exists, and without one there is no oracle for success.
- No design decisions have been made, so there is nothing to validate.
- The route may turn out to be a design exercise with little measurable content. That
  would be a legitimate finding and should be reported as one rather than hidden behind a
  prototype.

---

## Dependencies

- None on Route A.
- Would reuse GF(256)/Reed–Solomon knowledge from the existing implementations.
- Would require a new decoder — either a browser implementation or an independent one for
  validation.
- Would require a capture and annotation workflow for camera testing.

---

## Explicit non-goals

- Not a QR variant. If it ends up needing finder patterns, timing, and format information,
  it is Route A with extra steps.
- Not a steganographic technique. The mark is meant to be visible.
- Not a cryptographic design. Cryptography may be layered on later, as with any route, but
  is not part of this route's question.
- Not to be implemented during Route A's experiments.
