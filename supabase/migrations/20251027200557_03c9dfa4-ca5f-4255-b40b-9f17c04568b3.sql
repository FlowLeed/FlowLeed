-- Merge manager and contributor into member role

-- Step 1: First drop the existing constraint to allow updates
ALTER TABLE public.pipeline_team_members
DROP CONSTRAINT IF EXISTS pipeline_team_members_role_check;

-- Step 2: Update all manager and contributor roles to member
UPDATE public.pipeline_team_members
SET role = 'member'
WHERE role IN ('manager', 'contributor');

-- Step 3: Now add the new simplified constraint
ALTER TABLE public.pipeline_team_members
ADD CONSTRAINT pipeline_team_members_role_check 
CHECK (role IN ('lead', 'member'));

-- Step 4: Update RLS policies to only allow leads to manage
DROP POLICY IF EXISTS "Flow leads and managers can update pipelines" ON public.pipelines;
CREATE POLICY "Flow leads can update pipelines" 
ON public.pipelines 
FOR UPDATE 
USING (get_flow_role(auth.uid(), id) = 'lead')
WITH CHECK (get_flow_role(auth.uid(), id) = 'lead');

DROP POLICY IF EXISTS "Flow leads and managers can delete stages" ON public.pipeline_stages;
CREATE POLICY "Flow leads can delete stages" 
ON public.pipeline_stages 
FOR DELETE 
USING (get_flow_role(auth.uid(), pipeline_id) = 'lead');

DROP POLICY IF EXISTS "Flow leads and managers can manage team members" ON public.pipeline_team_members;
CREATE POLICY "Flow leads can manage team members" 
ON public.pipeline_team_members 
FOR ALL 
USING (get_flow_role(auth.uid(), pipeline_id) = 'lead')
WITH CHECK (get_flow_role(auth.uid(), pipeline_id) = 'lead');