"""Offline regression tests for batched claims and job-level failure isolation."""
from batch_runner import process_extra_jobs, _is_auto_window

assert _is_auto_window({"mode": "showroom_windows", "window_polygons": None})
assert not _is_auto_window({"mode": "showroom_windows", "window_polygons": [[[0, 0], [1, 0], [0, 1]]]})
assert not _is_auto_window({"mode": "showroom_exterior"})

jobs = [
    {"job": {"id": "1", "mode": "showroom_exterior"}},
    {"job": {"id": "2", "mode": "showroom_windows"}},
    {"job": {"id": "3", "mode": "showroom_exterior"}},
    {"job": None},
]
events = []

def claim():
    events.append("claim")
    return jobs.pop(0)

def render(job):
    events.append("render-" + job["id"])
    if job["id"] == "2":
        raise ValueError("invalid_window")

def fail(job, code):
    events.append("fail-" + job["id"] + "-" + code)

def prepare():
    events.append("prepare-windows")

report = process_extra_jobs(claim, render, fail, prepare)
assert report["completed"] == 2 and report["failed"] == 1, report
assert events.count("claim") == 4
assert events.count("prepare-windows") == 1
assert "fail-2-invalid_window" in events, events
assert "render-3" in events, "Single image failure must not block the next image."

# Safety: no job may be claimed after the time budget expires.
times = iter([0, 30, 30])
short = process_extra_jobs(lambda: 1 / 0, lambda _: None, lambda _, __: None,
                           lambda: None, clock=lambda: next(times), max_seconds=20)
assert short["completed"] == 0
print("CARVELO_BATCH_TEST_PASS")
