# StegoCode: Browser-Based Steganography and QR Studio

StegoCode is a client-side web application containing two related tools:

1. **Protected image steganography** using RGB least-significant-bit (LSB) embedding with Reed–Solomon-style repair.
2. **Raw QR generation and scanning** with a standalone Version 1 QR encoder built without a QR-generation library.

The tools run in the browser. Image payloads and QR content are not uploaded by the application.

---

## Overview

Traditional 2D barcodes (such as QR codes) rely on high-contrast, macro-level geometrical patterns (finder patterns, alignment modules, timing tracks) to ensure scan fidelity across noisy physical environments. While robust, they inherently disrupt visual aesthetics.

**StegoCode** explores the inverse trade-off: preserving visual fidelity by modulating image signals at the microscopic byte level. Using spatial-domain **Least Significant Bit (LSB)** substitution, the application injects protected binary packets directly into the RGB raster space of a host image.

The repository includes:

| File | Purpose |
| :--- | :--- |
| `stego_app.html` | Encode and decode protected UTF-8 messages in lossless images. |
| `qr_app copy.html` | Standalone Version 1 QR generator plus image/camera scanning. |
| `qr_app.html` | QR Studio page with the same general interface. |

---

## Technical Architecture

### 1. Spatial-Domain LSB Insertion
An uncompressed RGBA pixel consists of four 8-bit channels:

$$\text{Pixel} = [R, G, B, A] \quad \text{where } R, G, B, A \in [0, 255]$$

Modifying the least significant bit ($b_0$) of an 8-bit channel alters its intensity by at most $\pm 1$:

$$\Delta I = |I_{\text{modified}} - I_{\text{original}}| \le 1$$

Across an 8-bit dynamic range, this modification induces a perceptual delta well below the human visual system's Just-Noticeable Difference (JND) threshold, rendering data embedding imperceptible under ambient viewing conditions.

### 2. Protected Payload Framing & Bit Packing
The steganography encoder uses a binary packet rather than a sentinel terminator:

* **Header:** `STG` magic bytes, format version, and a two-byte UTF-8 payload length.
* **Integrity:** CRC-16 over the header and payload.
* **Serialization:** Text is encoded as standards-based UTF-8 bytes.
* **Block protection:** Three payload bytes are combined with a CRC-8 byte and two GF(256) parity symbols, producing a six-symbol protected block.
* **Repair:** The decoder tests candidate symbol values and can repair one damaged symbol per block. Ambiguous or multiply damaged blocks are rejected.
* **Channel masking:** The alpha channel ($A$) is skipped during insertion to prevent unwanted transparency side effects in browser rendering engines.

The finite-field arithmetic uses the primitive polynomial $x^8+x^4+x^3+x^2+1$ (`0x11d`).

### 3. Standalone Version 1 QR Generation
`qr_app copy.html` contains a self-contained QR encoder for **Version 1**, whose data matrix is 21 × 21 modules. It performs the core QR construction steps directly in JavaScript:

* UTF-8 byte-mode encoding with mode and character-count indicators.
* Reed–Solomon error-correction codewords over GF(256).
* Finder patterns, separators, timing patterns, quiet zone, and the fixed dark module.
* BCH-protected format information for the selected error-correction level and mask.
* All eight QR data masks and ISO-style penalty scoring to select the most readable mask.
* Canvas rendering and PNG download at the selected image size.

The generator does not use `qrcode.js` or another QR-generation package. QR image and camera scanning continue to use the `jsQR` browser library.

#### Version 1 byte-mode capacity

Because this implementation deliberately generates Version 1 symbols only, the maximum payload depends on the selected correction level:

| Level | Approximate recovery | Maximum UTF-8 bytes |
| :--- | :---: | ---: |
| L | 7% | 17 |
| M | 15% | 14 |
| Q | 25% | 11 |
| H | 30% | 7 |

Messages larger than the selected capacity are rejected instead of producing an invalid QR code. Numeric, alphanumeric, Kanji, multi-version, and alignment-pattern optimizations are not currently implemented.

---

## Limitations & Engineering Trade-offs

| Dimension | Standard QR Code | StegoCode (Spatial LSB) |
| :--- | :--- | :--- |
| **Visual Distortion** | High (Monochrome grid artifacts) | Zero (Perceptually lossless) |
| **Compression Resilience** | High (Reed-Solomon ECC improves recovery) | Low (Lossy compression destroys $b_0$) |
| **Camera Recapture (Print-to-Scan)** | Native (Deskewing via corner finder targets) | Requires spatial synchronization / DWT |
| **Format Requirement** | Any visual medium | Lossless raster only (PNG, BMP, WebP-lossless) |

Additional limitations:

* LSB data should be encoded and decoded through a lossless image path. JPEG and other lossy transformations can change the embedded bits.
* The protected decoder corrects at most one damaged symbol in each six-symbol block; it does not guarantee recovery from arbitrary corruption.
* QR Version 1 capacity is intentionally small. Use a larger, standards-complete QR implementation when encoding longer content.

## Basic Usage

### Protected image messages

1. Open `stego_app.html` in a modern browser.
2. Select a lossless PNG, BMP, or lossless WebP image.
3. Enter text and choose **Encode & Download Image**.
4. Upload the resulting image in the reader section to verify or repair the hidden message.

### QR codes

1. Open `qr_app copy.html` in a modern browser.
2. Enter a short UTF-8 message or URL.
3. Select the image size and QR correction level.
4. Generate and download the 21 × 21 Version 1 symbol.
5. Use the scan panel to decode a QR image or camera view. Camera access requires browser permission and a secure context such as HTTPS or localhost.

## Validation

The raw QR generator has been checked for JavaScript syntax, 21 × 21 matrix construction, format information for all eight masks, capacity enforcement, and independent decoding with OpenCV. The protected steganography codec has been checked for clean UTF-8 round trips, single-symbol repair, and rejection of multiply corrupted blocks.

---

