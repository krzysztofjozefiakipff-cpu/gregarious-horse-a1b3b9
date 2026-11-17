#!/usr/bin/env python3
"""CARVAMO V22: benchmark wheel predictions against provisional V21 annotations.

This script does not claim to detect wheels. It evaluates an independent detector's
predictions with one-to-one matching; provisional labels must not be training truth.
Example predictions JSON: {"front":[[x,y,r],...],"side":[...],"rear":[...]}.
"""
import argparse
import json
import math
from pathlib import Path

VIEWS = ("front", "side", "rear")


def _valid_circle(c, width, height):
    return (isinstance(c, list) and len(c) == 3 and
            all(isinstance(v, (int, float)) and math.isfinite(v) for v in c) and
            0 <= c[0] < width and 0 <= c[1] < height and
            0 < c[2] < min(width, height) / 2)


def evaluate(annotations_root, predictions_path, center_tolerance=0.6):
    predictions = json.loads(predictions_path.read_text(encoding="utf-8"))
    if set(predictions) != set(VIEWS):
        raise ValueError("Predictions must contain exactly front, side and rear")
    report = {"views": {}, "tp": 0, "fp": 0, "fn": 0,
              "annotation_quality": "provisional", "production_ready": False}
    for view in VIEWS:
        ann = json.loads((annotations_root / f"{view}_ground_truth.json").read_text(encoding="utf-8"))
        width, height = ann["image_size"]
        truth = ann["confirmed_candidate_wheels_xy_radius"] + ann["missed_wheels_xy_radius"]
        found = predictions[view]
        for c in truth + found:
            if not _valid_circle(c, width, height):
                raise ValueError(f"{view}: invalid wheel circle {c}")
        # Each detection and each reference can be used at most once.
        edges = []
        for i, pred in enumerate(found):
            for j, ref in enumerate(truth):
                distance = math.hypot(pred[0]-ref[0], pred[1]-ref[1])
                threshold = center_tolerance * max(pred[2], ref[2])
                ratio = min(pred[2], ref[2]) / max(pred[2], ref[2])
                if distance <= threshold and ratio >= 0.5:
                    edges.append((distance / threshold, i, j))
        used_pred, used_ref = set(), set()
        for _, i, j in sorted(edges):
            if i not in used_pred and j not in used_ref:
                used_pred.add(i)
                used_ref.add(j)
        tp, fp, fn = len(used_pred), len(found)-len(used_pred), len(truth)-len(used_ref)
        report["views"][view] = {
            "tp": tp, "fp": fp, "fn": fn,
            "reference_count": len(truth),
            "reference_verified": ann.get("human_verified") is True and
                                  ann.get("all_visible_wheels_labeled") is True,
        }
        report["tp"] += tp
        report["fp"] += fp
        report["fn"] += fn
    tp, fp, fn = report["tp"], report["fp"], report["fn"]
    report["precision"] = round(tp / (tp + fp), 4) if tp + fp else None
    report["recall_against_provisional_annotations"] = round(tp / (tp + fn), 4) if tp + fn else None
    report["all_reference_labels_verified"] = all(
        v["reference_verified"] for v in report["views"].values())
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--annotations-root", required=True, type=Path)
    parser.add_argument("--predictions", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(evaluate(args.annotations_root, args.predictions), indent=2))


if __name__ == "__main__":
    main()
