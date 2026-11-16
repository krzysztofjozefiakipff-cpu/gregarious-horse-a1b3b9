# OVH Photo AI migration candidate — 2026-11-16

This branch is preparation, not a completed infrastructure migration. Do not deploy it to the live worker yet.

## Verified

- The persistent worker uses PostgreSQL RPCs and Supabase Storage HTTP APIs.
- OVH schema 001 creates `photo_jobs` / `offer_photos`, while the worker uses `cv_photo_jobs` and `cv_ai_*` RPCs. Changing the DSN alone is unsafe.
- Render worker srv-dboftorrjlhs73bapd5g is not suspended and automatically deploys main. This candidate stays on a separate branch.
- 17 offline storage and 3D/camera tests passed. These are not OMODA/JAECOO image acceptance tests.

## Candidate configuration

Install `tools/carvelo-photo-ai/requirements-ovh.txt`. Set host secrets using the existing secret mechanism, never in Git:

- `CARVAMO_STORAGE_BACKEND=ovh_s3`
- `CARVAMO_DATABASE_URL`
- `CARVAMO_S3_ENDPOINT` (HTTPS), `CARVAMO_S3_REGION`
- `CARVAMO_S3_ORIGINALS_BUCKET`, `CARVAMO_S3_RESULTS_BUCKET` (distinct private buckets)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (standard boto3 credential chain)

S3 mode does not require Supabase credentials. The default backend remains unchanged to preserve the running deployment. Uploads are conditional and carry no public ACL. Downloads enforce byte limits before image decoding. The preflight reports only fixed status codes, never raw errors or credentials.

## Required gates before switching

1. Obtain authenticated OVH access. This session has no SSH key, DB DSN or S3 configuration; OVH Manager shows the sign-in form.
2. Back up the actual database and inventory storage. Inspect the live schema and deployed app before writing migrations.
3. Implement and validate the OVH queue contract against the actual schema; do not blindly run Supabase migrations, which have provider-specific dependencies.
4. Run `python tools/carvelo-photo-ai/ovh_preflight.py` on the candidate host. It is read-only and checks the expected RPC signatures plus private bucket configuration. A pass does not prove upload permissions or full queue semantics. Unsupported public-access-block APIs fail closed and require independent privacy verification.
5. Copy originals preserving keys; compare object counts, sizes and SHA-256. Leave the source intact. Test conditional write/read/delete using newly created disposable keys in an isolated test prefix.
6. Run a separate queue with real OMODA and JAECOO photographs, explicit source camera angles and an empty 3D showroom bundle. Save original/result pairs and evaluate wheel-floor contact, proportions, shadows, window backgrounds and review flow. Do not publish automatically.
7. Validate claim concurrency, worker ownership, retry/recovery and human approval on OVH. Stop on missing functions or mismatched schema.
8. Only after acceptance: drain the old consumer, switch the candidate, verify end-to-end on preview.carvamo.com, retain rollback and source data. Do not suspend Render or remove Supabase before success.

## Outstanding

Live PostgreSQL and Object Storage verification, data transfer, OVH queue implementation, actual vehicle photos and end-to-end rendering remain blocked on authenticated infrastructure/data access. No live service was changed or disabled.

## Naming compatibility

CARVAMO is the current brand. The worker accepts CARVAMO_DATABASE_URL, CARVAMO_SHOWROOM_3D_DIR, CARVAMO_SHOWROOM_3D_ENABLED and CARVAMO_POLL_SECONDS first; old CARVELO names remain fallback aliases during migration. Existing asset paths, bucket names and queue identifiers are legacy storage references, not the target brand. Renaming them requires verified data migration; current scene/logo assets must also be replaced with approved CARVAMO artwork before acceptance.
