# Terminology

Definitions as used *by this project*. Where a term is used loosely in general
discussion, the distinction is called out explicitly, because several of these
distinctions are exactly the ones that future work is most likely to blur.

---

## The four distinctions that matter most

```text
encryption       ≠  encoding
steganography    ≠  QR representation
watermarking     ≠  steganography
detection        ≠  decoding
```

1. **Encryption vs encoding.** Encoding changes the *form* of data so a machine can read
   it. Encryption changes the *readability* of data so an unauthorised party cannot.
   Base64 is encoding. AES-GCM is encryption. QR byte mode is encoding.
2. **Steganography vs QR representation.** A QR code is an overt, visible, intentionally
   machine-readable pattern. Steganography hides the existence of the message. A QR code
   is not hidden; that is its purpose.
3. **Watermarking vs steganography.** A watermark's primary goal is usually robustness
   and provenance; the embedded data may be entirely public and its presence may be
   acknowledged. A steganographic payload's primary goal is concealment of existence.
4. **Detection vs decoding.** A decoder can locate a symbol without recovering its
   content. Only exact payload recovery counts as a successful decode in this project.

---

## Core terms

**Steganography**
Hiding the existence of a message inside a carrier so that an observer does not know a
message is present. StegoCode's LSB codec is steganographic; its QR work is not.

**Watermarking**
Embedding information in a carrier primarily for provenance, ownership, or integrity,
usually accepting that the presence of the mark is known. Robustness typically matters
more than concealment. Related to, but distinct from, steganography.

**Encryption**
Transforming data so that only holders of a key can recover it. Provides
confidentiality. StegoCode implements no encryption. Nothing in this repository provides
confidentiality.

**Encoding**
Representing data in a different form so a machine can read or transport it. Provides no
confidentiality. QR byte mode and the `STG` packet framing are encodings.

**Error correction**
Redundant data added to a payload so that a decoder can detect and, within limits, repair
damage. In this project it appears in two unrelated places: Reed–Solomon codewords in the
QR encoder, and CRC-8 plus GF(256) parity in the LSB codec's protected blocks.

**Reed–Solomon (RS)**
A block error-correcting code over a finite field. A systematic RS code with *k* data
symbols and *n − k* parity symbols can correct up to `floor((n − k) / 2)` symbol errors,
where a symbol error is any damage to a whole symbol regardless of how many bits changed.

**GF(256)**
The finite field of 256 elements used for Reed–Solomon and parity arithmetic in this
project. Both implementations use the primitive polynomial `x⁸ + x⁴ + x³ + x² + 1`,
written `0x11d` — the same field QR uses. Multiplication is done through log/antilog
tables.

**QR module**
One square cell of a QR symbol. A Version 1 symbol is 21 × 21 = 441 modules. A module is
the smallest visual unit and carries one bit.

**QR codeword**
Eight modules' worth of data, i.e. one byte, treated as a single error-correction symbol.
A Version 1 symbol carries 26 codewords. This is the unit Reed–Solomon operates on, and
it is *not* the same as a module: damage to one module damages one codeword, but one
codeword spans eight modules spread across the matrix.

**Finder pattern**
The three 7 × 7 nested-square markers at three corners of a QR symbol, used by scanners
for location and orientation. Immutable structure.

**Separator**
The one-module-wide light border around each finder pattern, keeping it visually
distinct from the data region. Immutable structure.

**Timing pattern**
The alternating dark/light line running between the finder patterns along row 6 and
column 6, used to establish the module grid. Immutable structure.

**Quiet zone**
The blank margin around a QR symbol, four modules wide in this implementation. Required
for reliable scanning. Not part of the 21 × 21 matrix.

**Mask**
One of eight fixed, reversible transformations XORed over the data modules of a QR symbol
to break up large runs of identical modules and improve scanner readability. The mask
used is recorded in the format information so a decoder can undo it.

**Error-correction level**
The amount of Reed–Solomon redundancy in a QR symbol, selected from L (≈7%), M (≈15%),
Q (≈25%), and H (≈30%). Higher levels survive more damage and reduce payload capacity.

**Optical code**
Any machine-readable visual pattern intended to be captured by a camera or scanner — QR,
Data Matrix, Aztec, barcode, or a custom design. Routes A and B produce optical codes.
Route C does not.

**Visual similarity**
A measured agreement between a generated symbol and a target image, computed over a
defined set of positions. Always report the denominator and the metric definition.

**Mutable module**
A module that is not required by QR structure and could in principle be changed while the
symbol remains valid — in practice, a data or ECC module within the error-correction
budget.

**Immutable / function module**
A module whose value is fixed by QR structure: finder, separator, timing, format
information, and the fixed dark module. Changing one does not degrade readability
gracefully; it breaks the symbol's definition. No Route A experiment may modify these.

**Payload**
The actual data being carried. In this project the payload is UTF-8 text. In the LSB
codec, the payload is the part of the packet after the 8-byte header; in the QR work, it
is the byte-mode data stream.

**Target logo**
The image a candidate symbol is being pushed toward. In `A1` the target is normalised to
a deterministic 21 × 21 binary matrix so it is comparable to a QR matrix.

**Decoder robustness**
How well a symbol continues to decode after real-world degradation — scaling, blur,
noise, compression, perspective, obstruction, uneven lighting, or physical
print-and-capture. Distinct from digital decodability, and measured separately.

---

## Project-specific terms

**Protected block**
The LSB codec's unit of redundancy: three payload bytes, one CRC-8 byte, and two GF(256)
parity symbols, forming a six-symbol codeword. One damaged symbol per block is
repairable.

**Packet**
The LSB codec's framing: `STG` magic, format version, two-byte payload length, CRC-16,
then the UTF-8 payload. Its purpose is to make a decode self-validating rather than
guesswork.

**Role map**
A matrix parallel to a QR bit matrix recording what each module *is* — `FINDER`,
`SEPARATOR`, `TIMING`, `FORMAT`, `DARK_MODULE`, `DATA`, `ECC`, `REMAINDER`. The role map
keeps immutable structure from being mistaken for modifiable data. It does not exist in
the current code; it is required before `A1`.

**Candidate**
One generated QR symbol under evaluation — in `A1`, one specific combination of
error-correction level and mask for a fixed payload. `4 × 8 = 32` candidates for a
payload that fits all four levels.

**Theoretical similarity ceiling**
The highest similarity achievable if every mutable module matched the target while all
immutable structure stayed as QR requires. It bounds how good a target can ever look as a
valid QR symbol, and lets different logos be compared fairly.

**Fixed-module conflict count**
The number of positions where the target requests one module state but QR structure
requires the other. A direct measure of how incompatible a given target is with QR
geometry, before any modification is attempted.

**Error budget**
The amount of damage a symbol's error correction can absorb, expressed in affected
Reed–Solomon codewords rather than in flipped modules. The distinction matters because
flipping two modules inside one codeword costs one codeword's worth of budget, while
flipping two modules in two different codewords costs two.

**Synthetic robustness testing**
Applying controlled, reproducible transformations to a generated symbol in software, as
opposed to capturing it with a camera. Repeatable and parameterisable; `A4`.

**Physical camera testing**
Capturing a symbol from a screen or print with a real camera under real conditions; this is
Route A's A4.2 phase (physical validation), whose data is still pending. Digital/synthetic and
physical results must never be merged.
