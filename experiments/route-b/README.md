# Route B — Custom Logo Code

**Status: planned. No implementation. No design decisions made. No experiments defined.**

---

## Route goal

Investigate a custom machine-readable visual code designed specifically to resemble logos.

Unlike Route A, **ordinary QR compatibility is not required**. A dedicated StegoCode
scanner may be used. That relaxation is the entire premise: the visual budget QR spends on
generic finder patterns, separators, timing tracks, and format information is freed if the
scanner is allowed to know what it is looking at.

```text
human sees:            logo
StegoCode scanner sees: structured encoded payload
```

Full specification: [`../../docs/ROUTE_B_CUSTOM_LOGO_CODE.md`](../../docs/ROUTE_B_CUSTOM_LOGO_CODE.md).

---

## Current status

```text
No implementation.
No baseline.
No design decisions.
No experiments defined.
```

This directory contains a README and an empty `results/` placeholder, and nothing else.
That is the correct state for a route that has not been started.

---

## Planned experiments

None defined. Defining them requires decisions that have not been made — marker strategy,
payload layout, and code rate are all open, and writing milestones before those decisions
would prejudge the design.

A sensible first milestone when this route is activated would be a **feasibility spike**: a
single hard-coded custom marker with a single hard-coded payload, captured from a screen at
a fixed distance, decoded successfully. That establishes tractability before any design work
begins. It is not defined as a milestone here because doing so now would be premature.

---

## Metrics

Not yet defined. Route A measures agreement with an existing standard; Route B has no
standard to agree with, so its metrics must be built from scratch. At minimum:

- visual similarity to the target logo (probably reusing Route A's similarity definitions),
- decode success rate under controlled synthetic transformations,
- decode success rate under real camera capture,
- information density: payload bits per unit area.

Defining these before there is a design to measure would produce numbers that mean nothing.

---

## Key limitations

- No implementation exists, so every claim about this route is speculation.
- **No decoder exists, and without one there is no oracle for success.** This is the
  hardest structural problem in the route: Route A can always ask "does a normal scanner
  read it?", and Route B cannot.
- Logo geometry is arbitrary — chosen for brand reasons, not machine readability.
- No design decisions have been made, so there is nothing to validate.
- The route may turn out to be a design exercise with little measurable content. That would
  be a legitimate finding and should be reported as one rather than hidden behind a
  prototype.

---

## Dependencies

| Dependency | Status |
| :--- | :--- |
| GF(256) / Reed–Solomon knowledge from the existing implementations | Exists, reusable |
| Custom marker design | **Does not exist** |
| Custom decoder | **Does not exist** |
| Independent validation path | **Does not exist** — and is the route's hardest open problem |
| Capture and annotation workflow for camera testing | **Does not exist** |

No dependency on Route A's output. This is a separate design problem that happens to share
a mathematical toolkit.

---

## Relationship with the current implementation

Almost none, deliberately.

- The existing Version 1 QR encoder is **not** a starting point, because this route exists
  to abandon QR structure. If the design ends up needing finder patterns, timing, and format
  information, it is Route A with extra steps.
- The existing `jsQR` scan path is **not** a starting point, because it decodes QR and
  nothing else.
- The reusable asset is the **GF(256) and Reed–Solomon arithmetic** already present in both
  `qr_app copy.html` and `stego_app.html`, which could inform a future custom code's error
  correction.

---

## Explicit non-goals

- Not a QR variant.
- Not a steganographic technique — the mark is meant to be visible.
- Not a cryptographic design. Cryptography may be layered on later, as with any route, but
  is not part of this route's question.
- **Not to be implemented during Route A's experiments.**
