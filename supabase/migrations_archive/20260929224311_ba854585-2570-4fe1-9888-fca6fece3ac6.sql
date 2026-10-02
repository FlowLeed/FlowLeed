ALTER TABLE public.contact_prayer_requests
  ALTER COLUMN created_by_user_id DROP NOT NULL,
  ALTER COLUMN contact_id DROP NOT NULL,
  ALTER COLUMN title DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'prayer',
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS submitter_name text;

UPDATE public.contact_prayer_requests p SET organization_id = c.organization_id
FROM public.contacts c WHERE c.id = p.contact_id AND p.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cpr_org_created ON public.contact_prayer_requests(organization_id, created_at DESC);

CREATE POLICY "Org members can view org prayer requests"
ON public.contact_prayer_requests FOR SELECT TO authenticated
USING (organization_id IS NOT NULL AND public.is_user_in_organization(auth.uid(), organization_id));

CREATE POLICY "Org members can update org prayer requests"
ON public.contact_prayer_requests FOR UPDATE TO authenticated
USING (organization_id IS NOT NULL AND public.is_user_in_organization(auth.uid(), organization_id))
WITH CHECK (organization_id IS NOT NULL AND public.is_user_in_organization(auth.uid(), organization_id));

CREATE POLICY "Org members can add org prayer requests"
ON public.contact_prayer_requests FOR INSERT TO authenticated
WITH CHECK (organization_id IS NOT NULL AND public.is_user_in_organization(auth.uid(), organization_id));

CREATE TABLE public.prayer_request_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_request_id uuid NOT NULL REFERENCES public.contact_prayer_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.prayer_request_prayers TO authenticated;
GRANT ALL ON public.prayer_request_prayers TO service_role;
ALTER TABLE public.prayer_request_prayers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_prp_request ON public.prayer_request_prayers(prayer_request_id);
CREATE POLICY "Org members view prayers" ON public.prayer_request_prayers FOR SELECT TO authenticated
USING (public.is_user_in_organization(auth.uid(), organization_id));
CREATE POLICY "Members log own prayers" ON public.prayer_request_prayers FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_user_in_organization(auth.uid(), organization_id));
CREATE POLICY "Members remove own prayers" ON public.prayer_request_prayers FOR DELETE TO authenticated
USING (user_id = auth.uid());