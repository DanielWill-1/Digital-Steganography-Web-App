#!/usr/bin/env python3
"""A4 OpenCV validation for the generalization candidates.

Decodes the A4 generalization candidate PNGs (A3 packed + A1 base) with OpenCV and merges
the verdicts, so `A3_CLEAN_MAX` can later be computed as "both decoders exact".

Run after `node tests/run-generalization.js` and `node tests/run-a2-matched.js`.

Usage: python validation/validate_opencv.py
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

try:
    import cv2  # type: ignore
except ImportError:
    sys.stderr.write("OpenCV is not installed; `pip install opencv-python` yourself.\n")
    sys.exit(2)


def parse_args():
    here = Path(__file__).resolve().parent.parent
    p = argparse.ArgumentParser(description="A4 OpenCV validation.")
    p.add_argument("--a4-dir", type=Path, default=here)
    return p.parse_args()


def status(detected: bool, payload: str, expected: str, error: str) -> str:
    if error:
        return "DECODER_ERROR"
    if not detected:
        return "NO_DETECTION"
    return "EXACT" if payload == expected else "WRONG_PAYLOAD"


def decode(detector, path: Path):
    image = cv2.imread(str(path))
    if image is None:
        return False, "", "unreadable"
    try:
        payload, points, _ = detector.detectAndDecode(image)
    except cv2.error as error:  # pragma: no cover
        return False, "", f"OpenCV error: {error}"
    return (points is not None and len(points) > 0), (payload or ""), ""


def merge_file(detector, gen_dir: Path, csv_path: Path, out_path: Path, filename_col: str, payload_col: str) -> int:
    with csv_path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    exact = 0
    for row in rows:
        detected, payload, error = decode(detector, gen_dir / row[filename_col])
        row["opencv_detected"] = str(detected).lower()
        row["opencv_payload"] = payload
        row["opencv_decode_status"] = status(detected, payload, row[payload_col], error)
        row["opencv_payload_correct"] = str(row["opencv_decode_status"] == "EXACT").lower()
        if row["opencv_decode_status"] == "EXACT":
            exact += 1
    with out_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return exact, len(rows)


def main() -> int:
    args = parse_args()
    results = args.a4_dir / "results"
    gen = args.a4_dir / "outputs" / "gen"
    detector = cv2.QRCodeDetector()

    cand = results / "generalization_candidates.csv"
    if cand.is_file():
        exact, total = merge_file(detector, gen, cand, results / "generalization_candidates_with_opencv.csv", "candidate_filename", "payload")
        print(f"A3 candidates: OpenCV exact {exact}/{total} -> generalization_candidates_with_opencv.csv")
    else:
        sys.stderr.write("missing generalization_candidates.csv; run node tests/run-generalization.js first\n")
        return 2

    conf = results / "generalization_configs.csv"
    if conf.is_file():
        exact, total = merge_file(detector, gen, conf, results / "generalization_bases_with_opencv.csv", "base_filename", "payload")
        print(f"A1 bases:      OpenCV exact {exact}/{total} -> generalization_bases_with_opencv.csv")

    a2 = results / "a2_matched.csv"
    if a2.is_file():
        exact, total = merge_file(detector, gen, a2, results / "a2_matched_with_opencv.csv", "candidate_filename", "payload")
        print(f"A2 matched:    OpenCV exact {exact}/{total} -> a2_matched_with_opencv.csv")

    print(f"OpenCV {cv2.__version__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
