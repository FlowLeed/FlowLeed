CREATE TABLE public.org_engagement_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  preset_key text NOT NULL DEFAULT 'balanced',
  weights jsonb NOT NULL DEFAULT '{"consistency":35,"recency":20,"streak":15,"serving":20,"leadership":10,"group_membership":0,"flow_moments":0,"notes_interactions":0,"form_submissions":0,"event_attendance":0,"giving":0}'::jsonb,
  windows jsonb NOT NULL DEFAULT '{"consistency_weeks":12,"recency_days":90,"serving_days":90,"activity_days":90}'::jsonb,
  thresholds jsonb NOT NULL DEFAULT '{"highly_engaged":75,"active":50,"at_risk":25,"new_max_checkins":3}'::jsonb,
  ingredients jsonb NOT NULL DEFAULT '{"service_checkins":true,"group_attendance":true,"serving":true,"leadership":true,"group_membership":false,"flow_moments":false,"notes_interactions":false,"form_submissions":false,"event_attendance":false,"giving":false}'::jsonb,
  labels jsonb NOT NULL DEFAULT '{"highly_engaged":"Highly Engaged","active":"Active","at_risk":"At Risk","inactive":"Inactive","new":"New"}'::jsonb,
  safeguards jsonb NOT NULL DEFAULT '{"serving_keeps_active":true,"recent_attendance_days":14,"household_credit":true,"streak_break_misses":1,"count_partial_week":false}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.org_engagement_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.org_engagement_settings TO authenticated;
GRANT ALL ON public.org_engagement_settings TO service_role;

ALTER TABLE public.org_engagement_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view engagement settings"
ON public.org_engagement_settings FOR SELECT TO authenticated
USING (public.is_user_in_organization(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert engagement settings"
ON public.org_engagement_settings FOR INSERT TO authenticated
WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin'));

CREATE POLICY "Org admins can update engagement settings"
ON public.org_engagement_settings FOR UPDATE TO authenticated
USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin'))
WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin'));

CREATE POLICY "Org admins can delete engagement settings"
ON public.org_engagement_settings FOR DELETE TO authenticated
USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner','admin'));

CREATE TRIGGER org_engagement_settings_updated_at
BEFORE UPDATE ON public.org_engagement_settings
FOR EACH ROW EXECUTE FUNCTION public.chr_touch_updated_at();

ALTER TABLE public.contact_engagement_scores
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS consecutive_streak_weeks integer NOT NULL DEFAULT 0;