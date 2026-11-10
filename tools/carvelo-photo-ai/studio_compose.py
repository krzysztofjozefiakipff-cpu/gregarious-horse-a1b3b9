"""CARVELO photographic studio v4.1: grounded car, authentic contact and subtle reflection.

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
import numpy as np

SCENE_VERSION = "studio-v7"
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
    if scene_path.suffix.lower() == ".webp":
        with Image.open(scene_path) as decoded:
            if decoded.format != "WEBP":
                raise ValueError("showroom_reference_not_webp")
            original = decoded.convert("RGBA")
        if original.width < 640 or original.height < 360:
            raise ValueError("showroom_reference_too_small")
        return ImageOps.fit(original, size, method=Image.Resampling.LANCZOS, centering=(.5, .5))
    if scene_path.suffix.lower() != ".svg":
        raise ValueError("unsupported_showroom_file")
    data = cairosvg.svg2png(url=str(scene_path), output_width=w, output_height=h)
    with Image.open(io.BytesIO(data)) as image:
        return image.convert("RGBA")


def _contact_centers(alpha: Image.Image) -> tuple[float, ...]:
    """Find wheel-foot candidates from the lower silhouette across ALL x.

    Three-quarter vehicles may show three tires and both principal tires may
    occupy one half of the image. Never fabricate fixed left/right contacts.
    A broad bumper/rocker plateau is not a tire: require a local downward
    protrusion of meaningful width and prominence.
    """
    arr = np.asarray(alpha.convert("L"), dtype=np.uint8) >= 175
    h, w = arr.shape
    ys = np.where(arr, np.arange(h)[:, None], -1)
    bottom = ys.max(axis=0).astype(np.float32)
    window = max(7, int(w * .035) | 1)
    kernel = np.ones(window, dtype=np.float32) / window
    smooth = np.convolve(np.maximum(bottom, 0), kernel, mode="same")
    # Reject the roof, bumpers and tiny isolated matte fragments.
    floor = max(int(h * .66), int(np.percentile(bottom[bottom >= 0], 55))
                if (bottom >= 0).any() else h)
    candidates = []
    min_gap = max(15, int(w * .13))
    prominence_span = max(16, int(w * .095))
    for x in range(max(window, int(w*.035)), min(w-window, int(w*.965))):
        if smooth[x] < floor:
            continue
        l = max(0, x-prominence_span)
        r = min(w, x+prominence_span+1)
        if smooth[x] < smooth[l:r].max()-max(2,h*.008):
            continue
        left_base = np.percentile(smooth[l:x+1], 20)
        right_base = np.percentile(smooth[x:r], 20)
        prominence = smooth[x] - max(left_base, right_base)
        if prominence < h*.028:
            continue
        candidates.append((float(prominence), int(x), float(smooth[x])))
    candidates.sort(reverse=True)
    selected = []
    for prominence, x, depth in candidates:
        if all(abs(x - prev[1]) >= min_gap for prev in selected):
            selected.append((prominence, x, depth))
        if len(selected) >= 3:
            break
    if len(selected) < 2:
        # Conservative fallback for flat tire-foot plateaus missed by peak prominence.
        # Require two distinct deep silhouette bands separated by a shallower valley.
        valid = bottom >= 0
        if valid.any():
            deep_level = max(floor, float(np.percentile(bottom[valid], 83)))
            deep = smooth >= deep_level
            runs = []
            start = None
            stop = min(w-window, int(w*.965))
            for xx in range(max(window, int(w*.035)), stop):
                if deep[xx] and start is None:
                    start = xx
                if start is not None and (not deep[xx] or xx == stop-1):
                    end = xx if not deep[xx] else xx+1
                    if end-start >= max(5, int(w*.012)) and end-start <= w*.20:
                        runs.append((start, end))
                    start = None
            bands = [((a+b)//2, float(smooth[a:b].max())) for a,b in runs]
            for i, (xa, ya) in enumerate(bands):
                for xb, yb in bands[i+1:]:
                    if xb-xa < min_gap:
                        continue
                    valley = float(smooth[xa:xb+1].min())
                    if min(ya,yb)-valley >= h*.022:
                        selected = [(min(ya,yb)-valley, xa, ya),
                                    (min(ya,yb)-valley, xb, yb)]
                        break
                if len(selected) >= 2:
                    break
    if len(selected) < 2:
        raise ValueError("wheel_detection_low_confidence")
    selected.sort(key=lambda row: row[1])
    return tuple(x/w for _, x, _ in selected)


def compose_grounded_vehicle(vehicle: Image.Image, scene: Image.Image, source_photo: Image.Image | None = None) -> tuple[Image.Image, dict]:
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

    # Preserve source-photo vehicle prominence. The former 84% width / 57%
    # height limits made full-size SUVs look like miniatures in the showroom.
    # Fit generously but never crop bumpers, roof or wheels; keep the original
    # foreground aspect ratio and cap enlargement of smaller source vehicles.
    scale = min(w * .94 / bw, h * .73 / bh, 1.35)
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
    local_centers = [round(vw * frac) for frac in wheel_fractions]
    # The lowest pixel of the *whole silhouette* may be a bumper or shadow,
    # not an actual tire. Detect both tire foot-points independently.
    alpha_map = car.getchannel("A")
    footpoints = []
    for cx in local_centers:
        radius = max(3, round(vw * .029))
        deepest = -1
        for sy in range(max(0, round(vh * .66)), vh):
            # Require several opaque pixels around wheel center; anti-aliased
            # wisps and detached segmentation fragments do not qualify.
            left = max(0, cx-radius)
            right = min(vw-1, cx+radius)
            hits = sum(alpha_map.getpixel((sx,sy)) >= 190
                       for sx in range(left,right+1,max(1,radius//5)))
            if hits >= 3:
                deepest = sy
        if deepest < round(vh * .71):
            # Conservative fallback: a three-quarter view may hide the lower
            # tire pixels at the estimated wheel center. Do not fail the entire
            # photo on that heuristic; the second, wider alpha-band check below
            # still validates each wheel footprint and the final ground plane.
            band=max(8,round(vw*.065))
            wider=alpha_map.crop((max(0,cx-band),max(0,round(vh*.68)),
                                  min(vw,cx+band+1),vh))
            bbox=wider.point(lambda a:255 if a>=145 else 0).getbbox()
            if bbox is None or bbox[3]+max(0,round(vh*.68)) < round(vh*.70):
                raise ValueError("wheel_contact_uncertain")
            deepest=bbox[3]+max(0,round(vh*.68))-1
        footpoints.append((cx,deepest))
    # Align the wheel contact plane, not the overall alpha bounding box.
    contact_plane = max(fp[1] for fp in footpoints)
    if max(cy for _,cy in footpoints)-min(cy for _,cy in footpoints) > round(h*.18):
        raise ValueError("wheel_contact_misaligned")
    corrected_y = ground_y-contact_plane
    if corrected_y < 0 or corrected_y+vh > h:
        raise ValueError("vehicle_placement_overflows")
    y = corrected_y
    contact_xs = [x+cx for cx,_ in footpoints]
    contact_points = [(x+cx, y+cy) for cx,cy in footpoints]
    # Reject views with a bumper or matte artifact extending far below tires.
    if y+vh > ground_y + round(h*.07):
        raise ValueError("silhouette_below_floor")
    # Each wheel can end at a different height in a three-quarter perspective.
    # Anchor each local tire shadow to the actual bottom opaque pixel rather
    # than an imaginary shared horizontal axle/ground line.
    car_alpha = car.getchannel("A")
    contact_points = []
    for cx in contact_xs:
        local_x = cx - x
        band = max(8, round(vw * .065))
        bx0, bx1 = max(0, local_x-band), min(vw, local_x+band+1)
        sample = car_alpha.crop((bx0, max(0,round(vh*.68)), bx1, vh))
        mask = sample.point(lambda a: 255 if a >= 145 else 0)
        lower = mask.getbbox()
        if lower is None:
            raise ValueError("wheel_contact_unreliable")
        cy = y + max(0,round(vh*.68)) + lower[3] - 1
        contact_points.append((cx, cy))
    if max(cy for _,cy in contact_points)-min(cy for _,cy in contact_points) > h*.18:
        raise ValueError("wheel_ground_plane_unreliable")

    if any(cy > ground_y + round(h * .025) or cy < ground_y - round(h * .18) for _, cy in contact_points):
        raise ValueError("wheel_contact_not_on_floor")

    # Transfer the *real* ground occlusion from the original studio photograph.
    # The original already contains perspective-correct shadows under distant
    # wheels. Estimate floor brightness from unobstructed side strips, then
    # recover only darker floor pixels outside the car's segmentation matte.
    # Keep the original car pixels and CARVELO showroom floor untouched.
    if source_photo is not None and source_photo.size == original.size:
        src = np.asarray(source_photo.convert("RGB"), dtype=np.float32)
        alpha_src = np.asarray(original.getchannel("A"), dtype=np.uint8)
        floor_start = max(0, min(original.height - 1, box[1] + round(bh * .60)))
        sample_rows = src[floor_start:, :, :]
        sample_alpha = alpha_src[floor_start:, :]
        side = max(8, round(original.width * .075))
        side_values = np.concatenate((sample_rows[:, :side, :].reshape(-1, 3),
                                      sample_rows[:, -side:, :].reshape(-1, 3)), axis=0)
        # Use upper quantile: shadows at the frame edges must not lower the
        # estimated brightness of the unshadowed floor.
        baseline = float(np.percentile(side_values.mean(axis=1), 70))
        gray = src.mean(axis=2)
        darkness = np.clip((baseline - gray - 8.) / max(30., baseline * .50), 0., 1.)
        yy = np.arange(original.height, dtype=np.float32)[:, None]
        vertical = np.clip((yy - floor_start) / max(1., original.height - floor_start), 0., 1.)
        floor_only = (alpha_src < 40).astype(np.float32)
        # Exclude very distant background and suppress sharp original
        # wall/floor edges; the transferred matte is a soft contact shadow.
        dark_alpha = np.uint8(np.clip(darkness * floor_only * vertical * 185., 0, 175))
        # A car's real floor shadow extends *below and outside* its bounding
        # box. The old crop(box) cut away precisely the ground contact region.
        # Project the complete source floor at the same scale/translation as
        # the segmented vehicle, clipping safely to the showroom canvas.
        source_shadow = Image.fromarray(dark_alpha, "L")
        projected_w = max(1, round(original.width * scale))
        projected_h = max(1, round(original.height * scale))
        source_shadow = source_shadow.resize(
            (projected_w, projected_h), Image.Resampling.BILINEAR)
        source_shadow = source_shadow.filter(
            ImageFilter.GaussianBlur(max(2, round(h*.003))))
        shadow_x = x - round(box[0] * scale)
        shadow_y = y - round(box[1] * scale)
        paste_x0 = max(0, shadow_x)
        paste_y0 = max(0, shadow_y)
        paste_x1 = min(w, shadow_x + projected_w)
        paste_y1 = min(h, shadow_y + projected_h)
        if paste_x1 > paste_x0 and paste_y1 > paste_y0:
            region = source_shadow.crop((
                paste_x0 - shadow_x, paste_y0 - shadow_y,
                paste_x1 - shadow_x, paste_y1 - shadow_y))
            ground_layer = Image.new(
                "RGBA", region.size, (16, 17, 19, 0))
            ground_layer.putalpha(region)
            canvas.alpha_composite(ground_layer, (paste_x0, paste_y0))

    # Reflection is clipped to the floor and fades quickly; no mirror-image
    # floating above the tiles. Keep original vehicle pixels untouched.
    floor_y = max(0, min(h-1, min(cy for _, cy in contact_points)))
    reflect_h = max(0, min(round(vh * .20), h - floor_y - 3))
    if reflect_h > 4:
        reflection = ImageOps.flip(car).resize((vw, reflect_h), Image.Resampling.BILINEAR)
        a = reflection.getchannel("A")
        fade = Image.new("L", (vw, reflect_h), 0)
        fade.putdata([round(px * .13 * (1 - iy / max(1, reflect_h-1))**2.3)
                      for iy in range(reflect_h)
                      for px in a.crop((0, iy, vw, iy+1)).getdata()])
        reflection.putalpha(fade)
        reflection = reflection.filter(ImageFilter.GaussianBlur(max(2, round(h * .005))))
        canvas.alpha_composite(reflection, (x, floor_y + 2))

    # Layered, grounded shadows: broad ambient occlusion, tight tire contact,
    # and a soft directional floor shadow away from the window wall.
    ambient = Image.new("L", (w, h), 0)
    painter = ImageDraw.Draw(ambient)
    # Follow the projected axle line. A horizontal ellipse tied to the
    # nearest wheel's ground_y makes the far wheel visibly float.
    left_contact, right_contact = sorted(contact_points)
    ax0, ay0 = left_contact
    ax1, ay1 = right_contact
    span = max(1, ax1 - ax0)
    depth = max(8, round(h * .030))
    painter.polygon([
        (ax0-round(span*.11), ay0-depth),
        (ax1+round(span*.11), ay1-depth),
        (ax1+round(span*.13), ay1+depth),
        (ax0-round(span*.13), ay0+depth),
    ], fill=120)
    ambient = ambient.filter(ImageFilter.GaussianBlur(max(7, round(h * .017))))

    contact = Image.new("L", (w, h), 0)
    touch = ImageDraw.Draw(contact)
    for cx, cy in contact_points:
        dx = max(9, round(vw * .038))
        dy = max(3, round(h * .008))
        touch.ellipse((cx-dx, cy-dy, cx+dx, cy+dy+max(3,round(h*.008))), fill=238)
    contact = contact.filter(ImageFilter.GaussianBlur(max(2, round(h * .003))))

    directional = Image.new("L", (w, h), 0)
    dr = ImageDraw.Draw(directional)
    dr.polygon([
        (ax0, ay0),
        (ax1, ay1),
        (ax1-round(span*.20), ay1+round(h*.060)),
        (ax0-round(span*.23), ay0+round(h*.046))
    ], fill=42)
    directional = directional.filter(ImageFilter.GaussianBlur(max(8, round(h*.024))))
    # Tire grounding must be visible even on reflective light tiles.
    # A two-scale footprint creates an opaque seam directly under each tire
    # plus a wider soft penumbra, both behind the untouched vehicle pixels.
    footprint = Image.new("L", (w, h), 0)
    fd = ImageDraw.Draw(footprint)
    for cx, cy in contact_points:
        # Two-layer tire footprint: an almost-black, very tight contact seam
        # and a softer ground-level penumbra. Do not shift the seam toward the
        # global ground line: perspective can place each tire at a different y.
        rx = max(6, round(vw * .025))
        ry = max(2, round(h * .004))
        # Shift the contact patch a few pixels below the opaque tire edge:
        # a centered ellipse is mostly hidden behind the wheel silhouette.
        fd.ellipse((cx-rx, cy-1, cx+rx, cy+max(4, round(h*.010))), fill=247)
    footprint = footprint.filter(ImageFilter.GaussianBlur(max(1, round(h * .0012))))

    # The source studio has a broad dark occlusion zone below the rocker
    # panel. A thin line between tire centers leaves the underside bright
    # and creates the levitating-car appearance. Build a two-scale footprint
    # with a dense core and a wide soft penumbra following the axle slope.
    underbody = Image.new("L", (w, h), 0)
    ud = ImageDraw.Draw(underbody)
    sorted_contacts = sorted(contact_points)
    left_x, left_y = sorted_contacts[0]
    right_x, right_y = sorted_contacts[-1]
    wheel_span = max(1, right_x - left_x)
    for i in range(41):
        t = i / 40
        cx = round(left_x * (1-t) + right_x*t)
        cy = round(left_y * (1-t) + right_y*t)
        taper = .65 + .35 * (1-abs(2*t-1))
        rx = max(5, round(wheel_span * .046 * taper))
        ry = max(5, round(h * .042 * taper))
        ud.ellipse((cx-rx, cy-ry, cx+rx, cy+ry), fill=210)
    underbody = underbody.filter(ImageFilter.GaussianBlur(max(4, round(h*.012))))
    core = Image.new("L", (w, h), 0)
    cd = ImageDraw.Draw(core)
    for i in range(37):
        t = i / 36
        cx = round(left_x * (1-t) + right_x*t)
        cy = round(left_y * (1-t) + right_y*t)
        rx = max(4, round(wheel_span*.025))
        ry = max(3, round(h*.011))
        cd.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),fill=231)
    core = core.filter(ImageFilter.GaussianBlur(max(2,round(h*.004))))
    underbody = ImageChops.lighter(underbody,core)
    shadow = ImageChops.lighter(
        ImageChops.lighter(ImageChops.lighter(ambient, contact), directional),
        ImageChops.lighter(footprint, underbody))
    # Reinforce a short floor-only dark seam immediately below each tire.
    # This stays behind the foreground and cannot recolor wheels or bodywork.
    seam = Image.new("L", (w, h), 0)
    seam_draw = ImageDraw.Draw(seam)
    for cx, cy in contact_points:
        seam_draw.ellipse((cx-max(5,round(vw*.019)), cy,
                           cx+max(5,round(vw*.019)),
                           cy+max(3,round(h*.007))), fill=235)
    seam = seam.filter(ImageFilter.GaussianBlur(max(1,round(h*.001))))
    shadow = ImageChops.lighter(shadow, seam)
    layer = Image.new("RGBA", (w, h), (25, 25, 26, 0))
    layer.putalpha(shadow)
    canvas.alpha_composite(layer)
    canvas.alpha_composite(car, (x, y))

    return canvas, {
        "scene_version": SCENE_VERSION,
        "ground_contact_y": ground_y,
        "vehicle_bounds": [x, y, x + vw, y + vh],
        "proportional_scale": round(scale, 5),
        "wheel_contacts": contact_xs,
        "wheel_contact_points": contact_points,
        "wheel_grounded": all(ground_y-round(h*.18) <= pt_y <= ground_y+round(h*.025) for _,pt_y in contact_points),
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
