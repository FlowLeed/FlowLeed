-- Update is_flow_team_member() to grant org owners/admins access to all flows
CREATE OR REPLACE FUNCTION public.is_flow_team_member(_user_id uuid, _pipeline_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.pipeline_team_members
    WHERE user_id = _user_id
      AND pipeline_id = _pipeline_id
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.pipelines p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = _pipeline_id
      AND om.user_id = _user_id
      AND om.role IN ('owner', 'admin')
  );
$function$;

-- Update get_flow_role() to return 'lead' for org owners/admins
CREATE OR REPLACE FUNCTION public.get_flow_role(_user_id uuid, _pipeline_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1
        FROM public.pipelines p
        JOIN public.organization_members om ON om.organization_id = p.organization_id
        WHERE p.id = _pipeline_id
          AND om.user_id = _user_id
          AND om.role IN ('owner', 'admin')
      ) THEN 'lead'
      ELSE (
        SELECT role
        FROM public.pipeline_team_members
        WHERE user_id = _user_id
          AND pipeline_id = _pipeline_id
        LIMIT 1
      )
    END;
$function$;