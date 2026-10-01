-- Add Faith Partner flow to default pipelines
CREATE OR REPLACE FUNCTION public.create_default_pipelines(org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pipeline_id UUID;
  flow_count INTEGER := 0;
BEGIN
  -- Flow 1: Plan Your Visit
  BEGIN
    INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
    VALUES (gen_random_uuid(), org_id, 'Plan Your Visit', 
      'Once a visitor fills out the ''Plan Your Visit'' form, we''ll reach out with a friendly confirmation text right away! and we''ll then connect them with a wonderful host. After their visit, we''ll check in to see if they made it, and if so, we''ll follow up to ensure they felt welcomed and loved, eventually transitioning them to our ''New Guest'' flow.',
      'Calendar', 0)
    RETURNING id INTO pipeline_id;
    
    INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
      (pipeline_id, 'Form Submitted', '#3b82f6', 0, true, false),
      (pipeline_id, 'Confirmation Texted', '#f59e0b', 1, false, false),
      (pipeline_id, 'Email With Details', '#ef4444', 2, false, false),
      (pipeline_id, 'Host Assigned', '#10b981', 3, false, false),
      (pipeline_id, 'Attended', '#f97316', 4, false, true),
      (pipeline_id, 'Follow-Up', '#eab308', 5, false, false),
      (pipeline_id, 'Moved to Guest', '#84cc16', 6, false, false);
    flow_count := flow_count + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create Plan Your Visit flow: %', SQLERRM;
  END;

  -- Flow 2: New Guest Follow-Up
  BEGIN
    INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
    VALUES (gen_random_uuid(), org_id, 'New Guest Follow-Up',
      'Integrate new guests efficiently. Initiated by connect card/form submission from first-time visitors. Includes a 24-hour thank-you text, welcome call/email, and an invitation to church/small group.',
      'HeartHandshake', 1)
    RETURNING id INTO pipeline_id;
    
    INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
      (pipeline_id, 'New Guest', '#3b82f6', 0, true, false),
      (pipeline_id, 'Thank You Text', '#f59e0b', 1, false, false),
      (pipeline_id, 'Welcome Call', '#10b981', 2, false, false),
      (pipeline_id, 'Follow Up', '#ef4444', 3, false, false),
      (pipeline_id, 'Meet for Coffee', '#f97316', 4, false, false),
      (pipeline_id, 'Connected', '#6366f1', 5, false, true);
    flow_count := flow_count + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create New Guest Follow-Up flow: %', SQLERRM;
  END;

  -- Flow 3: New Believer Journey
  BEGIN
    INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
    VALUES (gen_random_uuid(), org_id, 'New Believer Journey',
      'Guides new believers from decision to discipleship, covering follow-up, devotionals, baptism, mentorship, and integration into growth programs.',
      'Star', 2)
    RETURNING id INTO pipeline_id;
    
    INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
      (pipeline_id, 'Decision Made', '#3b82f6', 0, true, false),
      (pipeline_id, 'Follow-Up', '#eab308', 1, false, false),
      (pipeline_id, 'Devotional Sent', '#22c55e', 2, false, false),
      (pipeline_id, 'Baptism Invite Sent', '#ffda99', 3, false, false),
      (pipeline_id, 'Mentor Assigned', '#ef4444', 4, false, false),
      (pipeline_id, 'Growing Flow', '#f97316', 5, false, true);
    flow_count := flow_count + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create New Believer Journey flow: %', SQLERRM;
  END;

  -- Flow 4: Pastoral Care
  BEGIN
    INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
    VALUES (gen_random_uuid(), org_id, 'Pastoral Care',
      'We all face spiritual ups and downs, and this flow is here to walk with you through every step! Whether you''re wrestling with a tough spiritual battle or seeking to deepen your relationship with God, our pastoral care team is ready to offer a listening ear, prayer, and guidance.',
      'Heart', 3)
    RETURNING id INTO pipeline_id;
    
    INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
      (pipeline_id, 'Request Received', '#3b82f6', 0, true, false),
      (pipeline_id, 'Pastor Assigned', '#10b981', 1, false, false),
      (pipeline_id, 'Care Given', '#ef4444', 2, false, false),
      (pipeline_id, 'Follow-Up', '#f59e0b', 3, false, false),
      (pipeline_id, 'Done', '#8b5cf6', 4, false, true);
    flow_count := flow_count + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create Pastoral Care flow: %', SQLERRM;
  END;

  -- Flow 5: Baptism
  BEGIN
    INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
    VALUES (gen_random_uuid(), org_id, 'Baptism',
      'This flow helps individuals to get connected from initial interest in baptism through to post-baptismal follow-up. It includes stages for baptism information, confirmation of baptism dates, scheduling of preparatory classes, the baptism event itself, and subsequent pastoral care.',
      'Waves', 4)
    RETURNING id INTO pipeline_id;
    
    INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
      (pipeline_id, 'Interest', '#06B6D4', 0, true, false),
      (pipeline_id, 'Info Sent', '#f59e0b', 1, false, false),
      (pipeline_id, 'Date Confirmed', '#ef4444', 2, false, false),
      (pipeline_id, 'Class Scheduled', '#f97316', 3, false, false),
      (pipeline_id, 'Baptized', '#10b981', 4, false, true),
      (pipeline_id, 'Follow-Up', '#abb0f1', 5, false, false);
    flow_count := flow_count + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create Baptism flow: %', SQLERRM;
  END;

  -- Flow 6: First-Time Giver
  BEGIN
    INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
    VALUES (gen_random_uuid(), org_id, 'First-Time Giver',
      'Welcome our amazing first-time givers! This flow is all about making their initial contribution a joyful and meaningful experience. We''ll walk them through each step, from ''New'' to ''In Progress'' and ''Completed,'' ensuring they feel loved, supported, and excited to be a part of building God''s Kingdom with us!',
      'UserCheck', 5)
    RETURNING id INTO pipeline_id;
    
    INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
      (pipeline_id, 'First Gift', '#3b82f6', 0, true, false),
      (pipeline_id, 'Thank You', '#f59e0b', 1, false, false),
      (pipeline_id, 'Impact Story', '#ef4444', 2, false, false),
      (pipeline_id, 'Acknowledged', '#10b981', 3, false, true);
    flow_count := flow_count + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create First-Time Giver flow: %', SQLERRM;
  END;

  -- Flow 7: Recurrent Giver
  BEGIN
    INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
    VALUES (gen_random_uuid(), org_id, 'Recurrent Giver',
      'This flow is designed to celebrate and support our amazing recurring givers! We want to shower them with appreciation, sharing stories and impact along the way, and eventually inviting them to connect personally.',
      'Globe', 6)
    RETURNING id INTO pipeline_id;
    
    INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
      (pipeline_id, 'Recurring Gift Set', '#3b82f6', 0, true, false),
      (pipeline_id, 'Thank You Note', '#f59e0b', 1, false, false),
      (pipeline_id, 'Story Email', '#10b981', 2, false, false),
      (pipeline_id, 'Impact SMS', '#ef4444', 3, false, false),
      (pipeline_id, 'Meet for Coffee', '#eab308', 4, false, false),
      (pipeline_id, 'Connected', '#f97316', 5, false, true);
    flow_count := flow_count + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create Recurrent Giver flow: %', SQLERRM;
  END;

  -- Flow 8: Faith Partner
  BEGIN
    INSERT INTO pipelines (id, organization_id, name, description, icon, flow_order)
    VALUES (gen_random_uuid(), org_id, 'Faith Partner',
      'Welcome to the Faith Partner journey! This flow is all about building wonderful relationships with our new partners. We''ll warmly recognize them, share our heartfelt thanks, enjoy some quality time together over lunch or dinner, keep them in the loop with exciting updates, invite them to special vision events, and finally, celebrate them becoming active, cherished members of our ministry family!',
      'Handshake', 7)
    RETURNING id INTO pipeline_id;
    
    INSERT INTO pipeline_stages (pipeline_id, name, color, stage_order, is_start_step, is_end_step) VALUES
      (pipeline_id, 'New (Recognized)', '#3b82f6', 0, true, false),
      (pipeline_id, 'Thanked', '#f59e0b', 1, false, false),
      (pipeline_id, 'Lunch or Dinner', '#f97316', 2, false, false),
      (pipeline_id, 'Updates Sent', '#10b981', 3, false, false),
      (pipeline_id, 'Vision Event', '#8b5cf6', 4, false, false),
      (pipeline_id, 'Active Partner', '#14b8a6', 5, false, true);
    flow_count := flow_count + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create Faith Partner flow: %', SQLERRM;
  END;

  -- Log success
  RAISE NOTICE 'Successfully created % flows for organization %', flow_count, org_id;
  
  -- If no flows were created, raise an error
  IF flow_count = 0 THEN
    RAISE EXCEPTION 'Failed to create any default flows for organization %', org_id;
  END IF;
END;
$function$;