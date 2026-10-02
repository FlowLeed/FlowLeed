-- Backfill visibility from PCO Church Center URL captured during prior syncs.
UPDATE public.groups
SET visibility = 'public'
WHERE pco_group_id IS NOT NULL
  AND visibility <> 'public'
  AND metadata->>'pco_url' IS NOT NULL
  AND metadata->>'pco_url' <> '';