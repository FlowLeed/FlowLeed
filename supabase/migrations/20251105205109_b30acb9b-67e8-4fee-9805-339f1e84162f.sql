-- Fix email_verification_tokens RLS - remove overly permissive policy
-- Service role operations will still work as they bypass RLS entirely

-- Drop the problematic policy that makes the table publicly readable
DROP POLICY IF EXISTS "Service role can manage all verification tokens" ON email_verification_tokens;

-- Keep the policy that allows users to view their own tokens
-- (This should already exist, but recreating to be sure)
DROP POLICY IF EXISTS "Users can view their own verification tokens" ON email_verification_tokens;

CREATE POLICY "Users can view their own verification tokens"
ON email_verification_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role doesn't need a policy since it bypasses RLS
-- Edge functions use service role, so password reset will continue working