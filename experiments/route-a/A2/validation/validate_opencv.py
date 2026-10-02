#!/usr/bin/env python3
"""Independent OpenCV validation for Experiment A2.

Decodes the generated A2 candidate PNGs with OpenCV's QRCodeDetector — a different decoder
lineage from jsQR — and, when A2's results.csv is present, merges the OpenCV outcome back in
so each trial carries both decoders' verdicts.

This is a local script only; there is no HTTP backend, and the browser UI never needs it.

Usage
-----
    python validation/validate_opencv.py
    python validation/validate_opencv.py --expected "g.co"

By default it reads the A2 directory it lives in (`../`), using `results/manifest.json` to
learn the payload and the exact candidate list. If OpenCV is not installed the script exits
with a clear instruction; it never installs anything.

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
        "OpenCV is not installed. Install it yourself, for example:\n"
        "    python -m pip install opencv-python\n"
        "This script does not install dependencies automatically.\n"
    )
    sys.exit(2)


def parse_args() -> argparse.Namespace:
    here = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Validate A2 candidate PNGs with OpenCV.")
    parser.add_argument("--a2-dir", type=Path, default=here, help="A2 experiment directory.")
    parser.add_argument("--expected", default=None, help="Override the expected payload.")
    parser.add_argument("--outputs", default="outputs", help="Candidate PNG directory (relative to a2-dir).")
    parser.add_argument("--csv", default="opencv_results.csv", help="OpenCV CSV filename under results/.")
    parser.add_argument("--merged", default="results_with_opencv.csv", help="Merged CSV filename under results/.")
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


def classify(detected: bool, payload: str, expected: str | None, error: str) -> str:
    if error:
        return "DECODER_ERROR"
    if not detected:
        return "NO_DETECTION"
    if expected is None:
        return "DETECTED"
    return "EXACT" if payload == expected else "WRONG_PAYLOAD"


def main() -> int:
    args = parse_args()
    a2_dir: Path = args.a2_dir
    results_dir = a2_dir / "results"
    outputs_dir = a2_dir / args.outputs
    if not outputs_dir.is_dir():
        sys.stderr.write(f"No outputs directory: {outputs_dir}\nGenerate candidates first.\n")
        return 2

    manifest_path = results_dir / "manifest.json"
    expected = args.expected
    filenames: list[str] = []
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if expected is None:
            expected = manifest.get("payload")
        filenames = [trial["candidate_filename"] for trial in manifest.get("trials", [])]
        print(f"using manifest: {manifest.get('payload')!r}, {len(filenames)} scheduled trials")
    if not filenames:
        filenames = sorted(p.name for p in outputs_dir.glob("A2_*.png"))
        print(f"no manifest trials; globbed {len(filenames)} candidate PNGs")

    detector = cv2.QRCodeDetector()
    rows = []
    for name in filenames:
        path = outputs_dir / name
        if not path.is_file():
            rows.append({
                "candidate_filename": name,
                "opencv_detected": "false",
                "opencv_payload": "",
                "opencv_payload_correct": "false",
                "opencv_decode_status": "NO_FILE",
            })
            continue
        detected, payload, error = decode(path, detector)
        status = classify(detected, payload, expected, error)
        rows.append({
            "candidate_filename": name,
            "opencv_detected": str(detected).lower(),
            "opencv_payload": payload,
            "opencv_payload_correct": str(status == "EXACT").lower(),
            "opencv_decode_status": status,
        })

    results_dir.mkdir(parents=True, exist_ok=True)
    opencv_csv = results_dir / args.csv
    with opencv_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "candidate_filename", "opencv_detected", "opencv_payload",
            "opencv_payload_correct", "opencv_decode_status",
        ])
        writer.writeheader()
        writer.writerows(rows)

    exact = sum(1 for row in rows if row["opencv_decode_status"] == "EXACT")
    detected = sum(1 for row in rows if row["opencv_detected"] == "true")
    print(f"OpenCV {cv2.__version__}: detected {detected}/{len(rows)}, exact {exact}/{len(rows)}"
          + (f" (expected {expected!r})" if expected is not None else ""))
    print(f"wrote {opencv_csv}")

    # Merge with the jsQR results if present.
    jsqr_csv = results_dir / "results.csv"
    if jsqr_csv.is_file():
        with jsqr_csv.open(newline="", encoding="utf-8") as handle:
            js_rows = list(csv.DictReader(handle))
        by_name = {row["candidate_filename"]: row for row in rows}
        merged = []
        for js_row in js_rows:
            opencv = by_name.get(js_row.get("candidate_filename", ""), {})
            merged.append({
                **js_row,
                "opencv_detected": opencv.get("opencv_detected", ""),
                "opencv_payload": opencv.get("opencv_payload", ""),
                "opencv_payload_correct": opencv.get("opencv_payload_correct", ""),
                "opencv_decode_status": opencv.get("opencv_decode_status", ""),
            })
        merged_csv = results_dir / args.merged
        fieldnames = list(merged[0].keys()) if merged else []
        with merged_csv.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(merged)
        print(f"wrote {merged_csv} ({len(merged)} merged rows)")
        _report_observations(merged)
    else:
        print("results.csv not found — skipping merge and budget observations")

    return 0


def _report_observations(merged: list[dict]) -> None:
    """Print the OpenCV-exact rate per budget and simple failure observations."""
    budgets: dict[int, list[dict]] = {}
    for row in merged:
        try:
            budget = int(row["budget"])
        except (KeyError, ValueError):
            continue
        budgets.setdefault(budget, []).append(row)

    print("\nOpenCV exact rate by budget:")
    print("  budget  exact/total")
    for budget in sorted(budgets):
        group = budgets[budget]
        exact = sum(1 for row in group if row.get("opencv_decode_status") == "EXACT")
        print(f"  {budget:^6}  {exact}/{len(group)}")

    failed = [int(r["budget"]) for r in merged if r.get("opencv_decode_status") not in ("EXACT", "", None)]
    exact_budgets = [int(r["budget"]) for r in merged if r.get("opencv_decode_status") == "EXACT"]
    first_failure = min(failed) if failed else None
    largest_success = max(exact_budgets) if exact_budgets else None

    sustained = None
    for budget in sorted(budgets):
        group = [r for b, rows in budgets.items() if b >= budget for r in rows]
        if group and all(r.get("opencv_decode_status") not in ("EXACT", "", None) for r in group):
            sustained = budget
            break

    print("\nOpenCV failure observations (observations, not theoretical limits):")
    print(f"  first observed failure budget:      {first_failure}")
    print(f"  largest successful tested budget:   {largest_success}")
    print(f"  observed sustained failure budget:  {sustained}")


if __name__ == "__main__":
    raise SystemExit(main())
