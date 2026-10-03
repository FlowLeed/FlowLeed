GRANT SELECT ON public.care_agent_state TO authenticated;
CREATE POLICY "Org members view care agent status" ON public.care_agent_state FOR SELECT TO authenticated
  USING (public.is_user_in_organization(auth.uid(), organization_id));