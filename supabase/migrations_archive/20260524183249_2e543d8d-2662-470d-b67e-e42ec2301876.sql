CREATE TABLE IF NOT EXISTS public.group_campuses (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, campus_id)
);

CREATE INDEX IF NOT EXISTS idx_group_campuses_campus ON public.group_campuses(campus_id);
CREATE INDEX IF NOT EXISTS idx_group_campuses_group ON public.group_campuses(group_id);

ALTER TABLE public.group_campuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view group campuses"
ON public.group_campuses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.organization_members om ON om.organization_id = g.organization_id
    WHERE g.id = group_campuses.group_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Org admins can manage group campuses"
ON public.group_campuses
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.organization_members om ON om.organization_id = g.organization_id
    WHERE g.id = group_campuses.group_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    JOIN public.organization_members om ON om.organization_id = g.organization_id
    WHERE g.id = group_campuses.group_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  )
);