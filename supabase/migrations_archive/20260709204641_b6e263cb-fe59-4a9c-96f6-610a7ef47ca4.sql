
-- =========================================================
-- Custom Signals
-- =========================================================

CREATE TABLE public.custom_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  polarity TEXT NOT NULL DEFAULT 'neutral' CHECK (polarity IN ('positive','neutral','negative')),
  category TEXT NOT NULL DEFAULT 'Custom',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','watch','risk')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_signals TO authenticated;
GRANT ALL ON public.custom_signals TO service_role;
ALTER TABLE public.custom_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view custom signals"
  ON public.custom_signals FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = custom_signals.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert custom signals"
  ON public.custom_signals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = custom_signals.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update custom signals"
  ON public.custom_signals FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = custom_signals.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete custom signals"
  ON public.custom_signals FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = custom_signals.organization_id AND om.user_id = auth.uid()
  ));

CREATE INDEX idx_custom_signals_org ON public.custom_signals(organization_id) WHERE enabled = true;

-- =========================================================
-- Custom Signal Rules (AND/OR tree)
-- =========================================================

CREATE TABLE public.custom_signal_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id UUID NOT NULL REFERENCES public.custom_signals(id) ON DELETE CASCADE,
  rule_combinator TEXT NOT NULL DEFAULT 'AND' CHECK (rule_combinator IN ('AND','OR')),
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (signal_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_signal_rules TO authenticated;
GRANT ALL ON public.custom_signal_rules TO service_role;
ALTER TABLE public.custom_signal_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view custom signal rules"
  ON public.custom_signal_rules FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.custom_signals cs
    JOIN public.organization_members om ON om.organization_id = cs.organization_id
    WHERE cs.id = custom_signal_rules.signal_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can manage custom signal rules"
  ON public.custom_signal_rules FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.custom_signals cs
    JOIN public.organization_members om ON om.organization_id = cs.organization_id
    WHERE cs.id = custom_signal_rules.signal_id AND om.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.custom_signals cs
    JOIN public.organization_members om ON om.organization_id = cs.organization_id
    WHERE cs.id = custom_signal_rules.signal_id AND om.user_id = auth.uid()
  ));

-- =========================================================
-- Custom Signal Contact matches
-- =========================================================

CREATE TABLE public.custom_signal_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id UUID NOT NULL REFERENCES public.custom_signals(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleared_at TIMESTAMPTZ,
  UNIQUE (signal_id, contact_id)
);
GRANT SELECT ON public.custom_signal_contacts TO authenticated;
GRANT ALL ON public.custom_signal_contacts TO service_role;
ALTER TABLE public.custom_signal_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view custom signal matches"
  ON public.custom_signal_contacts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = custom_signal_contacts.organization_id AND om.user_id = auth.uid()
  ));

CREATE INDEX idx_custom_signal_contacts_lookup
  ON public.custom_signal_contacts(organization_id, signal_id, contact_id)
  WHERE cleared_at IS NULL;
CREATE INDEX idx_custom_signal_contacts_contact
  ON public.custom_signal_contacts(contact_id) WHERE cleared_at IS NULL;

-- =========================================================
-- Signal Agent — per-org config
-- =========================================================

CREATE TABLE public.signal_agent_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  watch_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_actions JSONB NOT NULL DEFAULT '["notify"]'::jsonb,
  default_assignee_strategy TEXT NOT NULL DEFAULT 'assigned_user'
    CHECK (default_assignee_strategy IN ('assigned_user','campus_pastor','flow_owner')),
  quiet_hours JSONB NOT NULL DEFAULT '{"start":"21:00","end":"08:00"}'::jsonb,
  max_suggestions_per_day INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signal_agent_configs TO authenticated;
GRANT ALL ON public.signal_agent_configs TO service_role;
ALTER TABLE public.signal_agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view agent config"
  ON public.signal_agent_configs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = signal_agent_configs.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can manage agent config"
  ON public.signal_agent_configs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = signal_agent_configs.organization_id AND om.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = signal_agent_configs.organization_id AND om.user_id = auth.uid()
  ));

-- =========================================================
-- Signal Agent — per-signal action recipes
-- =========================================================

CREATE TABLE public.signal_agent_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  signal_key TEXT NOT NULL,
  suggested_action TEXT NOT NULL
    CHECK (suggested_action IN ('notify','add_to_flow','create_task','draft_message')),
  action_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, signal_key, suggested_action)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signal_agent_rules TO authenticated;
GRANT ALL ON public.signal_agent_rules TO service_role;
ALTER TABLE public.signal_agent_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view agent rules"
  ON public.signal_agent_rules FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = signal_agent_rules.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can manage agent rules"
  ON public.signal_agent_rules FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = signal_agent_rules.organization_id AND om.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = signal_agent_rules.organization_id AND om.user_id = auth.uid()
  ));

-- =========================================================
-- Signal Agent — suggestion review queue
-- =========================================================

CREATE TABLE public.signal_agent_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  signal_key TEXT NOT NULL,
  signal_source TEXT NOT NULL DEFAULT 'builtin' CHECK (signal_source IN ('builtin','custom')),
  action_type TEXT NOT NULL
    CHECK (action_type IN ('notify','add_to_flow','create_task','draft_message')),
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasoning TEXT,
  confidence NUMERIC(3,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','dismissed','expired')),
  assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signal_agent_suggestions TO authenticated;
GRANT ALL ON public.signal_agent_suggestions TO service_role;
ALTER TABLE public.signal_agent_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view suggestions"
  ON public.signal_agent_suggestions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = signal_agent_suggestions.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update suggestions"
  ON public.signal_agent_suggestions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = signal_agent_suggestions.organization_id AND om.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = signal_agent_suggestions.organization_id AND om.user_id = auth.uid()
  ));

CREATE INDEX idx_signal_suggestions_org_status
  ON public.signal_agent_suggestions(organization_id, status, created_at DESC);
CREATE INDEX idx_signal_suggestions_contact
  ON public.signal_agent_suggestions(contact_id, status);
CREATE INDEX idx_signal_suggestions_dedupe
  ON public.signal_agent_suggestions(organization_id, contact_id, signal_key, action_type, status);

-- =========================================================
-- Timestamp triggers
-- =========================================================

CREATE TRIGGER trg_custom_signals_updated_at
  BEFORE UPDATE ON public.custom_signals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_custom_signal_rules_updated_at
  BEFORE UPDATE ON public.custom_signal_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_signal_agent_configs_updated_at
  BEFORE UPDATE ON public.signal_agent_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_signal_agent_rules_updated_at
  BEFORE UPDATE ON public.signal_agent_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_signal_agent_suggestions_updated_at
  BEFORE UPDATE ON public.signal_agent_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
