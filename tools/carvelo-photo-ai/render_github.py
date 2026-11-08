"""CARVELO: segment real vehicle pixels, compose approved showroom, apply canonical logo.
Exterior uses conservative vehicle matting. Interior uses conservative window-only mask.
Output is review-only: no automatic publishing.
"""
import os,io,json,hashlib,pathlib,requests,sys
from PIL import Image,ImageOps,ImageDraw
import cairosvg
from rembg import remove,new_session
from broker import oidc,URL,post
from studio_compose import render_scene,compose_grounded_vehicle,add_official_logo

ROOT=pathlib.Path(__file__).resolve().parents[2]
JOB=json.loads((pathlib.Path(os.environ["RUNNER_TEMP"])/"carvelo-job.json").read_text())
SCENE=ROOT/"assets/brand/carvelo-studio-v2.svg"
LOGO=ROOT/"assets/brand/carvelo-wordmark-on-dark.svg"

def render():
 if not JOB or (JOB.get("type"),JOB.get("mode")) not in (
    ("exterior","showroom_exterior"),("interior","showroom_windows")):
    raise ValueError("photo_type_or_mode_not_supported")
 if not SCENE.is_file() or not LOGO.is_file():raise RuntimeError("missing_official_scene_or_logo")
 original_url=JOB["original_url"]
 source=requests.get(original_url,timeout=55)
 source.raise_for_status()
 if len(source.content)>6_000_000:raise ValueError("source_size_limit")
 with Image.open(io.BytesIO(source.content)) as img:
  img=ImageOps.exif_transpose(img)
  if img.width*img.height>12000000:raise ValueError("source_pixel_limit")
  img=img.convert("RGBA")
  img.thumbnail((1400,1400),Image.Resampling.LANCZOS)
 window_changed=None
 mask_confidence=None
 review_reason=None
 if JOB["mode"]=="showroom_windows":
  # Mask only the exterior view seen through glazing. Never repaint the cabin.
  from interior_windows import process_interior_windows,compose_staff_window_mask,UnsafeWindowMask
  with render_scene(SCENE,img.size) as base:
   try:
    if JOB.get("window_polygons"):
     background,coverage=compose_staff_window_mask(img,base,JOB["window_polygons"])
    else:
     background,coverage=process_interior_windows(img,base)
    window_changed=True
    print("CARVELO protected glass view updated, area",round(coverage,3))
   except UnsafeWindowMask as err:
    # Non-destructive fallback: original pixels remain unchanged except watermark.
    background=img.copy()
    window_changed=False
    review_reason="window_mask_low_confidence"
    print("CARVELO windows: original retained for review;",str(err)[:70])
 else:
  # Exterior: original vehicle pixels remain intact; AI only computes alpha matte.
  inp=io.BytesIO();img.convert("RGB").save(inp,format="PNG")
  cut=remove(inp.getvalue(),session=new_session("u2net"))
  with Image.open(io.BytesIO(cut)) as fg: foreground=fg.convert("RGBA")
  if foreground.size!=img.size:foreground=foreground.resize(img.size,Image.Resampling.BILINEAR)
  alpha=foreground.getchannel("A")
  import numpy as np
  matte=np.asarray(alpha,dtype=np.uint8)
  coverage=float((matte>48).mean())
  opaque=float((matte>238).mean())
  if coverage<.12 or coverage>.86 or opaque<.08:raise ValueError("mask_quality_unreliable")
  with render_scene(SCENE,img.size) as base:
   background,placement=compose_grounded_vehicle(foreground,base)
  print("CARVELO studio grounding",placement)
 background=add_official_logo(background,LOGO)
 result=io.BytesIO()
 background.convert("RGB").save(result,format="PNG",optimize=True)
 body=result.getvalue()
 if len(body)>6_500_000:raise ValueError("output_too_large")
 h={"Authorization":"Bearer "+oidc()}
 data={"action":"complete","job_id":JOB["id"],"photo_id":JOB["photo_id"],
        "offer_id":JOB["offer_id"],"scene_version":"studio-v3"}
 if JOB["mode"]=="showroom_windows":
  data.update(window_view_changed=str(window_changed).lower(),
              mask_confidence="" if mask_confidence is None else str(mask_confidence),
              review_required_reason=review_reason or "")
 res=requests.post(URL,data=data,files={"file":("carvelo-branded.png",body,"image/png")},
                   headers=h,timeout=100)
 if not res.ok:raise RuntimeError("broker_complete_"+str(res.status_code))
 print("CARVELO AI candidate created for moderation.",JOB["mode"],"studio-v3, realistic shadow/reflection, official top-right brand.")
if __name__=="__main__":
 try:render()
 except Exception as exc:
  reason=str(exc)[:90].replace("\n"," ").replace("\r"," ")
  print("CARVELO worker:",reason,file=sys.stderr)
  try:post("fail",{"job_id":JOB["id"],"error_code":reason})
  except Exception as ex:print("Could not mark failure:",type(ex).__name__,file=sys.stderr)
  raise SystemExit(1)
