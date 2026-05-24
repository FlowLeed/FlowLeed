ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pco_campus_id text;

CREATE INDEX IF NOT EXISTS idx_groups_campus_id ON public.groups(campus_id);
CREATE INDEX IF NOT EXISTS idx_groups_pco_campus_id ON public.groups(pco_campus_id);