"""Local mask safety tests, no external model and no personal photos required."""
import numpy as np
from PIL import Image
from interior_windows import compose_view,compose_staff_window_mask,UnsafeWindowMask

w,h=640,480
original=Image.new("RGBA",(w,h),(73,64,51,255))
background=Image.new("RGBA",(w,h),(22,111,162,255))
positive=np.zeros((h,w),dtype="float32")
keep=np.zeros((h,w),dtype="float32")
positive[60:230,100:570]=.93   # simulated scenery through windshield
updated,fraction=compose_view(original,background,positive,keep)
base=np.asarray(original.convert("RGB"))
out=np.asarray(updated.convert("RGB"))
assert .05 < fraction < .30
assert np.array_equal(out[350:,:,:],base[350:,:,:]),"Interior/dashboard region changed"
assert np.array_equal(out[:,0:50,:],base[:,0:50,:]),"Side pillar region changed"
assert (out[110,250,:]!=base[110,250,:]).any(),"Outside view not replaced"
try:
  compose_view(original,background,np.ones((h,w),dtype=np.float32),keep)
except UnsafeWindowMask:
  pass
else:
  raise AssertionError("Full-frame scene was not rejected")
# Staff-selected window-only polygon must not alter dashboard, pillars or unselected pixels.
staff_polygons=[[[.15,.12],[.86,.12],[.86,.41],[.15,.41]]]
manual_out,manual_coverage=compose_staff_window_mask(original,background,staff_polygons)
actual=np.asarray(manual_out.convert("RGB"))
assert .10 < manual_coverage < .26
assert np.array_equal(actual[350:,:,:],base[350:,:,:]),"Manual masking touched dashboard"
assert np.array_equal(actual[:,0:60,:],base[:,0:60,:]),"Manual masking touched pillars"
assert (actual[105,200,:]!=base[105,200,:]).any(),"Manual mask did not replace scenery"
try:
  compose_staff_window_mask(original,background,[[[0,0],[1,0],[1,.99],[0,.99]]])
except UnsafeWindowMask:
  pass
else:
  raise AssertionError("Unsafe large manual polygon passed")
from interior_windows import conservative_window_mask
for unsafe_positive,unsafe_keep in [
 (np.full((h,w),np.nan,dtype=np.float32),keep),
 (np.full((h,w),.90,dtype=np.float32),np.full((h,w),.90,dtype=np.float32)),
 (np.ones((h,w),dtype=np.float32),keep),
]:
 try: conservative_window_mask(unsafe_positive,unsafe_keep,(w,h))
 except UnsafeWindowMask: pass
 else: raise AssertionError("Unsafe window confidence accepted")
print("MANUAL WINDOW MASK SAFETY PASS",w,h,round(manual_coverage,3))
print("INTERIOR MASK SAFETY PASS",w,h,round(fraction,3))
