CREATE TABLE public.organization_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid,
  UNIQUE (organization_id, feature_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_features TO authenticated;
GRANT ALL ON public.organization_features TO service_role;

ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's feature flags (needed to gate UI)
CREATE POLICY "Org members can view their org features"
ON public.organization_features
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_features.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.is_system_admin(auth.uid())
);

-- Only super admins can modify
CREATE POLICY "System admins can insert org features"
ON public.organization_features
FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can update org features"
ON public.organization_features
FOR UPDATE
TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can delete org features"
ON public.organization_features
FOR DELETE
TO authenticated
USING (public.is_system_admin(auth.uid()));

CREATE TRIGGER update_organization_features_updated_at
BEFORE UPDATE ON public.organization_features
FOR EACH ROW EXECUTE FUNCTION public.update_pipeline_contacts_updated_at();
