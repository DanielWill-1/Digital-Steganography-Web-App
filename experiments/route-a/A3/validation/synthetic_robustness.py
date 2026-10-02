#!/usr/bin/env python3
"""A3 synthetic robustness: deterministic image degradations + OpenCV decoding.

This is the single transform pipeline for A3. It applies each preset to each selected
candidate PNG, writes the transformed PNG (the shared pixel source), decodes it with
OpenCV, and writes machine-readable results. A following Node step
(`tests/run-robustness-jsqr.js`) runs jsQR on the *same* transformed PNGs, so both decoders
see identical pixels.

No physical/camera testing: that is A4.

Usage
-----
    python validation/synthetic_robustness.py
    python validation/synthetic_robustness.py --self-test

Selection (§39/§75): the A1 base, A2 random candidates at budgets 8/10/12 (all seeds), and
A3 packed candidates at budgets 8/10/12 plus every A3 budget that decoded exactly in the
clean run.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np

try:
    import cv2  # type: ignore
except ImportError:
    sys.stderr.write("OpenCV is not installed; install it yourself (`pip install opencv-python`).\n")
    sys.exit(2)

WHITE = (255, 255, 255)
BASE_PITCH = 12


# --- transforms (all deterministic) ----------------------------------------

def t_pristine(img):
    return img.copy()


def t_resize(img, pitch):
    scale = pitch / BASE_PITCH
    height, width = img.shape[:2]
    return cv2.resize(img, (max(1, round(width * scale)), max(1, round(height * scale))),
                      interpolation=cv2.INTER_AREA)


def t_blur(img, sigma):
    if sigma <= 0:
        return img.copy()
    k = int(2 * math.ceil(3 * sigma) + 1)
    return cv2.GaussianBlur(img, (k, k), sigma, sigma, borderType=cv2.BORDER_REFLECT101)


def t_jpeg(img, quality):
    ok, buffer = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError("JPEG encode failed")
    return cv2.imdecode(buffer, cv2.IMREAD_COLOR)


def t_rotate(img, angle):
    height, width = img.shape[:2]
    diagonal = int(math.ceil(math.hypot(width, height)))
    canvas = np.full((diagonal, diagonal, 3), WHITE, np.uint8)
    matrix = cv2.getRotationMatrix2D((width / 2.0, height / 2.0), angle, 1.0)
    matrix[0, 2] += (diagonal - width) / 2.0
    matrix[1, 2] += (diagonal - height) / 2.0
    return cv2.warpAffine(img, matrix, (diagonal, diagonal), flags=cv2.INTER_LINEAR, borderValue=WHITE)


def t_perspective(img, variant, magnitude):
    height, width = img.shape[:2]
    d = magnitude * width
    src = np.float32([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]])
    if variant == "top-far":
        dst = np.float32([[d, d * 0.5], [width - 1 - d, d * 0.5], [width - 1, height - 1], [0, height - 1]])
    elif variant == "left-skew":
        dst = np.float32([[0, d], [width - 1, 0], [width - 1, height - 1], [0, height - 1 - d]])
    else:  # quad
        dst = np.float32([[d, d], [width - 1 - d, 0], [width - 1, height - 1 - d], [0, height - 1]])
    matrix = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(img, matrix, (width, height), flags=cv2.INTER_LINEAR, borderValue=WHITE)


def build_presets():
    presets = [{"id": "PRISTINE", "family": "pristine", "params": {}}]
    for pitch in [8, 6, 4, 3, 2]:
        presets.append({"id": f"RESIZE_{pitch}", "family": "resize", "params": {"module_pitch": pitch, "interpolation": "area-downscale"}})
    for sigma in [0.5, 1.0, 1.5, 2.0]:
        presets.append({"id": f"BLUR_{int(sigma * 100):02d}", "family": "blur", "params": {"blur_sigma": sigma}})
    for quality in [95, 85, 70, 50, 30]:
        presets.append({"id": f"JPEG_{quality}", "family": "jpeg", "params": {"jpeg_quality": quality}})
    for angle in [-10, -5, -2, 2, 5, 10]:
        tag = f"M{abs(angle)}" if angle < 0 else f"P{angle}"
        presets.append({"id": f"ROT_{tag}", "family": "rotation", "params": {"angle_deg": angle, "background": "white", "canvas": "expanded"}})
    for magnitude in [0.02, 0.05, 0.08, 0.12]:
        presets.append({"id": f"PERSP_{int(magnitude * 100):02d}", "family": "perspective",
                        "params": {"magnitude": magnitude, "variant": "quad", "background": "white"}})
    return presets


def apply_preset(img, preset):
    family = preset["family"]
    params = preset["params"]
    if family == "pristine":
        return t_pristine(img)
    if family == "resize":
        return t_resize(img, params["module_pitch"])
    if family == "blur":
        return t_blur(img, params["blur_sigma"])
    if family == "jpeg":
        return t_jpeg(img, params["jpeg_quality"])
    if family == "rotation":
        return t_rotate(img, params["angle_deg"])
    if family == "perspective":
        return t_perspective(img, params["variant"], params["magnitude"])
    raise ValueError(f"unknown family {family}")


# --- candidate selection ----------------------------------------------------

def select_candidates(a3_dir: Path):
    results_dir = a3_dir / "results"
    outputs_dir = a3_dir / "outputs"
    manifest = json.loads((results_dir / "manifest.json").read_text(encoding="utf-8"))
    base = manifest["bases"][0]
    base_file = f"A1base_{base['ecc']}_mask{base['mask']}.png"

    selected = [{
        "candidate_id": f"A1base_{base['ecc']}_mask{base['mask']}",
        "strategy": "A1_BASELINE",
        "base_ecc": base["ecc"],
        "base_mask": base["mask"],
        "module_budget": 0,
        "affected_codeword_count": 0,
        "similarity": base["full_similarity"],
        "file": base_file,
    }]

    with (results_dir / "clean_results.csv").open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    seen = set()
    for row in rows:
        strategy = row["strategy"]
        budget = int(row["module_budget"])
        take = False
        if strategy == "A2_RANDOM" and budget in (8, 10, 12):
            take = True
        if strategy == "A3_PACKED" and (budget in (8, 10, 12) or row.get("jsqr_decode_status") == "EXACT"):
            take = True
        if not take or row["candidate_filename"] in seen:
            continue
        seen.add(row["candidate_filename"])
        selected.append({
            "candidate_id": row["candidate_id"],
            "strategy": strategy,
            "base_ecc": row["base_ecc"],
            "base_mask": row["base_mask"],
            "module_budget": budget,
            "affected_codeword_count": int(row["affected_codeword_count"] or 0),
            "similarity": float(row["full_similarity_after"]),
            "file": row["candidate_filename"],
        })
    return selected, outputs_dir


# --- main -------------------------------------------------------------------

def decode_opencv(img, detector):
    try:
        payload, points, _ = detector.detectAndDecode(img)
    except cv2.error as error:  # pragma: no cover
        return False, "", f"OpenCV error: {error}"
    return (points is not None and len(points) > 0), (payload or ""), ""


def status(detected, payload, expected, error):
    if error:
        return "DECODER_ERROR"
    if not detected:
        return "NO_DETECTION"
    return "EXACT" if payload == expected else "WRONG_PAYLOAD"


def run(args) -> int:
    a3_dir: Path = args.a3_dir
    robustness_dir = a3_dir / "outputs" / "robustness"
    robustness_dir.mkdir(parents=True, exist_ok=True)

    selected, outputs_dir = select_candidates(a3_dir)
    manifest = json.loads((a3_dir / "results" / "manifest.json").read_text(encoding="utf-8"))
    expected = args.expected or manifest.get("payload")
    presets = build_presets()
    detector = cv2.QRCodeDetector()

    cases = []
    for candidate in selected:
        pristine = cv2.imread(str(outputs_dir / candidate["file"]), cv2.IMREAD_COLOR)
        if pristine is None:
            sys.stderr.write(f"could not read {candidate['file']}; skipping\n")
            continue
        for preset in presets:
            transformed = apply_preset(pristine, preset)
            case_id = f"{candidate['candidate_id']}__{preset['id']}"
            png_path = robustness_dir / f"{case_id}.png"
            cv2.imwrite(str(png_path), transformed)
            detected, payload, error = decode_opencv(transformed, detector)
            cases.append({
                "case_id": case_id,
                "candidate_id": candidate["candidate_id"],
                "strategy": candidate["strategy"],
                "base_ecc": candidate["base_ecc"],
                "base_mask": candidate["base_mask"],
                "module_budget": candidate["module_budget"],
                "affected_codeword_count": candidate["affected_codeword_count"],
                "similarity": candidate["similarity"],
                "transform_id": preset["id"],
                "transform_family": preset["family"],
                "transform_parameters": json.dumps(preset["params"], sort_keys=True),
                "transform_parameters_object": preset["params"],
                "image": f"robustness/{case_id}.png",
                "width": int(transformed.shape[1]),
                "height": int(transformed.shape[0]),
                "opencv_detected": str(detected).lower(),
                "opencv_payload": payload,
                "opencv_payload_correct": str(status(detected, payload, expected, error) == "EXACT").lower(),
                "opencv_decode_status": status(detected, payload, expected, error),
                "jsqr_detected": "",
                "jsqr_payload": "",
                "jsqr_payload_correct": "",
                "jsqr_decode_status": "",
            })

    results_dir = a3_dir / "results"
    (results_dir / "robustness_cases.json").write_text(json.dumps({
        "experiment": "A3",
        "payload": expected,
        "presets": presets,
        "candidates": selected,
        "cases": cases,
    }, indent=2), encoding="utf-8")

    (results_dir / "synthetic_test_manifest.json").write_text(json.dumps({
        "experiment": "A3",
        "description": "Deterministic synthetic degradations; transformed PNGs are shared by jsQR and OpenCV.",
        "presets": presets,
        "case_count": len(cases),
        "note": "Pristine is always included. Transforms are applied in isolation, not combined.",
    }, indent=2), encoding="utf-8")

    cols = ["candidate_id", "strategy", "base_ecc", "base_mask", "module_budget", "affected_codeword_count",
            "similarity", "transform_family", "transform_id", "transform_parameters",
            "jsqr_detected", "jsqr_payload", "jsqr_payload_correct", "jsqr_decode_status",
            "opencv_detected", "opencv_payload", "opencv_payload_correct", "opencv_decode_status"]
    with (results_dir / "robustness_results.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=cols, extrasaction="ignore")
        writer.writeheader()
        for case in cases:
            writer.writerow(case)

    ocv_exact = sum(1 for c in cases if c["opencv_decode_status"] == "EXACT")
    print(f"synthetic robustness: {len(selected)} candidates × {len(presets)} presets = {len(cases)} cases")
    print(f"OpenCV exact (all transforms): {ocv_exact}/{len(cases)}")
    print(f"wrote PNGs to {robustness_dir} and results to {results_dir}/")
    print("next: node tests/run-robustness-jsqr.js   (adds jsQR and the summary)")
    return 0


def self_test() -> int:
    print("synthetic_robustness self-test")
    sample = np.full((232, 232, 3), WHITE, np.uint8)
    cv2.rectangle(sample, (40, 40), (120, 120), (0, 0, 0), -1)
    ok = True

    # pristine unchanged
    if not np.array_equal(t_pristine(sample), sample):
        print("  FAIL pristine changed the image"); ok = False
    else:
        print("  ok   pristine unchanged")

    # resize dimensions
    resized = t_resize(sample, 6)
    if resized.shape[:2] != (116, 116):
        print(f"  FAIL resize dims {resized.shape[:2]}"); ok = False
    else:
        print("  ok   resize dimensions")

    # determinism
    for preset in build_presets():
        a = apply_preset(sample, preset)
        b = apply_preset(sample, preset)
        if a.shape != b.shape or not np.array_equal(a, b):
            print(f"  FAIL non-deterministic: {preset['id']}"); ok = False
    print("  ok   all presets deterministic")

    # jpeg actually encodes/decodes
    jpeg = t_jpeg(sample, 50)
    if jpeg is None or jpeg.shape != sample.shape:
        print("  FAIL jpeg did not round-trip"); ok = False
    else:
        print("  ok   jpeg encode/decode")

    # rotation keeps white background (no black clipping)
    rotated = t_rotate(sample, 10)
    corners = [rotated[0, 0], rotated[0, -1], rotated[-1, 0], rotated[-1, -1]]
    if any(int(c.min()) < 200 for c in corners):
        print(f"  FAIL rotation clipped corners {[int(c.min()) for c in corners]}"); ok = False
    else:
        print("  ok   rotation keeps a white background")

    # perspective determinism
    if not np.array_equal(t_perspective(sample, "quad", 0.08), t_perspective(sample, "quad", 0.08)):
        print("  FAIL perspective non-deterministic"); ok = False
    else:
        print("  ok   perspective deterministic")

    print("self-test", "PASSED" if ok else "FAILED")
    return 0 if ok else 1


def parse_args() -> argparse.Namespace:
    here = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="A3 synthetic robustness transforms + OpenCV decode.")
    parser.add_argument("--a3-dir", type=Path, default=here)
    parser.add_argument("--expected", default=None)
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(self_test() if args.self_test else run(args))
