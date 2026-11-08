"""CARVELO: conservative compositing of ONLY scenery visible through car windows.
The original image is never edited or made public. CLIPSeg produces a proposed
mask, not a guaranteed glass/window detector; every candidate requires review.
No generative drawing of cabin, seats, steering wheel, or vehicle parts.
"""
import io
import numpy as np
from PIL import Image, ImageFilter, ImageOps

MODEL_ID = "CIDAS/clipseg-rd64-refined"
WINDOW_PROMPTS = (
    "scenery outside seen through the windshield from inside a car",
    "outside view through the side window of a car",
    "outside scenery through the rear windshield of a car",
)
KEEP_PROMPTS = (
    "dashboard and steering wheel inside a car",
    "seat upholstery and interior of a car",
    "car pillars windshield frame and rearview mirror",
)

class UnsafeWindowMask(Exception):
    """No trustworthy region to modify; keep original with CARVELO logo."""


def infer_window_probability(photo):
    """Text-guided zero-shot foreground proposals, not a trained automotive glass model."""
    import torch
    from transformers import CLIPSegProcessor, CLIPSegForImageSegmentation
    torch.set_num_threads(2)
    processor = CLIPSegProcessor.from_pretrained(MODEL_ID)
    model = CLIPSegForImageSegmentation.from_pretrained(MODEL_ID, use_safetensors=True).eval()
    prompts = list(WINDOW_PROMPTS + KEEP_PROMPTS)
    inputs = processor(text=prompts, images=[photo.convert("RGB")] * len(prompts),
                       padding=True, return_tensors="pt")
    with torch.no_grad():
        logits = model(**inputs).logits
        if logits.ndim == 2:
            logits = logits.unsqueeze(0)
        expanded = torch.nn.functional.interpolate(
            logits.unsqueeze(1), size=(photo.height,photo.width),
            mode="bilinear", align_corners=False).squeeze(1)
        scores = torch.sigmoid(expanded).cpu().numpy()
    if scores.shape != (len(prompts), photo.height, photo.width):
        raise UnsafeWindowMask("mask_shape_unexpected")
    positive = scores[:len(WINDOW_PROMPTS)].max(axis=0)
    protected = scores[len(WINDOW_PROMPTS):].max(axis=0)
    return positive, protected


def conservative_window_mask(positive, protected, size):
    """Keep a small, confident core of exterior scenery; never assume entire glass is transparent."""
    width, height = size
    if positive.shape != (height, width) or protected.shape != positive.shape:
        raise UnsafeWindowMask("mask_size_mismatch")
    if not np.isfinite(positive).all() or not np.isfinite(protected).all():
        raise UnsafeWindowMask("mask_not_finite")
    y = np.arange(height)[:,None]
    x = np.arange(width)[None,:]
    # This is a safety bound, not an assumption that every window is at the top.
    # Side glass extending lower than this requires manual review.
    top_zone = (y < height * .70)
    allowed = (positive >= .68) & (positive - protected >= .13) & top_zone
    coverage = float(np.mean(allowed))
    if not (.015 <= coverage <= .39):
        raise UnsafeWindowMask("window_mask_uncertain")
    # Avoid cutting through pillars, rubber seals, dashboard or reflections.
    raw = Image.fromarray((allowed.astype("uint8")*255),"L")
    radius = max(7, min(23, int(width*.015)//2*2+1))
    eroded = raw.filter(ImageFilter.MinFilter(radius))
    core = np.array(eroded,dtype=np.uint8)>127
    core_count = float(np.mean(core))
    if core_count < .008 or core_count > .31:
        raise UnsafeWindowMask("window_core_not_safe")
    # Disallow bottom of picture and implausible whole-frame masks.
    if bool(np.mean(core[int(height*.65):])) > .001:
        raise UnsafeWindowMask("window_mask_reaches_interior")
    return core


def compose_view(photo, scene, positive, protected):
    """Scenery only; hard protected pixels remain pixel-identical to original photo."""
    if photo.mode != "RGBA":
        photo = photo.convert("RGBA")
    core = conservative_window_mask(positive,protected,photo.size)
    w,h = photo.size
    scene = ImageOps.fit(scene.convert("RGB"),photo.size,
                         method=Image.Resampling.LANCZOS).convert("RGBA")
    base = np.asarray(photo.convert("RGB"),dtype=np.uint8)
    replacement = np.asarray(scene.convert("RGB"),dtype=np.uint8)
    # Natural window tint: a modest part of original light/reflection survives.
    matte = Image.fromarray(core.astype("uint8")*255,"L").filter(ImageFilter.GaussianBlur(2.5))
    strength = np.asarray(matte,dtype=np.float32)/255.0
    strength *= .86
    strength[~core]=0
    strength = strength[:,:,None]
    composited = np.clip(
        base.astype(np.float32)*(1.0-strength)+replacement.astype(np.float32)*strength,
        0,255).astype("uint8")
    if not np.array_equal(composited[~core],base[~core]):
        raise AssertionError("protected_car_pixels_modified")
    return Image.fromarray(composited,mode="RGB").convert("RGBA"),float(np.mean(core))


def process_interior_windows(photo, scene):
    positive,protected = infer_window_probability(photo)
    return compose_view(photo,scene,positive,protected)
