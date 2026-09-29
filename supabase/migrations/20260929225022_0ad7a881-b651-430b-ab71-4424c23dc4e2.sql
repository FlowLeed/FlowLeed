CREATE TABLE public.prayer_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  stage_order int NOT NULL DEFAULT 0,
  is_answered_step boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prayer_stages TO authenticated;
GRANT ALL ON public.prayer_stages TO service_role;
ALTER TABLE public.prayer_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage prayer stages" ON public.prayer_stages FOR ALL TO authenticated
USING (public.is_user_in_organization(auth.uid(), organization_id))
WITH CHECK (public.is_user_in_organization(auth.uid(), organization_id));
CREATE INDEX idx_prayer_stages_org ON public.prayer_stages(organization_id, stage_order);
ALTER TABLE public.contact_prayer_requests
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.prayer_stages(id) ON DELETE SET NULL;