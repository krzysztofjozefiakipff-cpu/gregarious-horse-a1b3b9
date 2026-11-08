"""CARVELO: conservative compositing of ONLY scenery visible through car windows.
The original image is never edited or made public. CLIPSeg produces a proposed
mask, not a guaranteed glass/window detector; every candidate requires review.
No generative drawing of cabin, seats, steering wheel, or vehicle parts.
"""
import io
import numpy as np
from PIL import Image, ImageFilter, ImageOps, ImageDraw

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
        raise UnsafeWindowMask("window_mask_uncertain:c"+format(coverage,".3f")+
            ",p"+format(float(np.mean(positive>=.50)),".3f")+
            ",k"+format(float(np.mean(protected>=.50)),".3f"))
    # Avoid cutting through pillars, rubber seals, dashboard or reflections.
    raw = Image.fromarray((allowed.astype("uint8")*255),"L")
    radius = max(7, min(23, int(width*.015)//2*2+1))
    eroded = raw.filter(ImageFilter.MinFilter(radius))
    core = np.array(eroded,dtype=np.uint8)>127
    core_count = float(np.mean(core))
    if core_count < .008 or core_count > .31:
        raise UnsafeWindowMask("window_core_not_safe:c"+format(core_count,".3f"))
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


def compose_staff_window_mask(photo, scene, polygons):
    """Precisely selected exterior view through windows. Staff reviews output before use."""
    if not isinstance(polygons,list) or len(polygons)<1 or len(polygons)>6:
        raise UnsafeWindowMask("manual_mask_invalid")
    w,h=photo.size
    picture=Image.new("L",(w,h),0)
    canvas=ImageDraw.Draw(picture)
    area_sum=0.0
    for poly in polygons:
        if not isinstance(poly,list) or not 3<=len(poly)<=20:
            raise UnsafeWindowMask("manual_mask_invalid")
        points=[]
        for pt in poly:
            if not isinstance(pt,list) or len(pt)!=2:
                raise UnsafeWindowMask("manual_mask_invalid")
            x,y=pt
            if not all(isinstance(z,(int,float)) and np.isfinite(z) and 0<=z<=1 for z in (x,y)):
                raise UnsafeWindowMask("manual_mask_invalid")
            points.append((float(x),float(y)))
        if max(p[1] for p in points)>.79:
            raise UnsafeWindowMask("manual_mask_interior_risk")
        shoelace=abs(sum(points[i][0]*points[(i+1)%len(points)][1]-
             points[(i+1)%len(points)][0]*points[i][1] for i in range(len(points))))/2
        if not .002<=shoelace<=.25:
            raise UnsafeWindowMask("manual_mask_invalid_area")
        area_sum+=shoelace
        canvas.polygon([(round(x*w),round(y*h)) for x,y in points],fill=255)
    if area_sum>.35:
        raise UnsafeWindowMask("manual_mask_excessive_area")
    safe=picture.filter(ImageFilter.MinFilter(max(9,min(23,int(w*.015)//2*2+1))))
    core=np.asarray(safe,dtype=np.uint8)>127
    coverage=float(np.mean(core))
    if not .004<=coverage<=.32:
        raise UnsafeWindowMask("manual_mask_invalid_area")
    return compose_mask(photo,scene,core)


def compose_mask(photo,scene,core):
    """Pixel-perfect protection of car interior outside explicitly masked scenery."""
    if photo.mode!="RGBA":
        photo=photo.convert("RGBA")
    scene=ImageOps.fit(scene.convert("RGB"),photo.size,method=Image.Resampling.LANCZOS).convert("RGBA")
    original=np.asarray(photo.convert("RGB"),dtype=np.uint8)
    target=np.asarray(scene.convert("RGB"),dtype=np.uint8)
    matte=Image.fromarray(core.astype("uint8")*255,"L").filter(ImageFilter.GaussianBlur(2.5))
    strength=np.asarray(matte,dtype=np.float32)/255.0*.86
    strength[~core]=0
    strength=strength[:,:,None]
    result=np.clip(original.astype(np.float32)*(1-strength)+target.astype(np.float32)*strength,0,255).astype("uint8")
    if not np.array_equal(result[~core],original[~core]):
        raise AssertionError("protected_car_pixels_modified")
    return Image.fromarray(result,mode="RGB").convert("RGBA"),float(np.mean(core))


def process_interior_windows(photo, scene):
    positive,protected = infer_window_probability(photo)
    return compose_view(photo,scene,positive,protected)
