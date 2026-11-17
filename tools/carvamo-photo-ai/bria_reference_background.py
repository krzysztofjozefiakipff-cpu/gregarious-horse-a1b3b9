#!/usr/bin/env python3
"""Isolated CARVAMO Bria reference-background pilot; no production publication."""
import argparse, base64, json, os, pathlib, sys, time, urllib.request, urllib.error

API="https://engine.prod.bria-api.com/v2/image/edit/replace_background"
def encoded(path):
    p=pathlib.Path(path)
    if p.suffix.lower() not in (".png",".jpg",".jpeg",".webp") or not p.is_file() or not 0<p.stat().st_size<=12*1024*1024:
        raise ValueError("Expected existing PNG/JPEG/WEBP image up to 12MB: "+str(path))
    return base64.b64encode(p.read_bytes()).decode("ascii")
def request(url,token,payload=None):
    req=urllib.request.Request(url,method="POST" if payload is not None else "GET",
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"api_token":token,"Content-Type":"application/json","User-Agent":"CARVAMO-Bria-Pilot"})
    with urllib.request.urlopen(req,timeout=180) as r: return json.load(r)
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--vehicle",required=True)
    p.add_argument("--background",required=True)
    p.add_argument("--output-dir",default="bria_reference_result")
    p.add_argument("--execute",action="store_true")
    a=p.parse_args()
    out=pathlib.Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
    vehicle=encoded(a.vehicle);background=encoded(a.background)
    payload={"image":vehicle,"ref_images":[background],"mode":"high_control","enhance_ref_images":False,"sync":True}
    if not a.execute:
        print(json.dumps({"status":"DRY_RUN","endpoint":API,"vehicle":a.vehicle,"background":a.background,"mode":"high_control","note":"Reference guides generation; exact background not guaranteed"}))
        return
    token=os.getenv("BRIA_API_TOKEN")
    if not token: p.error("BRIA_API_TOKEN missing")
    response=request(API,token,payload)
    if "status_url" in response and not response.get("result"):
        url=response["status_url"]
        if not url.startswith("https://engine.prod.bria-api.com/"): raise RuntimeError("Unexpected status URL")
        for _ in range(48):
            time.sleep(5);response=request(url,token)
            if response.get("result"):break
            if response.get("status","").lower() in ("failed","error","cancelled"):raise RuntimeError("Bria job failed")
    (out/"response.json").write_text(json.dumps({"request_id":response.get("request_id"),"status":"AWAITING_VISUAL_QA","ready_for_publication":False,"response":response},indent=2))
    result=response.get("result") or {}
    url=result.get("image_url") if isinstance(result,dict) else None
    if not url or not url.startswith("https://"):raise RuntimeError("Bria returned no image_url")
    req=urllib.request.Request(url,headers={"User-Agent":"CARVAMO-Bria-Pilot"})
    with urllib.request.urlopen(req,timeout=120) as r: data=r.read(12*1024*1024+1)
    if not 0<len(data)<=12*1024*1024:raise RuntimeError("Invalid output size")
    suffix=".png" if data[:4] == bytes([137,80,78,71]) else ".jpg" if data[:2] == bytes([255,216]) else ".webp" if data.startswith(b"RIFF") else None
    if not suffix: raise RuntimeError("Bria returned unrecognized image bytes")
    (out/("candidate"+suffix)).write_bytes(data)
    print("Saved unapproved candidate",out/("candidate"+suffix))
if __name__=="__main__":
    try:main()
    except Exception as e:print(type(e).__name__+": "+str(e),file=sys.stderr);sys.exit(1)
