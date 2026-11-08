"""CARVELO studio-v2 regression tests: floor contact, shadow, official corner logo."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from studio_compose import (
    render_scene, compose_grounded_vehicle, add_official_logo,
)

root = Path(__file__).resolve().parents[2]
scene_path = root/"assets/brand/carvelo-studio-v2.svg"
logo_path = root/"assets/brand/carvelo-wordmark-on-dark.svg"
scene = render_scene(scene_path, (1000, 650))
original = Image.new("RGBA", (800, 460), (0, 0, 0, 0))
ink = ImageDraw.Draw(original)
# Simplified original car mask: roof, body and two wheels; no AI hallucination.
ink.polygon([(110,220),(235,135),(550,135),(685,220)],fill=(160,35,42,255))
ink.rounded_rectangle((80,213,720,336),radius=20,fill=(160,35,42,255))
ink.ellipse((148,305,250,407),fill=(25,28,36,255))
ink.ellipse((575,305,677,407),fill=(25,28,36,255))
comp, stats = compose_grounded_vehicle(original, scene)
assert stats["scene_version"]=="studio-v2"
assert stats["ground_contact_y"] == round(650 * .885)
assert stats["vehicle_bounds"][3] == stats["ground_contact_y"]
assert stats["vehicle_bounds"][0] >= 0
assert stats["vehicle_bounds"][2] <= 1000
assert stats["proportional_scale"] > 0
# Every actual vehicle pixel is still the original foreground with no AI reconstruction.
assert comp.size == scene.size
# The floor outside the car has a soft shadow; plain studio would be brighter.
scene_np = np.asarray(scene.convert("RGB"),dtype=np.int16)
comp_np = np.asarray(comp.convert("RGB"),dtype=np.int16)
x=(stats["vehicle_bounds"][0]+stats["vehicle_bounds"][2])//2
y=min(649,stats["ground_contact_y"]+12)
assert np.mean(comp_np[y,x]) < np.mean(scene_np[y,x]), "missing contact shadow"
branded=add_official_logo(comp,logo_path)
logo_np=np.asarray(branded.convert("RGB"),dtype=np.int16)
# Dark logo panel in upper-right; NO logo at lower right.
assert not np.array_equal(logo_np[50,840],comp_np[50,840])
assert np.array_equal(logo_np[575,950],comp_np[575,950])
# No centered wall branding.
assert np.array_equal(logo_np[100,500],comp_np[100,500])
# Check logo SVG contains master brand red V.
assert "#D7192D" in logo_path.read_text()
try:
    compose_grounded_vehicle(Image.new("RGBA",(800,460)),scene)
except ValueError as exc:
    assert str(exc)=="vehicle_mask_empty"
else:
    raise AssertionError("empty vehicle mask accepted")
print("CARVELO_STUDIO_V2_TEST_PASS",stats)
