#!/usr/bin/env python3
"""CARVAMO wheel contact prototype. Diagnostics only; never publishes images.
Uses OpenCV circle candidates constrained by opaque vehicle silhouette.
No pretrained wheel model or 3D assets required.
"""
import argparse,json
from pathlib import Path
import cv2
import numpy as np

def detect(path):
 image=cv2.imread(str(path),cv2.IMREAD_UNCHANGED)
 if image is None:raise ValueError("Unreadable image")
 if image.shape[2]!=4:raise ValueError("Expected transparent RGBA cutout")
 rgb=image[:,:,:3];alpha=image[:,:,3]
 ys,xs=np.where(alpha>=80)
 if not len(xs):raise ValueError("Empty cutout")
 x0,x1=int(xs.min()),int(xs.max());y0,y1=int(ys.min()),int(ys.max())
 w=x1-x0+1;h=y1-y0+1
 gray=cv2.cvtColor(rgb,cv2.COLOR_BGR2GRAY)
 gray=cv2.GaussianBlur(gray,(7,7),1.5)
 minr=max(9,int(h*.055));maxr=max(minr+2,int(h*.23))
 circles=cv2.HoughCircles(gray,cv2.HOUGH_GRADIENT,dp=1.3,minDist=max(30,w*.17),
                          param1=110,param2=25,minRadius=minr,maxRadius=maxr)
 candidates=[]
 if circles is not None:
  for cx,cy,rad in circles[0]:
   cx,cy,rad=int(cx),int(cy),int(rad)
   if not (x0+w*.04<cx<x1-w*.04 and y0+h*.42<cy<y1+h*.03):continue
   if not (0<=cx<alpha.shape[1] and 0<=cy<alpha.shape[0]):continue
   if alpha[cy,cx]<100:continue
   # Evaluate dark, low-saturation wheel ring, not merely a circle on the body.
   angles=np.linspace(0,2*np.pi,48,endpoint=False)
   xx=np.clip(np.rint(cx+rad*.77*np.cos(angles)).astype(int),0,gray.shape[1]-1)
   yy=np.clip(np.rint(cy+rad*.77*np.sin(angles)).astype(int),0,gray.shape[0]-1)
   ring=gray[yy,xx]
   opacity=float(np.mean(alpha[yy,xx]>100))
   darkness=float(np.mean(ring<115))
   bottom=cy+rad
   if opacity<.48 or darkness<.35 or bottom<y0+h*.65:continue
   score=round(.5*darkness+.3*opacity+.2*min(1,(bottom-y0)/h),3)
   candidates.append({"center":[cx,cy],"radius":rad,"contact":[cx,bottom],
                      "score":score,"ring_darkness":round(darkness,3)})
 candidates.sort(key=lambda c:c["score"],reverse=True)
 chosen=[]
 for c in candidates:
  if all(abs(c["center"][0]-other["center"][0])>w*.17 for other in chosen):
   chosen.append(c)
  if len(chosen)==2:break
 chosen.sort(key=lambda c:c["center"][0])
 status="REVIEW_REQUIRED" if len(chosen)!=2 or min(c["score"] for c in chosen)<.6 else "PROVISIONAL"
 return {"status":status,"source":str(path),"cutout_bbox":[x0,y0,x1,y1],
         "candidates":candidates[:12],"selected":chosen,
         "note":"Hough circles are wheel hypotheses, not verified tire contact points. Never auto-publish."},image

def main():
 p=argparse.ArgumentParser();p.add_argument("--vehicle",required=True);p.add_argument("--output-dir",required=True)
 a=p.parse_args();out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
 result,img=detect(Path(a.vehicle))
 overlay=img[:,:,:3].copy()
 for c in result["candidates"]:
  x,y=c["center"];rad=c["radius"]
  cv2.circle(overlay,(x,y),rad,(0,180,255),2)
 for c in result["selected"]:
  x,y=c["contact"];cv2.circle(overlay,(x,y),9,(0,0,255),-1)
 cv2.imwrite(str(out/"wheel_detection_overlay.jpg"),overlay)
 (out/"wheel_detection.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
 print(result["status"],len(result["selected"]),"wheel candidates")
if __name__=="__main__":main()
