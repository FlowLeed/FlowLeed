-- Rename flow roles for better clarity
-- Organization roles: Owner, Admin, Member (remain unchanged)
-- Flow roles: owner->lead, admin->manager, member->contributor

-- Step 1: Drop old check constraint first (before updating data)
ALTER TABLE public.pipeline_team_members
DROP CONSTRAINT IF EXISTS pipeline_team_members_role_check;

-- Step 2: Update existing role values in pipeline_team_members table
UPDATE public.pipeline_team_members
SET role = CASE
  WHEN role = 'owner' THEN 'lead'
  WHEN role = 'admin' THEN 'manager'
  WHEN role = 'member' THEN 'contributor'
  ELSE role
END;

-- Step 3: Add new check constraint with updated role values
ALTER TABLE public.pipeline_team_members
ADD CONSTRAINT pipeline_team_members_role_check 
CHECK (role IN ('lead', 'manager', 'contributor'));

-- Step 4: Update the trigger function that adds pipeline creator
CREATE OR REPLACE FUNCTION public.add_pipeline_creator_as_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.pipeline_team_members (pipeline_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'lead');
  RETURN NEW;
END;
$function$;

-- Step 5: Update RLS policies that reference flow roles

-- Update pipelines policies
DROP POLICY IF EXISTS "Flow owners and admins can update pipelines" ON public.pipelines;
CREATE POLICY "Flow leads and managers can update pipelines" 
ON public.pipelines 
FOR UPDATE 
USING (get_flow_role(auth.uid(), id) = ANY (ARRAY['lead'::text, 'manager'::text]))
WITH CHECK (get_flow_role(auth.uid(), id) = ANY (ARRAY['lead'::text, 'manager'::text]));

DROP POLICY IF EXISTS "Flow owners can delete pipelines" ON public.pipelines;
CREATE POLICY "Flow leads can delete pipelines" 
ON public.pipelines 
FOR DELETE 
USING (get_flow_role(auth.uid(), id) = 'lead'::text);

-- Update pipeline_stages policies
DROP POLICY IF EXISTS "Flow owners and admins can delete stages" ON public.pipeline_stages;
CREATE POLICY "Flow leads and managers can delete stages" 
ON public.pipeline_stages 
FOR DELETE 
USING (get_flow_role(auth.uid(), pipeline_id) = ANY (ARRAY['lead'::text, 'manager'::text]));

-- Update pipeline_team_members policies
DROP POLICY IF EXISTS "Flow owners and admins can manage team members" ON public.pipeline_team_members;
CREATE POLICY "Flow leads and managers can manage team members" 
ON public.pipeline_team_members 
FOR ALL 
USING (get_flow_role(auth.uid(), pipeline_id) = ANY (ARRAY['lead'::text, 'manager'::text]))
WITH CHECK (get_flow_role(auth.uid(), pipeline_id) = ANY (ARRAY['lead'::text, 'manager'::text]));