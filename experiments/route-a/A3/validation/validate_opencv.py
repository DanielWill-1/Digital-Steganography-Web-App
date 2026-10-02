#!/usr/bin/env python3
"""Independent OpenCV validation for A3 clean candidates.

Decodes the A3 clean candidate PNGs (A2 baseline + A3 packed + codeword-budget) with
OpenCV's QRCodeDetector and merges the outcome into A3's clean_results.csv, so each
candidate carries both decoders' verdicts.

Run after `node tests/run-default-experiment.js`.

Usage
-----
    python validation/validate_opencv.py

Detection is not decoding: a candidate counts as correct only when the decoded payload
equals the expected payload exactly.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

try:
    import cv2  # type: ignore
except ImportError:
    sys.stderr.write(
        "OpenCV is not installed. Install it yourself, e.g. `python -m pip install opencv-python`.\n"
    )
    sys.exit(2)


def parse_args() -> argparse.Namespace:
    here = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Validate A3 clean candidates with OpenCV.")
    parser.add_argument("--a3-dir", type=Path, default=here, help="A3 experiment directory.")
    parser.add_argument("--expected", default=None, help="Override expected payload.")
    return parser.parse_args()


def decode(path: Path, detector: "cv2.QRCodeDetector"):
    image = cv2.imread(str(path))
    if image is None:
        return False, "", "unreadable"
    try:
        payload, points, _ = detector.detectAndDecode(image)
    except cv2.error as error:  # pragma: no cover
        return False, "", f"OpenCV error: {error}"
    return (points is not None and len(points) > 0), (payload or ""), ""


def status(detected: bool, payload: str, expected: str | None, error: str) -> str:
    if error:
        return "DECODER_ERROR"
    if not detected:
        return "NO_DETECTION"
    if expected is None:
        return "DETECTED"
    return "EXACT" if payload == expected else "WRONG_PAYLOAD"


def main() -> int:
    args = parse_args()
    results_dir = args.a3_dir / "results"
    outputs_dir = args.a3_dir / "outputs"
    manifest_path = results_dir / "manifest.json"
    clean_path = results_dir / "clean_results.csv"
    if not clean_path.is_file():
        sys.stderr.write(f"Missing {clean_path}. Run `node tests/run-default-experiment.js` first.\n")
        return 2

    expected = args.expected
    if expected is None and manifest_path.is_file():
        expected = json.loads(manifest_path.read_text(encoding="utf-8")).get("payload")

    with clean_path.open(newline="", encoding="utf-8") as handle:
        clean_rows = list(csv.DictReader(handle))

    detector = cv2.QRCodeDetector()
    opencv_by_file: dict[str, dict] = {}
    for row in clean_rows:
        name = row["candidate_filename"]
        detected, payload, error = decode(outputs_dir / name, detector)
        opencv_by_file[name] = {
            "opencv_detected": str(detected).lower(),
            "opencv_payload": payload,
            "opencv_payload_correct": str(status(detected, payload, expected, error) == "EXACT").lower(),
            "opencv_decode_status": status(detected, payload, expected, error),
        }

    merged = []
    for row in clean_rows:
        merged.append({**row, **opencv_by_file.get(row["candidate_filename"], {})})

    merged_path = results_dir / "results_with_opencv.csv"
    with merged_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(merged[0].keys()))
        writer.writeheader()
        writer.writerows(merged)

    exact = sum(1 for v in opencv_by_file.values() if v["opencv_decode_status"] == "EXACT")
    print(f"OpenCV {cv2.__version__}: {exact}/{len(clean_rows)} clean candidates decoded exactly")
    print(f"wrote {merged_path}")

    # A3-PACKED boundary with BOTH decoders.
    a3 = [r for r in merged if r["strategy"] == "A3_PACKED"]
    both = [r for r in a3 if r.get("jsqr_decode_status") == "EXACT" and r.get("opencv_decode_status") == "EXACT"]
    if both:
        best = max(both, key=lambda r: int(r["module_budget"]))
        print("\nA3 clean boundary (both decoders exact):")
        print(f"  largest both-exact module budget: {best['module_budget']}")
        print(f"  similarity:                       {best['full_similarity_after']}")
        print(f"  affected codewords:               {best['affected_codeword_count']}")
        print(f"  candidate:                        {best['candidate_id']}")
    else:
        print("no A3 candidate decoded exactly under both decoders")

    # Fill the a3_opencv_exact column in strategy_comparison.csv now that we have OpenCV.
    strategy_path = results_dir / "strategy_comparison.csv"
    if strategy_path.is_file():
        a3_status = {
            (r["base_ecc"], r["base_mask"], r["module_budget"]): r.get("opencv_decode_status")
            for r in merged if r["strategy"] == "A3_PACKED"
        }
        with strategy_path.open(newline="", encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        for row in rows:
            key = (row["base_ecc"], row["base_mask"], row["module_budget"])
            row["a3_opencv_exact"] = str(a3_status.get(key) == "EXACT").lower()
        with strategy_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        print(f"updated {strategy_path} with OpenCV verdicts")

    # Codeword-budget candidates too.
    cw_path = results_dir / "codeword_budget_results.csv"
    if cw_path.is_file():
        with cw_path.open(newline="", encoding="utf-8") as handle:
            cw_rows = list(csv.DictReader(handle))
        cw_exact = []
        for row in cw_rows:
            detected, payload, error = decode(outputs_dir / row["candidate_filename"], detector)
            row["opencv_decode_status"] = status(detected, payload, expected, error)
            cw_exact.append(row)
        with cw_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(cw_exact[0].keys()))
            writer.writeheader()
            writer.writerows(cw_exact)
        both_cw = [r for r in cw_exact if r.get("jsqr_decode_status") == "EXACT" and r.get("opencv_decode_status") == "EXACT"]
        if both_cw:
            best_k = max(both_cw, key=lambda r: int(r["codeword_budget"]))
            print(f"codeword-budget largest both-exact K: {best_k['codeword_budget']} "
                  f"({best_k['actual_modified_modules']} modules, similarity {best_k['full_similarity_after']})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
