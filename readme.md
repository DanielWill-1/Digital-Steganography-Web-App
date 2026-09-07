# StegoCode: Imperceptible Data Embedding via Spatial-Domain LSB Steganography

An in-browser cryptographic & steganographic tool that encodes arbitrary payloads into standard imagery without perceptible visual artifacts—exploring the boundary between 2D barcodes and invisible digital watermarks.

---

## Overview

Traditional 2D barcodes (such as QR codes) rely on high-contrast, macro-level geometrical patterns (finder patterns, alignment modules, timing tracks) to ensure scan fidelity across noisy physical environments. While robust, they inherently disrupt visual aesthetics.

**StegoCode** explores the inverse trade-off: preserving full aesthetic fidelity by modulating visual signals at the microscopic byte level. Using Spatial-Domain **Least Significant Bit (LSB)** substitution, the application injects binary bitstreams directly into the 24-bit RGB raster space of an arbitrary host image.

---

## Technical Architecture

### 1. Spatial-Domain LSB Insertion
An uncompressed RGBA pixel consists of four 8-bit channels:

$$\text{Pixel} = [R, G, B, A] \quad \text{where } R, G, B, A \in [0, 255]$$

Modifying the least significant bit ($b_0$) of an 8-bit channel alters its intensity by at most $\pm 1$:

$$\Delta I = |I_{\text{modified}} - I_{\text{original}}| \le 1$$

Across an 8-bit dynamic range, this modification induces a perceptual delta well below the human visual system's Just-Noticeable Difference (JND) threshold, rendering data embedding imperceptible under ambient viewing conditions.

### 2. Payload Framing & Bit Packing
* **Serialization:** Characters are converted into 8-bit ASCII / UTF-8 byte arrays.
* **Termination Marker:** A sentinel delimiter (`###END###`) is suffixed to the payload bitstream to eliminate the need for fixed payload-length preambles.
* **Channel Masking:** The alpha channel ($A$) is skipped during insertion to prevent unwanted transparency side effects in browser rendering engines.

---

## Limitations & Engineering Trade-offs

| Dimension | Standard QR Code | StegoCode (Spatial LSB) |
| :--- | :--- | :--- |
| **Visual Distortion** | High (Monochrome grid artifacts) | Zero (Perceptually lossless) |
| **Compression Resilience** | High (Reed-Solomon ECC handles up to 30% loss) | Low (Lossy compression destroys $b_0$) |
| **Camera Recapture (Print-to-Scan)** | Native (Deskewing via corner finder targets) | Requires spatial synchronization / DWT |
| **Format Requirement** | Any visual medium | Lossless raster only (PNG, BMP, WebP-lossless) |

---

