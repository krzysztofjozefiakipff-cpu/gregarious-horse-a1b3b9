"""CARVELO window-only interior image compositing.

Safeguards:
* CLIPSeg predicts where the outdoor view is visible through vehicle glazing;
* independent interior-object prompts veto edits, then the candidate mask is
  eroded away from pillars/window frames and limited to 4 connected components;
* every original pixel outside the mask is identical (before official watermark);
* no generative replacement, no editing upholstery/screens/trim;
* uncertain cases return exact original with window_view_changed=False.
All AI versions are private and require human review before publication.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from PIL import Image, ImageFilter

MODEL_ID = "CIDAS/clipseg-rd64-refined"
POSITIVE_PROMPTS = (
    "outdoor scenery visible through a car windshield from inside",
    "view through a car side window from the passenger compartment",
    "outside scenery visible through the car rear window",
)
PROTECT_PROMPTS = (
    "car interior dashboard steering wheel and instruments",
    "front seats and headrests inside a car",
    "interior trim rear view mirror and window frame",
)
MIN_VIEW_COVERAGE = 0.015
MAX_VIEW_COVERAGE = 0.40
# This is an intentionally conservative pilot; humans verify all candidates.
MIN_CONFIDENCE = 0.70
MAX_TOTAL_COMPONENTS = 4
RENDER_OPACITY = 0.63


@dataclass
class WindowsResult:
    photo: Image.Image
    changed: bool
    confidence: float
    reason: str | None = None
    mask: Image.Image | None = None


@lru_cache(maxsize=1)
def load_clipseg():
    import torch
    from transformers import CLIPSegForImageSegmentation, CLIPSegProcessor
    proc = CLIPSegProcessor.from_pretrained(MODEL_ID, trust_remote_code=False)
    model = CLIPSegForImageSegmentation.from_pretrained(
        MODEL_ID, trust_remote_code=False
    ).eval().to("cpu")
    torch.set_num_threads(2)
    return proc, model


def _predict(image: Image.Image, prompts: tuple[str, ...]) -> np.ndarray:
    import torch
    proc, model = load_clipseg()
    rgb = image.convert("RGB")
    maps: list[np.ndarray] = []
    with torch.inference_mode():
        # Avoid parallel large-transformer batches on modest GH-hosted CPU.
        for text in prompts:
            batch = proc(text=[text], images=[rgb], padding=True, return_tensors="pt")
            logits = model(**batch).logits[0]
            scaled = torch.nn.functional.interpolate(
                logits[None, None],
                size=(image.height, image.width),
                mode="bilinear",
                align_corners=False,
            )[0, 0]
            maps.append(torch.sigmoid(scaled).cpu().numpy())
    return np.stack(maps, axis=0)


def _components(binary: np.ndarray) -> list[np.ndarray]:
    from scipy import ndimage
    connected, count = ndimage.label(binary)
    min_area = max(120, round(binary.size * .006))
    components: list[np.ndarray] = []
    for label in range(1, count + 1):
        area = int(np.count_nonzero(connected == label))
        if area < min_area:
            continue
        if area > binary.size * 0.26:
            return []  # image-spanning "window" likely includes interior.
        components.append(connected == label)
    if len(components) > MAX_TOTAL_COMPONENTS:
        return []
    return components


def compose_windows(
    interior: Image.Image,
    showroom: Image.Image,
    positives: np.ndarray | None = None,
    negatives: np.ndarray | None = None,
) -> WindowsResult:
    """Modify only confidently identified window apertures, leave interior intact.

    Optional probability maps support deterministic mask-quality unit tests.
    """
    if interior.width < 400 or interior.height < 300:
        return WindowsResult(interior.copy(), False, 0.0, "image_too_small")
    original = interior.convert("RGB")
    if positives is None:
        positives = _predict(original, POSITIVE_PROMPTS)
    if negatives is None:
        negatives = _predict(original, PROTECT_PROMPTS)
    size = (original.height, original.width)
    if positives.shape != (3, *size) or negatives.shape != (3, *size):
        raise ValueError("invalid_probability_map_dimensions")

    # The two independently phrased positive prompts must agree with decent
    # probability and no high confidence in any protected interior component.
    strongest = positives.max(axis=0)
    votes = (positives > 0.56).sum(axis=0)
    interior_veto = negatives.max(axis=0)
    margin = strongest - interior_veto
    candidate = (
        (strongest > 0.70)
        & (votes >= 2)
        & (interior_veto < .43)
        & (margin > .31)
    )
    # Protect the border and floor/seat level, where misclassification is common.
    pad = max(8, round(min(original.size) * .025))
    candidate[:pad, :] = False
    candidate[-pad:, :] = False
    candidate[:, :pad] = False
    candidate[:, -pad:] = False
    # Clip bottom image: photo through windscreen can include dashboard edge.
    candidate[round(original.height * .88):, :] = False
    from scipy import ndimage
    kernel = np.ones((max(3, pad // 4), max(3, pad // 4)), dtype=bool)
    candidate = ndimage.binary_opening(candidate, structure=kernel)
    components = _components(candidate)
    if not components:
        return WindowsResult(original, False, 0.0, "window_mask_low_confidence")
    safe = np.any(np.stack(components, axis=0), axis=0).astype("uint8")
    # Erode the mask by ~1.3% to keep seals, pillars and glass edging original.
    erosion = max(5, round(min(original.size) * .013))
    safe = ndimage.binary_erosion(
        safe.astype(bool), structure=np.ones((erosion, erosion), dtype=bool)
    ).astype("uint8")
    selected = safe.astype(bool)
    coverage = float(selected.mean())
    if coverage < MIN_VIEW_COVERAGE or coverage > MAX_VIEW_COVERAGE:
        return WindowsResult(original, False, 0.0, "window_area_out_of_range")
    quality = float(np.mean(strongest[selected] - interior_veto[selected]))
    if not np.isfinite(quality) or quality < .42:
        return WindowsResult(original, False, max(0.0, quality), "window_mask_low_confidence")
    confidence = float(np.clip(
        .6 * np.mean(strongest[selected]) + .4 * quality, 0.0, 1.0))
    if confidence < MIN_CONFIDENCE:
        return WindowsResult(original, False, confidence, "window_mask_low_confidence")

    # A fixed, brand-approved showroom, never a generated replacement interior.
    scene = showroom.convert("RGB").resize(original.size, Image.Resampling.LANCZOS)
    # Conservative opacity mimics existing tint/reflections; retains much of
    # original glass appearance. The mask is deliberately not feathered across
    # unselected pixels: outside the mask all pixels remain bit-for-bit equal.
    base = np.asarray(original, dtype=np.uint8).copy()
    other = np.asarray(scene, dtype=np.uint8)
    base[selected] = np.rint(
        base[selected].astype(np.float32) * (1 - RENDER_OPACITY)
        + other[selected].astype(np.float32) * RENDER_OPACITY
    ).clip(0, 255).astype("uint8")

    # Internal invariant, tested with synthetic masks.
    assert np.array_equal(
        base[~selected], np.asarray(original, dtype=np.uint8)[~selected]
    ), "interior_pixels_modified"
    result = Image.fromarray(base, mode="RGB")
    return WindowsResult(
        result, True, confidence, mask=Image.fromarray(safe * 255, mode="L")
    )
