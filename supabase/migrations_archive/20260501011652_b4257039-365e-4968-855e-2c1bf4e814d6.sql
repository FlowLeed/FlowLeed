-- Update function to include owner's name in Personal Flow name
CREATE OR REPLACE FUNCTION public.create_personal_flow_for_user(p_user_id uuid, p_org_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_id uuid;
  v_max_order integer;
  v_full_name text;
  v_first_name text;
  v_flow_name text;
BEGIN
  -- Skip if user already has a Personal Flow they lead in this org (match any name ending in 'Personal Flow')
  IF EXISTS (
    SELECT 1
    FROM pipelines p
    JOIN pipeline_team_members ptm ON ptm.pipeline_id = p.id
    WHERE p.organization_id = p_org_id
      AND p.name LIKE '%Personal Flow'
      AND ptm.user_id = p_user_id
      AND ptm.role = 'lead'
  ) THEN
    RETURN NULL;
  END IF;

  -- Get user's first name from profile
  SELECT full_name INTO v_full_name FROM profiles WHERE user_id = p_user_id LIMIT 1;
  v_first_name := NULLIF(split_part(COALESCE(v_full_name, ''), ' ', 1), '');

  IF v_first_name IS NOT NULL THEN
    v_flow_name := v_first_name || '''s Personal Flow';
  ELSE
    v_flow_name := 'Personal Flow';
  END IF;

  SELECT COALESCE(MAX(flow_order), -1) + 1 INTO v_max_order
  FROM pipelines WHERE organization_id = p_org_id;

  INSERT INTO pipelines (organization_id, name, description, icon, flow_order, flow_type)
  VALUES (p_org_id, v_flow_name, 'Your personal follow-up flow for staying connected with people.', 'User', v_max_order, 'linear')
  RETURNING id INTO v_pipeline_id;

  INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
    (v_pipeline_id, 'Need to Check In', '#3b82f6', 0, true, false),
    (v_pipeline_id, 'Text', '#f59e0b', 1, false, false),
    (v_pipeline_id, 'Follow Up', '#ef4444', 2, false, false),
    (v_pipeline_id, 'Meet for Coffee', '#f97316', 3, false, false),
    (v_pipeline_id, 'Connected', '#10b981', 4, false, true);

  INSERT INTO pipeline_team_members (pipeline_id, user_id, role)
  VALUES (v_pipeline_id, p_user_id, 'lead')
  ON CONFLICT DO NOTHING;

  RETURN v_pipeline_id;
END;
$function$;

-- Rename existing 'Personal Flow' rows to include their lead's first name
UPDATE pipelines p
SET name = split_part(pr.full_name, ' ', 1) || '''s Personal Flow'
FROM pipeline_team_members ptm
JOIN profiles pr ON pr.user_id = ptm.user_id
WHERE ptm.pipeline_id = p.id
  AND ptm.role = 'lead'
  AND p.name = 'Personal Flow'
  AND COALESCE(pr.full_name, '') <> ''
  AND split_part(pr.full_name, ' ', 1) <> '';