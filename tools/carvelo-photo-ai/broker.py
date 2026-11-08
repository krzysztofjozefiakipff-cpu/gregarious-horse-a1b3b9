"""CARVELO: claim one queued photo via signed GitHub Actions OIDC (no Supabase secrets)."""
import json,os,urllib.parse,urllib.request,pathlib
URL="https://rgnqsrllgemsyumvjwax.supabase.co/functions/v1/carvelo-ai-broker"
AUD="carvelo-photo-worker"
def oidc():
    endpoint=os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    token=os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    url=endpoint+("&" if "?" in endpoint else "?")+"audience="+urllib.parse.quote(AUD)
    rq=urllib.request.Request(url,headers={"Authorization":"Bearer "+token})
    with urllib.request.urlopen(rq,timeout=15) as resp:
        return json.load(resp)["value"]
def post(action,params=None):
    payload={"action":action,**(params or {})}
    data=json.dumps(payload).encode()
    req=urllib.request.Request(URL,data,method="POST",
      headers={"Authorization":"Bearer "+oidc(),"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=30) as resp:
        return json.load(resp)
if __name__=="__main__":
    job=post("claim")["job"]
    path=pathlib.Path(os.environ["RUNNER_TEMP"])/"carvelo-job.json"
    path.write_text(json.dumps(job),encoding="utf-8")
    mode=job.get("mode") if job else ""
    if mode not in ("showroom_exterior","showroom_windows",""):raise RuntimeError("Unexpected photo job mode")
    with open(os.environ["GITHUB_OUTPUT"],"a") as out:
        out.write("pending="+("true" if job else "false")+"\n")
        out.write("mode="+mode+"\n")
    print("CARVELO queue:", "one job claimed" if job else "no jobs (no model packages downloaded)")
