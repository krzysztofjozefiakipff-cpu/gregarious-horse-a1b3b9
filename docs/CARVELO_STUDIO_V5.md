# carVelo Studio v5 — active showroom reference

The empty photographic showroom asset is `assets/brand/carvelo-showroom-empty-v5.webp`.
Both GitHub Actions `render_github.py` and the optional persistent worker `persistent_worker.py` now read this exact WebP. `studio_compose.render_scene` loads it directly, with no legacy wall-logo inpainting; it uses aspect-preserving crop to the requested photo dimensions. The approved official corner logo is applied to every result.

The result is marked `scene_version=studio-v5` and remains private until manual moderation. Database `cv_ai_complete_v3` and broker validation must accept `studio-v5`. Old `studio-v4` photos remain untouched. Test coverage includes the new source image and grounding.
