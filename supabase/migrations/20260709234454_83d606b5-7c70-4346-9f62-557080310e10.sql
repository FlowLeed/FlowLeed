-- Reports
CREATE TABLE public.church_health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by_user_id UUID,
  status TEXT NOT NULL DEFAULT 'queued',
  overall_score NUMERIC,
  section_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_storage_path TEXT,
  share_token TEXT UNIQUE,
  share_enabled BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chr_status_check CHECK (status IN ('queued','running','ready','failed'))
);

GRANT SELECT ON public.church_health_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.church_health_reports TO authenticated;
GRANT ALL ON public.church_health_reports TO service_role;

ALTER TABLE public.church_health_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org reports"
ON public.church_health_reports FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can create reports for their org"
ON public.church_health_reports FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can update their org reports"
ON public.church_health_reports FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can delete their org reports"
ON public.church_health_reports FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view shared reports"
ON public.church_health_reports FOR SELECT
TO anon, authenticated
USING (share_enabled = true AND share_token IS NOT NULL);

CREATE INDEX idx_chr_org ON public.church_health_reports(organization_id, created_at DESC);
CREATE INDEX idx_chr_share_token ON public.church_health_reports(share_token) WHERE share_token IS NOT NULL;

-- Findings
CREATE TABLE public.church_health_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.church_health_reports(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  metric_value NUMERIC,
  metric_label TEXT,
  contact_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chf_section_check CHECK (section IN ('at_risk','volunteers','groups')),
  CONSTRAINT chf_severity_check CHECK (severity IN ('low','medium','high'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.church_health_findings TO authenticated;
GRANT ALL ON public.church_health_findings TO service_role;

ALTER TABLE public.church_health_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view findings for their org"
ON public.church_health_findings FOR SELECT
TO authenticated
USING (
  report_id IN (
    SELECT id FROM public.church_health_reports
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Members can manage findings for their org"
ON public.church_health_findings FOR ALL
TO authenticated
USING (
  report_id IN (
    SELECT id FROM public.church_health_reports
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  report_id IN (
    SELECT id FROM public.church_health_reports
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);

CREATE INDEX idx_chf_report ON public.church_health_findings(report_id, sort_order);

-- updated_at trigger for reports
CREATE OR REPLACE FUNCTION public.chr_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chr_touch_updated_at
BEFORE UPDATE ON public.church_health_reports
FOR EACH ROW EXECUTE FUNCTION public.chr_touch_updated_at();

-- Add attribution fields to profiles for ad tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_intent TEXT,
  ADD COLUMN IF NOT EXISTS signup_utm JSONB,
  ADD COLUMN IF NOT EXISTS signup_referrer TEXT;
