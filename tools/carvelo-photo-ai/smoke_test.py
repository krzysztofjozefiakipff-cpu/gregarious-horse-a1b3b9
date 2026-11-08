"""CARVELO GitHub Actions smoke test: public sample only, no client Supabase files."""
from pathlib import Path
import io
from PIL import Image,ImageOps,ImageDraw
from rembg import remove,new_session
import cairosvg
root=Path(__file__).resolve().parents[2]
hero=root/"assets/carvelo-hero-v3.webp"
scene=root/"assets/brand/carvelo-showroom-v1.webp"
brand=root/"assets/brand/carvelo-wordmark-on-dark.svg"
assert hero.is_file() and scene.is_file() and brand.is_file(), "Missing test asset"
with Image.open(hero) as im:
 source=im.convert("RGB");source.thumbnail((1100,730),Image.Resampling.LANCZOS)
blob=io.BytesIO();source.save(blob,format="PNG")
foreground=remove(blob.getvalue(),session=new_session("u2net"))
with Image.open(io.BytesIO(foreground)) as im: car=im.convert("RGBA")
if car.size!=source.size:car=car.resize(source.size)
coverage=sum(v for i,v in enumerate(car.getchannel("A").histogram()) if i>=48)/(source.width*source.height)
assert 0.01<coverage<0.99, "Mask is empty or completely opaque"
with Image.open(scene) as im:
 bg=ImageOps.fit(im.convert("RGBA"),source.size,method=Image.Resampling.LANCZOS)
bg.alpha_composite(car)
logo_data=cairosvg.svg2png(url=str(brand),output_width=max(110,round(source.width*.2)))
with Image.open(io.BytesIO(logo_data)) as im:logo=im.convert("RGBA")
x,y=bg.width-logo.width-29,bg.height-logo.height-29
ImageDraw.Draw(bg,"RGBA").rounded_rectangle((x-10,y-7,x+logo.width+10,y+logo.height+7),
 fill=(8,23,35,217),radius=9)
bg.alpha_composite(logo,(x,y))
out=Path("/tmp/carvelo-smoke.png")
bg.convert("RGB").save(out,format="PNG",optimize=True)
assert out.stat().st_size>5000
print("SMOKE PASS",source.size,round(coverage,3),out.stat().st_size)
