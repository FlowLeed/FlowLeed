-- 1. Drop the duplicate trigger (keep `after_owner_member_insert`)
DROP TRIGGER IF EXISTS create_default_pipelines_trigger ON public.organization_members;

-- 2. Clean up existing duplicate Personal Flows
-- For each (organization, user) where the user leads >1 "Personal Flow", keep the oldest one
-- and merge contacts from duplicates into the kept flow before deleting them.
DO $$
DECLARE
  r RECORD;
  v_keep_id uuid;
  v_dup_ids uuid[];
BEGIN
  FOR r IN
    SELECT p.organization_id, ptm.user_id
    FROM pipelines p
    JOIN pipeline_team_members ptm ON ptm.pipeline_id = p.id AND ptm.role = 'lead'
    WHERE p.name = 'Personal Flow'
    GROUP BY p.organization_id, ptm.user_id
    HAVING COUNT(*) > 1
  LOOP
    -- Pick the oldest pipeline as the keeper
    SELECT p.id
    INTO v_keep_id
    FROM pipelines p
    JOIN pipeline_team_members ptm ON ptm.pipeline_id = p.id AND ptm.role = 'lead'
    WHERE p.organization_id = r.organization_id
      AND p.name = 'Personal Flow'
      AND ptm.user_id = r.user_id
    ORDER BY p.created_at ASC, p.id ASC
    LIMIT 1;

    -- Collect duplicate ids
    SELECT array_agg(p.id)
    INTO v_dup_ids
    FROM pipelines p
    JOIN pipeline_team_members ptm ON ptm.pipeline_id = p.id AND ptm.role = 'lead'
    WHERE p.organization_id = r.organization_id
      AND p.name = 'Personal Flow'
      AND ptm.user_id = r.user_id
      AND p.id <> v_keep_id;

    -- Move any pipeline_contacts from duplicates to the keeper
    -- (use the keeper's first stage for the new stage_id to satisfy FK and ordering)
    UPDATE pipeline_contacts pc
    SET pipeline_id = v_keep_id,
        stage_id = (
          SELECT id FROM pipeline_stages
          WHERE pipeline_id = v_keep_id
          ORDER BY stage_order ASC, created_at ASC
          LIMIT 1
        ),
        stage_order = 0,
        updated_at = now()
    WHERE pc.pipeline_id = ANY(v_dup_ids)
      -- Avoid violating any (contact_id, pipeline_id) uniqueness if the contact is already in keeper
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_contacts pc2
        WHERE pc2.pipeline_id = v_keep_id AND pc2.contact_id = pc.contact_id
      );

    -- Delete duplicate pipelines (cascades to stages, team_members, remaining contacts)
    DELETE FROM pipelines WHERE id = ANY(v_dup_ids);
  END LOOP;
END $$;