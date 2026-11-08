"""CARVELO: batch a small number of claimed photos in one authenticated Actions run.

Saves startup and model initialization work. All jobs remain individually
tracked in Supabase with per-photo QA approval. Time and count are capped.
Never outputs private signed object URLs or secrets.
"""
from __future__ import annotations
import importlib.util
import os
import subprocess
import sys
import time
from pathlib import Path


def _is_auto_window(job: dict) -> bool:
    return job.get("mode") == "showroom_windows" and not job.get("window_polygons")


def _install_windows_if_needed() -> None:
    if importlib.util.find_spec("torch") is None:
        print("CARVELO batch: installing PyTorch CPU for window-only task", flush=True)
        subprocess.run([
            sys.executable, "-m", "pip", "install", "torch==2.7.1",
            "--index-url", "https://download.pytorch.org/whl/cpu"
        ], check=True, timeout=240)
    if importlib.util.find_spec("transformers") is None:
        requirements = Path(__file__).resolve().parent / "requirements-interior.txt"
        print("CARVELO batch: installing CLIPSeg dependencies once", flush=True)
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", str(requirements)
        ], check=True, timeout=180)


def process_extra_jobs(claim, render, fail, ensure_windows, *,
                       max_extra: int = 8, max_seconds: float = 720,
                       clock=time.monotonic) -> dict:
    """Pure orchestration, useful for safe offline regression tests.

    Claims only when ready to process; never claims another after time budget.
    Each failed job is recorded before proceeding, so a single bad image does
    not block nine valid images. If failure reporting breaks, abort the worker.
    """
    start = clock()
    processed = 0
    failed = 0
    for _ in range(max(0, min(max_extra, 12))):
        if clock() - start >= max_seconds:
            break
        response = claim()
        job = response.get("job")
        if not job:
            break
        if job.get("mode") not in ("showroom_exterior", "showroom_windows"):
            fail(job, "unsupported_job_mode")
            failed += 1
            continue
        try:
            if _is_auto_window(job):
                ensure_windows()
            render(job)
            processed += 1
        except Exception as err:
            reason = (str(err) or type(err).__name__).replace("\n", " ").replace("\r", " ")[:95]
            print("CARVELO batch: job failed:", reason, file=sys.stderr, flush=True)
            fail(job, reason)
            failed += 1
    return {"completed": processed, "failed": failed, "elapsed_seconds": round(clock() - start)}


def main() -> None:
    from broker import post
    # Import after all base packages are installed. The renderer holds the U2Net
    # session and CLIPSeg cached in memory across additional images.
    module = None

    def claim():
        return post("claim")

    def render(job):
        nonlocal module
        if module is None:
            import render_github as loaded
            module = loaded
        module.JOB = job
        module.render()

    def fail(job, code):
        post("fail", {"job_id": job["id"], "error_code": code[:100]})

    max_extra = int(os.environ.get("CARVELO_BATCH_MAX_EXTRA", "8"))
    max_seconds = int(os.environ.get("CARVELO_BATCH_MAX_SECONDS", "720"))
    report = process_extra_jobs(
        claim, render, fail, _install_windows_if_needed,
        max_extra=max_extra, max_seconds=max_seconds
    )
    print("CARVELO batch result:", report, flush=True)


if __name__ == "__main__":
    main()
