-- Create pipeline_team_members table for flow-based access control
CREATE TABLE public.pipeline_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pipeline_id, user_id)
);

-- Enable RLS on pipeline_team_members
ALTER TABLE public.pipeline_team_members ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is a team member of a flow
CREATE OR REPLACE FUNCTION public.is_flow_team_member(_user_id UUID, _pipeline_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pipeline_team_members
    WHERE user_id = _user_id
      AND pipeline_id = _pipeline_id
  );
$$;

-- Create helper function to get user's role in a flow
CREATE OR REPLACE FUNCTION public.get_flow_role(_user_id UUID, _pipeline_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.pipeline_team_members
  WHERE user_id = _user_id
    AND pipeline_id = _pipeline_id
  LIMIT 1;
$$;

-- RLS Policies for pipeline_team_members
CREATE POLICY "Users can view team members for flows they have access to"
ON public.pipeline_team_members
FOR SELECT
TO authenticated
USING (public.is_flow_team_member(auth.uid(), pipeline_id));

CREATE POLICY "Flow owners and admins can manage team members"
ON public.pipeline_team_members
FOR ALL
TO authenticated
USING (
  public.get_flow_role(auth.uid(), pipeline_id) IN ('owner', 'admin')
)
WITH CHECK (
  public.get_flow_role(auth.uid(), pipeline_id) IN ('owner', 'admin')
);

-- Update RLS policies for pipelines table
DROP POLICY IF EXISTS "Users can view pipelines in their organization" ON public.pipelines;
CREATE POLICY "Users can view pipelines they have access to"
ON public.pipelines
FOR SELECT
TO authenticated
USING (public.is_flow_team_member(auth.uid(), id));

DROP POLICY IF EXISTS "Users can update pipelines in their organization" ON public.pipelines;
CREATE POLICY "Flow owners and admins can update pipelines"
ON public.pipelines
FOR UPDATE
TO authenticated
USING (public.get_flow_role(auth.uid(), id) IN ('owner', 'admin'))
WITH CHECK (public.get_flow_role(auth.uid(), id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Users can delete pipelines in their organization" ON public.pipelines;
CREATE POLICY "Flow owners can delete pipelines"
ON public.pipelines
FOR DELETE
TO authenticated
USING (public.get_flow_role(auth.uid(), id) = 'owner');

-- Keep insert policy using organization membership for initial creation
-- After creation, trigger will add creator as owner

-- Update RLS policies for pipeline_stages table
DROP POLICY IF EXISTS "Users can view stages of pipelines in their organization" ON public.pipeline_stages;
CREATE POLICY "Users can view stages of flows they have access to"
ON public.pipeline_stages
FOR SELECT
TO authenticated
USING (public.is_flow_team_member(auth.uid(), pipeline_id));

DROP POLICY IF EXISTS "Users can create stages for pipelines in their organization" ON public.pipeline_stages;
CREATE POLICY "Flow team members can create stages"
ON public.pipeline_stages
FOR INSERT
TO authenticated
WITH CHECK (public.is_flow_team_member(auth.uid(), pipeline_id));

DROP POLICY IF EXISTS "Users can update stages of pipelines in their organization" ON public.pipeline_stages;
CREATE POLICY "Flow team members can update stages"
ON public.pipeline_stages
FOR UPDATE
TO authenticated
USING (public.is_flow_team_member(auth.uid(), pipeline_id))
WITH CHECK (public.is_flow_team_member(auth.uid(), pipeline_id));

DROP POLICY IF EXISTS "Users can delete stages of pipelines in their organization" ON public.pipeline_stages;
CREATE POLICY "Flow owners and admins can delete stages"
ON public.pipeline_stages
FOR DELETE
TO authenticated
USING (public.get_flow_role(auth.uid(), pipeline_id) IN ('owner', 'admin'));

-- Update RLS policies for pipeline_contacts table
DROP POLICY IF EXISTS "Users can view pipeline contacts in their organization" ON public.pipeline_contacts;
CREATE POLICY "Users can view contacts in flows they have access to"
ON public.pipeline_contacts
FOR SELECT
TO authenticated
USING (public.is_flow_team_member(auth.uid(), pipeline_id));

DROP POLICY IF EXISTS "Users can create pipeline contacts in their organization" ON public.pipeline_contacts;
CREATE POLICY "Flow team members can create pipeline contacts"
ON public.pipeline_contacts
FOR INSERT
TO authenticated
WITH CHECK (public.is_flow_team_member(auth.uid(), pipeline_id));

DROP POLICY IF EXISTS "Users can update pipeline contacts in their organization" ON public.pipeline_contacts;
CREATE POLICY "Flow team members can update pipeline contacts"
ON public.pipeline_contacts
FOR UPDATE
TO authenticated
USING (public.is_flow_team_member(auth.uid(), pipeline_id))
WITH CHECK (public.is_flow_team_member(auth.uid(), pipeline_id));

DROP POLICY IF EXISTS "Users can delete pipeline contacts in their organization" ON public.pipeline_contacts;
CREATE POLICY "Flow team members can delete pipeline contacts"
ON public.pipeline_contacts
FOR DELETE
TO authenticated
USING (public.is_flow_team_member(auth.uid(), pipeline_id));

-- Create trigger to automatically add pipeline creator as owner
CREATE OR REPLACE FUNCTION public.add_pipeline_creator_as_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pipeline_team_members (pipeline_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_pipeline_insert
AFTER INSERT ON public.pipelines
FOR EACH ROW
EXECUTE FUNCTION public.add_pipeline_creator_as_owner();

-- Migration: Add all organization members to existing pipelines
-- Add organization owners as flow owners, others as members
INSERT INTO public.pipeline_team_members (pipeline_id, user_id, role)
SELECT 
  p.id AS pipeline_id,
  om.user_id,
  CASE 
    WHEN om.role = 'owner' THEN 'owner'
    ELSE 'member'
  END AS role
FROM public.pipelines p
CROSS JOIN public.organization_members om
WHERE om.organization_id = p.organization_id
ON CONFLICT (pipeline_id, user_id) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_pipeline_team_members_updated_at
BEFORE UPDATE ON public.pipeline_team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();