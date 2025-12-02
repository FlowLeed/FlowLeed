-- Add public signup columns to groups table
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
ADD COLUMN IF NOT EXISTS public_signup_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS allow_public_signup boolean NOT NULL DEFAULT false;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_groups_public_signup_token ON public.groups(public_signup_token) WHERE allow_public_signup = true;

-- Create RLS policy for public access to groups with signup enabled
CREATE POLICY "Anyone can view groups with public signup enabled"
ON public.groups
FOR SELECT
USING (allow_public_signup = true AND visibility IN ('public', 'unlisted'));

-- Create group_signup_requests table for tracking signups
CREATE TABLE IF NOT EXISTS public.group_signup_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  processed_by_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  notes text
);

-- Enable RLS on group_signup_requests
ALTER TABLE public.group_signup_requests ENABLE ROW LEVEL SECURITY;

-- Users in org can view and manage signup requests
CREATE POLICY "Users can view signup requests for groups in their organization"
ON public.group_signup_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM groups g
    JOIN organization_members om ON om.organization_id = g.organization_id
    WHERE g.id = group_signup_requests.group_id AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage signup requests for groups in their organization"
ON public.group_signup_requests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM groups g
    JOIN organization_members om ON om.organization_id = g.organization_id
    WHERE g.id = group_signup_requests.group_id AND om.user_id = auth.uid()
  )
);