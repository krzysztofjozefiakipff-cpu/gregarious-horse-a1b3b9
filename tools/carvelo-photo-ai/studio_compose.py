"""CARVELO: studio v2 — grounded vehicle, real pixels, no synthetic bodywork.

The source foreground mask must come from the original vehicle photo. Car is
uniformly scaled and moved over an unbranded studio scene; ground shadow is
behind the car, not on its paintwork. Only the canonical repository wordmark
may be applied at the upper-right corner.
"""
from __future__ import annotations
import io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import cairosvg

SCENE_VERSION = "studio-v2"
GROUND_Y = .885

def render_scene(svg_path: Path, size: tuple[int, int]) -> Image.Image:
    width, height = size
    data = cairosvg.svg2png(url=str(svg_path), output_width=width, output_height=height)
    with Image.open(io.BytesIO(data)) as img:
        return img.convert("RGBA")

def compose_grounded_vehicle(
    vehicle: Image.Image, scene: Image.Image,
) -> tuple[Image.Image, dict]:
    """Return a plausible floor contact; cannot regenerate/modify vehicle details."""
    original = vehicle.convert("RGBA")
    canvas = scene.convert("RGBA").copy()
    w, h = canvas.size
    original_alpha = original.getchannel("A")
    safe_mask = original_alpha.point(lambda p: 255 if p >= 96 else 0)
    box = safe_mask.getbbox()
    if not box:
        raise ValueError("vehicle_mask_empty")
    bw, bh = box[2] - box[0], box[3] - box[1]
    if bw <= 0 or bh <= 0:
        raise ValueError("vehicle_mask_invalid")
    coverage = (bw * bh) / (original.width * original.height)
    if coverage < .045:
        raise ValueError("vehicle_mask_too_small")
    # Scale conservatively to keep the complete car (including wheels) in frame.
    scale = min(w * .84 / bw, h * .55 / bh, 1.5)
    new_size = (max(1, int(bw * scale)), max(1, int(bh * scale)))
    cropped = original.crop(box)
    resampled = cropped.resize(new_size, Image.Resampling.LANCZOS)
    vw, vh = resampled.size
    anchor_y = round(h * GROUND_Y)
    left = (w - vw) // 2
    top = anchor_y - vh
    if left < 0 or top < 0 or left + vw > w or top + vh > h:
        raise ValueError("vehicle_placement_overflows")

    # Ambient floor shadow keeps vehicle grounded, with local wheel contact.
    ambient = Image.new("L", canvas.size, 0)
    draw = ImageDraw.Draw(ambient)
    draw.ellipse(
        (left + int(vw * .07), anchor_y - round(h * .035),
         left + int(vw * .93), anchor_y + round(h * .017)),
        fill=77,
    )
    ambient = ambient.filter(ImageFilter.GaussianBlur(max(7, round(h * .016))))
    contact = Image.new("L", canvas.size, 0)
    touch = ImageDraw.Draw(contact)
    for fraction in (.24, .76):
        cx = left + round(vw * fraction)
        touch.ellipse(
            (cx - round(vw * .075), anchor_y - round(h * .013),
             cx + round(vw * .075), anchor_y + round(h * .009)),
            fill=116,
        )
    contact = contact.filter(ImageFilter.GaussianBlur(max(3, round(h * .006))))
    ambient = __max_shadow(ambient, contact)
    dark = Image.new("RGBA", canvas.size, (23, 28, 34, 0))
    dark.putalpha(ambient)
    canvas.alpha_composite(dark)
    canvas.alpha_composite(resampled, (left, top))

    return canvas, {
        "scene_version": SCENE_VERSION,
        "ground_contact_y": anchor_y,
        "vehicle_bounds": [left, top, left + vw, anchor_y],
        "proportional_scale": scale,
    }

def __max_shadow(a: Image.Image, b: Image.Image):
    # Pure PIL max blend; no extra dependency for unit tests.
    from PIL import ImageChops
    return ImageChops.lighter(a, b)

def add_official_logo(image: Image.Image, svg_path: Path) -> Image.Image:
    """Apply official CARVELO brand SVG, never AI-generated, at upper right."""
    canvas = image.convert("RGBA").copy()
    w, h = canvas.size
    logo_width = max(112, min(300, round(w * .21)))
    pixels = cairosvg.svg2png(url=str(svg_path), output_width=logo_width)
    with Image.open(io.BytesIO(pixels)) as decoded:
        logo = decoded.convert("RGBA")
    inset_x = max(16, round(w * .025))
    inset_y = max(14, round(h * .033))
    padding = max(7, round(w * .011))
    x = w - inset_x - logo.width - padding
    y = inset_y + padding
    panel = (x-padding, y-padding, x+logo.width+padding, y+logo.height+padding)
    ImageDraw.Draw(canvas, "RGBA").rounded_rectangle(
        panel, radius=max(8, round(w * .01)),
        fill=(10, 25, 39, 223),
    )
    canvas.alpha_composite(logo, (x, y))
    return canvas
