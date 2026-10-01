CREATE TABLE public.contact_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  import_tag text,
  pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  enrolled_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_message text,
  undone_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_imports_org ON public.contact_imports(organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_imports TO authenticated;
GRANT ALL ON public.contact_imports TO service_role;

ALTER TABLE public.contact_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view imports"
  ON public.contact_imports FOR SELECT TO authenticated
  USING (public.is_user_in_organization(auth.uid(), organization_id));

CREATE POLICY "Org members can create imports"
  ON public.contact_imports FOR INSERT TO authenticated
  WITH CHECK (public.is_user_in_organization(auth.uid(), organization_id) AND created_by_user_id = auth.uid());

CREATE POLICY "Creator or admins can update imports"
  ON public.contact_imports FOR UPDATE TO authenticated
  USING (created_by_user_id = auth.uid() OR public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin'));

CREATE POLICY "Creator or admins can delete imports"
  ON public.contact_imports FOR DELETE TO authenticated
  USING (created_by_user_id = auth.uid() OR public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin'));

CREATE TABLE public.contact_import_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id uuid NOT NULL REFERENCES public.contact_imports(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  reason text,
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_import_rows_import ON public.contact_import_rows(import_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_import_rows TO authenticated;
GRANT ALL ON public.contact_import_rows TO service_role;

ALTER TABLE public.contact_import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view import rows"
  ON public.contact_import_rows FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contact_imports ci
    WHERE ci.id = contact_import_rows.import_id
      AND public.is_user_in_organization(auth.uid(), ci.organization_id)
  ));

CREATE TRIGGER update_contact_imports_updated_at
  BEFORE UPDATE ON public.contact_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();