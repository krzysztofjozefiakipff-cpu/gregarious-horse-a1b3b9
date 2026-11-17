#!/usr/bin/env python3
"""Evaluate CARVAMO wheel candidates against explicitly labeled V19 crops.

This is candidate-level evaluation, NOT detection of missed wheels and NOT a
production-ready model. No network, database, or Supabase dependency.
"""
import argparse
import json
from pathlib import Path


def evaluate(review_root, results_root):
    summary = {"total": 0, "wheel": 0, "not_wheel": 0, "unreviewed": 0,
               "matched": 0, "unmatched": 0, "per_view": {}}
    for view in ("front", "side", "rear"):
        annotations = json.loads((review_root / f"v19-{view}" / "wheel_review" /
                                  "annotations.json").read_text(encoding="utf-8"))
        result = json.loads((results_root / f"v19-{view}" /
                             "result.json").read_text(encoding="utf-8"))
        candidates = result["placement"]["image_wheel_candidates"]["candidates"]
        stats = {"wheel": 0, "not_wheel": 0, "unreviewed": 0, "matched": 0, "unmatched": 0}
        for item in annotations["candidates"]:
            label = item["label"]
            if label not in ("wheel", "not_wheel", "uncertain", "unreviewed"):
                raise ValueError(f"invalid label: {label}")
            category = label if label in ("wheel", "not_wheel") else "unreviewed"
            stats[category] += 1
            x, y, radius = item["circle_xy_radius"]
            matched = any(abs(c["x"]-x) <= 2 and abs(c["y"]-y) <= 2
                          and abs(c["radius"]-radius) <= 2 for c in candidates)
            stats["matched" if matched else "unmatched"] += 1
        summary["per_view"][view] = stats
        for key, value in stats.items():
            summary[key] += value
    summary["candidate_precision_if_all_accepted"] = (
        round(summary["wheel"] / (summary["wheel"] + summary["not_wheel"]), 4)
        if summary["wheel"] + summary["not_wheel"] else None
    )
    summary["recall_of_all_vehicle_wheels"] = "unknown_missing_wheels_not_annotated"
    summary["production_ready"] = False
    return summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--review-root", required=True, type=Path,
                        help="Directory containing v19-front/side/rear/wheel_review")
    parser.add_argument("--results-root", required=True, type=Path,
                        help="Directory containing v19-front/side/rear/result.json")
    args = parser.parse_args()
    report = evaluate(args.review_root, args.results_root)
    print(json.dumps(report, indent=2))
    if report["unmatched"]:
        raise SystemExit("ERROR: annotations and V19 candidate coordinates differ")
    if report["unreviewed"]:
        raise SystemExit("ERROR: incomplete manual candidate labels")


if __name__ == "__main__":
    main()
