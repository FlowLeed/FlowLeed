CREATE TABLE public.care_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  briefing_date date NOT NULL DEFAULT current_date,
  kind text NOT NULL CHECK (kind IN ('life_moment','faith_moment','drift','follow_up')),
  signal_key text,
  headline text NOT NULL,
  why text NOT NULL,
  known jsonb NOT NULL DEFAULT '[]'::jsonb,
  best_connection jsonb,
  sensitive boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','taking','delegated','handled','snoozed','dismissed')),
  outcome text,
  outcome_note text,
  snoozed_until timestamptz,
  follow_up_at timestamptz,
  follow_up_of uuid REFERENCES public.care_recommendations(id) ON DELETE SET NULL,
  task_id uuid,
  delegated_to_user_id uuid,
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_user_id, contact_id, briefing_date)
);
GRANT SELECT, UPDATE ON public.care_recommendations TO authenticated;
GRANT ALL ON public.care_recommendations TO service_role;
ALTER TABLE public.care_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipients view their care briefing" ON public.care_recommendations FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid() AND public.is_user_in_organization(auth.uid(), organization_id));
CREATE POLICY "Recipients act on their care briefing" ON public.care_recommendations FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());
CREATE INDEX care_rec_recipient_idx ON public.care_recommendations (recipient_user_id, briefing_date DESC);
CREATE INDEX care_rec_contact_idx ON public.care_recommendations (contact_id, created_at DESC);
CREATE TRIGGER care_rec_updated BEFORE UPDATE ON public.care_recommendations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.care_agent_state (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_run_date date,
  locked_until timestamptz,
  paused_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.care_agent_state TO service_role;
ALTER TABLE public.care_agent_state ENABLE ROW LEVEL SECURITY;

-- Called through the Vault helper (project_url + cron_secret); care-agent-run checks the cron secret.
SELECT cron.schedule('care-agent-daily', '0 12 * * *',
  $$SELECT private.invoke_edge_function('care-agent-run', '{"source": "cron"}'::jsonb)$$);