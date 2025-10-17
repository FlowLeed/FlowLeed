-- Create table for email verification tokens
CREATE TABLE IF NOT EXISTS public.auth_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text UNIQUE NOT NULL,
  token_type text NOT NULL CHECK (token_type IN ('signup', 'password_reset', 'email_change', 'magic_link')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_verification_tokens_hash ON public.auth_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON public.auth_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON public.auth_verification_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.auth_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access (via edge functions)
CREATE POLICY "Service role only" ON public.auth_verification_tokens
  FOR ALL USING (false);

-- Auto-verify all existing users (mark email as confirmed)
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users WHERE email_confirmed_at IS NULL
  LOOP
    UPDATE auth.users 
    SET email_confirmed_at = now() 
    WHERE id = user_record.id;
  END LOOP;
END $$;