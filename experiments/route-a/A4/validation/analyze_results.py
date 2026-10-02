#!/usr/bin/env python3
"""A4.3 final analysis over the generalization, robustness, and A2–matched results.

Computes per-configuration operating points (A1_BASE, A3_CLEAN_MAX, A3_ROBUST, A2_MATCHED),
aggregate comparisons, simple descriptive correlations, and the dataset manifest. Writes:

  results/operating_points.csv
  results/generalization_summary.json
  results/dataset_manifest.json

The A3_ROBUST criterion is PREDEFINED: both-exact synthetic rate >= 0.95 x the A1 baseline
rate for the same configuration. Physical results are NOT included (pending real data).

Usage: python validation/analyze_results.py
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

import numpy as np

ROBUST_RELATIVE_THRESHOLD = 0.95


def read_csv(path: Path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def fnum(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def pearson(xs, ys):
    if len(xs) < 3:
        return None
    a, b = np.array(xs, dtype=float), np.array(ys, dtype=float)
    if a.std() == 0 or b.std() == 0:
        return None
    return float(np.corrcoef(a, b)[0, 1])


def spearman(xs, ys):
    if len(xs) < 3:
        return None
    a = np.argsort(np.argsort(np.array(xs, dtype=float)))
    b = np.argsort(np.argsort(np.array(ys, dtype=float)))
    return pearson(list(a), list(b))


def main() -> int:
    parser = argparse.ArgumentParser(description="A4 final analysis.")
    parser.add_argument("--a4-dir", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    results = args.a4_dir / "results"

    configs = read_csv(results / "generalization_configs.csv")
    candidates = read_csv(results / "generalization_candidates_with_opencv.csv")
    a2 = read_csv(results / "a2_matched_with_opencv.csv") if (results / "a2_matched_with_opencv.csv").is_file() else []
    robustness = read_csv(results / "robustness_summary.csv") if (results / "robustness_summary.csv").is_file() else []
    corpus = json.loads((args.a4_dir / "targets" / "target_corpus.json").read_text(encoding="utf-8"))
    target_meta = {t["target_id"]: t for t in corpus["targets"]}

    by_config_candidates = defaultdict(list)
    for row in candidates:
        by_config_candidates[row["config_id"]].append(row)
    by_config_a2 = defaultdict(list)
    for row in a2:
        by_config_a2[row["config_id"]].append(row)
    robust_by_id = {row["candidate_id"]: row for row in robustness}

    operating_rows = []
    for config in configs:
        cid = config["config_id"]
        target = target_meta.get(config["target_id"], {})
        cands = by_config_candidates[cid]

        both_exact = [c for c in cands if c["jsqr_decode_status"] == "EXACT" and c["opencv_decode_status"] == "EXACT"]
        clean_max = max(both_exact, key=lambda c: int(c["module_budget"])) if both_exact else None

        base_id = f"{cid}_A1base"
        base_rate = fnum(robust_by_id.get(base_id, {}).get("both_exact_rate"), None)
        threshold = ROBUST_RELATIVE_THRESHOLD * base_rate if base_rate else 0.0
        robust_candidates = []
        for c in cands:
            cand_id = c["candidate_filename"][:-4]
            rate = fnum(robust_by_id.get(cand_id, {}).get("both_exact_rate"), None)
            if rate is not None and c["jsqr_decode_status"] == "EXACT" and rate >= threshold:
                robust_candidates.append((int(c["module_budget"]), c, rate))
        robust = max(robust_candidates, key=lambda t: t[0]) if robust_candidates else None

        a2_rows = by_config_a2.get(cid, [])
        a2_cw = [int(r["affected_codeword_count"] or 0) for r in a2_rows]
        a2_jsqr_exact = [r for r in a2_rows if r["jsqr_decode_status"] == "EXACT"]
        a2_both_exact = [r for r in a2_rows if r["jsqr_decode_status"] == "EXACT" and r["opencv_decode_status"] == "EXACT"]
        a2_seed42 = next((r for r in a2_rows if r["seed"] == "42"), None)
        a2_robust_rate = fnum(robust_by_id.get(a2_seed42["candidate_filename"][:-4], {}).get("both_exact_rate"), None) if a2_seed42 else None

        operating_rows.append({
            "config_id": cid,
            "target_id": config["target_id"],
            "target_name": target.get("target_name", config["target_id"]),
            "target_category": target.get("target_category", ""),
            "payload": config["payload"],
            "payload_bytes": config["payload_bytes"],
            "ecc": config["ecc"],
            "a1_similarity": fnum(config["a1_similarity"]),
            "eligible_mismatches": int(config["eligible_mismatches"]),
            "fixed_conflicts": int(config["fixed_conflicts"]),
            "theoretical_ceiling": fnum(config["theoretical_ceiling"]),
            "top4_mismatch_fraction": fnum(config["top4_mismatch_fraction"]),
            "packability_codewords": int(config["codeword_count"]),
            "a3_clean_max_budget": int(clean_max["module_budget"]) if clean_max else None,
            "a3_clean_max_cw": int(clean_max["affected_codeword_count"]) if clean_max else None,
            "a3_clean_max_similarity": fnum(clean_max["full_similarity_after"]) if clean_max else None,
            "a3_clean_max_filename": clean_max["candidate_filename"] if clean_max else None,
            "a3_robust_budget": robust[0] if robust else None,
            "a3_robust_cw": int(robust[1]["affected_codeword_count"]) if robust else None,
            "a3_robust_similarity": fnum(robust[1]["full_similarity_after"]) if robust else None,
            "a3_robust_rate": robust[2] if robust else None,
            "a2_matched_budget": int(a2_rows[0]["module_budget"]) if a2_rows else None,
            "a2_mean_cw": statistics.mean(a2_cw) if a2_cw else None,
            "a2_clean_exact_rate": (len(a2_jsqr_exact) / len(a2_rows)) if a2_rows else None,
            "a2_both_exact_rate": (len(a2_both_exact) / len(a2_rows)) if a2_rows else None,
            "a2_robust_rate": a2_robust_rate,
            "a3_clean_exact": bool(clean_max),
            "a3_robust_exact": bool(robust),
        })

    # Write operating_points.csv (columns match A4/js/export-results.js).
    columns = ["config_id", "target_id", "target_name", "target_category", "payload", "payload_bytes", "ecc",
               "a1_similarity", "a3_clean_max_budget", "a3_clean_max_cw", "a3_clean_max_similarity", "a3_clean_max_filename",
               "a3_robust_budget", "a3_robust_cw", "a3_robust_similarity", "a3_robust_rate",
               "a2_matched_budget", "a2_mean_cw", "a2_clean_exact_rate", "a2_robust_rate", "a3_clean_exact", "a3_robust_exact"]
    with (results / "operating_points.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in operating_rows:
            writer.writerow({k: ("" if row.get(k) is None else row.get(k)) for k in columns})

    # A2 vs A3 at matched module budget (clean exact).
    a3_gt = a3_eq = a3_lt = 0
    for row in operating_rows:
        a3_ok = row["a3_clean_exact"]
        a2_rate = row["a2_clean_exact_rate"] or 0.0
        if a3_ok and a2_rate == 0:
            a3_gt += 1
        elif a3_ok and a2_rate > 0:
            a3_eq += 1
        else:
            a3_lt += 1

    # A3 clean-max similarity gain statistics and correlations.
    gains = [r["a3_clean_max_similarity"] - r["a1_similarity"] for r in operating_rows if r["a3_clean_max_similarity"] is not None]
    gain_stats = {
        "count": len(gains),
        "mean": statistics.mean(gains) if gains else None,
        "median": statistics.median(gains) if gains else None,
        "min": min(gains) if gains else None,
        "max": max(gains) if gains else None,
    }
    descriptor_keys = ["eligible_mismatches", "fixed_conflicts", "theoretical_ceiling", "top4_mismatch_fraction"]
    usable = [r for r in operating_rows if r["a3_clean_max_similarity"] is not None]
    correlations = {}
    for key in descriptor_keys:
        xs = [r[key] for r in usable]
        ys_clean = [r["a3_clean_max_similarity"] - r["a1_similarity"] for r in usable]
        correlations[key] = {
            "n": len(xs),
            "pearson_vs_clean_gain": pearson(xs, ys_clean),
            "spearman_vs_clean_gain": spearman(xs, ys_clean),
        }

    def median_gain(predicate):
        vals = [r["a3_clean_max_similarity"] - r["a1_similarity"] for r in operating_rows if r["a3_clean_max_similarity"] is not None and predicate(r)]
        return statistics.median(vals) if vals else None

    by_ecc = {e: median_gain(lambda r, e=e: r["ecc"] == e) for e in ["L", "M", "Q", "H"]}
    by_payload = {p: median_gain(lambda r, p=p: r["payload"] == p) for p in sorted({r["payload"] for r in operating_rows})}
    by_category = {c: median_gain(lambda r, c=c: r["target_category"] == c) for c in sorted({r["target_category"] for r in operating_rows})}

    summary = {
        "configurations": len(operating_rows),
        "a3_clean_max_exact_count": sum(1 for r in operating_rows if r["a3_clean_exact"]),
        "a3_robust_exact_count": sum(1 for r in operating_rows if r["a3_robust_exact"]),
        "robust_criterion": f"both_exact_rate >= {ROBUST_RELATIVE_THRESHOLD} x A1 baseline both_exact_rate",
        "a2_vs_a3_clean": {"a3_outperformed": a3_gt, "a3_tied": a3_eq, "a3_underperformed": a3_lt, "note": "outperform = A3 both-exact while A2 matched-budget both-exact rate == 0"},
        "a3_clean_max_gain": gain_stats,
        "median_clean_gain_by_ecc": by_ecc,
        "median_clean_gain_by_payload": by_payload,
        "median_clean_gain_by_target_category": by_category,
        "correlations": correlations,
        "first_generalization_failure": None,
    }

    # Boundary observations.
    clean_budgets = [r["a3_clean_max_budget"] for r in operating_rows if r["a3_clean_max_budget"] is not None]
    robust_budgets = [r["a3_robust_budget"] for r in operating_rows if r["a3_robust_budget"] is not None]
    summary["a3_clean_max_budget"] = {"min": min(clean_budgets) if clean_budgets else None, "median": statistics.median(clean_budgets) if clean_budgets else None, "max": max(clean_budgets) if clean_budgets else None}
    summary["a3_robust_budget"] = {"min": min(robust_budgets) if robust_budgets else None, "median": statistics.median(robust_budgets) if robust_budgets else None, "max": max(robust_budgets) if robust_budgets else None}

    (results / "generalization_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # Dataset manifest.
    versions = {"decoders": [{"name": "jsQR", "version": "1.4.0"}, {"name": "OpenCV QRCodeDetector", "version": "4.12.0"}], "opencv": "4.12.0"}
    dataset = {
        "experiment": "A4",
        "version": "1.0.0",
        "date": json.loads((results / "a4_manifest.json").read_text(encoding="utf-8"))["timestamp"][:10] if (results / "a4_manifest.json").is_file() else None,
        "target_corpus": corpus["targets"],
        "payload_corpus": sorted({r["payload"] for r in operating_rows}),
        "ecc_levels": ["L", "M", "Q", "H"],
        "decoder_versions": versions["decoders"],
        "opencv_version": versions["opencv"],
        "generalization_result_files": ["results/generalization_configs.csv", "results/generalization_candidates_with_opencv.csv", "results/operating_points.csv", "results/generalization_summary.json"],
        "synthetic_result_files": ["results/robustness_results.csv", "results/robustness_summary.csv", "results/synthetic_test_manifest.json"],
        "physical_result_files": [],
        "physical_status": "PHYSICAL VALIDATION PENDING",
    }
    (results / "dataset_manifest.json").write_text(json.dumps(dataset, indent=2), encoding="utf-8")

    # Console summary.
    print(f"configurations: {summary['configurations']}")
    print(f"A3_CLEAN_MAX (both exact): {summary['a3_clean_max_exact_count']}/{summary['configurations']}")
    print(f"A3_ROBUST (criterion):     {summary['a3_robust_exact_count']}/{summary['configurations']}")
    print(f"A2 vs A3 (clean): A3> {a3_gt}, A3= {a3_eq}, A3< {a3_lt}")
    print(f"A3 clean-max similarity gain: mean {gain_stats['mean']}, median {gain_stats['median']}, min {gain_stats['min']}, max {gain_stats['max']}")
    print(f"median gain by ECC: {by_ecc}")
    print(f"median gain by payload: {by_payload}")
    print(f"wrote operating_points.csv, generalization_summary.json, dataset_manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
