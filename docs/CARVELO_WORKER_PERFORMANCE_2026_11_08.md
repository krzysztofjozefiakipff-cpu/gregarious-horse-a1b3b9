# CARVELO: photo processing updates — 2026-11-08
- Contact plane uses detected tire footprints rather than the bottom of the silhouette; both tire contacts, ground shadow and soft reflection are validated.
- All newly uploaded photos use the shared vector `assets/brand/carvelo-wordmark-on-dark.svg`, including photos that retain the original background.
- In the panel, the fallback `window_mask_low_confidence` includes a visible option to manually outline the exterior scenery through glass.
- `carvelo-photos` may wake GitHub Actions immediately using an **optional** secret `CARVELO_GITHUB_DISPATCH_TOKEN` (fine-grained Actions:write for this one repository). If absent, upload succeeds and the GitHub Actions schedule remains the fallback.
- A true always-on worker requires a separate persistent host and private Supabase credentials, not GitHub Actions. It is NOT silently started by these code changes.
- The user-supplied reference contains two cars. It must not be used directly as a ready-to-composite backdrop; a validated empty version of the exact showroom image must be added first. Existing photo scene remains active until this passes QA.
- New photo versions remain private until CARVELO staff accept the AI candidate and approve the branded photo.
