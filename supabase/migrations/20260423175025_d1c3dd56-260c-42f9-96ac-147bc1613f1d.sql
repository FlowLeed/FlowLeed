-- Function to create a Personal Flow for a specific user in an organization
CREATE OR REPLACE FUNCTION public.create_personal_flow_for_user(p_user_id uuid, p_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pipeline_id uuid;
  v_max_order integer;
BEGIN
  -- Skip if user already has a Personal Flow they lead in this org
  IF EXISTS (
    SELECT 1
    FROM pipelines p
    JOIN pipeline_team_members ptm ON ptm.pipeline_id = p.id
    WHERE p.organization_id = p_org_id
      AND p.name = 'Personal Flow'
      AND ptm.user_id = p_user_id
      AND ptm.role = 'lead'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(MAX(flow_order), -1) + 1 INTO v_max_order
  FROM pipelines WHERE organization_id = p_org_id;

  INSERT INTO pipelines (organization_id, name, description, icon, flow_order, flow_type)
  VALUES (p_org_id, 'Personal Flow', 'Your personal follow-up flow for staying connected with people.', 'User', v_max_order, 'linear')
  RETURNING id INTO v_pipeline_id;

  INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
    (v_pipeline_id, 'Need to Check In', '#3b82f6', 0, true, false),
    (v_pipeline_id, 'Text', '#f59e0b', 1, false, false),
    (v_pipeline_id, 'Follow Up', '#ef4444', 2, false, false),
    (v_pipeline_id, 'Meet for Coffee', '#f97316', 3, false, false),
    (v_pipeline_id, 'Connected', '#10b981', 4, false, true);

  -- Assign the user as lead of this personal flow (skip if trigger already added them)
  INSERT INTO pipeline_team_members (pipeline_id, user_id, role)
  VALUES (v_pipeline_id, p_user_id, 'lead')
  ON CONFLICT DO NOTHING;

  RETURN v_pipeline_id;
END;
$$;

-- Update the trigger function so every new organization member also gets a Personal Flow
CREATE OR REPLACE FUNCTION public.trigger_create_default_pipelines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pipeline_count integer;
BEGIN
  SELECT COUNT(*) INTO v_pipeline_count
  FROM pipelines WHERE organization_id = NEW.organization_id;

  -- Only create org default pipelines for the first member (owner) and only if none exist
  IF v_pipeline_count = 0 THEN
    PERFORM create_default_pipelines(NEW.organization_id);
  END IF;

  -- Always create a Personal Flow for the new member
  PERFORM create_personal_flow_for_user(NEW.user_id, NEW.organization_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trigger_create_default_pipelines failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Backfill: create Personal Flow for every existing org member who doesn't have one
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT om.user_id, om.organization_id
    FROM organization_members om
  LOOP
    PERFORM create_personal_flow_for_user(r.user_id, r.organization_id);
  END LOOP;
END $$;