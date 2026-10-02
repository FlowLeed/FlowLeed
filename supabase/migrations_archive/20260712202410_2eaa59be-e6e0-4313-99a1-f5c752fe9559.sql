
-- FORMS
CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT false,
  brand_color text,
  logo_url text,
  redirect_url text,
  success_message text DEFAULT 'Thanks! We''ll be in touch soon.',
  routing_rules jsonb,
  submission_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.forms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read published forms"
  ON public.forms FOR SELECT TO anon
  USING (is_published = true);

CREATE POLICY "Org members can view their forms"
  ON public.forms FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = forms.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can manage their forms"
  ON public.forms FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = forms.organization_id AND om.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = forms.organization_id AND om.user_id = auth.uid()
  ));

CREATE INDEX idx_forms_org ON public.forms(organization_id);
CREATE INDEX idx_forms_slug ON public.forms(slug);

-- FORM FIELDS
CREATE TABLE public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','textarea','email','phone','number','date','select','radio','checkbox')),
  options jsonb,
  required boolean NOT NULL DEFAULT false,
  placeholder text,
  help_text text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, field_key)
);

GRANT SELECT ON public.form_fields TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_fields TO authenticated;
GRANT ALL ON public.form_fields TO service_role;

ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read fields of published forms"
  ON public.form_fields FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_fields.form_id AND f.is_published = true));

CREATE POLICY "Org members can view fields"
  ON public.form_fields FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.organization_members om ON om.organization_id = f.organization_id
    WHERE f.id = form_fields.form_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can manage fields"
  ON public.form_fields FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.organization_members om ON om.organization_id = f.organization_id
    WHERE f.id = form_fields.form_id AND om.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.forms f
    JOIN public.organization_members om ON om.organization_id = f.organization_id
    WHERE f.id = form_fields.form_id AND om.user_id = auth.uid()
  ));

CREATE INDEX idx_form_fields_form ON public.form_fields(form_id, sort_order);

-- FORM SUBMISSIONS
CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.form_submissions TO authenticated;
GRANT ALL ON public.form_submissions TO service_role;

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = form_submissions.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete submissions"
  ON public.form_submissions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = form_submissions.organization_id AND om.user_id = auth.uid()
  ));

CREATE INDEX idx_form_submissions_form ON public.form_submissions(form_id, created_at DESC);
CREATE INDEX idx_form_submissions_org ON public.form_submissions(organization_id, created_at DESC);

-- updated_at triggers
CREATE TRIGGER trg_forms_updated_at BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_form_fields_updated_at BEFORE UPDATE ON public.form_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Feature flag: forms
-- Enable for existing orgs, OFF by default for new ones
INSERT INTO public.organization_features (organization_id, feature_key, enabled)
SELECT o.id, 'forms', true
FROM public.organizations o
ON CONFLICT (organization_id, feature_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_default_org_features()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_features (organization_id, feature_key, enabled)
  VALUES
    (NEW.id, 'texting', false),
    (NEW.id, 'calling', false),
    (NEW.id, 'content', false),
    (NEW.id, 'signals', false),
    (NEW.id, 'forms', false)
  ON CONFLICT (organization_id, feature_key) DO NOTHING;
  RETURN NEW;
END;
$$;
