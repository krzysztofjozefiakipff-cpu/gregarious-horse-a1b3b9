"""CARVELO photographic studio v3: grounded car, authentic contact and subtle reflection.

Source car pixels are composited from its segmentation matte. No AI reconstructs
body panels, wheel shapes, paint, badging or the interior. Shadows and reflection
are synthesized on the STUDIO FLOOR ONLY and stay behind the vehicle.
The logo is always the approved SVG added at the upper-right corner.
"""
from __future__ import annotations
import io
import base64
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps
import cairosvg

SCENE_VERSION = "studio-v4"
GROUND_Y = 0.85


def _refresh_legacy_showroom(scene: Image.Image) -> Image.Image:
    """Restore the approved empty photographic showroom and replace obsolete wall logo.

    The source is the real-looking empty 800x450 reference; unlike sample CGI
    photos it contains NO vehicles. Only this fixed, audited scene is rendered.
    A softly feathered dark wall patch hides the *old* capital-letter brand.
    The new official vector carVelo mark is stamped on the wall separately.
    """
    original = scene.convert("RGBA")
    w, h = original.size
    if w < 640 or h < 360 or abs(w / h - 16 / 9) > .025:
        raise ValueError("showroom_reference_unexpected_size")
    # The approved reference is a smaller 16:9 WEBP; normalize its pixels
    # before using wall and logo coordinates in the fixed 800x450 grid.
    if (w, h) != (800, 450):
        original = original.resize((800, 450), Image.Resampling.LANCZOS)
        w, h = original.size
    replacement = original.copy()
    pix = replacement.load()
    # Interpolate existing dark wall paint across the former wordmark, preserving
    # the photographed wall tone and its falloff rather than drawing a flat box.
    for yy in range(82, 233):
        left = original.getpixel((201, yy))
        right = original.getpixel((586, yy))
        for xx in range(188, 603):
            t = min(1., max(0., (xx - 201) / 385.))
            pix[xx, yy] = tuple(round(left[k] * (1 - t) + right[k] * t) for k in range(3)) + (255,)
    matte = Image.new("L", (w, h), 0)
    ImageDraw.Draw(matte).rectangle((210, 92, 585, 215), fill=255)
    matte = matte.filter(ImageFilter.GaussianBlur(11))
    scene = Image.composite(replacement, original, matte)

    # Master SVG: no AI-generated letters and no font dependency.
    logo_path = Path(__file__).resolve().parents[2] / "assets/brand/carvelo-wordmark-on-dark.svg"
    if not logo_path.is_file():
        raise ValueError("missing_official_carvelo_logo")
    logo_png = cairosvg.svg2png(url=str(logo_path), output_width=312)
    with Image.open(io.BytesIO(logo_png)) as logo_raw:
        logo = logo_raw.convert("RGBA")
    # A very faint cast shadow reinforces the sign's photographic depth.
    shadow = Image.new("RGBA", logo.size, (0, 0, 0, 0))
    shadow.putalpha(logo.getchannel("A").point(lambda a: int(a * .38)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(3))
    x = (w - logo.width) // 2
    y = 99
    scene.alpha_composite(shadow, (x + 2, y + 3))
    scene.alpha_composite(logo, (x, y))
    return scene


def render_scene(scene_path: Path, size: tuple[int, int]) -> Image.Image:
    """Render either approved photo showroom (.webp.b64) or legacy SVG scene."""
    w, h = size
    if w < 1 or h < 1:
        raise ValueError("scene_size_invalid")
    if scene_path.name.endswith(".webp.b64"):
        packed = base64.b64decode(scene_path.read_text(encoding="ascii").strip(), validate=True)
        with Image.open(io.BytesIO(packed)) as decoded:
            if decoded.format != "WEBP":
                raise ValueError("showroom_reference_not_webp")
            original = decoded.convert("RGBA")
        refreshed = _refresh_legacy_showroom(original)
        return ImageOps.fit(refreshed, size, method=Image.Resampling.LANCZOS,
                            centering=(.5, .5))
    if scene_path.suffix.lower() != ".svg":
        raise ValueError("unsupported_showroom_file")
    data = cairosvg.svg2png(url=str(scene_path), output_width=w, output_height=h)
    with Image.open(io.BytesIO(data)) as image:
        return image.convert("RGBA")


def _contact_centers(alpha: Image.Image) -> tuple[float, float]:
    """Locate bottommost tire-like silhouette clusters; use stable conservative fallback.

    Works with side-view and three-quarter images. It never assumes two specific
    wheel shapes when the silhouette is ambiguous.
    """
    w, h = alpha.size
    sample = alpha.convert("L").point(lambda p: 255 if p >= 175 else 0)
    y_start = max(0, round(h * .87))
    bottom = sample.crop((0, y_start, w, h))
    candidates = []
    for left_frac, right_frac, fallback in ((.08, .48, .24), (.52, .92, .76)):
        x0, x1 = int(w * left_frac), int(w * right_frac)
        segments = []
        active = None
        for x in range(x0, x1):
            is_deep = False
            for y in range(bottom.height - 1, -1, -1):
                if bottom.getpixel((x, y)) and y + y_start >= h * .95:
                    is_deep = True
                    break
            if is_deep and active is None:
                active = x
            if not is_deep and active is not None:
                segments.append((active, x))
                active = None
        if active is not None:
            segments.append((active, x1))
        useful = [seg for seg in segments if
                  .035 * w <= seg[1] - seg[0] <= .29 * w]
        if useful:
            best = max(useful, key=lambda seg: seg[1] - seg[0])
            candidates.append((best[0] + best[1]) / (2 * w))
        else:
            candidates.append(fallback)
    return candidates[0], candidates[1]


def compose_grounded_vehicle(vehicle: Image.Image, scene: Image.Image) -> tuple[Image.Image, dict]:
    """Float-free car placement, soft body shadow, two tire contacts, faint reflection.

    Vehicle is uniformly scaled; original foreground colors are never altered.
    Low quality / clipped segmentation raises ValueError, avoiding bad AI photos.
    """
    original = vehicle.convert("RGBA")
    canvas = scene.convert("RGBA").copy()
    w, h = canvas.size
    matte = original.getchannel("A")
    box = matte.point(lambda p: 255 if p >= 96 else 0).getbbox()
    if not box:
        raise ValueError("vehicle_mask_empty")
    bw, bh = box[2] - box[0], box[3] - box[1]
    if bw <= 0 or bh <= 0 or bw * bh < original.width * original.height * .045:
        raise ValueError("vehicle_mask_invalid")

    # Do not create missing wheels or crop the front/rear bumpers. Original
    # segment is only rescaled proportionally and centered in the blank studio.
    scale = min(w * .84 / bw, h * .57 / bh, 1.5)
    new_size = max(1, round(bw * scale)), max(1, round(bh * scale))
    cropped = original.crop(box)
    car = cropped.resize(new_size, Image.Resampling.LANCZOS)
    vw, vh = car.size
    x = (w - vw) // 2
    ground_y = round(h * GROUND_Y)
    y = ground_y - vh
    if x < 0 or y < 0 or x + vw > w or ground_y + round(h * .09) > h:
        raise ValueError("vehicle_placement_overflows")
    wheel_fractions = _contact_centers(car.getchannel("A"))
    contact_xs = [x + round(vw * frac) for frac in wheel_fractions]

    # A very faint diffuse reflected silhouette, BELOW the tire contact plane.
    # Only the floor is modified, the car itself is not color graded/repainted.
    reflect_h = min(round(vh * .19), h - ground_y - 4)
    if reflect_h > 4:
        reflection = ImageOps.flip(car).resize((vw, reflect_h), Image.Resampling.BILINEAR)
        a = reflection.getchannel("A")
        fade = Image.new("L", (vw, reflect_h), 0)
        fade.putdata([max(0, round(a0 * (.078 * (1 - iy / max(1, reflect_h - 1)) ** 1.8)))
                      for iy in range(reflect_h) for a0 in
                      list(a.crop((0, iy, vw, iy + 1)).getdata())])
        reflection.putalpha(fade)
        reflection = reflection.filter(ImageFilter.GaussianBlur(max(1, round(h * .003))))
        canvas.alpha_composite(reflection, (x, ground_y + 2))

    # Broad ambient-occlusion shadow follows the car's footprint: low contrast,
    # soft falloff, and offset barely toward the foreground.
    ambient = Image.new("L", (w, h), 0)
    painter = ImageDraw.Draw(ambient)
    painter.ellipse((x + round(vw * .07), ground_y - round(h * .025),
                     x + round(vw * .93), ground_y + round(h * .031)), fill=58)
    ambient = ambient.filter(ImageFilter.GaussianBlur(max(8, round(h * .019))))

    # Local contact patches beneath tire centers, not two oversized black spots.
    contact = Image.new("L", (w, h), 0)
    touch = ImageDraw.Draw(contact)
    for cx in contact_xs:
        dx = max(9, round(vw * .07))
        dy = max(4, round(h * .008))
        touch.ellipse((cx - dx, ground_y - dy,
                       cx + dx, ground_y + round(dy * .8)), fill=139)
    contact = contact.filter(ImageFilter.GaussianBlur(max(3, round(h * .007))))
    # Shallow daylight shadow leans away from the windows on the right.
    # It remains on the floor, below the real car silhouette.
    directional = Image.new("L", (w, h), 0)
    dr = ImageDraw.Draw(directional)
    dr.polygon([
        (x + round(vw * .14), ground_y - round(h * .009)),
        (x + round(vw * .89), ground_y - round(h * .009)),
        (x + round(vw * .57), ground_y + round(h * .068)),
        (x - round(vw * .055), ground_y + round(h * .043))
    ], fill=29)
    directional = directional.filter(ImageFilter.GaussianBlur(max(8, round(h * .027))))
    shadow = ImageChops.lighter(ImageChops.lighter(ambient, contact), directional)
    # Warm neutral shadow matches the window-lit photographic floor.
    layer = Image.new("RGBA", (w, h), (29, 28, 26, 0))
    layer.putalpha(shadow)
    canvas.alpha_composite(layer)
    canvas.alpha_composite(car, (x, y))

    return canvas, {
        "scene_version": SCENE_VERSION,
        "ground_contact_y": ground_y,
        "vehicle_bounds": [x, y, x + vw, ground_y],
        "proportional_scale": round(scale, 5),
        "wheel_contacts": contact_xs,
        "ambient_shadow": True,
        "daylight_shadow": True,
        "subtle_floor_reflection": bool(reflect_h > 4),
    }


def add_official_logo(image: Image.Image, svg_path: Path) -> Image.Image:
    """Apply unmodified CARVELO master wordmark: white letters, red V, upper right."""
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
    panel = (x - padding, y - padding, x + logo.width + padding, y + logo.height + padding)
    ImageDraw.Draw(canvas, "RGBA").rounded_rectangle(
        panel, radius=max(8, round(w * .01)), fill=(10, 25, 39, 223)
    )
    canvas.alpha_composite(logo, (x, y))
    return canvas
