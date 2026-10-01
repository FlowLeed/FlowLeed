CREATE TABLE public.ai_tool_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tool_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  safety_level text NOT NULL DEFAULT 'read',
  updated_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, tool_key),
  CONSTRAINT ai_tool_settings_safety_level_valid CHECK (safety_level IN ('read', 'prepare', 'act'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_tool_settings TO authenticated;
GRANT ALL ON public.ai_tool_settings TO service_role;
ALTER TABLE public.ai_tool_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization members can view AI tool settings"
ON public.ai_tool_settings FOR SELECT TO authenticated
USING (public.is_user_in_organization(auth.uid(), organization_id));
CREATE POLICY "Organization admins can create AI tool settings"
ON public.ai_tool_settings FOR INSERT TO authenticated
WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner', 'admin'));
CREATE POLICY "Organization admins can update AI tool settings"
ON public.ai_tool_settings FOR UPDATE TO authenticated
USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner', 'admin'))
WITH CHECK (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner', 'admin'));
CREATE POLICY "Organization admins can delete AI tool settings"
ON public.ai_tool_settings FOR DELETE TO authenticated
USING (public.get_user_organization_role(auth.uid(), organization_id) IN ('owner', 'admin'));
CREATE TRIGGER update_ai_tool_settings_updated_at
BEFORE UPDATE ON public.ai_tool_settings
FOR EACH ROW EXECUTE FUNCTION public.update_pipeline_contacts_updated_at();

CREATE TABLE public.ai_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL,
  tool_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  summary text NOT NULL,
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_payload jsonb,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_action_requests_status_valid CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'failed', 'expired'))
);
GRANT SELECT ON public.ai_action_requests TO authenticated;
GRANT ALL ON public.ai_action_requests TO service_role;
ALTER TABLE public.ai_action_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own AI action requests"
ON public.ai_action_requests FOR SELECT TO authenticated
USING (requested_by_user_id = auth.uid() OR public.get_user_organization_role(auth.uid(), organization_id) IN ('owner', 'admin'));
CREATE TRIGGER update_ai_action_requests_updated_at
BEFORE UPDATE ON public.ai_action_requests
FOR EACH ROW EXECUTE FUNCTION public.update_pipeline_contacts_updated_at();
CREATE INDEX ai_action_requests_user_status_idx
ON public.ai_action_requests (requested_by_user_id, status, created_at DESC);

CREATE TABLE public.ai_tool_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL,
  tool_key text NOT NULL,
  action_request_id uuid REFERENCES public.ai_action_requests(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  affected_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_tool_audit_logs_outcome_valid CHECK (outcome IN ('prepared', 'completed', 'cancelled', 'failed', 'blocked'))
);
GRANT SELECT ON public.ai_tool_audit_logs TO authenticated;
GRANT ALL ON public.ai_tool_audit_logs TO service_role;
ALTER TABLE public.ai_tool_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization members can view AI tool audit history"
ON public.ai_tool_audit_logs FOR SELECT TO authenticated
USING (public.is_user_in_organization(auth.uid(), organization_id));
CREATE INDEX ai_tool_audit_logs_org_created_idx
ON public.ai_tool_audit_logs (organization_id, created_at DESC);