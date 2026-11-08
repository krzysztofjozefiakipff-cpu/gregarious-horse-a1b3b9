"""Local mask safety tests, no external model and no personal photos required."""
import numpy as np
from PIL import Image
from interior_windows import compose_view,UnsafeWindowMask

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
print("INTERIOR MASK SAFETY PASS",w,h,round(fraction,3))
