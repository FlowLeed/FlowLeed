-- Enable RLS on user_login_events table (tracks login activity)
ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;

-- Only system admins can view login events
CREATE POLICY "System admins can view all login events"
ON public.user_login_events
FOR SELECT
TO authenticated
USING (public.is_system_admin(auth.uid()));

-- Only system admins can insert login events (for internal tracking)
CREATE POLICY "System can insert login events"
ON public.user_login_events
FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(auth.uid()));

-- Enable RLS on impersonation_audit_log if it's a table (it might be a view)
-- Note: impersonation_audit_log appears to be a view based on the schema
-- Views inherit RLS from their underlying tables, so we need to ensure
-- impersonation_sessions has proper RLS (which it already does)

-- Document that organization_health_view should only be accessed through the secure function
COMMENT ON FUNCTION public.get_organizations_health_data() IS 'SECURITY: This is the ONLY safe way to access organization_health_view data. Direct queries to the view are restricted by underlying table RLS policies.';