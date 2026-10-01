# Route C — Image Steganography

**Status: existing implementation (`stego_app.html`). Future research directions planned,
not started.**

---

## Route goal

Determine how much machine-readable information can be hidden inside an ordinary digital
image while preserving human-visible appearance.

The carrier is the **image signal**, not an optical pattern. Nothing is meant to be visible.

Full specification: [`../../docs/ROUTE_C_IMAGE_STEGANOGRAPHY.md`](../../docs/ROUTE_C_IMAGE_STEGANOGRAPHY.md).
Implementation detail: [`../../docs/STEGANOGRAPHY_TECHNICAL_NOTES.md`](../../docs/STEGANOGRAPHY_TECHNICAL_NOTES.md).

---

## Current status

Unlike Routes A and B, this route has a **working implementation**: the protected LSB codec
in `stego_app.html`.

```text
Existing implementation:
  RGB LSB embedding, alpha skipped, UTF-8 payload, "STG" packet framing,
  CRC-16 packet integrity, (6,4) GF(256) protected blocks with CRC-8,
  one-symbol repair per block, rejection of multiply damaged blocks.

Verified (23/23 checks during the documentation pass):
  exact UTF-8 round trip, single-symbol repair at every block position,
  rejection of multiply damaged blocks, header guards, standard CRC check values.

Future research directions:
  all planned, none started, no measurements recorded.
```

No experiment has been run in this directory. There is not one PSNR value, not one bit
error rate, and not one payload survival rate anywhere in the repository.

---

## Planned experiments

None defined yet. Any Route C experiment should record at minimum: the payload, the host
image (with a hash), the embedding method and its parameters, the transformation applied
with its parameters, the resulting bit error rate, and whether the payload decoded exactly.

Candidate research directions, none of which is a decided plan:

| Direction | What it would address |
| :--- | :--- |
| Redundant LSB strategies | Damage concentrating in one block |
| Adaptive embedding | Spending capacity where change is least visible |
| Error-correction improvements | Surviving more damage per block; interleaving; erasure decoding |
| Transform-domain methods | Surviving re-encoding |
| DCT methods | Embedding in cosine coefficients |
| DWT methods | Embedding in wavelet sub-bands |
| Robust watermarking ideas | The established literature closest to this problem |
| Spatial synchronisation | Recovering position after a geometric transform |
| Camera-survivable embedding | Surviving display → photograph → read |

**None of these may be implemented as part of Route A work.**

---

## Metrics

Not yet defined as a formal experiment set. At minimum:

- **Visual distortion** — a perceptual metric, plus a visual difference visualisation.
  PSNR alone is a weak proxy.
- **Bit error rate after a named transformation**, with the transformation's parameters
  recorded exactly.
- **Payload survival rate** — the fraction of trials in which the payload decodes exactly.
  Partial recovery is a failure.
- **Capacity** — payload bits per pixel, and how much of that is redundancy.

As with Route A, exact payload equality defines success, and synthetic results must be
reported separately from physical capture results.

---

## Key limitations

- The current codec has **no robustness to lossy transformation at all**.
- Requires essentially lossless pixel preservation; JPEG, resize, crop, screenshots, print
  recapture, and social-media recompression all destroy the payload.
- One-symbol repair per six-symbol block; no interleaving, so damage concentrated in one
  region is far more dangerous than the same amount spread evenly.
- No camera recapture capability whatsoever. This codec is not a watermark and is not
  designed to be one.
- 100% redundancy overhead: six embedded symbols carry three payload bytes.
- The payload is trivially discoverable by anyone who reads bit 0 of each non-alpha byte and
  recognises the `STG` magic. **Hiding is not protection.**
- No measurements exist.

---

## Dependencies

| Dependency | Status |
| :--- | :--- |
| Protected LSB codec (`stego_app.html`) | Exists — the comparison baseline |
| Perceptual distortion metric | **Does not exist** |
| Transformation harness | **Does not exist** |
| Capture workflow (for camera-survivability work) | **Does not exist** |
| DCT/DWT implementation or dependency | **Does not exist** |

`stego_app.html` makes no network request of any kind. Adding a dependency requires a
documented reason.

---

## Relationship with the current implementation

- The working implementation is `stego_app.html`, and it must not be modified in place. The
  packet format and block structure are documented and verified; changing them invalidates
  both.
- Route C research belongs in a separate experiment directory, with the existing codec as
  the comparison baseline.
- Route C shares **no mechanism** with Routes A and B. Findings do not transfer directly in
  either direction.
