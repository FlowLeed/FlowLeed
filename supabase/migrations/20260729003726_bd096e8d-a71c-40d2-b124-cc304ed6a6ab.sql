ALTER TABLE public.group_type_definitions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS pco_group_type_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS group_type_definitions_org_pco_uniq
  ON public.group_type_definitions (organization_id, pco_group_type_id)
  WHERE pco_group_type_id IS NOT NULL;