"""CARVELO photo worker: report verified processing milestones via GitHub OIDC.

Percentages represent finished pipeline milestones, not an ETA.
A telemetry outage must never prevent a valid photo candidate from being generated.
"""
import json,os,pathlib,sys
from broker import post

def report(percent:int,stage:str,job_id:str|None=None)->bool:
    if job_id is None:
        data=pathlib.Path(os.environ["RUNNER_TEMP"])/"carvelo-job.json"
        job=json.loads(data.read_text(encoding="utf-8"))
        job_id=job.get("id") if job else None
    if not job_id:return False
    try:
        res=post("progress",{"job_id":job_id,"percent":percent,"stage":stage})
        return res.get("ok") is True
    except Exception as err:
        print("CARVELO progress telemetry unavailable:",type(err).__name__,file=sys.stderr)
        return False

if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("usage: progress.py <percent> <stage>")
    report(int(sys.argv[1]),sys.argv[2])
