#!/usr/bin/env python3
"""A4 synthetic robustness over generalization operating points.

Reuses A3's transform + OpenCV code as a single pipeline (imported, not copied) and applies
a documented CORE preset subset to a bounded candidate set per configuration:

  A1 base
  up to 3 highest-budget A3 packed candidates that were jsQR-exact
  the A2 matched candidate (seed 42, representative) where present

Transformed PNGs (shared by jsQR and OpenCV) go to outputs/robustness/ (git-ignored);
machine-readable results go to results/.

Run after validate_opencv.py.  Usage: python validation/synthetic_robustness.py
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True  # importing A3's transform module must not create __pycache__

try:
    import cv2  # type: ignore
except ImportError:
    sys.stderr.write("OpenCV is not installed; install it yourself.\n")
    sys.exit(2)

CORE_PRESET_IDS = ["PRISTINE", "RESIZE_6", "RESIZE_4", "BLUR_100", "JPEG_70", "JPEG_50", "ROT_M5", "ROT_P5", "PERSP_05", "PERSP_12"]
WHITE = (255, 255, 255)


def load_a3_transforms(a4_dir: Path):
    a3_script = a4_dir.parent / "A3" / "validation" / "synthetic_robustness.py"
    spec = importlib.util.spec_from_file_location("a3rob", a3_script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # module main() is guarded by __main__
    return module


def read_csv(path: Path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def select_candidates(results_dir: Path):
    configs = read_csv(results_dir / "generalization_configs.csv")
    candidates = read_csv(results_dir / "generalization_candidates.csv")
    a2_rows = []
    a2_path = results_dir / "a2_matched.csv"
    if a2_path.is_file():
        a2_rows = [r for r in read_csv(a2_path) if r["seed"] == "42"]

    selected = []
    for config in configs:
        selected.append({
            "candidate_id": config["config_id"] + "_A1base",
            "config_id": config["config_id"],
            "target_id": config["target_id"],
            "strategy": "A1_BASELINE",
            "payload": config["payload"],
            "ecc": config["ecc"],
            "module_budget": 0,
            "affected_codeword_count": 0,
            "similarity": float(config["a1_similarity"]),
            "file": config["base_filename"],
        })
        exact = [r for r in candidates if r["config_id"] == config["config_id"]
                 and r["jsqr_decode_status"] == "EXACT" and int(r["module_budget"]) > 0]
        exact.sort(key=lambda r: int(r["module_budget"]), reverse=True)
        for row in exact[:3]:
            selected.append({
                "candidate_id": row["candidate_filename"][:-4],
                "config_id": config["config_id"],
                "target_id": config["target_id"],
                "strategy": "A3_PACKED",
                "payload": config["payload"],
                "ecc": config["ecc"],
                "module_budget": int(row["module_budget"]),
                "affected_codeword_count": int(row["affected_codeword_count"] or 0),
                "similarity": float(row["full_similarity_after"]),
                "file": row["candidate_filename"],
            })
    for row in a2_rows:
        selected.append({
            "candidate_id": row["candidate_filename"][:-4],
            "config_id": row["config_id"],
            "target_id": row["target_id"],
            "strategy": "A2_RANDOM",
            "payload": row["payload"],
            "ecc": row["ecc"],
            "module_budget": int(row["module_budget"]),
            "affected_codeword_count": int(row["affected_codeword_count"] or 0),
            "similarity": float(row["full_similarity_after"]),
            "file": row["candidate_filename"],
        })
    return selected


def main() -> int:
    parser = argparse.ArgumentParser(description="A4 synthetic robustness.")
    parser.add_argument("--a4-dir", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    a4_dir: Path = args.a4_dir
    results_dir = a4_dir / "results"
    gen_dir = a4_dir / "outputs" / "gen"
    out_dir = a4_dir / "outputs" / "robustness"
    out_dir.mkdir(parents=True, exist_ok=True)

    a3 = load_a3_transforms(a4_dir)
    all_presets = {p["id"]: p for p in a3.build_presets()}
    presets = [all_presets[i] for i in CORE_PRESET_IDS]

    selected = select_candidates(results_dir)
    detector = cv2.QRCodeDetector()
    cases = []
    for candidate in selected:
        pristine = cv2.imread(str(gen_dir / candidate["file"]), cv2.IMREAD_COLOR)
        if pristine is None:
            continue
        for preset in presets:
            transformed = a3.apply_preset(pristine, preset)
            case_id = f"{candidate['candidate_id']}__{preset['id']}"
            png = out_dir / f"{case_id}.png"
            cv2.imwrite(str(png), transformed)
            try:
                payload, points, _ = detector.detectAndDecode(transformed)
            except cv2.error as error:  # pragma: no cover
                payload, points = "", None
            detected = points is not None and len(points) > 0
            ostatus = "NO_DETECTION" if not detected else ("EXACT" if payload == candidate["payload"] else "WRONG_PAYLOAD")
            cases.append({
                "case_id": case_id,
                "candidate_id": candidate["candidate_id"],
                "config_id": candidate["config_id"],
                "target_id": candidate["target_id"],
                "strategy": candidate["strategy"],
                "payload": candidate["payload"],
                "ecc": candidate["ecc"],
                "module_budget": candidate["module_budget"],
                "affected_codeword_count": candidate["affected_codeword_count"],
                "similarity": candidate["similarity"],
                "transform_id": preset["id"],
                "transform_family": preset["family"],
                "transform_parameters": json.dumps(preset["params"], sort_keys=True),
                "image": f"robustness/{case_id}.png",
                "jsqr_detected": "",
                "jsqr_payload": "",
                "jsqr_payload_correct": "",
                "jsqr_decode_status": "",
                "opencv_detected": str(detected).lower(),
                "opencv_payload": payload or "",
                "opencv_payload_correct": str(ostatus == "EXACT").lower(),
                "opencv_decode_status": ostatus,
            })

    (results_dir / "robustness_cases.json").write_text(json.dumps({
        "experiment": "A4",
        "preset_ids": CORE_PRESET_IDS,
        "candidate_count": len(selected),
        "cases": cases,
    }, indent=2), encoding="utf-8")

    (results_dir / "synthetic_test_manifest.json").write_text(json.dumps({
        "experiment": "A4",
        "description": "Core synthetic degradation subset applied to A4 generalization operating points.",
        "presets": presets,
        "case_count": len(cases),
        "note": "Transforms are applied in isolation; transformed PNGs are shared by jsQR and OpenCV.",
    }, indent=2), encoding="utf-8")

    cols = ["case_id", "candidate_id", "config_id", "target_id", "strategy", "payload", "ecc",
            "module_budget", "affected_codeword_count", "similarity", "transform_family", "transform_id",
            "transform_parameters", "image",
            "jsqr_detected", "jsqr_payload", "jsqr_payload_correct", "jsqr_decode_status",
            "opencv_detected", "opencv_payload", "opencv_payload_correct", "opencv_decode_status"]
    with (results_dir / "robustness_results.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=cols, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(cases)

    ocv = sum(1 for c in cases if c["opencv_decode_status"] == "EXACT")
    print(f"A4 robustness: {len(selected)} candidates x {len(presets)} presets = {len(cases)} cases")
    print(f"OpenCV exact: {ocv}/{len(cases)}")
    print("next: node tests/run-robustness-jsqr.js")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
