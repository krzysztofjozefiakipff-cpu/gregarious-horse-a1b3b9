# CARVAMO Photo AI — OVH migration contract (draft, not deployed)

## Confirmed legacy dependencies
The deployed Render background worker runs `tools/carvelo-photo-ai/persistent_worker.py`. Its required environment includes `CARVELO_DATABASE_URL`, `CARVELO_SUPABASE_URL` and `CARVELO_SUPABASE_SERVICE_ROLE_KEY`. It claims jobs with `public.cv_ai_claim`, reads originals from Supabase Storage, writes candidates to Supabase Storage and finalizes through `public.cv_ai_complete_v3`.

Do not remove those variables or change production until the replacement API is verified and a rollback exists.

## Proposed OVH-side API (requires implementation and security review)
- `POST /internal/photo-ai/claim`: atomically lease one eligible unpublished exterior photo job; return opaque job ID, signed short-lived original download URL, mode, and optional calibrated camera pose. Never return a permanent object URL or credentials.
- `POST /internal/photo-ai/{job_id}/heartbeat`: extend the lease and report stage/progress.
- `POST /internal/photo-ai/{job_id}/complete`: upload output or use a one-time signed upload URL; store candidate in private OVH object storage with state `review`; enforce idempotency and lease ownership.
- `POST /internal/photo-ai/{job_id}/fail`: report a safe error code and retry state, without leaking tokens.
- `GET /internal/photo-ai/health`: readiness check, no secrets.

Authenticate Render to OVH with a dedicated least-privilege service identity; HTTPS, replay protection, request size limits, audit logs and rotation are required. No browser-exposed credentials.

## Migration acceptance gates
1. Confirm actual OVH backend framework, endpoints, object storage and job database; the above routes are a proposal, NOT confirmed existing endpoints.
2. Implement a separate OVH adapter behind an explicit feature flag, retaining the legacy adapter for rollback.
3. Confirm an approved CARVAMO brand asset and scene; never stamp obsolete CARVELO signage.
4. Test on one consented real photo with source, output, job ID, logs and moderation evidence.
5. Require wheel-grounding confidence; on failure, preserve original and request manual review rather than silently lowering thresholds.
6. Only then consider staging rollout, production deployment and legacy shutdown.

Related: #6 end-to-end acceptance and #7 wheel-contact failure.
