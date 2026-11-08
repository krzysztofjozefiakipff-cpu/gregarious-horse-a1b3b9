-- CARVELO window scenery pilot enabled after CLIPSeg CPU inference smoke test (2026-11-08).
-- Every result is PRIVATE until approved by CARVELO staff; low-confidence masks preserve original.
update public.cv_photo_styles set is_active=true where code='windows-v1';
