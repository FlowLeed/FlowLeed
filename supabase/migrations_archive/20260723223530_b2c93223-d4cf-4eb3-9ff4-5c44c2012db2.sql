ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
UPDATE public.profiles SET email_verified_at = COALESCE(email_verified_at, created_at, now()) WHERE email_verified_at IS NULL;
CREATE INDEX IF NOT EXISTS profiles_email_verified_at_idx ON public.profiles(email_verified_at);