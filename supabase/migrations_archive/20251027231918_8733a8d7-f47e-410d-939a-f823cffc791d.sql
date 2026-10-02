-- Add additional profile fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS department text;

COMMENT ON COLUMN public.profiles.phone IS 'User phone number';
COMMENT ON COLUMN public.profiles.location IS 'User location/city';
COMMENT ON COLUMN public.profiles.bio IS 'User biography';
COMMENT ON COLUMN public.profiles.job_title IS 'User job title';
COMMENT ON COLUMN public.profiles.department IS 'User department';