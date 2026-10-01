# Current Implementation

This document describes what the repository's code actually does, as inspected from
source. It is the factual companion to [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) and
the baseline that the technical notes expand on:

- [`QR_V1_TECHNICAL_NOTES.md`](QR_V1_TECHNICAL_NOTES.md) — the standalone Version 1 QR
  encoder, function by function.
- [`STEGANOGRAPHY_TECHNICAL_NOTES.md`](STEGANOGRAPHY_TECHNICAL_NOTES.md) — the protected
  LSB codec, function by function.

---

## Inventory

| Path | Type | Lines | Tracked in Git |
| :--- | :--- | ---: | :--- |
| `stego_app.html` | HTML + inline CSS + inline JS | 356 | yes |
| `qr_app.html` | HTML + inline CSS + inline JS | 479 | yes |
| `qr_app copy.html` | HTML + inline CSS + inline JS | 686 | yes |
| `readme.md` | Documentation | 117 | yes |
| `todo.md` | Historical scratch note | 18 | no (gitignored) |
| `prompt.md` | Documentation-phase task spec | 1424 | no (untracked) |
| `.gitattributes` | `* text=auto` (LF normalisation) | 2 | yes |
| `.gitignore` | `todo.md`, `*\todo.md` | 1 | yes |

There is no JavaScript module file, no stylesheet file, no image asset, no library
vendored into the repository, no test directory, and no build configuration. Every
application is a single self-contained HTML file.

Everything the applications need at runtime is either inline or loaded from a public CDN.

---

## Applications

### `stego_app.html` — protected image steganography

A single page with two panels:

1. **Encode** — file input for a host image, text input for the message, and an
   *Encode & Download Image* button.
2. **Read Protected Data** — file input for an encoded image and a *Read Hidden Data*
   button.

Both panels share one hidden `<canvas>` used to decode the source image into raw RGBA
pixels and to re-encode the output.

Flow, encode:

```text
text
  -> UTF-8 bytes
  -> framed packet (magic, version, length, CRC-16, payload)
  -> split into 3-byte groups, each expanded to a 6-symbol protected block
  -> bit stream (MSB first)
  -> LSB of every non-alpha byte of the raster, in raster order
  -> canvas.toDataURL('image/png') download as encoded_image.png
```

Flow, decode:

```text
image
  -> canvas -> RGBA raster
  -> read LSB of every non-alpha byte, in raster order
  -> group into 6-symbol blocks, repair up to one damaged symbol per block
  -> reassemble packet, verify CRC-16
  -> UTF-8 decode (fatal mode) -> payload text
```

The output is always PNG regardless of the input format. The alpha channel is never
modified. Capacity is checked before embedding and the operation is refused with a
message if the payload does not fit.

The status line reports how many blocks were repaired, so a successful decode of a
damaged image is visibly distinguishable from a clean one.

### `qr_app copy.html` — standalone Version 1 QR encoder + scanner

The same two-tab shell (Generate / Scan) as `qr_app.html`, but the generator is a
from-scratch Version 1 QR encoder and the `qrcodejs` script tag is absent.

Flow, generate:

```text
text
  -> UTF-8 bytes
  -> byte-mode bit stream (mode indicator, 8-bit length, data)
  -> terminator + byte alignment + pad codewords
  -> Reed-Solomon ECC codewords over GF(256)
  -> 21x21 matrix: finders, separators, timing, dark module, format info, data
  -> all eight masks built, ISO-style penalty scored, lowest penalty kept
  -> canvas rendering with a four-module quiet zone
  -> PNG download as stegocode-qr.png
```

Flow, scan:

```text
uploaded image or camera frame
  -> drawn to a hidden canvas (uploaded images downscaled to at most 1600 px)
  -> ImageData passed to jsQR with inversionAttempts: 'attemptBoth'
  -> decoded text shown, with an "Open link" button when it looks like a URL
```

The generator refuses payloads that exceed the Version 1 capacity for the selected
correction level, with an explicit message naming the limit.

### `qr_app.html` — library-based QR page

Structurally identical to `qr_app copy.html` minus the in-repo encoder. Generation is
delegated to `qrcodejs` (`new QRCode(element, {...})`), which internally chooses its own
QR version and can therefore encode longer payloads than the Version 1 encoder.

Scanning code is byte-for-byte the same approach as `qr_app copy.html`.

---

## The two QR pages

The prompt for this documentation phase asked whether `qr_app copy.html` differs from
`qr_app.html` and to document the difference. It does. The complete set of differences
is small and is reproduced here in full.

| Aspect | `qr_app.html` | `qr_app copy.html` |
| :--- | :--- | :--- |
| QR generation | `qrcodejs` 1.0.0 from cdnjs | In-repo encoder, no QR library |
| Extra `<script src>` | `qrcodejs`, `jsQR` | `jsQR` only |
| Generator description text | "Add a link, contact detail, or short note…" | "Create a genuine Version 1 QR symbol from scratch…" |
| Character counter | `N / 2000 characters` | `N UTF-8 bytes` |
| Version control | Library selects the version | Version 1 only, enforced |
| Capacity handling | Library decides | Explicit rejection with the byte limit |
| Generate status message | "QR code ready to share." | "Version 1 (21×21) QR code ready. Reed-Solomon parity and mask selection applied." |
| `downloadQr()` | Handles both canvas and `<img>` output | Same code; the `<img>` branch is unreachable |
| Lines | 479 | 686 |

Everything else — layout, CSS, tabs, scanning, camera handling, clipboard, result panel —
is identical. The diff between the two files is confined to: two text strings, one
`<script src>` line, the `updateCount()` body, the whole QR encoder block, and the body
of `generateQr()`.

**Conclusion:** `qr_app copy.html` is not a stale backup. It is the newer and more
significant implementation — the one that contains the encoder the research depends on.
Both files are kept in place, unrenamed and unmodified.

The name `qr_app copy.html` (with a space) is a filesystem artefact of how the file was
created. It is retained because renaming tracked files carries risk on a
case-insensitive, OneDrive-synced working tree and the prompt for this phase explicitly
preferred preservation over tidiness. Any future rename should be done as a deliberate
change with the corresponding documentation updates, not as drive-by cleanup.

---

## External dependencies

| Dependency | Version | Loaded by | Purpose |
| :--- | :--- | :--- | :--- |
| `jsQR` | 1.4.0 | `qr_app.html`, `qr_app copy.html` | QR detection and decoding from ImageData |
| `qrcodejs` | 1.0.0 | `qr_app.html` | QR generation (not used by `qr_app copy.html`) |

Both are loaded from public CDNs at page load. No dependency is vendored, bundled, or
version-pinned beyond the URL. No package manifest exists.

`stego_app.html` has no external dependency of any kind.

---

## Network behaviour

Verified by inspecting the source for `fetch`, `XMLHttpRequest`, `sendBeacon`,
`WebSocket`, `EventSource`, `import()`, and dynamic script injection. **No such call
exists in any of the three applications.**

The only network activity is the CDN `<script src>` tags listed above. Consequences:

- **Application data never leaves the browser.** Uploaded images, typed payloads, camera
  frames, and decoded results are processed in-page and are not transmitted by the
  application.
- **Third-party code is fetched remotely.** Opening `qr_app.html` or `qr_app copy.html`
  causes requests to `cdnjs.cloudflare.com` and/or `cdn.jsdelivr.net`, which means the
  CDN operators observe the page load (IP address, user agent, referrer). That is a
  supply-chain and privacy consideration distinct from data upload, and it is also a
  reliability consideration: if the CDN is unreachable, scanning fails and generation in
  `qr_app.html` fails. Both pages handle this with an explicit error message.
- **`stego_app.html` makes no network request at all.**

Camera frames are drawn to a local canvas and passed directly to `jsQR` as `ImageData`.
No frame is stored, transmitted, or written to disk.

---

## Browser APIs used

| API | Where | Why |
| :--- | :--- | :--- |
| `TextEncoder` / `TextDecoder` | both apps | UTF-8 byte conversion (stego decoder uses `fatal: true`) |
| `CanvasRenderingContext2D` | both apps | raster access; `willReadFrequently: true` on the scan canvas |
| `ImageData` | both apps | direct pixel read/write |
| `URL.createObjectURL` / `revokeObjectURL` | both apps | loading user-selected files |
| `canvas.toDataURL('image/png')` | both apps | PNG output and download |
| `navigator.clipboard.writeText` | QR pages | copy content and copy result |
| `navigator.mediaDevices.getUserMedia` | QR pages | camera capture |
| `requestAnimationFrame` / `cancelAnimationFrame` | QR pages | camera scan loop |
| `alert()` | `stego_app.html` | encode-side error reporting |

No storage API is used. Nothing is persisted between sessions.

---

## Git state at the time of this documentation pass

```text
branch:  main
head:    4b6b180  feat: implement raw Version 1 QR encoding and Reed-Solomon stego repair
history: 4b6b180, d0e5638 (tst), f52e929 (Initial commit)
tags:    none
```

Working tree before this pass: `.gitignore` modified (an absolute-path ignore entry
replaced with a relative `*\todo.md` pattern), `prompt.md` untracked. Both were left as
they were.

No tag or preservation commit was created by this pass — the prompt recommended one but
did not require it, and the recommendation belongs to the repository owner. See
[`AGENT_CONTEXT.md`](AGENT_CONTEXT.md) for the suggested baseline name.

---

## Files that must not be casually rewritten

- `stego_app.html` — the protected codec is the subject of Route C and its framing is
  referenced by the technical notes. Changing the packet layout or the block structure
  breaks the documented format.
- `qr_app copy.html` — the in-repo Version 1 encoder is the baseline for every Route A
  experiment. `A0` exists specifically to freeze and validate it before any artistic
  modification. Rewriting it silently invalidates the A0 milestone.
- `qr_app.html` — a working page. It is historical relative to the encoder, but it is
  not dead code.

Any change to these three files should be a deliberate, documented decision, not a side
effect of another task.
