#!/usr/bin/env python3
"""Independent QR validation for Experiment A1 using OpenCV's QRCodeDetector.

This is the one non-browser utility A1 allows. It decodes generated candidate PNGs with a
different implementation lineage from jsQR, so a symbol that decodes in both is validated
by two independent decoders rather than one.

Usage
-----
    python validate_opencv.py ../outputs --expected "g.co"
    python validate_opencv.py ../outputs --expected "g.co" --csv opencv_results.csv

The script:
  1. accepts a directory of generated candidate PNG files,
  2. optionally accepts an expected payload,
  3. processes every matching candidate file,
  4. decodes each with OpenCV,
  5. records detection, the decoded payload, and whether it matches exactly,
  6. prints a summary,
  7. optionally writes opencv_results.csv (mergeable with the browser results).

If OpenCV is not installed the script exits with a clear instruction. It never installs
anything automatically.

Detection is not decoding: a candidate counts as correct only when the decoded payload
equals the expected payload exactly.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

try:
    import cv2  # type: ignore
except ImportError:
    sys.stderr.write(
        "OpenCV is not installed. Install it yourself, for example:\n"
        "    python -m pip install opencv-python\n"
        "This script does not install dependencies automatically.\n"
    )
    sys.exit(2)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate A1 candidate PNGs with OpenCV.")
    parser.add_argument("directory", type=Path, help="Directory containing candidate PNGs.")
    parser.add_argument("--expected", default=None, help="Expected payload for exact-match checks.")
    parser.add_argument("--pattern", default="A1_*.png", help="Glob pattern (default: A1_*.png).")
    parser.add_argument("--csv", dest="csv_path", type=Path, default=None,
                        help="Write opencv_results.csv to this path.")
    return parser.parse_args()


def decode(path: Path, detector: "cv2.QRCodeDetector"):
    image = cv2.imread(str(path))
    if image is None:
        return False, "", "image could not be read"
    try:
        payload, points, _ = detector.detectAndDecode(image)
    except cv2.error as error:  # pragma: no cover - depends on the OpenCV build
        return False, "", f"OpenCV error: {error}"
    detected = points is not None and len(points) > 0
    return detected, payload or "", ""


def main() -> int:
    args = parse_args()
    if not args.directory.is_dir():
        sys.stderr.write(f"Not a directory: {args.directory}\n")
        return 2

    files = sorted(args.directory.glob(args.pattern))
    if not files:
        sys.stderr.write(
            f"No files matching {args.pattern!r} in {args.directory}. "
            "Generate candidates first (run the default experiment or export the PNGs).\n"
        )
        return 2

    detector = cv2.QRCodeDetector()
    rows = []
    decoded_count = 0
    exact_count = 0

    for path in files:
        detected, payload, error = decode(path, detector)
        if detected:
            decoded_count += 1
        correct = bool(args.expected is not None and detected and payload == args.expected)
        if correct:
            exact_count += 1
        rows.append({
            "candidate_filename": path.name,
            "opencv_detected": str(detected).lower(),
            "opencv_payload": payload,
            "opencv_payload_correct": str(correct).lower() if args.expected is not None else "",
        })
        note = f" — {error}" if error else ""
        match = "MATCH" if correct else ("no exact match" if args.expected is not None else "detected" if detected else "NOT DETECTED")
        print(f"{path.name}: {match} payload={payload!r}{note}")

    print()
    print(f"OpenCV version: {cv2.__version__}")
    print(f"Files processed: {len(files)}")
    print(f"Detected:        {decoded_count} / {len(files)}")
    if args.expected is not None:
        print(f"Exact payload:   {exact_count} / {len(files)}  (expected {args.expected!r})")
    else:
        print("Exact payload:   not checked — pass --expected to enable exact-match validation")

    if args.csv_path is not None:
        with args.csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=["candidate_filename", "opencv_detected", "opencv_payload", "opencv_payload_correct"],
            )
            writer.writeheader()
            writer.writerows(rows)
        print(f"Wrote {args.csv_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
