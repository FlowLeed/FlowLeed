-- 1. Integrations: hide OAuth tokens & credentials from clients
REVOKE SELECT (oauth_access_token, oauth_refresh_token, credentials)
  ON public.integrations FROM anon, authenticated;

-- 2. user_pco_connections: hide OAuth tokens from clients
REVOKE SELECT (oauth_access_token, oauth_refresh_token)
  ON public.user_pco_connections FROM anon, authenticated;

-- 3. organizations: hide billing/admin/contact fields from regular members
REVOKE SELECT (
  stripe_customer_id,
  stripe_subscription_id,
  billing_email,
  primary_contact_email,
  primary_contact_phone,
  total_revenue,
  plan_price,
  fl_admin_notes
) ON public.organizations FROM anon, authenticated;

-- 4. Invitations: restrict reads (incl. token col) to org owners/admins
DROP POLICY IF EXISTS "Users can view invitations for their organization" ON public.invitations;
CREATE POLICY "Org admins can view invitations"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = invitations.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- 5. Notifications: only service role may insert
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "Service role can create notifications"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 6. PCO sync debug logs: only service role may insert
DROP POLICY IF EXISTS "Authenticated users can insert pco sync debug logs" ON public.pco_sync_debug_logs;
DROP POLICY IF EXISTS "System can insert sync logs" ON public.pco_sync_debug_logs;
DROP POLICY IF EXISTS "Anyone can insert pco sync debug logs" ON public.pco_sync_debug_logs;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='pco_sync_debug_logs' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.pco_sync_debug_logs', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Service role can insert pco sync debug logs"
  ON public.pco_sync_debug_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 7. user_login_events: allow service role inserts in addition to existing rules
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='user_login_events' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.user_login_events', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Service role can record login events"
  ON public.user_login_events FOR INSERT
  TO service_role
  WITH CHECK (true);
CREATE POLICY "System admins can record login events"
  ON public.user_login_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

-- 8. Storage: group-images bucket — require org membership for updates/deletes
DROP POLICY IF EXISTS "Authenticated users can delete group images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update group images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload group images" ON storage.objects;

-- Helper: check if current user belongs to the org that owns the group encoded in the path
-- Path convention: groups/{groupId}-{timestamp}.{ext}
CREATE OR REPLACE FUNCTION public.user_can_manage_group_image(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    JOIN public.organization_members om
      ON om.organization_id = g.organization_id
    WHERE om.user_id = auth.uid()
      AND _path LIKE 'groups/' || g.id::text || '-%'
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_manage_group_image(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_can_manage_group_image(text) TO authenticated;

CREATE POLICY "Org members can upload group images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group-images'
    AND public.user_can_manage_group_image(name)
  );

CREATE POLICY "Org members can update their group images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'group-images'
    AND public.user_can_manage_group_image(name)
  )
  WITH CHECK (
    bucket_id = 'group-images'
    AND public.user_can_manage_group_image(name)
  );

CREATE POLICY "Org members can delete their group images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'group-images'
    AND public.user_can_manage_group_image(name)
  );