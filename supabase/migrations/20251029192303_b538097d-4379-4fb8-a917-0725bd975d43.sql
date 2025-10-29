-- Fix RLS policy for user_logins table to be more restrictive
DROP POLICY IF EXISTS "System can manage user logins" ON public.user_logins;

-- Only allow service role to manage user logins (used by the track_user_login function)
CREATE POLICY "Service role can manage user logins"
  ON public.user_logins
  FOR ALL
  USING (false)
  WITH CHECK (false);