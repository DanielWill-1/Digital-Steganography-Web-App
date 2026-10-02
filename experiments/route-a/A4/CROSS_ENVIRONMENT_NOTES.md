# A4 — Cross-Environment Notes

Actual outcomes only. Untested environments are marked `NOT TESTED` and are not claimed.

| Environment / concern | Status | Evidence / notes |
| :--- | :--- | :--- |
| `file://` direct open | **PASS** | All A4 pages use classic `<script src>` files (no ES modules), so there is no `file://` CORS issue. Verified there are no `type="module"` tags. |
| `localhost` (static server) | **PASS** | `python -m http.server` served `experiment-a4.html`, `physical-test-recorder.html`, `js/operating-points.js`, and `third_party/jsQR/jsQR.min.js` with HTTP 200. |
| Chromium / Chrome | **NOT TESTED** | No browser automation available in this environment. |
| Firefox | **NOT TESTED** | — |
| Edge / Opera | **NOT TESTED** | — |
| Safari | **NOT TESTED** | Not available on Windows. |
| Windows (this machine) | **PASS** | Node/Python/OpenCV pipeline run here. |
| Linux | **NOT TESTED** | — |
| Node.js | **PASS** | v22.12.0 (recorded in `results/a4_manifest.json`). |
| Python | **PASS** | 3.11.0. |
| OpenCV `QRCodeDetector` | **PASS** | 4.12.0. |
| jsQR | **PASS** | Pinned 1.4.0 under `third_party/jsQR/` (sha256 in `VERSION`); vendored load works offline and from `file://`, with a documented CDN fallback. |
| Target normalisation reproducibility | **PASS (Node)** | Canonical 21×21 matrices; fixture PNGs normalise back to the same matrices (A4 test). Cross-browser canvas resampling comparison is **NOT TESTED** (no browsers); the benchmark therefore uses the canonical matrices directly. |
| Cross-platform paths | **PASS** | Python uses `pathlib`, Node uses `path`; tested under Windows paths with spaces. |
| CSV / JSON integrity | **PASS** | Escaping tested for commas, quotes, newlines, and non-ASCII; timestamps are ISO-8601. |
| Downloads (candidate PNG, CSV, JSON) | **NOT TESTED** | Implemented via object URLs/`toDataURL`; not exercised in a browser here. |
| Mobile layout (recorder / screen test) | **NOT TESTED** | Responsive layout implemented; not exercised on a device. |
| Browser camera (`getUserMedia`) | **NOT TESTED** | Optional recorder feature; requires a secure context (HTTPS/localhost). Errors are reported clearly and tracks are stopped on stop/reset/unload. |
| Object-URL cleanup | **PASS (A4 pages)** | A4 pages revoke the previous object URL when a file is replaced. A1–A3 previews have a small unrevoked-URL leak, left unchanged deliberately (frozen experiments). |
| Duplicate element ids | **PASS** | No duplicate ids in the A4 pages. |
| JS syntax | **PASS** | All A4 `.js` files and page scripts parse (`node --check`). |

## Not claimed

- No universal browser compatibility is claimed.
- No mobile-device behaviour is claimed.
- No camera/secure-context success is claimed (only the error handling and cleanup paths are verified by construction).

Cross-browser functional testing, mobile testing, and camera capture remain open items for a
future pass with the relevant devices.
