# Research Roadmap

The StegoCode programme investigates how far machine-readable visual codes and image
steganography can be pushed toward human-meaningful appearance, and what that costs in
reliability. It is organised as **three routes** that relax different constraints, plus a final
integration and an optional cryptography layer.

Legend: ✅ implemented · ◐ implemented, incomplete · ◑ existing baseline · ☐ planned

---

## Overall structure

```text
FOUNDATION
  existing QR + protected-LSB implementations               ✅

ROUTE A — Standards-Compatible Artistic QR
  A1 ✅   A2 ✅   A3 ✅   A4 ◐ (physical validation pending)
  → freeze Route A v1, finalize the Route A report

ROUTE B — Custom Logo Code
  B1 ☐ Custom-code foundation
  B2 ☐ Logo-aware encoding
  B3 ☐ Robustness + Route A comparison

ROUTE C — Image Steganography
  C1 ◑ existing LSB baseline (formalize + benchmark)
  C2 ☐ robust embedding
  C3 ☐ evaluation

FINAL INTEGRATION
  StegoCode Studio: Artistic QR + Logo Code + Image Steganography   ☐

OPTIONAL FUTURE
  cryptographic payload layer (encryption / signatures / auth)       ☐
```

Do not create implementation phases beyond these. In particular, do not invent an A5, and do
not add B4–B8 or C4–C8 automatically.

---

## Route A — Standards-Compatible Artistic QR

**Question:** How closely can a standards-compatible QR symbol be moved toward the appearance
of a target logo while ordinary QR decoders continue to recover the original payload reliably?

**Constraint that defines the route:** ordinary QR scanners must keep working; a StegoCode
scanner is **not** required. Only QR data/ECC modules are changed; mandatory QR structure
(finder patterns, separators, timing, format information, dark module, quiet zone) is untouched.

**Progression:** A1 → A2 → A3 → A4. **Current position:** A1–A3 complete/frozen; A4 software
implemented with physical validation pending.

| | Status | Result |
| :--- | :--- | :--- |
| **A1** baseline | ✅ COMPLETE / FROZEN | 4 ECC × 8 masks = 32 valid candidates; jsQR 32/32, OpenCV 32/32 exact; ≈49% similarity vs ≈68–72% structural ceiling. |
| **A2** random modification | ✅ COMPLETE / FROZEN | Seeded random target-directed changes; exact to budget 8, partial 10–12, 0/5 from 16; ≈3.4 codewords on success vs ≈18.9 on failure. |
| **A3** codeword-aware optimization | ✅ COMPLETE / FROZEN | Packing the same changes into fewer codewords: both-exact to budget 40 (58.50% similarity, 7 codewords) where A2 needed ≈21 codewords and failed. |
| **A4** generalization + physical | ◐ IMPLEMENTED | Audit + 96-config generalization complete; physical tooling done; physical data **pending**. |

**A4 generalization (96 configurations = 8 targets × 3 payloads × 4 ECC):**

```text
A3_CLEAN_MAX both-exact:            96/96
A3_ROBUST:                          94/96
A2 vs A3 matched budget:            A3 > A2 94 · tie 2 · A3 < A2 0
A3 clean-max similarity gain:       mean ≈5.95pp · median ≈5.44pp · min ≈0.91pp · max ≈9.07pp
median gain by ECC:                 H ≈9.07pp > Q ≈7.25pp > M ≈5.44pp > L ≈3.63pp
```

**Route A's central (bounded) finding:** at the same number of target-directed module changes,
concentrating them into fewer Reed–Solomon codewords preserves decoding substantially better
than random distribution — **observed in 94 of 96 tested software-generalization
configurations (2 ties, 0 losses)**. This is scoped to the tested configurations; it is not a
universal claim.

**Route A's fundamental limitation:** QR has mandatory geometry and encoded-payload
constraints, so an arbitrary logo cannot be reproduced perfectly. Route A maximizes resemblance
*subject to standard-QR compatibility and measured robustness*. This limitation motivates
Route B.

Details: [`ROUTE_A_ARTISTIC_QR.md`](ROUTE_A_ARTISTIC_QR.md) and the experiment READMEs under
[`../experiments/route-a/`](../experiments/route-a/).

---

## Route B — Custom Logo Code

**Question:** If standard QR compatibility is abandoned, how much more closely can a
machine-readable optical code resemble a natural logo while remaining practical to scan with a
dedicated StegoCode decoder?

**Constraint that defines the route:** ordinary QR scanners are no longer required; a dedicated
StegoCode scanner is allowed. This frees registration, orientation, payload placement, error
correction, synchronisation, spatial distribution, camera recovery, and custom geometry from
QR's finder-square and placement rules.

```text
B1 ☐ Custom-code foundation
      minimum viable StegoCode optical format; encodes a payload and survives basic
      digital/camera transforms using the StegoCode scanner. No logo optimization yet.

B2 ☐ Logo-constrained encoding
      adapt the symbol to a target logo: where information may live, which regions preserve
      target geometry, redundancy allocation, logo-aware distribution, visual similarity.
      Compare against Route A: how much visual freedom did abandoning QR buy?

B3 ☐ Robustness and Route A comparison
      digital transforms, screens, print, camera, angle, distance, lighting, multiple logos,
      multiple payloads; compare Route A (standard compatible, more restricted) vs Route B
      (custom scanner, greater expected visual freedom).
```

Route B is **PLANNED, not implemented**. It ends after B3 unless future evidence justifies more.
Do not create B4–B8 automatically. Detail:
[`ROUTE_B_CUSTOM_LOGO_CODE.md`](ROUTE_B_CUSTOM_LOGO_CODE.md).

---

## Route C — Image Steganography

**Question:** How much information can be embedded into an ordinary image while minimizing
visible change and maintaining useful robustness?

**Constraint that defines the route:** the carrier is the image signal itself; there is no
visible code.

```text
C1 ◑ Existing LSB baseline
      formalize and benchmark the protected spatial-domain RGB LSB codec already in
      stego_app.html (STG framing, UTF-8 payload, CRC-16, CRC-8 block protection, GF(256)
      parity, single-symbol repair): capacity, visual distortion, clean recovery, controlled
      corruption. Much of the implementation already exists.

C2 ☐ Robust embedding
      techniques intended to survive transformations that destroy raw LSB data (redundant
      spatial embedding, block-based embedding, DCT/DWT ideas, synchronization, stronger ECC).
      Do NOT preselect a final method.

C3 ☐ Evaluation
      visibility, capacity, and survival under JPEG / resize / crop / screenshot / camera;
      produce the final Route C analysis.
```

The LSB baseline is **hidden but not protected against lossy transformation**, and hidden is not
secure: anyone who knows the `STG` format can read it. Detail:
[`ROUTE_C_IMAGE_STEGANOGRAPHY.md`](ROUTE_C_IMAGE_STEGANOGRAPHY.md).

---

## Three-route comparison

| Property | Route A | Route B | Route C |
| :--- | :--- | :--- | :--- |
| Human appearance | QR / logo hybrid | Logo-like custom symbol | Normal image |
| Ordinary QR scanner | **Yes** | No | No |
| StegoCode decoder required | No | **Yes** | **Yes** |
| Camera-oriented | Yes | Yes | Initially limited |
| Visual freedom | Limited | High | Very high |
| Hiddenness | Low / medium | Medium | High |
| Standard compatibility | QR | Custom | Custom |
| Existing implementation | Advanced (A1–A4) | Planned | Baseline exists (LSB codec) |

No route is universally superior; they serve different goals.

---

## Final integration — StegoCode Studio

```text
Artistic QR          Route A   Standard scanner compatible
Logo Code            Route B   Maximum logo integration, StegoCode scanner
Image Steganography  Route C   Invisible payload in an ordinary image
```

A user picks the tool matching the trade-off they want. This integration is **planned**.

---

## Cryptography layer (optional, separate)

Cryptography is a **payload layer**, not a route:

```text
plaintext → optional encryption/signature → payload bytes → Route A / B / C encoding
```

Possible future payload protection: encryption, digital signatures, authentication, tamper
evidence. But QR ≠ encryption, steganography ≠ encryption, encoding ≠ encryption. None is
implemented. Do not implement cryptography as part of a route task.

---

## Immediate next work

```text
CURRENT:               Route A / A4 — physical validation pending real data collection
NEXT AFTER A4:         Route B / B1 — Custom Code Foundation
LATER:                 Route C robust-steganography research (C2–C3)
END GOAL:              StegoCode Studio
```

Route A is **not** scientifically complete until real screen/print/camera trials are collected
and analysed. Do not start Route B before then.

---

## Standing principles

1. **Preserve first.** `stego_app.html`, `qr_app.html`, and `qr_app copy.html` remain working
   applications. Experiments are separate artefacts under `experiments/`.
2. **Measure second.** Every claim comes with a reproducible measurement.
3. **Optimize third.** Deterministic baselines before heuristics.
4. **Local first.** No server, accounts, or cloud dependency.
5. **No premature sophistication.** No ML, generative methods, cryptography, or new
   dependencies before the deterministic baselines exist.
6. **Report failures honestly.** Detection is not decoding; digital decoding is not camera
   decoding.
