
-- Update create_default_pipelines to also enroll all org owners/admins as pipeline leads
CREATE OR REPLACE FUNCTION public.create_default_pipelines(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pipeline_id UUID;
  new_pipeline_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
  VALUES (gen_random_uuid(), org_id, 'Plan Your Visit',
    'Once a visitor fills out the ''Plan Your Visit'' form, we''ll reach out with a friendly confirmation text right away! and we''ll then connect them with a wonderful host. After their visit, we''ll check in to see if they made it, and if so, we''ll follow up to ensure they felt welcomed and loved, eventually transitioning them to our ''New Guest'' flow.',
    'Calendar', 0) RETURNING id INTO pipeline_id;
  new_pipeline_ids := array_append(new_pipeline_ids, pipeline_id);
  INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
    (pipeline_id, 'Form Submitted', '#3b82f6', 0, true, false),
    (pipeline_id, 'Confirmation Texted', '#f59e0b', 1, false, false),
    (pipeline_id, 'Email With Details', '#ef4444', 2, false, false),
    (pipeline_id, 'Host Assigned', '#10b981', 3, false, false),
    (pipeline_id, 'Attended', '#f97316', 4, false, true),
    (pipeline_id, 'Follow-Up', '#eab308', 5, false, false),
    (pipeline_id, 'Moved to Guest', '#84cc16', 6, false, false);

  INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
  VALUES (gen_random_uuid(), org_id, 'New Guest Follow-Up',
    'Integrate new guests efficiently. Initiated by connect card/form submission from first-time visitors. Includes a 24-hour thank-you text, welcome call/email, and an invitation to church/small group.',
    'HeartHandshake', 1) RETURNING id INTO pipeline_id;
  new_pipeline_ids := array_append(new_pipeline_ids, pipeline_id);
  INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
    (pipeline_id, 'New Guest', '#3b82f6', 0, true, false),
    (pipeline_id, 'Thank You Text', '#f59e0b', 1, false, false),
    (pipeline_id, 'Welcome Call', '#10b981', 2, false, false),
    (pipeline_id, 'Follow Up', '#ef4444', 3, false, false),
    (pipeline_id, 'Meet for Coffee', '#f97316', 4, false, false),
    (pipeline_id, 'Connected', '#6366f1', 5, false, true);

  INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
  VALUES (gen_random_uuid(), org_id, 'New Believer Journey',
    'Guides new believers from decision to discipleship, covering follow-up, devotionals, baptism, mentorship, and integration into growth programs.',
    'Star', 2) RETURNING id INTO pipeline_id;
  new_pipeline_ids := array_append(new_pipeline_ids, pipeline_id);
  INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
    (pipeline_id, 'Decision Made', '#3b82f6', 0, true, false),
    (pipeline_id, 'Follow-Up', '#eab308', 1, false, false),
    (pipeline_id, 'Devotional Sent', '#22c55e', 2, false, false),
    (pipeline_id, 'Baptism Invite Sent', '#ffda99', 3, false, false),
    (pipeline_id, 'Mentor Assigned', '#ef4444', 4, false, false),
    (pipeline_id, 'Growing Flow', '#f97316', 5, false, true);

  INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
  VALUES (gen_random_uuid(), org_id, 'Pastoral Care',
    'We all face spiritual ups and downs, and this flow is here to walk with you through every step! Whether you''re wrestling with a tough spiritual battle or seeking to deepen your relationship with God, our pastoral care team is ready to offer a listening ear, prayer, and guidance.',
    'Heart', 3) RETURNING id INTO pipeline_id;
  new_pipeline_ids := array_append(new_pipeline_ids, pipeline_id);
  INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
    (pipeline_id, 'Request Received', '#3b82f6', 0, true, false),
    (pipeline_id, 'Pastor Assigned', '#10b981', 1, false, false),
    (pipeline_id, 'Care Given', '#ef4444', 2, false, false),
    (pipeline_id, 'Follow-Up', '#f59e0b', 3, false, false),
    (pipeline_id, 'Done', '#8b5cf6', 4, false, true);

  INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
  VALUES (gen_random_uuid(), org_id, 'Baptism',
    'This flow helps individuals to get connected from initial interest in baptism through to post-baptismal follow-up. It includes stages for baptism information, confirmation of baptism dates, scheduling of preparatory classes, the baptism event itself, and subsequent pastoral care.',
    'Waves', 4) RETURNING id INTO pipeline_id;
  new_pipeline_ids := array_append(new_pipeline_ids, pipeline_id);
  INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
    (pipeline_id, 'Interest', '#06B6D4', 0, true, false),
    (pipeline_id, 'Info Sent', '#f59e0b', 1, false, false),
    (pipeline_id, 'Date Confirmed', '#ef4444', 2, false, false),
    (pipeline_id, 'Class Scheduled', '#f97316', 3, false, false),
    (pipeline_id, 'Baptized', '#10b981', 4, false, true),
    (pipeline_id, 'Follow-Up', '#abb0f1', 5, false, false);

  INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
  VALUES (gen_random_uuid(), org_id, 'First-Time Giver',
    'Welcome our amazing first-time givers! This flow is all about making their initial contribution a joyful and meaningful experience. We''ll walk them through each step, from ''New'' to ''In Progress'' and ''Completed,'' ensuring they feel loved, supported, and excited to be a part of building God''s Kingdom with us!',
    'UserCheck', 5) RETURNING id INTO pipeline_id;
  new_pipeline_ids := array_append(new_pipeline_ids, pipeline_id);
  INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
    (pipeline_id, 'First Gift', '#3b82f6', 0, true, false),
    (pipeline_id, 'Thank You', '#f59e0b', 1, false, false),
    (pipeline_id, 'Impact Story', '#ef4444', 2, false, false),
    (pipeline_id, 'Acknowledged', '#10b981', 3, false, true);

  INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
  VALUES (gen_random_uuid(), org_id, 'Recurrent Giver',
    'This flow is designed to celebrate and support our amazing recurring givers! We want to shower them with appreciation, sharing stories and impact along the way, and eventually inviting them to connect personally.',
    'Globe', 6) RETURNING id INTO pipeline_id;
  new_pipeline_ids := array_append(new_pipeline_ids, pipeline_id);
  INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
    (pipeline_id, 'Recurring Gift Set', '#3b82f6', 0, true, false),
    (pipeline_id, 'Thank You Note', '#f59e0b', 1, false, false),
    (pipeline_id, 'Story Email', '#10b981', 2, false, false),
    (pipeline_id, 'Impact SMS', '#ef4444', 3, false, false),
    (pipeline_id, 'Meet for Coffee', '#eab308', 4, false, false),
    (pipeline_id, 'Connected', '#f97316', 5, false, true);

  -- Enroll all owners/admins of the org as leads on every default pipeline
  INSERT INTO public.pipeline_team_members (pipeline_id, user_id, role)
  SELECT p_id, om.user_id, 'lead'
  FROM unnest(new_pipeline_ids) AS p_id
  CROSS JOIN public.organization_members om
  WHERE om.organization_id = org_id
    AND om.role IN ('owner', 'admin')
  ON CONFLICT DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating default pipelines for org %: %', org_id, SQLERRM;
END;
$$;

-- When someone becomes an owner/admin of an org, ensure they're on every existing pipeline in that org
CREATE OR REPLACE FUNCTION public.enroll_admin_on_org_pipelines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('owner', 'admin') THEN
    INSERT INTO public.pipeline_team_members (pipeline_id, user_id, role)
    SELECT p.id, NEW.user_id, 'lead'
    FROM public.pipelines p
    WHERE p.organization_id = NEW.organization_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enroll_admin_on_org_pipelines ON public.organization_members;
CREATE TRIGGER trg_enroll_admin_on_org_pipelines
  AFTER INSERT ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enroll_admin_on_org_pipelines();

-- Backfill: add every current owner/admin to every existing pipeline in their org
INSERT INTO public.pipeline_team_members (pipeline_id, user_id, role)
SELECT p.id, om.user_id, 'lead'
FROM public.pipelines p
JOIN public.organization_members om
  ON om.organization_id = p.organization_id
WHERE om.role IN ('owner', 'admin')
ON CONFLICT DO NOTHING;
