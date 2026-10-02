#!/usr/bin/env python3
"""A4.2 physical trial analysis.

Reads physical/physical_trials.csv (exported by the physical-test recorder) and writes
results/physical_summary.csv + results/physical_summary.json with attempt/exact/wrong/no-detection
counts and Wilson 95% intervals per candidate × condition.

If no physical data exists, it reports PHYSICAL VALIDATION PENDING and writes nothing
fabricated.

Usage: python validation/physical_analysis.py
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path


def wilson95(successes: int, trials: int):
    if trials == 0:
        return None, None
    z = 1.959963984540054
    p = successes / trials
    denominator = 1 + z * z / trials
    centre = p + z * z / (2 * trials)
    spread = z * math.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials))
    return max(0.0, (centre - spread) / denominator), min(1.0, (centre + spread) / denominator)


def read_csv(path: Path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    parser = argparse.ArgumentParser(description="A4 physical analysis.")
    parser.add_argument("--a4-dir", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    a4_dir: Path = args.a4_dir
    results = a4_dir / "results"
    results.mkdir(parents=True, exist_ok=True)

    candidates = [a4_dir / "physical" / "physical_trials.csv", results / "physical_trials.csv"]
    source = next((p for p in candidates if p.is_file() and p.stat().st_size > 0), None)
    if source is None:
        status = {
            "status": "PHYSICAL VALIDATION PENDING",
            "message": "No physical_trials.csv found. Collect screen/print/camera trials with physical/physical-test-recorder.html and export it here.",
            "expected_file": "physical/physical_trials.csv",
        }
        (results / "physical_summary.json").write_text(json.dumps(status, indent=2), encoding="utf-8")
        print("PHYSICAL VALIDATION PENDING - no physical_trials.csv found")
        return 0

    rows = read_csv(source)
    if not rows:
        (results / "physical_summary.json").write_text(json.dumps({"status": "PHYSICAL VALIDATION PENDING", "message": "physical_trials.csv is empty"}, indent=2), encoding="utf-8")
        print("PHYSICAL VALIDATION PENDING - empty data file")
        return 0

    groups = defaultdict(list)
    for row in rows:
        key = (row.get("candidate_id", ""), row.get("medium", ""), row.get("device", ""), row.get("symbol_size", ""), row.get("angle_deg", ""), row.get("lighting", ""))
        groups[key].append(row)

    summary = []
    for key, group in groups.items():
        def count(status):
            return sum(1 for r in group if r.get("decode_status") == status)
        exact = count("EXACT")
        low, high = wilson95(exact, len(group))
        summary.append({
            "candidate_id": key[0], "medium": key[1], "device": key[2], "symbol_size": key[3],
            "angle_deg": key[4], "lighting": key[5],
            "attempt_count": len(group), "exact_count": exact,
            "wrong_payload_count": count("WRONG_PAYLOAD"), "no_detection_count": count("NO_DETECTION"),
            "error_count": count("ERROR"), "exact_rate": exact / len(group),
            "wilson_low": low, "wilson_high": high,
        })
    summary.sort(key=lambda r: (r["candidate_id"], r["medium"], r["device"], r["symbol_size"]))

    columns = list(summary[0].keys())
    with (results / "physical_summary.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(summary)
    (results / "physical_summary.json").write_text(json.dumps({
        "status": "PHYSICAL DATA COLLECTED",
        "source": str(source),
        "conditions": len(summary),
        "attempts": sum(r["attempt_count"] for r in summary),
        "exact": sum(r["exact_count"] for r in summary),
        "wrong_payload_events": sum(r["wrong_payload_count"] for r in summary),
        "summary": summary,
    }, indent=2), encoding="utf-8")

    print(f"physical conditions: {len(summary)}, attempts: {sum(r['attempt_count'] for r in summary)}")
    print("wrote physical_summary.csv and physical_summary.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
