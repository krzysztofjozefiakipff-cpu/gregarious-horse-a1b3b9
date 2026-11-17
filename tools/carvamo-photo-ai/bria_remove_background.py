#!/usr/bin/env python3
"""Remove a vehicle background with BRIA, preserving its original geometry.
Never generate a replacement vehicle or a replacement showroom.
"""
import argparse,json,os,urllib.request,urllib.error,uuid,mimetypes
from pathlib import Path
from PIL import Image
import io

ENDPOINT="https://engine.prod.bria-api.com/v1/background/remove"
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--image-file",required=True)
 p.add_argument("--output",required=True)
 a=p.parse_args()
 src=Path(a.image_file)
 if not src.is_file() or not 0<src.stat().st_size<=12*1024*1024: p.error("Missing or oversized source image")
 token=os.getenv("BRIA_API_TOKEN")
 if not token:p.error("Missing BRIA_API_TOKEN")
 boundary="----CARVAMO"+uuid.uuid4().hex
 mime=mimetypes.guess_type(src.name)[0] or "application/octet-stream"
 payload=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{src.name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+src.read_bytes()+f'\r\n--{boundary}--\r\n'.encode())
 req=urllib.request.Request(ENDPOINT,data=payload,headers={"api_token":token,"Content-Type":f"multipart/form-data; boundary={boundary}"},method="POST")
 try:
  with urllib.request.urlopen(req,timeout=180) as response:
   raw=response.read(20*1024*1024)
 except urllib.error.HTTPError as e:
  raise RuntimeError(f"BRIA background removal HTTP {e.code}: {e.read(400).decode('utf-8','replace')}") from e
 content_type=""
 try:
  result=json.loads(raw)
  url=result.get("result_url") or result.get("image_url") or result.get("result",{}).get("url")
  if not url and isinstance(result.get("result"),list):
   first=result["result"][0]
   url=first if isinstance(first,str) else first.get("url") if isinstance(first,dict) else None
  if not isinstance(url,str) or not url.startswith("https://"):
   raise RuntimeError("BRIA returned no HTTPS cutout URL")
  with urllib.request.urlopen(url,timeout=120) as response:raw=response.read(20*1024*1024)
 except (ValueError,UnicodeDecodeError):
  pass
 image=Image.open(io.BytesIO(raw)).convert("RGBA")
 if image.getchannel("A").getextrema()[0]>=250:
  raise RuntimeError("BRIA output is opaque; refusing to composite an uncut vehicle")
 out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
 image.save(out)
 print(f"Transparent vehicle ready: {out}, size={image.size}")
if __name__=="__main__":main()
