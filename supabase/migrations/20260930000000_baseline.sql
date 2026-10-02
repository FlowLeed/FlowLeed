

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."content_consent_level" AS ENUM (
    'internal_use',
    'public_search'
);


ALTER TYPE "public"."content_consent_level" OWNER TO "postgres";


CREATE TYPE "public"."content_ingest_status" AS ENUM (
    'pending',
    'transcribing',
    'embedding',
    'analyzing',
    'ready',
    'failed'
);


ALTER TYPE "public"."content_ingest_status" OWNER TO "postgres";


CREATE TYPE "public"."system_role" AS ENUM (
    'super_admin',
    'support_admin',
    'viewer'
);


ALTER TYPE "public"."system_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_pipeline_creator_as_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only add team member if we have an authenticated user
  -- Skip for system-created pipelines (when called via RPC with service role)
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.pipeline_team_members (pipeline_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'lead')
    ON CONFLICT (pipeline_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_pipeline_creator_as_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_organization"("_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only system administrators can delete organizations';
  END IF;

  -- Delete from tables that reference organizations without ON DELETE CASCADE
  DELETE FROM public.user_pco_visible_people WHERE organization_id = _org_id;
  DELETE FROM public.user_pco_field_preferences WHERE organization_id = _org_id;
  DELETE FROM public.user_pco_connections WHERE organization_id = _org_id;
  DELETE FROM public.pco_oauth_states WHERE organization_id = _org_id;
  DELETE FROM public.integrations WHERE organization_id = _org_id;
  DELETE FROM public.pipelines WHERE organization_id = _org_id;
  DELETE FROM public.contacts WHERE organization_id = _org_id;

  -- Remaining tables cascade via FK ON DELETE CASCADE
  DELETE FROM public.organizations WHERE id = _org_id;
END;
$$;


ALTER FUNCTION "public"."admin_delete_organization"("_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_org_members_activity"("p_org_id" "uuid") RETURNS TABLE("user_id" "uuid", "role" "text", "joined_at" timestamp with time zone, "full_name" "text", "email" "text", "avatar_url" "text", "last_login" timestamp with time zone, "logins_30d" integer, "logins_7d" integer, "contacts_assigned" integer, "notes_30d" integer, "interactions_30d" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_system_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;
  return query
  select
    om.user_id, om.role, om.created_at as joined_at,
    p.full_name, p.email, p.avatar_url,
    (select max(logged_in_at) from user_logins ul
       where ul.user_id = om.user_id and ul.organization_id = p_org_id) as last_login,
    (select count(*)::int from user_logins ul
       where ul.user_id = om.user_id and ul.organization_id = p_org_id
       and ul.logged_in_at > now() - interval '30 days') as logins_30d,
    (select count(*)::int from user_logins ul
       where ul.user_id = om.user_id and ul.organization_id = p_org_id
       and ul.logged_in_at > now() - interval '7 days') as logins_7d,
    (select count(*)::int from contacts c
       where c.organization_id = p_org_id and c.assigned_to_user_id = om.user_id) as contacts_assigned,
    (select count(*)::int from contact_notes n
       join contacts c on c.id = n.contact_id
       where c.organization_id = p_org_id and n.created_by_user_id = om.user_id
       and n.created_at > now() - interval '30 days') as notes_30d,
    (select count(*)::int from contact_interactions i
       join contacts c on c.id = i.contact_id
       where c.organization_id = p_org_id and i.created_by_user_id = om.user_id
       and i.created_at > now() - interval '30 days') as interactions_30d
  from organization_members om
  left join profiles p on p.user_id = om.user_id
  where om.organization_id = p_org_id
  order by last_login desc nulls last;
end;
$$;


ALTER FUNCTION "public"."admin_get_org_members_activity"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_clear_demo_on_real_contact"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_demo THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contacts
    WHERE organization_id = NEW.organization_id AND is_demo
  ) THEN
    PERFORM public.clear_demo_data_for_org(NEW.organization_id);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_clear_demo_on_real_contact"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_engagement_scores"("p_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_settings jsonb := public.engagement_settings_for_org(p_org_id);
BEGIN
  INSERT INTO contact_engagement_scores (
    contact_id, organization_id, total_checkins_90d, total_checkins_30d,
    weeks_attended_last_12, last_checkin_at, engagement_level,
    streak_weeks, consecutive_streak_weeks, volunteer_checkins_90d, score, score_breakdown, updated_at
  )
  SELECT
    c.contact_id, p_org_id, c.total_90d, c.total_30d, c.weeks_window, c.last_attended,
    c.engagement_level, c.weeks_window, c.consecutive_weeks, c.serving_count, c.score, c.breakdown, NOW()
  FROM public.compute_engagement_rows(p_org_id, v_settings) c
  WHERE NOT EXISTS (
    SELECT 1 FROM contact_life_seasons ls
    WHERE ls.contact_id = c.contact_id AND ls.ended_on IS NULL
  )
  ON CONFLICT (contact_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    total_checkins_90d = EXCLUDED.total_checkins_90d,
    total_checkins_30d = EXCLUDED.total_checkins_30d,
    weeks_attended_last_12 = EXCLUDED.weeks_attended_last_12,
    last_checkin_at = EXCLUDED.last_checkin_at,
    engagement_level = EXCLUDED.engagement_level,
    streak_weeks = EXCLUDED.streak_weeks,
    consecutive_streak_weeks = EXCLUDED.consecutive_streak_weeks,
    volunteer_checkins_90d = EXCLUDED.volunteer_checkins_90d,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    updated_at = NOW();

  PERFORM public.snapshot_engagement_distribution_all();
  PERFORM public.recompute_contact_markers(p_org_id);
END;
$$;


ALTER FUNCTION "public"."calculate_engagement_scores"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_health_score_v2"("org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
  -- Component scores
  user_activity_score numeric := 0;
  flows_usage_score numeric := 0;
  followups_score numeric := 0;
  pco_sync_score numeric := 0;
  ai_usage_score numeric := 0;
  engagement_growth_score numeric := 0;
  setup_score numeric := 0;
  total_score integer := 0;
  
  -- Intermediate calculations
  avg_logins_per_user_per_week numeric := 0;
  people_moved_per_week numeric := 0;
  active_flows_count integer := 0;
  completion_rate numeric := 0;
  interactions_per_week numeric := 0;
  last_pco_sync_days integer := 999;
  ai_uses_30d integer := 0;
  contact_growth_percent numeric := 0;
  
  -- Setup checklist
  profile_completed boolean := false;
  team_invited boolean := false;
  first_flow_created boolean := false;
  pco_connected boolean := false;
  first_contact_added boolean := false;
  
  -- Other variables
  total_users integer := 0;
  contacts_30d_ago integer := 0;
  contacts_now integer := 0;
  previous_score integer;
BEGIN
  -- 1. USER ACTIVITY (25 points) - Logins per user per week
  SELECT 
    COUNT(DISTINCT om.user_id),
    COALESCE(SUM(oas.total_logins) / NULLIF(COUNT(DISTINCT om.user_id), 0) / 4.0, 0)
  INTO total_users, avg_logins_per_user_per_week
  FROM organization_members om
  LEFT JOIN organization_activity_stats oas ON oas.organization_id = om.organization_id 
    AND oas.date >= CURRENT_DATE - 30
  WHERE om.organization_id = org_id;
  
  user_activity_score := LEAST((avg_logins_per_user_per_week / 4.0) * 25, 25);
  
  -- 2. FLOWS USAGE (20 points) - People moved + active flows
  SELECT 
    COUNT(DISTINCT p.id),
    COALESCE(COUNT(DISTINCT pc.id) / 4.0, 0)
  INTO active_flows_count, people_moved_per_week
  FROM pipelines p
  LEFT JOIN pipeline_contacts pc ON pc.pipeline_id = p.id 
    AND pc.updated_at >= NOW() - INTERVAL '7 days'
  WHERE p.organization_id = org_id;
  
  flows_usage_score := (
    LEAST(people_moved_per_week / 10.0, 1.0) * 0.7 + 
    LEAST(active_flows_count / 3.0, 1.0) * 0.3
  ) * 20;
  
  -- 3. FOLLOW-UPS DONE (15 points) - Completed interactions
  SELECT 
    COALESCE(COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::numeric / 
      NULLIF(COUNT(*)::numeric, 0), 0),
    COALESCE(COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND 
      completed_at >= NOW() - INTERVAL '7 days') / 1.0, 0)
  INTO completion_rate, interactions_per_week
  FROM contact_interactions ci
  JOIN contacts c ON c.id = ci.contact_id
  WHERE c.organization_id = org_id
    AND ci.created_at >= NOW() - INTERVAL '30 days';
  
  followups_score := (
    completion_rate * 0.6 + 
    LEAST(interactions_per_week / 5.0, 1.0) * 0.4
  ) * 15;
  
  -- 4. PCO SYNC HEALTH (10 points) - Integration recency
  SELECT 
    COALESCE(EXTRACT(DAY FROM NOW() - MAX(last_pco_sync))::integer, 999)
  INTO last_pco_sync_days
  FROM organization_activity_stats
  WHERE organization_id = org_id;
  
  pco_sync_score := CASE 
    WHEN last_pco_sync_days < 7 THEN 10
    WHEN last_pco_sync_days < 30 THEN 5
    ELSE 0
  END;
  
  -- 5. AI FEATURES USED (10 points) - AI interactions
  SELECT COALESCE(SUM(total_ai_uses), 0)
  INTO ai_uses_30d
  FROM organization_activity_stats
  WHERE organization_id = org_id
    AND date >= CURRENT_DATE - 30;
  
  ai_usage_score := LEAST(ai_uses_30d / 20.0, 1.0) * 10;
  
  -- 6. ENGAGEMENT GROWTH (10 points) - Contact growth
  SELECT COUNT(*) INTO contacts_now
  FROM contacts WHERE organization_id = org_id;
  
  SELECT COUNT(*) INTO contacts_30d_ago
  FROM contacts 
  WHERE organization_id = org_id 
    AND created_at < NOW() - INTERVAL '30 days';
  
  IF contacts_30d_ago > 0 THEN
    contact_growth_percent := ((contacts_now - contacts_30d_ago)::numeric / contacts_30d_ago::numeric) * 100;
  END IF;
  
  engagement_growth_score := LEAST(contact_growth_percent / 10.0, 1.0) * 10;
  
  -- 7. ADMIN SETUP (10 points) - Onboarding checklist
  SELECT 
    EXISTS(SELECT 1 FROM profiles p JOIN organization_members om ON om.user_id = p.user_id 
           WHERE om.organization_id = org_id AND p.full_name IS NOT NULL LIMIT 1),
    (SELECT COUNT(*) FROM organization_members WHERE organization_id = org_id) > 1,
    EXISTS(SELECT 1 FROM pipelines WHERE organization_id = org_id LIMIT 1),
    EXISTS(SELECT 1 FROM integrations WHERE organization_id = org_id 
           AND service_name = 'planning_center' AND status = 'active' LIMIT 1),
    contacts_now > 0
  INTO profile_completed, team_invited, first_flow_created, pco_connected, first_contact_added;
  
  setup_score := 
    (CASE WHEN profile_completed THEN 2 ELSE 0 END) +
    (CASE WHEN team_invited THEN 2 ELSE 0 END) +
    (CASE WHEN first_flow_created THEN 2 ELSE 0 END) +
    (CASE WHEN pco_connected THEN 2 ELSE 0 END) +
    (CASE WHEN first_contact_added THEN 2 ELSE 0 END);
  
  -- Calculate total score
  total_score := ROUND(
    user_activity_score + 
    flows_usage_score + 
    followups_score + 
    pco_sync_score + 
    ai_usage_score + 
    engagement_growth_score + 
    setup_score
  )::integer;
  
  -- Get previous score
  SELECT health_score INTO previous_score
  FROM organizations WHERE id = org_id;
  
  -- Build result JSON
  result := jsonb_build_object(
    'total_score', total_score,
    'breakdown', jsonb_build_object(
      'user_activity', jsonb_build_object('score', ROUND(user_activity_score, 1), 'max', 25),
      'flows_usage', jsonb_build_object('score', ROUND(flows_usage_score, 1), 'max', 20),
      'followups', jsonb_build_object('score', ROUND(followups_score, 1), 'max', 15),
      'pco_sync', jsonb_build_object('score', ROUND(pco_sync_score, 1), 'max', 10),
      'ai_usage', jsonb_build_object('score', ROUND(ai_usage_score, 1), 'max', 10),
      'engagement_growth', jsonb_build_object('score', ROUND(engagement_growth_score, 1), 'max', 10),
      'setup', jsonb_build_object('score', setup_score, 'max', 10)
    ),
    'metrics', jsonb_build_object(
      'avg_logins_per_user_per_week', ROUND(avg_logins_per_user_per_week, 2),
      'people_moved_per_week', ROUND(people_moved_per_week, 1),
      'active_flows_count', active_flows_count,
      'completion_rate', ROUND(completion_rate * 100, 1),
      'interactions_per_week', ROUND(interactions_per_week, 1),
      'last_pco_sync_days', last_pco_sync_days,
      'ai_uses_30d', ai_uses_30d,
      'contact_growth_percent', ROUND(contact_growth_percent, 1),
      'total_users', total_users,
      'contacts_now', contacts_now
    ),
    'setup_checklist', jsonb_build_object(
      'profile_completed', profile_completed,
      'team_invited', team_invited,
      'first_flow_created', first_flow_created,
      'pco_connected', pco_connected,
      'first_contact_added', first_contact_added
    )
  );
  
  -- Update organizations table
  UPDATE organizations 
  SET 
    health_score = total_score,
    onboarding_progress = result->'setup_checklist'
  WHERE id = org_id;
  
  -- Insert into history
  INSERT INTO organization_health_history (
    organization_id,
    total_score,
    score_breakdown,
    metrics,
    previous_score,
    score_change
  ) VALUES (
    org_id,
    total_score,
    result->'breakdown',
    result->'metrics',
    previous_score,
    total_score - COALESCE(previous_score, 0)
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."calculate_health_score_v2"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_organization_health_score"("org_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  health_score INTEGER := 0;
  engagement_score INTEGER := 0;
  adoption_score INTEGER := 0;
  team_score INTEGER := 0;
  integration_score INTEGER := 0;
  ai_score INTEGER := 0;
BEGIN
  -- Engagement (30 points) - logins in last 30 days
  SELECT LEAST(30, (SUM(total_logins) / 10)::INTEGER) INTO engagement_score
  FROM organization_activity_stats
  WHERE organization_id = org_id AND date >= CURRENT_DATE - 30;
  
  -- Feature Adoption (25 points) - flows and contacts
  SELECT LEAST(25, 
    (COUNT(DISTINCT p.id) * 5 + LEAST(20, (COUNT(DISTINCT c.id) / 10)::INTEGER))
  ) INTO adoption_score
  FROM organizations o
  LEFT JOIN pipelines p ON p.organization_id = o.id
  LEFT JOIN contacts c ON c.organization_id = o.id
  WHERE o.id = org_id;
  
  -- Team Collaboration (20 points)
  SELECT LEAST(20, COUNT(*) * 5) INTO team_score
  FROM organization_members WHERE organization_id = org_id;
  
  -- Integration (15 points) - PC sync recency
  SELECT CASE 
    WHEN MAX(last_pco_sync) >= NOW() - INTERVAL '7 days' THEN 15
    WHEN MAX(last_pco_sync) >= NOW() - INTERVAL '30 days' THEN 10
    ELSE 0
  END INTO integration_score
  FROM organization_activity_stats WHERE organization_id = org_id;
  
  -- AI Usage (10 points)
  SELECT LEAST(10, (SUM(total_ai_uses) / 10)::INTEGER) INTO ai_score
  FROM organization_activity_stats
  WHERE organization_id = org_id AND date >= CURRENT_DATE - 30;
  
  health_score := COALESCE(engagement_score, 0) + COALESCE(adoption_score, 0) + 
                  COALESCE(team_score, 0) + COALESCE(integration_score, 0) + 
                  COALESCE(ai_score, 0);
  
  UPDATE organizations SET health_score = health_score WHERE id = org_id;
  
  RETURN health_score;
END;
$$;


ALTER FUNCTION "public"."calculate_organization_health_score"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_user_see_contact"("_user" "uuid", "_contact_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH c AS (
    SELECT id, organization_id, pc_person_id
    FROM public.contacts WHERE id = _contact_id
  )
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM c) THEN false
      WHEN (SELECT pco_enforce_user_permissions FROM public.organizations
              WHERE id = (SELECT organization_id FROM c)) = false THEN true
      WHEN public.is_system_admin(_user) THEN true
      WHEN EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = _user
          AND organization_id = (SELECT organization_id FROM c)
          AND role IN ('owner','admin')
      ) THEN true
      WHEN (SELECT pc_person_id FROM c) IS NULL THEN true
      WHEN NOT public.user_has_active_pco_connection(_user, (SELECT organization_id FROM c)) THEN true
      WHEN EXISTS (
        SELECT 1 FROM public.user_pco_visible_people v
        WHERE v.user_id = _user
          AND v.organization_id = (SELECT organization_id FROM c)
          AND v.pc_person_id = (SELECT pc_person_id FROM c)
      ) THEN true
      ELSE false
    END;
$$;


ALTER FUNCTION "public"."can_user_see_contact"("_user" "uuid", "_contact_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_reserved_org_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.slug IS NOT NULL AND lower(NEW.slug) = ANY (ARRAY[
    'auth','verify-email','invite','pco','dev','fl-admin','audit','f','org',
    'groups','content','flows','contacts','signals','messages','calls','tasks',
    'team','integrations','analytics','profile','calendar','forms','api','admin',
    'settings','dashboard','home','about','login','logout','signup','signin',
    'fl-admin','public','static','assets','favicon.ico','robots.txt'
  ]) THEN
    RAISE EXCEPTION 'Organization slug "%" is reserved', NEW.slug;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_reserved_org_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chr_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."chr_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_pipeline_team_on_org_leave"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When a user is removed from an organization,
  -- remove them from all pipeline teams in that organization
  DELETE FROM public.pipeline_team_members ptm
  WHERE ptm.user_id = OLD.user_id
    AND ptm.pipeline_id IN (
      SELECT id FROM public.pipelines
      WHERE organization_id = OLD.organization_id
    );
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."cleanup_pipeline_team_on_org_leave"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_stage_assignees"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When a team member is removed, clear them from stage default assignees
  UPDATE public.pipeline_stages
  SET default_assignee_user_id = NULL
  WHERE pipeline_id = OLD.pipeline_id
    AND default_assignee_user_id = OLD.user_id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."cleanup_stage_assignees"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_demo_data_for_org"("_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _contacts uuid[];
  _groups uuid[];
  _flows uuid[];
  _meetings uuid[];
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO _contacts
  FROM public.contacts WHERE organization_id = _org_id AND is_demo;

  SELECT coalesce(array_agg(id), '{}') INTO _groups
  FROM public.groups WHERE organization_id = _org_id AND is_demo;

  SELECT coalesce(array_agg(id), '{}') INTO _flows
  FROM public.pipelines WHERE organization_id = _org_id AND is_demo;

  IF array_length(_contacts, 1) IS NULL
     AND array_length(_groups, 1) IS NULL
     AND array_length(_flows, 1) IS NULL THEN
    RETURN;
  END IF;

  IF array_length(_groups, 1) IS NOT NULL THEN
    SELECT coalesce(array_agg(id), '{}') INTO _meetings
    FROM public.group_meetings WHERE group_id = ANY(_groups);
    DELETE FROM public.group_attendance WHERE group_meeting_id = ANY(_meetings);
    DELETE FROM public.group_meetings WHERE id = ANY(_meetings);
    DELETE FROM public.group_members WHERE group_id = ANY(_groups);
  END IF;

  IF array_length(_contacts, 1) IS NOT NULL THEN
    DELETE FROM public.signal_agent_suggestions WHERE contact_id = ANY(_contacts);
    DELETE FROM public.flow_moments WHERE contact_id = ANY(_contacts);
    DELETE FROM public.contact_interactions WHERE contact_id = ANY(_contacts);
    DELETE FROM public.contact_notes WHERE contact_id = ANY(_contacts);
    DELETE FROM public.contact_engagement_scores WHERE contact_id = ANY(_contacts);
    DELETE FROM public.contact_tags WHERE contact_id = ANY(_contacts);
    DELETE FROM public.pipeline_contacts WHERE contact_id = ANY(_contacts);
    DELETE FROM public.group_members WHERE contact_id = ANY(_contacts);
  END IF;

  IF array_length(_groups, 1) IS NOT NULL THEN
    DELETE FROM public.group_campuses WHERE group_id = ANY(_groups);
    DELETE FROM public.groups WHERE id = ANY(_groups);
  END IF;

  IF array_length(_flows, 1) IS NOT NULL THEN
    DELETE FROM public.pipeline_contacts WHERE pipeline_id = ANY(_flows);
    DELETE FROM public.pipeline_team_members WHERE pipeline_id = ANY(_flows);
    DELETE FROM public.pipeline_resources WHERE pipeline_id = ANY(_flows);
    DELETE FROM public.pipeline_stages WHERE pipeline_id = ANY(_flows);
    DELETE FROM public.pipelines WHERE id = ANY(_flows);
  END IF;

  IF array_length(_contacts, 1) IS NOT NULL THEN
    DELETE FROM public.contacts WHERE id = ANY(_contacts);
  END IF;

  UPDATE public.organizations
  SET demo_cleared_at = now()
  WHERE id = _org_id;
END;
$$;


ALTER FUNCTION "public"."clear_demo_data_for_org"("_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_engagement_rows"("p_org_id" "uuid", "p_settings" "jsonb", "p_sample_limit" integer DEFAULT NULL::integer) RETURNS TABLE("contact_id" "uuid", "total_90d" integer, "total_30d" integer, "total_ever" integer, "last_attended" timestamp with time zone, "weeks_window" integer, "consecutive_weeks" integer, "serving_count" integer, "vol_90d" integer, "is_leader" boolean, "in_group" boolean, "moments_count" integer, "notes_count" integer, "forms_count" integer, "events_count" integer, "score" integer, "engagement_level" "text", "breakdown" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  r RECORD;
  w_consistency numeric := COALESCE((p_settings->'weights'->>'consistency')::numeric, 0);
  w_recency numeric := COALESCE((p_settings->'weights'->>'recency')::numeric, 0);
  w_groupatt numeric := COALESCE((p_settings->'weights'->>'group_attendance')::numeric, 0);
  w_streak numeric := COALESCE((p_settings->'weights'->>'streak')::numeric, 0);
  w_serving numeric := COALESCE((p_settings->'weights'->>'serving')::numeric, 0);
  w_leader numeric := COALESCE((p_settings->'weights'->>'leadership')::numeric, 0);
  w_group numeric := COALESCE((p_settings->'weights'->>'group_membership')::numeric, 0);
  w_moments numeric := COALESCE((p_settings->'weights'->>'flow_moments')::numeric, 0);
  w_notes numeric := COALESCE((p_settings->'weights'->>'notes_interactions')::numeric, 0);
  w_forms numeric := COALESCE((p_settings->'weights'->>'form_submissions')::numeric, 0);
  w_events numeric := COALESCE((p_settings->'weights'->>'event_attendance')::numeric, 0);
  win_weeks integer := GREATEST(COALESCE((p_settings->'windows'->>'consistency_weeks')::integer, 12), 1);
  win_recency integer := GREATEST(COALESCE((p_settings->'windows'->>'recency_days')::integer, 90), 1);
  win_serving integer := GREATEST(COALESCE((p_settings->'windows'->>'serving_days')::integer, 90), 1);
  win_activity integer := GREATEST(COALESCE((p_settings->'windows'->>'activity_days')::integer, 90), 1);
  t_high numeric := COALESCE((p_settings->'thresholds'->>'highly_engaged')::numeric, 75);
  t_active numeric := COALESCE((p_settings->'thresholds'->>'active')::numeric, 50);
  t_risk numeric := COALESCE((p_settings->'thresholds'->>'at_risk')::numeric, 25);
  t_new integer := COALESCE((p_settings->'thresholds'->>'new_max_checkins')::integer, 3);
  i_service boolean := COALESCE((p_settings->'ingredients'->>'service_checkins')::boolean, true);
  i_groupatt boolean := COALESCE((p_settings->'ingredients'->>'group_attendance')::boolean, true);
  i_serving boolean := COALESCE((p_settings->'ingredients'->>'serving')::boolean, true);
  i_leader boolean := COALESCE((p_settings->'ingredients'->>'leadership')::boolean, true);
  i_group boolean := COALESCE((p_settings->'ingredients'->>'group_membership')::boolean, false);
  i_moments boolean := COALESCE((p_settings->'ingredients'->>'flow_moments')::boolean, false);
  i_notes boolean := COALESCE((p_settings->'ingredients'->>'notes_interactions')::boolean, false);
  i_forms boolean := COALESCE((p_settings->'ingredients'->>'form_submissions')::boolean, false);
  i_events boolean := COALESCE((p_settings->'ingredients'->>'event_attendance')::boolean, false);
  sg_serving_active boolean := COALESCE((p_settings->'safeguards'->>'serving_keeps_active')::boolean, true);
  sg_recent_days integer := COALESCE((p_settings->'safeguards'->>'recent_attendance_days')::integer, 14);
  sg_household boolean := COALESCE((p_settings->'safeguards'->>'household_credit')::boolean, true);
  sg_break integer := GREATEST(COALESCE((p_settings->'safeguards'->>'streak_break_misses')::integer, 1), 1);
  sg_partial boolean := COALESCE((p_settings->'safeguards'->>'count_partial_week')::boolean, false);
  v_total_weight numeric;
  v_earned numeric;
  v_consistency numeric;
  v_recency numeric;
  v_groupatt numeric;
  v_streak numeric;
  v_serving numeric;
  v_leaderp numeric;
  v_groupp numeric;
  v_momentsp numeric;
  v_notesp numeric;
  v_formsp numeric;
  v_eventsp numeric;
  v_days_since numeric;
  v_last_activity timestamptz;
  v_score integer;
  v_level text;
  v_streak_weeks integer;
  v_misses integer;
  v_offset integer;
  v_cursor date;
  v_start date;
BEGIN
  v_total_weight :=
    (CASE WHEN i_service THEN w_consistency + w_recency + w_streak ELSE 0 END)
    + (CASE WHEN i_groupatt THEN w_groupatt ELSE 0 END)
    + (CASE WHEN i_serving THEN w_serving ELSE 0 END)
    + (CASE WHEN i_leader THEN w_leader ELSE 0 END)
    + (CASE WHEN i_group THEN w_group ELSE 0 END)
    + (CASE WHEN i_moments THEN w_moments ELSE 0 END)
    + (CASE WHEN i_notes THEN w_notes ELSE 0 END)
    + (CASE WHEN i_forms THEN w_forms ELSE 0 END)
    + (CASE WHEN i_events THEN w_events ELSE 0 END);
  IF v_total_weight <= 0 THEN v_total_weight := 100; END IF;

  v_start := (date_trunc('week', NOW())::date) - CASE WHEN sg_partial THEN 0 ELSE 7 END;

  FOR r IN
    WITH household_person_ids AS (
      SELECT c1.id AS hh_contact_id, c2.pc_person_id AS hh_person_id
      FROM contacts c1
      JOIN contacts c2 ON c2.pc_household_id = c1.pc_household_id
        AND c2.id != c1.id AND c2.pc_person_id IS NOT NULL
      WHERE c1.organization_id = p_org_id AND c1.pc_household_id IS NOT NULL AND sg_household
    ),
    family_person_ids AS (
      SELECT cfm.contact_id AS fm_contact_id, cfm.pc_person_id AS fm_person_id
      FROM contact_family_members cfm
      JOIN contacts c ON c.id = cfm.contact_id
      WHERE c.organization_id = p_org_id AND cfm.pc_person_id IS NOT NULL AND sg_household
        AND NOT EXISTS (
          SELECT 1 FROM household_person_ids hp
          WHERE hp.hh_contact_id = cfm.contact_id AND hp.hh_person_id = cfm.pc_person_id
        )
    ),
    all_checkins AS (
      SELECT c.id AS ac_contact_id, pc.id AS checkin_id, pc.checked_in_at AS at, pc.checkin_kind AS kind
      FROM contacts c JOIN pco_checkins pc ON pc.contact_id = c.id
      WHERE c.organization_id = p_org_id
      UNION ALL
      SELECT hp.hh_contact_id, pc.id, pc.checked_in_at, pc.checkin_kind
      FROM household_person_ids hp JOIN pco_checkins pc ON pc.pc_person_id = hp.hh_person_id
      UNION ALL
      SELECT fp.fm_contact_id, pc.id, pc.checked_in_at, pc.checkin_kind
      FROM family_person_ids fp JOIN pco_checkins pc ON pc.pc_person_id = fp.fm_person_id
    ),
    deduped_checkins AS (
      SELECT DISTINCT ON (ac_contact_id, checkin_id) ac_contact_id AS dc_contact_id, checkin_id, at, kind
      FROM all_checkins
    ),
    group_att AS (
      SELECT ga.contact_id AS ga_contact_id, ga.checked_in_at AS at
      FROM group_attendance ga JOIN contacts c ON c.id = ga.contact_id
      WHERE c.organization_id = p_org_id AND ga.status = 'present' AND ga.checked_in_at IS NOT NULL
        AND i_groupatt
    ),
    combined_attendance AS (
      SELECT dc_contact_id AS ca_contact_id, at FROM deduped_checkins WHERE i_service
      UNION ALL
      SELECT ga_contact_id, at FROM group_att WHERE false
    ),
    serving_signals AS (
      SELECT dc_contact_id AS ss_contact_id, at AS occurred
      FROM deduped_checkins
      WHERE i_serving AND kind = 'volunteer'
        AND at >= NOW() - (win_serving || ' days')::interval
      UNION ALL
      SELECT fm.contact_id, fm.occurred_at
      FROM flow_moments fm
      JOIN flow_moment_types fmt ON fmt.id = fm.flow_moment_type_id
      JOIN contacts c ON c.id = fm.contact_id
      WHERE c.organization_id = p_org_id AND i_serving
        AND fm.occurred_at >= NOW() - (win_serving || ' days')::interval
        AND (fmt.category = 'serving'
          OR fmt.name ILIKE '%serv%' OR fmt.name ILIKE '%volunteer%'
          OR fmt.name ILIKE '%dream team%' OR fmt.name ILIKE '%prayer team%'
          OR fmt.name ILIKE '%worship team%' OR fmt.name ILIKE '%group leader%')
    ),
    serving_agg AS (
      SELECT ss_contact_id AS sa_contact_id, COUNT(*)::integer AS serving_n, MAX(occurred) AS last_serving
      FROM serving_signals GROUP BY ss_contact_id
    ),
    leadership AS (
      SELECT DISTINCT c.id AS ld_contact_id
      FROM contacts c
      JOIN profiles p ON p.email IS NOT NULL AND lower(p.email) = lower(c.email)
      JOIN groups g ON g.organization_id = c.organization_id AND g.status = 'active'
        AND (g.leader_user_id = p.user_id OR g.co_leader_user_id = p.user_id)
      WHERE c.organization_id = p_org_id AND i_leader
      UNION
      SELECT DISTINCT gm.contact_id
      FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE g.organization_id = p_org_id AND i_leader
        AND g.status = 'active' AND gm.status = 'active' AND gm.role IN ('leader','co_leader','host')
    ),
    group_member AS (
      SELECT DISTINCT gm.contact_id AS gmb_contact_id
      FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE g.organization_id = p_org_id AND i_group
        AND g.status = 'active' AND gm.status = 'active'
    ),
    moments_agg AS (
      SELECT fm.contact_id AS ma_contact_id, COUNT(*)::integer AS cnt
      FROM flow_moments fm JOIN contacts c ON c.id = fm.contact_id
      WHERE c.organization_id = p_org_id AND i_moments
        AND fm.occurred_at >= NOW() - (win_activity || ' days')::interval
      GROUP BY fm.contact_id
    ),
    notes_agg AS (
      SELECT x.na_contact_id, SUM(x.cnt)::integer AS cnt FROM (
        SELECT cn.contact_id AS na_contact_id, COUNT(*)::integer AS cnt
        FROM contact_notes cn JOIN contacts c ON c.id = cn.contact_id
        WHERE c.organization_id = p_org_id AND i_notes
          AND cn.created_at >= NOW() - (win_activity || ' days')::interval
        GROUP BY cn.contact_id
        UNION ALL
        SELECT ci.contact_id, COUNT(*)::integer
        FROM contact_interactions ci JOIN contacts c ON c.id = ci.contact_id
        WHERE c.organization_id = p_org_id AND i_notes
          AND ci.created_at >= NOW() - (win_activity || ' days')::interval
        GROUP BY ci.contact_id
      ) x GROUP BY x.na_contact_id
    ),
    forms_agg AS (
      SELECT fs.contact_id AS fa_contact_id, COUNT(*)::integer AS cnt
      FROM form_submissions fs JOIN contacts c ON c.id = fs.contact_id
      WHERE c.organization_id = p_org_id AND i_forms
        AND fs.created_at >= NOW() - (win_activity || ' days')::interval
      GROUP BY fs.contact_id
    ),
    events_agg AS (
      SELECT coe.contact_id AS ea_contact_id, COUNT(*)::integer AS cnt
      FROM church_online_events coe JOIN contacts c ON c.id = coe.contact_id
      WHERE c.organization_id = p_org_id AND i_events
        AND coe.created_at >= NOW() - (win_activity || ' days')::interval
      GROUP BY coe.contact_id
    ),
    base AS (
      SELECT
        ca.ca_contact_id AS b_contact_id,
        COALESCE(SUM(CASE WHEN ca.at >= NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END), 0)::integer AS total_90d,
        COALESCE(SUM(CASE WHEN ca.at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END), 0)::integer AS total_30d,
        COUNT(*)::integer AS total_ever,
        MAX(ca.at) AS last_attended,
        COUNT(DISTINCT date_trunc('week', ca.at))
          FILTER (WHERE ca.at >= NOW() - ((win_weeks * 7) || ' days')::interval)::integer AS weeks_window,
        ARRAY_AGG(DISTINCT date_trunc('week', ca.at)::date) AS attended_weeks
      FROM combined_attendance ca
      GROUP BY ca.ca_contact_id
    ),
    group_att_agg AS (
      SELECT ga_contact_id AS gaa_contact_id, MAX(at) AS last_group_attended
      FROM group_att GROUP BY ga_contact_id
    ),
    vol_only AS (
      SELECT dc_contact_id AS vo_contact_id,
        COALESCE(SUM(CASE WHEN kind='volunteer' AND at >= NOW() - (win_serving || ' days')::interval THEN 1 ELSE 0 END),0)::integer AS vol_n
      FROM deduped_checkins GROUP BY dc_contact_id
    ),
    ids AS (
      SELECT b_contact_id AS id_contact FROM base
      UNION SELECT gaa_contact_id FROM group_att_agg
      UNION SELECT sa_contact_id FROM serving_agg
      UNION SELECT ld_contact_id FROM leadership
      UNION SELECT gmb_contact_id FROM group_member
      UNION SELECT ma_contact_id FROM moments_agg
      UNION SELECT na_contact_id FROM notes_agg
      UNION SELECT fa_contact_id FROM forms_agg
      UNION SELECT ea_contact_id FROM events_agg
    )
    SELECT
      i.id_contact AS r_contact_id,
      COALESCE(b.total_90d,0) AS r_total_90d,
      COALESCE(b.total_30d,0) AS r_total_30d,
      COALESCE(b.total_ever,0) AS r_total_ever,
      b.last_attended AS r_last_attended,
      COALESCE(b.weeks_window,0) AS r_weeks_window,
      COALESCE(b.attended_weeks, ARRAY[]::date[]) AS r_attended_weeks,
      COALESCE(v.vol_n, 0) AS r_vol,
      COALESCE(s.serving_n, 0) AS r_serving,
      s.last_serving AS r_last_serving,
      ga.last_group_attended AS r_last_group_attended,
      (l.ld_contact_id IS NOT NULL) AS r_is_leader,
      (g.gmb_contact_id IS NOT NULL) AS r_in_group,
      COALESCE(m.cnt, 0) AS r_moments,
      COALESCE(n.cnt, 0) AS r_notes,
      COALESCE(f.cnt, 0) AS r_forms,
      COALESCE(e.cnt, 0) AS r_events
    FROM (SELECT id_contact FROM ids ORDER BY id_contact LIMIT COALESCE(p_sample_limit, 2000000000)) i
    LEFT JOIN base b ON b.b_contact_id = i.id_contact
    LEFT JOIN group_att_agg ga ON ga.gaa_contact_id = i.id_contact
    LEFT JOIN vol_only v ON v.vo_contact_id = i.id_contact
    LEFT JOIN serving_agg s ON s.sa_contact_id = i.id_contact
    LEFT JOIN leadership l ON l.ld_contact_id = i.id_contact
    LEFT JOIN group_member g ON g.gmb_contact_id = i.id_contact
    LEFT JOIN moments_agg m ON m.ma_contact_id = i.id_contact
    LEFT JOIN notes_agg n ON n.na_contact_id = i.id_contact
    LEFT JOIN forms_agg f ON f.fa_contact_id = i.id_contact
    LEFT JOIN events_agg e ON e.ea_contact_id = i.id_contact
  LOOP
    v_streak_weeks := 0;
    v_misses := 0;
    v_offset := 0;
    WHILE v_offset < 104 LOOP
      v_cursor := v_start - (v_offset * 7);
      IF v_cursor = ANY (r.r_attended_weeks) THEN
        v_streak_weeks := v_streak_weeks + 1;
        v_misses := 0;
      ELSE
        v_misses := v_misses + 1;
        IF v_misses >= sg_break THEN EXIT; END IF;
      END IF;
      v_offset := v_offset + 1;
    END LOOP;

    v_consistency := CASE WHEN i_service
      THEN LEAST(r.r_weeks_window::numeric / win_weeks, 1) * w_consistency ELSE 0 END;

    v_last_activity := COALESCE(r.r_last_attended, 'epoch'::timestamptz);
    IF i_service AND v_last_activity > 'epoch'::timestamptz THEN
      v_days_since := EXTRACT(EPOCH FROM (NOW() - v_last_activity)) / 86400.0;
      v_recency := GREATEST(w_recency - (v_days_since / win_recency * w_recency), 0);
    ELSE
      v_recency := 0;
    END IF;

    v_streak := CASE WHEN i_service
      THEN LEAST(v_streak_weeks::numeric / 10.0, 1) * w_streak ELSE 0 END;
    v_groupatt := CASE WHEN i_groupatt AND r.r_last_group_attended IS NOT NULL
      THEN GREATEST(w_groupatt - ((EXTRACT(EPOCH FROM (NOW() - r.r_last_group_attended)) / 86400.0) / win_activity * w_groupatt), 0)
      ELSE 0 END;
    v_serving := CASE WHEN i_serving
      THEN LEAST((r.r_vol + r.r_serving)::numeric / 5.0, 1) * w_serving ELSE 0 END;
    v_leaderp := CASE WHEN i_leader AND r.r_is_leader THEN w_leader ELSE 0 END;
    v_groupp := CASE WHEN i_group AND r.r_in_group THEN w_group ELSE 0 END;
    v_momentsp := CASE WHEN i_moments THEN LEAST(r.r_moments::numeric / 3.0, 1) * w_moments ELSE 0 END;
    v_notesp := CASE WHEN i_notes THEN LEAST(r.r_notes::numeric / 3.0, 1) * w_notes ELSE 0 END;
    v_formsp := CASE WHEN i_forms THEN LEAST(r.r_forms::numeric / 2.0, 1) * w_forms ELSE 0 END;
    v_eventsp := CASE WHEN i_events THEN LEAST(r.r_events::numeric / 3.0, 1) * w_events ELSE 0 END;

    v_earned := v_consistency + v_recency + v_streak + v_groupatt + v_serving + v_leaderp
      + v_groupp + v_momentsp + v_notesp + v_formsp + v_eventsp;
    v_score := LEAST(ROUND(v_earned / v_total_weight * 100)::integer, 100);

    IF r.r_total_ever < t_new AND NOT r.r_is_leader AND r.r_serving = 0 THEN v_level := 'new';
    ELSIF v_score >= t_high THEN v_level := 'highly_engaged';
    ELSIF v_score >= t_active THEN v_level := 'active';
    ELSIF v_score >= t_risk THEN v_level := 'at_risk';
    ELSE v_level := 'inactive'; END IF;

    IF sg_serving_active AND (r.r_is_leader OR r.r_serving > 0) AND v_level IN ('at_risk','inactive','new') THEN
      v_level := 'active';
    END IF;

    IF sg_recent_days > 0 AND r.r_last_attended IS NOT NULL
       AND r.r_last_attended >= NOW() - (sg_recent_days || ' days')::interval
       AND v_level IN ('at_risk','inactive') THEN
      v_level := 'active';
    END IF;

    RETURN QUERY SELECT
      r.r_contact_id, r.r_total_90d, r.r_total_30d, r.r_total_ever, r.r_last_attended,
      r.r_weeks_window, v_streak_weeks, (r.r_vol + r.r_serving)::integer, r.r_vol,
      r.r_is_leader, r.r_in_group, r.r_moments, r.r_notes, r.r_forms, r.r_events,
      v_score, v_level,
      jsonb_build_object(
        'total_weight', v_total_weight,
        'consistency', jsonb_build_object('earned', ROUND(v_consistency,1), 'max', w_consistency),
        'recency', jsonb_build_object('earned', ROUND(v_recency,1), 'max', w_recency),
        'streak', jsonb_build_object('earned', ROUND(v_streak,1), 'max', w_streak),
        'group_attendance', jsonb_build_object('earned', ROUND(v_groupatt,1), 'max', w_groupatt),
        'serving', jsonb_build_object('earned', ROUND(v_serving,1), 'max', w_serving),
        'leadership', jsonb_build_object('earned', ROUND(v_leaderp,1), 'max', w_leader),
        'group_membership', jsonb_build_object('earned', ROUND(v_groupp,1), 'max', w_group),
        'flow_moments', jsonb_build_object('earned', ROUND(v_momentsp,1), 'max', w_moments),
        'notes_interactions', jsonb_build_object('earned', ROUND(v_notesp,1), 'max', w_notes),
        'form_submissions', jsonb_build_object('earned', ROUND(v_formsp,1), 'max', w_forms),
        'event_attendance', jsonb_build_object('earned', ROUND(v_eventsp,1), 'max', w_events)
      );
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."compute_engagement_rows"("p_org_id" "uuid", "p_settings" "jsonb", "p_sample_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."content_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."content_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cpr_set_org"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.contact_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM public.contacts WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."cpr_set_org"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_assignment_notification"("_user_id" "uuid", "_organization_id" "uuid", "_type" "text", "_title" "text", "_message" "text", "_contact_id" "uuid", "_pipeline_id" "uuid", "_interaction_id" "uuid" DEFAULT NULL::"uuid", "_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- Only create notification if user_id is not null
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO public.notifications (
    user_id,
    organization_id,
    type,
    title,
    message,
    contact_id,
    pipeline_id,
    interaction_id,
    metadata
  ) VALUES (
    _user_id,
    _organization_id,
    _type,
    _title,
    _message,
    _contact_id,
    _pipeline_id,
    _interaction_id,
    _metadata
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;


ALTER FUNCTION "public"."create_assignment_notification"("_user_id" "uuid", "_organization_id" "uuid", "_type" "text", "_title" "text", "_message" "text", "_contact_id" "uuid", "_pipeline_id" "uuid", "_interaction_id" "uuid", "_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_pipelines"("org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_default_pipelines"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_personal_flow_for_user"("p_user_id" "uuid", "p_org_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."create_personal_flow_for_user"("p_user_id" "uuid", "p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_org_tag"("p_org_id" "uuid", "p_tag" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_affected integer := 0;
BEGIN
  IF NOT public.is_user_in_organization(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  DELETE FROM public.contact_tags t
  USING public.contacts c
  WHERE c.id = t.contact_id
    AND c.organization_id = p_org_id
    AND t.tag = p_tag;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;


ALTER FUNCTION "public"."delete_org_tag"("p_org_id" "uuid", "p_tag" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_impersonation_session"("_session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Verify caller is system admin and owns this session
    IF NOT EXISTS (
        SELECT 1 FROM impersonation_sessions
        WHERE id = _session_id
          AND system_admin_user_id = auth.uid()
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Invalid session or not authorized';
    END IF;
    
    -- End the session
    UPDATE impersonation_sessions
    SET ended_at = now(),
        is_active = false,
        updated_at = now()
    WHERE id = _session_id;
    
    RETURN true;
END;
$$;


ALTER FUNCTION "public"."end_impersonation_session"("_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_life_season_on_attendance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_season public.contact_life_seasons;
  v_when date;
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Group attendance rows are written for absent members too; only a real
  -- present attendance should end an engagement pause.
  IF TG_TABLE_NAME = 'group_attendance' AND COALESCE(NEW.status, '') <> 'present' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_season
  FROM public.contact_life_seasons
  WHERE contact_id = NEW.contact_id AND ended_on IS NULL
  LIMIT 1;

  IF v_season.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_when := COALESCE(NEW.checked_in_at::date, CURRENT_DATE);

  UPDATE public.contact_life_seasons
  SET ended_on = CURRENT_DATE,
      end_reason = 'auto_attended',
      updated_at = now()
  WHERE id = v_season.id;

  IF v_season.created_by_user_id IS NOT NULL THEN
    INSERT INTO public.contact_notes (contact_id, content, note_type, created_by_user_id)
    VALUES (
      NEW.contact_id,
      'Engagement pause ended automatically — attended ' || to_char(v_when, 'Mon FMDD, YYYY') || '.',
      'general',
      v_season.created_by_user_id
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."end_life_season_on_attendance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."engagement_settings_for_org"("p_org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'weights', '{"consistency":35,"recency":20,"streak":15,"group_attendance":15,"serving":20,"leadership":10}'::jsonb || COALESCE(s.weights, '{}'::jsonb),
    'windows', COALESCE(s.windows, '{"consistency_weeks":12,"recency_days":90,"serving_days":90,"activity_days":90}'::jsonb),
    'thresholds', COALESCE(s.thresholds, '{"highly_engaged":75,"active":50,"at_risk":25,"new_max_checkins":3}'::jsonb),
    'ingredients', COALESCE(s.ingredients, '{"service_checkins":true,"group_attendance":true,"serving":true,"leadership":true}'::jsonb),
    'safeguards', COALESCE(s.safeguards, '{"serving_keeps_active":true,"recent_attendance_days":14,"household_credit":true,"streak_break_misses":1,"count_partial_week":false}'::jsonb)
  )
  FROM (SELECT p_org_id AS org) q
  LEFT JOIN public.org_engagement_settings s ON s.organization_id = q.org;
$$;


ALTER FUNCTION "public"."engagement_settings_for_org"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enroll_admin_on_org_pipelines"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."enroll_admin_on_org_pipelines"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_contact_signal"("p_contact_id" "uuid") RETURNS TABLE("signal" "text", "engagement_level" "text", "score" integer, "marker_key" "text", "label" "text", "description" "text", "category" "text", "polarity" "text", "value_text" "text", "value_numeric" numeric, "sort_order" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    ces.signal,
    ces.engagement_level,
    ces.score,
    md.key,
    md.label,
    md.description,
    md.category,
    md.polarity,
    cm.value_text,
    cm.value_numeric,
    md.sort_order
  FROM contacts c
  LEFT JOIN contact_engagement_scores ces ON ces.contact_id = c.id
  LEFT JOIN contact_markers cm ON cm.contact_id = c.id
  LEFT JOIN marker_definitions md ON md.key = cm.marker_key
  WHERE c.id = p_contact_id
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = c.organization_id AND om.user_id = auth.uid()
    )
  ORDER BY
    CASE md.polarity WHEN 'positive' THEN 1 WHEN 'neutral' THEN 2 WHEN 'negative' THEN 3 ELSE 4 END,
    md.sort_order;
$$;


ALTER FUNCTION "public"."get_contact_signal"("p_contact_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_engagement_snapshot"("p_org_id" "uuid", "p_as_of" "date") RETURNS TABLE("engagement_level" "text", "count" integer, "snapshot_date" "date")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH access_check AS (
    SELECT 1
    WHERE EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
    )
    OR public.is_system_admin(auth.uid())
  ),
  latest AS (
    SELECT MAX(snapshot_date) AS d
    FROM public.org_engagement_snapshots
    WHERE organization_id = p_org_id
      AND snapshot_date <= p_as_of
      AND snapshot_date >= p_as_of - INTERVAL '7 days'
  )
  SELECT s.engagement_level, s.count, s.snapshot_date
  FROM public.org_engagement_snapshots s, latest, access_check
  WHERE s.organization_id = p_org_id
    AND s.snapshot_date = latest.d;
$$;


ALTER FUNCTION "public"."get_engagement_snapshot"("p_org_id" "uuid", "p_as_of" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_engagement_snapshot_series"("p_org_id" "uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("snapshot_date" "date", "engagement_level" "text", "count" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT s.snapshot_date, s.engagement_level, s.count
  FROM public.org_engagement_snapshots s
  WHERE s.organization_id = p_org_id
    AND s.snapshot_date >= CURRENT_DATE - (p_days || ' days')::interval
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
      )
      OR public.is_system_admin(auth.uid())
    )
  ORDER BY s.snapshot_date ASC;
$$;


ALTER FUNCTION "public"."get_engagement_snapshot_series"("p_org_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_flow_role"("_user_id" "uuid", "_pipeline_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_flow_role"("_user_id" "uuid", "_pipeline_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_impersonation_org_id"("_admin_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT target_organization_id
  FROM public.impersonation_sessions
  WHERE system_admin_user_id = _admin_user_id
    AND is_active = true
    AND started_at > NOW() - INTERVAL '4 hours'
  ORDER BY started_at DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_impersonation_org_id"("_admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_marker_catalog"("p_org_id" "uuid", "p_campus_id" "uuid" DEFAULT NULL::"uuid", "p_assigned_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("key" "text", "label" "text", "description" "text", "category" "text", "polarity" "text", "sort_order" integer, "requires_integration" "text", "is_phase_two" boolean, "contact_count" bigint, "enabled" boolean, "default_label" "text", "default_description" "text", "params" "jsonb", "is_customized" boolean, "promoted_signal_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    md.key,
    COALESCE(oms.custom_label, md.label) AS label,
    COALESCE(oms.custom_description, md.description) AS description,
    md.category,
    COALESCE(cs.polarity, md.polarity) AS polarity,
    md.sort_order,
    md.requires_integration,
    md.is_phase_two,
    CASE
      WHEN oms.promoted_signal_id IS NOT NULL THEN COALESCE(custom_cnt.contact_count, 0)
      ELSE COALESCE(marker_cnt.contact_count, 0)
    END AS contact_count,
    CASE
      WHEN oms.promoted_signal_id IS NOT NULL THEN COALESCE(cs.enabled, false)
      ELSE COALESCE(oms.enabled, true)
    END AS enabled,
    md.label AS default_label,
    md.description AS default_description,
    COALESCE(oms.params, '{}'::jsonb) AS params,
    (oms.id IS NOT NULL AND (
      oms.custom_label IS NOT NULL
      OR oms.custom_description IS NOT NULL
      OR COALESCE(oms.params, '{}'::jsonb) <> '{}'::jsonb
      OR oms.enabled = false
      OR oms.promoted_signal_id IS NOT NULL
    )) AS is_customized,
    oms.promoted_signal_id
  FROM public.marker_definitions md
  LEFT JOIN public.org_marker_settings oms
    ON oms.organization_id = p_org_id AND oms.marker_key = md.key
  LEFT JOIN public.custom_signals cs
    ON cs.id = oms.promoted_signal_id
  LEFT JOIN (
    SELECT cm.marker_key, COUNT(DISTINCT cm.contact_id) AS contact_count
    FROM public.contact_markers cm
    JOIN public.contacts c ON c.id = cm.contact_id
    WHERE cm.organization_id = p_org_id
      AND (p_campus_id IS NULL OR c.campus_id = p_campus_id)
      AND (p_assigned_user_id IS NULL OR c.assigned_to_user_id = p_assigned_user_id)
    GROUP BY cm.marker_key
  ) marker_cnt ON marker_cnt.marker_key = md.key
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT csc.contact_id) AS contact_count
    FROM public.custom_signal_contacts csc
    JOIN public.contacts c ON c.id = csc.contact_id
    WHERE csc.signal_id = oms.promoted_signal_id
      AND csc.organization_id = p_org_id
      AND csc.cleared_at IS NULL
      AND (p_campus_id IS NULL OR c.campus_id = p_campus_id)
      AND (p_assigned_user_id IS NULL OR c.assigned_to_user_id = p_assigned_user_id)
  ) custom_cnt ON oms.promoted_signal_id IS NOT NULL
  ORDER BY md.sort_order, md.key
$$;


ALTER FUNCTION "public"."get_marker_catalog"("p_org_id" "uuid", "p_campus_id" "uuid", "p_assigned_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_checkin_counts"("p_org_id" "uuid", "p_week_start" timestamp with time zone, "p_month_start" timestamp with time zone, "p_campus_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("checkins_week" bigint, "checkins_month" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    COUNT(*) FILTER (WHERE pc.checked_in_at >= p_week_start)::bigint AS checkins_week,
    COUNT(*) FILTER (WHERE pc.checked_in_at >= p_month_start)::bigint AS checkins_month
  FROM public.pco_checkins pc
  WHERE pc.organization_id = p_org_id
    AND pc.checked_in_at >= p_month_start
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
      )
      OR public.is_system_admin(auth.uid())
    )
    AND (
      p_campus_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = pc.contact_id AND c.campus_id = p_campus_id
      )
    );
$$;


ALTER FUNCTION "public"."get_org_checkin_counts"("p_org_id" "uuid", "p_week_start" timestamp with time zone, "p_month_start" timestamp with time zone, "p_campus_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_engagement_distribution"("p_org_id" "uuid", "p_campus_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("engagement_level" "text", "count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ces.engagement_level::text, COUNT(*)::bigint
  FROM public.contact_engagement_scores ces
  WHERE ces.organization_id = p_org_id
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
      )
      OR public.is_system_admin(auth.uid())
    )
    AND (
      p_campus_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = ces.contact_id AND c.campus_id = p_campus_id
      )
    )
  GROUP BY ces.engagement_level;
$$;


ALTER FUNCTION "public"."get_org_engagement_distribution"("p_org_id" "uuid", "p_campus_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_tag_stats"("p_org_id" "uuid") RETURNS TABLE("tag" "text", "contact_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT t.tag, count(DISTINCT t.contact_id)::bigint
  FROM public.contact_tags t
  JOIN public.contacts c ON c.id = t.contact_id
  WHERE c.organization_id = p_org_id
    AND public.is_user_in_organization(auth.uid(), p_org_id)
  GROUP BY t.tag
  ORDER BY count(DISTINCT t.contact_id) DESC, t.tag ASC
$$;


ALTER FUNCTION "public"."get_org_tag_stats"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_team_activity_stats"("p_org_id" "uuid") RETURNS TABLE("user_id" "uuid", "last_active_at" timestamp with time zone, "active_days_30d" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Auth: caller must be a member of the org or a system admin
  IF NOT (
    public.is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = p_org_id AND user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT om.user_id
    FROM public.organization_members om
    WHERE om.organization_id = p_org_id
  ),
  activity AS (
    -- Logins
    SELECT ul.user_id, ul.logged_in_at AS ts
    FROM public.user_logins ul
    WHERE ul.organization_id = p_org_id
      AND ul.logged_in_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    -- Interactions (filtered to this org via contacts join)
    SELECT ci.created_by_user_id AS user_id, ci.created_at AS ts
    FROM public.contact_interactions ci
    JOIN public.contacts c ON c.id = ci.contact_id
    WHERE c.organization_id = p_org_id
      AND ci.created_at >= NOW() - INTERVAL '30 days'
  ),
  last_login AS (
    SELECT ul.user_id, MAX(ul.logged_in_at) AS ts
    FROM public.user_logins ul
    WHERE ul.organization_id = p_org_id
    GROUP BY ul.user_id
  ),
  last_interaction AS (
    SELECT ci.created_by_user_id AS user_id, MAX(ci.created_at) AS ts
    FROM public.contact_interactions ci
    JOIN public.contacts c ON c.id = ci.contact_id
    WHERE c.organization_id = p_org_id
    GROUP BY ci.created_by_user_id
  )
  SELECT
    m.user_id,
    GREATEST(
      COALESCE(ll.ts, 'epoch'::timestamptz),
      COALESCE(li.ts, 'epoch'::timestamptz)
    ) AS last_active_at,
    COALESCE((
      SELECT COUNT(DISTINCT date_trunc('day', a.ts))::integer
      FROM activity a
      WHERE a.user_id = m.user_id
    ), 0) AS active_days_30d
  FROM members m
  LEFT JOIN last_login ll ON ll.user_id = m.user_id
  LEFT JOIN last_interaction li ON li.user_id = m.user_id;
END;
$$;


ALTER FUNCTION "public"."get_org_team_activity_stats"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_organizations_health_data"() RETURNS TABLE("id" "uuid", "name" "text", "slug" "text", "admin_name" "text", "admin_email" "text", "admin_user_id" "uuid", "plan_tier" "text", "subscription_status" "text", "created_at" timestamp with time zone, "last_login" timestamp with time zone, "total_logins_30d" bigint, "last_pco_sync" timestamp with time zone, "flows_count" bigint, "active_users" bigint, "contacts_count" bigint, "avg_weekly_activity" integer, "ai_uses_30d" bigint, "health_score" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    id,
    name,
    slug,
    admin_name,
    admin_email,
    admin_user_id,
    plan_tier,
    subscription_status,
    created_at,
    last_login,
    total_logins_30d,
    last_pco_sync,
    flows_count,
    active_users,
    contacts_count,
    avg_weekly_activity,
    ai_uses_30d,
    health_score
  FROM organization_health_view
  WHERE is_system_admin(auth.uid())
  ORDER BY created_at DESC;
$$;


ALTER FUNCTION "public"."get_organizations_health_data"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_organizations_health_data"() IS 'SECURITY: This is the ONLY safe way to access organization_health_view data. Direct queries to the view are restricted by underlying table RLS policies.';



CREATE OR REPLACE FUNCTION "public"."get_public_content_video"("p_slug" "text", "p_video_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
  v_video jsonb;
  v_analysis jsonb;
  v_chunks jsonb;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = p_slug;
  IF v_org_id IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(v) INTO v_video
  FROM (
    SELECT id, youtube_id, title, channel_name, thumbnail_url, duration_seconds, description, short_description, published_at
    FROM content_videos
    WHERE id = p_video_id
      AND organization_id = v_org_id
      AND consent_level = 'public_search'
      AND ingest_status = 'ready'
  ) v;
  IF v_video IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(a) INTO v_analysis
  FROM (
    SELECT summary, themes, story_patterns, key_quotes, impact_score, generated_at
    FROM content_analyses
    WHERE video_id = p_video_id
    ORDER BY generated_at DESC
    LIMIT 1
  ) a;

  SELECT jsonb_agg(to_jsonb(c) ORDER BY (c).chunk_index) INTO v_chunks
  FROM (
    SELECT id, chunk_index, text, start_seconds, end_seconds
    FROM content_transcript_chunks
    WHERE video_id = p_video_id
  ) c;

  RETURN jsonb_build_object(
    'video', v_video,
    'analysis', v_analysis,
    'chunks', COALESCE(v_chunks, '[]'::jsonb)
  );
END;
$$;


ALTER FUNCTION "public"."get_public_content_video"("p_slug" "text", "p_video_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_group_settings"("p_org_id" "uuid") RETURNS TABLE("directory_hero_title" "text", "directory_hero_subtitle" "text", "directory_show_meeting_time" boolean, "directory_show_location" boolean, "directory_show_capacity" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT directory_hero_title, directory_hero_subtitle,
         directory_show_meeting_time, directory_show_location, directory_show_capacity
  FROM public.group_settings
  WHERE organization_id = p_org_id AND directory_enabled = true;
$$;


ALTER FUNCTION "public"."get_public_group_settings"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_group_types"("p_org_id" "uuid") RETURNS TABLE("key" "text", "label" "text", "icon" "text", "color" "text", "sort_order" integer, "is_active" boolean, "is_hidden" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT t.key, t.label, t.icon, t.color, t.sort_order, t.is_active, t.is_hidden
  FROM public.group_type_definitions t
  WHERE t.organization_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.group_settings s
      WHERE s.organization_id = p_org_id AND s.directory_enabled = true
    )
  ORDER BY t.sort_order;
$$;


ALTER FUNCTION "public"."get_public_group_types"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_organization"("p_slug" "text") RETURNS TABLE("id" "uuid", "name" "text", "slug" "text", "logo_url" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT o.id, o.name, o.slug, o.logo_url
  FROM public.organizations o
  WHERE o.slug = p_slug
    AND (
      EXISTS (
        SELECT 1 FROM public.content_videos v
        WHERE v.organization_id = o.id
          AND v.consent_level = 'public_search'::content_consent_level
      )
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.organization_id = o.id
          AND g.visibility = 'public'
          AND g.status = 'active'
          AND g.archived_at IS NULL
      )
    )
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_public_organization"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_story"("p_slug" "text", "p_content_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_org_id uuid; v_story public.content_stories%ROWTYPE; v_video jsonb; v_analysis jsonb; v_blocks jsonb; v_cta jsonb; v_related jsonb;
  v_preset public.content_story_cta_defaults%ROWTYPE; v_url text;
BEGIN
  SELECT id INTO v_org_id FROM public.get_public_organization(p_slug) LIMIT 1;
  IF v_org_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_story FROM public.content_stories WHERE organization_id = v_org_id AND status = 'published' AND (id = p_content_id OR source_video_id = p_content_id) LIMIT 1;
  SELECT to_jsonb(v) INTO v_video FROM (SELECT id, youtube_id, title, channel_name, thumbnail_url, duration_seconds, description, short_description, published_at FROM public.content_videos WHERE id = COALESCE(v_story.source_video_id, p_content_id) AND organization_id = v_org_id AND consent_level = 'public_search' AND ingest_status = 'ready') v;
  IF v_story.id IS NULL AND v_video IS NULL THEN RETURN NULL; END IF;
  SELECT to_jsonb(a) INTO v_analysis FROM (SELECT summary, themes, story_patterns, key_quotes, impact_score FROM public.content_analyses WHERE video_id = COALESCE(v_story.source_video_id, p_content_id) ORDER BY generated_at DESC LIMIT 1) a;

  IF v_story.id IS NOT NULL AND v_story.cta_mode = 'custom' AND v_story.cta_headline IS NOT NULL AND v_story.cta_button_label IS NOT NULL AND v_story.cta_url IS NOT NULL THEN
    v_cta := jsonb_build_object('headline', v_story.cta_headline, 'description', v_story.cta_description, 'button_label', v_story.cta_button_label, 'destination_url', v_story.cta_url);
  ELSE
    IF v_story.id IS NOT NULL AND v_story.cta_mode = 'preset' AND v_story.cta_preset_id IS NOT NULL THEN
      SELECT * INTO v_preset FROM public.content_story_cta_defaults WHERE id = v_story.cta_preset_id AND organization_id = v_org_id;
    END IF;
    IF v_preset.id IS NULL AND v_story.category IS NOT NULL THEN
      SELECT * INTO v_preset FROM public.content_story_cta_defaults WHERE organization_id = v_org_id AND NOT is_global AND lower(category) = lower(v_story.category) LIMIT 1;
    END IF;
    IF v_preset.id IS NULL THEN
      SELECT * INTO v_preset FROM public.content_story_cta_defaults WHERE organization_id = v_org_id AND is_global LIMIT 1;
    END IF;
    IF v_preset.id IS NOT NULL THEN
      IF v_preset.destination_type = 'form' THEN
        SELECT '/' || p_slug || '/f/' || f.slug INTO v_url FROM public.forms f WHERE f.id = v_preset.form_id AND f.organization_id = v_org_id AND f.is_published;
      ELSE v_url := v_preset.destination_url; END IF;
      IF v_url IS NOT NULL AND v_preset.headline IS NOT NULL AND v_preset.button_label IS NOT NULL THEN
        v_cta := jsonb_build_object('headline', v_preset.headline, 'description', v_preset.description, 'button_label', v_preset.button_label, 'destination_url', v_url);
      END IF;
    END IF;
  END IF;

  IF v_story.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.sort_order), '[]'::jsonb) INTO v_blocks FROM public.content_story_blocks b WHERE b.story_id = v_story.id;
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_related FROM (SELECT s.id, s.source_video_id, s.title, s.person_name, s.summary, s.category, s.story_format, s.lead_media_url, cv.thumbnail_url, cv.youtube_id, cv.duration_seconds FROM public.content_stories s LEFT JOIN public.content_videos cv ON cv.id = s.source_video_id WHERE s.organization_id = v_org_id AND s.status = 'published' AND s.id <> v_story.id ORDER BY CASE WHEN s.category IS NOT NULL AND lower(s.category) = lower(v_story.category) THEN 0 ELSE 1 END, s.published_at DESC NULLS LAST LIMIT 4) r;
  ELSE
    v_blocks := '[]'::jsonb;
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_related FROM (SELECT cv.id, cv.id AS source_video_id, cv.title, cv.channel_name AS person_name, cv.short_description AS summary, NULL::text AS category, 'vertical_video'::text AS story_format, cv.thumbnail_url AS lead_media_url, cv.thumbnail_url, cv.youtube_id, cv.duration_seconds FROM public.content_videos cv WHERE cv.organization_id = v_org_id AND cv.consent_level = 'public_search' AND cv.ingest_status = 'ready' AND cv.id <> p_content_id ORDER BY cv.is_featured DESC, cv.created_at DESC LIMIT 4) r;
  END IF;
  RETURN jsonb_build_object('story', CASE WHEN v_story.id IS NULL THEN NULL ELSE to_jsonb(v_story) END, 'video', v_video, 'analysis', v_analysis, 'blocks', COALESCE(v_blocks, '[]'::jsonb), 'cta', v_cta, 'related', COALESCE(v_related, '[]'::jsonb));
END;
$$;


ALTER FUNCTION "public"."get_public_story"("p_slug" "text", "p_content_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_organization_role"("_user_id" "uuid", "_organization_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.organization_members 
  WHERE user_id = _user_id AND organization_id = _organization_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_organization_role"("_user_id" "uuid", "_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_system_role"("_user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role::text
  FROM public.system_user_roles
  WHERE user_id = _user_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_system_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  org_id UUID;
  skip_org BOOLEAN;
  base_slug TEXT;
  final_slug TEXT;
  slug_exists BOOLEAN;
  suffix_num INTEGER := 1;
BEGIN
  -- Insert user profile (always needed)
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Check if we should skip org creation (invited user)
  skip_org := COALESCE((NEW.raw_user_meta_data->>'skip_org_creation')::boolean, false);
  
  -- Only create organization if not invited
  IF NOT skip_org THEN
    -- Generate base slug from organization name
    base_slug := LOWER(REGEXP_REPLACE(
      COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email, '@', 1)),
      '[^a-zA-Z0-9]+', '-', 'g'
    ));
    -- Remove leading/trailing hyphens
    base_slug := TRIM(BOTH '-' FROM base_slug);
    
    -- Start with base slug
    final_slug := base_slug;
    
    -- Loop to find available slug (with numbered suffix if needed)
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.organizations WHERE slug = final_slug) INTO slug_exists;
      EXIT WHEN NOT slug_exists OR suffix_num > 10;
      final_slug := base_slug || '-' || suffix_num;
      suffix_num := suffix_num + 1;
    END LOOP;
    
    -- If still exists after 10 attempts, add random suffix
    IF slug_exists THEN
      final_slug := base_slug || '-' || SUBSTRING(md5(random()::text) FROM 1 FOR 6);
    END IF;
    
    INSERT INTO public.organizations (name, slug)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email, '@', 1) || '''s Organization'),
      final_slug
    )
    RETURNING id INTO org_id;
    
    -- Make user owner of their organization
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, NEW.id, 'owner');
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ai_stat"("org_id" "uuid", "stat_column" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO organization_activity_stats (
    organization_id,
    date,
    ai_messages_generated,
    ai_suggestions_used,
    ai_descriptions_generated,
    total_ai_uses
  ) VALUES (
    org_id,
    CURRENT_DATE,
    CASE WHEN stat_column = 'ai_messages_generated' THEN 1 ELSE 0 END,
    CASE WHEN stat_column = 'ai_suggestions_used' THEN 1 ELSE 0 END,
    CASE WHEN stat_column = 'ai_descriptions_generated' THEN 1 ELSE 0 END,
    1
  )
  ON CONFLICT (organization_id, date) 
  DO UPDATE SET
    ai_messages_generated = organization_activity_stats.ai_messages_generated + 
      CASE WHEN stat_column = 'ai_messages_generated' THEN 1 ELSE 0 END,
    ai_suggestions_used = organization_activity_stats.ai_suggestions_used + 
      CASE WHEN stat_column = 'ai_suggestions_used' THEN 1 ELSE 0 END,
    ai_descriptions_generated = organization_activity_stats.ai_descriptions_generated + 
      CASE WHEN stat_column = 'ai_descriptions_generated' THEN 1 ELSE 0 END,
    total_ai_uses = organization_activity_stats.total_ai_uses + 1;
END;
$$;


ALTER FUNCTION "public"."increment_ai_stat"("org_id" "uuid", "stat_column" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_currently_impersonating"("_admin_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.impersonation_sessions
    WHERE system_admin_user_id = _admin_user_id
      AND is_active = true
      AND started_at > NOW() - INTERVAL '4 hours'
  );
$$;


ALTER FUNCTION "public"."is_currently_impersonating"("_admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_flow_team_member"("_user_id" "uuid", "_pipeline_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."is_flow_team_member"("_user_id" "uuid", "_pipeline_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_system_admin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'support_admin')
  )
$$;


ALTER FUNCTION "public"."is_system_admin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_in_organization"("_user_id" "uuid", "_organization_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE user_id = _user_id AND organization_id = _organization_id
  );
$$;


ALTER FUNCTION "public"."is_user_in_organization"("_user_id" "uuid", "_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_impersonation_action"("_session_id" "uuid", "_action_type" "text", "_action_description" "text", "_page_url" "text" DEFAULT NULL::"text", "_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    action_id UUID;
BEGIN
    INSERT INTO impersonation_actions (
        impersonation_session_id,
        action_type,
        action_description,
        page_url,
        metadata
    ) VALUES (
        _session_id,
        _action_type,
        _action_description,
        _page_url,
        _metadata
    )
    RETURNING id INTO action_id;
    
    RETURN action_id;
END;
$$;


ALTER FUNCTION "public"."log_impersonation_action"("_session_id" "uuid", "_action_type" "text", "_action_description" "text", "_page_url" "text", "_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_pipeline_contact_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_user_id uuid;
  previous_stage_name text;
  new_stage_name text;
  pipeline_name text;
  previous_user_name text;
  new_user_name text;
  fallback_user_id uuid;
  contact_name text;
  org_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Get organization ID and contact name
  SELECT organization_id, name INTO org_id, contact_name FROM contacts WHERE id = COALESCE(NEW.contact_id, OLD.contact_id);
  
  -- Get fallback user ID from integration if this is an automated sync
  IF current_user_id IS NULL AND NEW.assigned_to_user_id IS NULL THEN
    SELECT user_id INTO fallback_user_id
    FROM integrations
    WHERE organization_id = org_id
      AND service_name = 'planning_center'
    LIMIT 1;
  END IF;
  
  -- Get pipeline name
  SELECT name INTO pipeline_name FROM pipelines WHERE id = COALESCE(NEW.pipeline_id, OLD.pipeline_id);
  
  -- Handle INSERT (contact added to flow)
  IF TG_OP = 'INSERT' THEN
    -- Get stage name
    SELECT name INTO new_stage_name FROM pipeline_stages WHERE id = NEW.stage_id;
    
    INSERT INTO contact_interactions (
      contact_id,
      pipeline_id,
      stage_id,
      created_by_user_id,
      interaction_type,
      subject,
      details,
      completed_at,
      metadata
    ) VALUES (
      NEW.contact_id,
      NEW.pipeline_id,
      NEW.stage_id,
      COALESCE(current_user_id, NEW.assigned_to_user_id, fallback_user_id),
      'flow_added',
      'Added to ' || pipeline_name,
      'Contact was added to the ' || pipeline_name || ' pipeline in stage: ' || new_stage_name,
      now(),
      jsonb_build_object(
        'pipeline_name', pipeline_name,
        'stage_name', new_stage_name,
        'source_type', NEW.source_type
      )
    );
    
    -- Create notification if someone is assigned (and it's not a self-assignment)
    IF NEW.assigned_to_user_id IS NOT NULL AND NEW.assigned_to_user_id != current_user_id THEN
      PERFORM create_assignment_notification(
        NEW.assigned_to_user_id,
        org_id,
        'person_assigned',
        'New Person Assigned',
        'You have been assigned to ' || COALESCE(contact_name, 'a contact') || ' in ' || pipeline_name,
        NEW.contact_id,
        NEW.pipeline_id,
        NULL,
        jsonb_build_object(
          'pipeline_name', pipeline_name,
          'stage_name', new_stage_name,
          'assigned_by', current_user_id
        )
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Check if stage changed
    IF OLD.stage_id != NEW.stage_id THEN
      -- Get stage names
      SELECT name INTO previous_stage_name FROM pipeline_stages WHERE id = OLD.stage_id;
      SELECT name INTO new_stage_name FROM pipeline_stages WHERE id = NEW.stage_id;
      
      INSERT INTO contact_interactions (
        contact_id,
        pipeline_id,
        stage_id,
        previous_stage_id,
        created_by_user_id,
        interaction_type,
        subject,
        details,
        completed_at,
        metadata
      ) VALUES (
        NEW.contact_id,
        NEW.pipeline_id,
        NEW.stage_id,
        OLD.stage_id,
        COALESCE(current_user_id, NEW.assigned_to_user_id, fallback_user_id),
        'flow_stage_changed',
        'Stage changed in ' || pipeline_name,
        'Moved from "' || previous_stage_name || '" to "' || new_stage_name || '"',
        now(),
        jsonb_build_object(
          'pipeline_name', pipeline_name,
          'previous_stage_name', previous_stage_name,
          'new_stage_name', new_stage_name
        )
      );
    END IF;
    
    -- Check if assignment changed
    IF COALESCE(OLD.assigned_to_user_id::text, '') != COALESCE(NEW.assigned_to_user_id::text, '') THEN
      -- Get user names if available
      IF OLD.assigned_to_user_id IS NOT NULL THEN
        SELECT full_name INTO previous_user_name FROM profiles WHERE user_id = OLD.assigned_to_user_id;
      END IF;
      IF NEW.assigned_to_user_id IS NOT NULL THEN
        SELECT full_name INTO new_user_name FROM profiles WHERE user_id = NEW.assigned_to_user_id;
      END IF;
      
      INSERT INTO contact_interactions (
        contact_id,
        pipeline_id,
        stage_id,
        assigned_to_user_id,
        created_by_user_id,
        interaction_type,
        subject,
        details,
        completed_at,
        metadata
      ) VALUES (
        NEW.contact_id,
        NEW.pipeline_id,
        NEW.stage_id,
        NEW.assigned_to_user_id,
        COALESCE(current_user_id, NEW.assigned_to_user_id, fallback_user_id),
        'flow_assignment_changed',
        'Assignment changed in ' || pipeline_name,
        CASE 
          WHEN OLD.assigned_to_user_id IS NULL THEN 'Assigned to ' || COALESCE(new_user_name, 'Unknown User')
          WHEN NEW.assigned_to_user_id IS NULL THEN 'Unassigned from ' || COALESCE(previous_user_name, 'Unknown User')
          ELSE 'Reassigned from ' || COALESCE(previous_user_name, 'Unknown User') || ' to ' || COALESCE(new_user_name, 'Unknown User')
        END,
        now(),
        jsonb_build_object(
          'pipeline_name', pipeline_name,
          'previous_user_name', previous_user_name,
          'new_user_name', new_user_name
        )
      );
      
      -- Create notifications for assignment changes (skip self-assignments)
      -- Notify new assignee
      IF NEW.assigned_to_user_id IS NOT NULL AND NEW.assigned_to_user_id != current_user_id THEN
        PERFORM create_assignment_notification(
          NEW.assigned_to_user_id,
          org_id,
          'person_assigned',
          'New Person Assigned',
          'You have been assigned to ' || COALESCE(contact_name, 'a contact') || ' in ' || pipeline_name,
          NEW.contact_id,
          NEW.pipeline_id,
          NULL,
          jsonb_build_object(
            'pipeline_name', pipeline_name,
            'assigned_by', current_user_id,
            'previous_assignee', OLD.assigned_to_user_id
          )
        );
      END IF;
      
      -- Notify previous assignee (if being reassigned, not unassigned)
      IF OLD.assigned_to_user_id IS NOT NULL 
         AND OLD.assigned_to_user_id != NEW.assigned_to_user_id 
         AND NEW.assigned_to_user_id IS NOT NULL THEN
        PERFORM create_assignment_notification(
          OLD.assigned_to_user_id,
          org_id,
          'person_unassigned',
          'Person Reassigned',
          COALESCE(contact_name, 'A contact') || ' has been reassigned to ' || 
          COALESCE(new_user_name, 'another team member') || ' in ' || pipeline_name,
          OLD.contact_id,
          OLD.pipeline_id,
          NULL,
          jsonb_build_object(
            'pipeline_name', pipeline_name,
            'reassigned_to', NEW.assigned_to_user_id,
            'reassigned_by', current_user_id
          )
        );
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- Handle DELETE (contact removed from flow)
  IF TG_OP = 'DELETE' THEN
    -- Get stage name
    SELECT name INTO previous_stage_name FROM pipeline_stages WHERE id = OLD.stage_id;
    
    INSERT INTO contact_interactions (
      contact_id,
      pipeline_id,
      stage_id,
      created_by_user_id,
      interaction_type,
      subject,
      details,
      completed_at,
      metadata
    ) VALUES (
      OLD.contact_id,
      OLD.pipeline_id,
      OLD.stage_id,
      COALESCE(current_user_id, OLD.assigned_to_user_id, fallback_user_id),
      'flow_removed',
      'Removed from ' || pipeline_name,
      'Contact was removed from the ' || pipeline_name || ' pipeline (was in stage: ' || previous_stage_name || ')',
      now(),
      jsonb_build_object(
        'pipeline_name', pipeline_name,
        'stage_name', previous_stage_name
      )
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."log_pipeline_contact_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."marker_param"("p_org_id" "uuid", "p_key" "text", "p_param" "text", "p_default" numeric) RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(oms.params->>p_param), '')::numeric
     FROM org_marker_settings oms
     WHERE oms.organization_id = p_org_id AND oms.marker_key = p_key),
    p_default
  );
$$;


ALTER FUNCTION "public"."marker_param"("p_org_id" "uuid", "p_key" "text", "p_param" "text", "p_default" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_content_chunks"("query_embedding" "public"."vector", "p_org_id" "uuid", "p_video_id" "uuid" DEFAULT NULL::"uuid", "match_threshold" double precision DEFAULT 0.3, "match_count" integer DEFAULT 8) RETURNS TABLE("chunk_id" "uuid", "video_id" "uuid", "chunk_index" integer, "text" "text", "start_seconds" integer, "end_seconds" integer, "similarity" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    c.id,
    c.video_id,
    c.chunk_index,
    c.text,
    c.start_seconds,
    c.end_seconds,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.content_transcript_chunks c
  WHERE c.organization_id = p_org_id
    AND (p_video_id IS NULL OR c.video_id = p_video_id)
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (
      auth.uid() IS NULL
      OR public.get_user_organization_role(auth.uid(), c.organization_id) IS NOT NULL
      OR public.is_system_admin(auth.uid())
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."match_content_chunks"("query_embedding" "public"."vector", "p_org_id" "uuid", "p_video_id" "uuid", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_content_chunks_public"("query_embedding" "public"."vector", "p_org_slug" "text", "match_threshold" double precision DEFAULT 0.3, "match_count" integer DEFAULT 8) RETURNS TABLE("chunk_id" "uuid", "video_id" "uuid", "chunk_index" integer, "text" "text", "start_seconds" integer, "end_seconds" integer, "similarity" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    c.id,
    c.video_id,
    c.chunk_index,
    c.text,
    c.start_seconds,
    c.end_seconds,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.content_transcript_chunks c
  JOIN public.content_videos v ON v.id = c.video_id
  JOIN public.organizations o ON o.id = v.organization_id
  WHERE o.slug = p_org_slug
    AND v.consent_level = 'public_search'
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."match_content_chunks_public"("query_embedding" "public"."vector", "p_org_slug" "text", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_org_tags"("p_org_id" "uuid", "p_source_tags" "text"[], "p_target_tag" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_target text := btrim(p_target_tag);
  v_inserted integer := 0;
BEGIN
  IF NOT public.is_user_in_organization(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  IF v_target IS NULL OR v_target = '' THEN
    RAISE EXCEPTION 'Target tag cannot be empty';
  END IF;

  -- Add the target tag to everyone holding a source tag
  INSERT INTO public.contact_tags (contact_id, tag)
  SELECT DISTINCT t.contact_id, v_target
  FROM public.contact_tags t
  JOIN public.contacts c ON c.id = t.contact_id
  WHERE c.organization_id = p_org_id
    AND t.tag = ANY(p_source_tags)
    AND NOT EXISTS (
      SELECT 1 FROM public.contact_tags x
      WHERE x.contact_id = t.contact_id AND x.tag = v_target
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Remove the source tags (except the target itself)
  DELETE FROM public.contact_tags t
  USING public.contacts c
  WHERE c.id = t.contact_id
    AND c.organization_id = p_org_id
    AND t.tag = ANY(p_source_tags)
    AND t.tag <> v_target;

  RETURN v_inserted;
END;
$$;


ALTER FUNCTION "public"."merge_org_tags"("p_org_id" "uuid", "p_source_tags" "text"[], "p_target_tag" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_push_on_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_project_url TEXT := 'https://lghamvpolwebtjwaxned.supabase.co';
  v_service_key TEXT;
  v_url TEXT;
BEGIN
  -- Service role key is stored in vault.secrets (Supabase managed). Fallback: skip.
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  IF v_service_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_url := v_project_url || '/functions/v1/send-push';

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'url', CASE
        WHEN NEW.contact_id IS NOT NULL AND NEW.pipeline_id IS NOT NULL
          THEN '/contacts/' || NEW.contact_id || '?pipelineId=' || NEW.pipeline_id
        WHEN NEW.contact_id IS NOT NULL THEN '/contacts/' || NEW.contact_id
        WHEN NEW.pipeline_id IS NOT NULL THEN '/flows/' || NEW.pipeline_id
        ELSE '/'
      END,
      'tag', NEW.id::text,
      'notification_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_push_on_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_engagement_settings"("p_org_id" "uuid", "p_settings" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  WITH computed AS (
    SELECT * FROM public.compute_engagement_rows(p_org_id, p_settings)
  ),
  rows AS (
    SELECT
      r.contact_id,
      COALESCE(ls.frozen_score, r.score) AS score,
      COALESCE(ls.frozen_level, r.engagement_level) AS engagement_level,
      r.consecutive_weeks,
      r.weeks_window,
      COALESCE(ls.frozen_breakdown, r.breakdown) AS breakdown,
      (ls.id IS NOT NULL) AS paused
    FROM computed r
    LEFT JOIN contact_life_seasons ls
      ON ls.contact_id = r.contact_id AND ls.ended_on IS NULL
  ),
  dist AS (
    SELECT engagement_level AS level, COUNT(*)::integer AS count FROM rows GROUP BY engagement_level
  ),
  samples AS (
    SELECT r.contact_id, c.name AS full_name, r.score, r.engagement_level,
           r.consecutive_weeks, r.weeks_window, r.breakdown, r.paused
    FROM rows r JOIN contacts c ON c.id = r.contact_id
    ORDER BY r.score DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'distribution', COALESCE((SELECT jsonb_object_agg(level, count) FROM dist), '{}'::jsonb),
    'average_score', COALESCE((SELECT ROUND(AVG(score),1) FROM rows), 0),
    'people_scored', (SELECT COUNT(*) FROM rows),
    'paused_count', (SELECT COUNT(*) FROM rows WHERE paused),
    'samples', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM samples s), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."preview_engagement_settings"("p_org_id" "uuid", "p_settings" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_engagement_settings"("p_org_id" "uuid", "p_settings" "jsonb", "p_sample_limit" integer DEFAULT 2500) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result jsonb;
  v_total integer;
  v_scanned integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  SELECT COUNT(*)::integer INTO v_total FROM contacts c WHERE c.organization_id = p_org_id;

  WITH computed AS (
    SELECT * FROM public.compute_engagement_rows(p_org_id, p_settings, p_sample_limit)
  ),
  rows AS (
    SELECT
      r.contact_id,
      COALESCE(ls.frozen_score, r.score) AS score,
      COALESCE(ls.frozen_level, r.engagement_level) AS engagement_level,
      r.consecutive_weeks,
      r.weeks_window,
      COALESCE(ls.frozen_breakdown, r.breakdown) AS breakdown,
      (ls.id IS NOT NULL) AS paused
    FROM computed r
    LEFT JOIN contact_life_seasons ls
      ON ls.contact_id = r.contact_id AND ls.ended_on IS NULL
  ),
  dist AS (
    SELECT engagement_level AS level, COUNT(*)::integer AS count FROM rows GROUP BY engagement_level
  ),
  ranked_samples AS (
    SELECT r.contact_id, c.name AS full_name, r.score, r.engagement_level,
           r.consecutive_weeks, r.weeks_window, r.breakdown, r.paused,
           ROW_NUMBER() OVER (
             PARTITION BY r.engagement_level
             ORDER BY r.score DESC, c.name ASC NULLS LAST, r.contact_id
           ) AS level_rank
    FROM rows r
    JOIN contacts c ON c.id = r.contact_id
  ),
  samples AS (
    SELECT contact_id, full_name, score, engagement_level,
           consecutive_weeks, weeks_window, breakdown, paused
    FROM ranked_samples
    WHERE level_rank <= 3
    ORDER BY CASE engagement_level
      WHEN 'highly_engaged' THEN 1
      WHEN 'active' THEN 2
      WHEN 'at_risk' THEN 3
      WHEN 'inactive' THEN 4
      WHEN 'new' THEN 5
      ELSE 6
    END, score DESC, full_name ASC NULLS LAST
  )
  SELECT jsonb_build_object(
    'distribution', COALESCE((SELECT jsonb_object_agg(level, count) FROM dist), '{}'::jsonb),
    'average_score', COALESCE((SELECT ROUND(AVG(score),1) FROM rows), 0),
    'people_scored', (SELECT COUNT(*) FROM rows),
    'paused_count', (SELECT COUNT(*) FROM rows WHERE paused),
    'samples', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM samples s), '[]'::jsonb)
  ) INTO v_result;

  v_scanned := COALESCE((v_result->>'people_scored')::integer, 0);
  v_result := v_result || jsonb_build_object(
    'total_contacts', v_total,
    'sample_limit', p_sample_limit,
    'sampled', (p_sample_limit IS NOT NULL AND v_scanned >= p_sample_limit)
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."preview_engagement_settings"("p_org_id" "uuid", "p_settings" "jsonb", "p_sample_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_contact_markers"("p_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.recompute_contact_markers_core(p_org_id);

  -- People in an active life season are excluded from signals
  DELETE FROM public.contact_markers cm
  WHERE cm.organization_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.contact_life_seasons ls
      WHERE ls.contact_id = cm.contact_id
        AND ls.ended_on IS NULL
    );
END;
$$;


ALTER FUNCTION "public"."recompute_contact_markers"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_contact_markers_core"("p_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_attend_days            int;
  v_consistent_weeks_win   int;
  v_consistent_min_weeks   int;
  v_guest_days             int;
  v_kids_days              int;
  v_missed_min_days        int;
  v_missed_max_days        int;
  v_missed_min_lifetime    int;
  v_drift_days             int;
  v_drift_min_lifetime     int;
  v_dropped_min_prior      int;
  v_group_inactive_days    int;
  v_serve_recent_days      int;
  v_serve_regular_days     int;
  v_serve_regular_min      int;
  v_stopped_lookback_days  int;
  v_stopped_min_times      int;
  v_stopped_recent_days    int;
  v_stopped_quiet_days     int;
  v_stuck_days             int;
  v_moment_days            int;
  v_online_days            int;
  v_prayer_days            int;
BEGIN
  v_attend_days           := marker_param(p_org_id, 'attended_sunday_recent', 'days', 14);
  v_consistent_weeks_win  := marker_param(p_org_id, 'consistent_attender', 'window_weeks', 4);
  v_consistent_min_weeks  := marker_param(p_org_id, 'consistent_attender', 'min_weeks', 3);
  v_guest_days            := marker_param(p_org_id, 'first_time_guest', 'days', 30);
  v_kids_days             := marker_param(p_org_id, 'kids_checked_in', 'days', 30);
  v_missed_min_days       := marker_param(p_org_id, 'missed_3_sundays', 'min_days', 21);
  v_missed_max_days       := marker_param(p_org_id, 'missed_3_sundays', 'max_days', 42);
  v_missed_min_lifetime   := marker_param(p_org_id, 'missed_3_sundays', 'min_lifetime_checkins', 4);
  v_drift_days            := marker_param(p_org_id, 'drifting_6_weeks', 'days', 42);
  v_drift_min_lifetime    := marker_param(p_org_id, 'drifting_6_weeks', 'min_lifetime_checkins', 4);
  v_dropped_min_prior     := marker_param(p_org_id, 'attendance_dropped', 'min_prior_weeks', 4);
  v_group_inactive_days   := marker_param(p_org_id, 'group_inactive_30d', 'days', 30);
  v_serve_recent_days     := marker_param(p_org_id, 'served_recently', 'days', 30);
  v_serve_regular_days    := marker_param(p_org_id, 'serves_regularly', 'days', 90);
  v_serve_regular_min     := marker_param(p_org_id, 'serves_regularly', 'min_times', 3);
  v_stopped_lookback_days := marker_param(p_org_id, 'stopped_serving', 'lookback_days', 180);
  v_stopped_min_times     := marker_param(p_org_id, 'stopped_serving', 'min_times', 3);
  v_stopped_recent_days   := marker_param(p_org_id, 'stopped_serving', 'recent_days', 90);
  v_stopped_quiet_days    := marker_param(p_org_id, 'stopped_serving', 'quiet_days', 60);
  v_stuck_days            := marker_param(p_org_id, 'stuck_in_stage_30d', 'days', 30);
  v_moment_days           := marker_param(p_org_id, 'flow_moment_recent', 'days', 90);
  v_online_days           := marker_param(p_org_id, 'watched_online_recent', 'days', 30);
  v_prayer_days           := marker_param(p_org_id, 'prayer_request_submitted', 'days', 90);

  DELETE FROM public.contact_markers WHERE organization_id = p_org_id;

  WITH
  household_person_ids AS (
    SELECT DISTINCT fm.contact_id, fm.pc_person_id AS hh_person_id
    FROM contact_family_members fm
    JOIN contacts c1 ON c1.id = fm.contact_id
    WHERE c1.organization_id = p_org_id
      AND fm.pc_person_id IS NOT NULL
      AND lower(fm.relationship) = 'child'
  ),
  own_checkins AS (
    SELECT c.id AS contact_id, pc.checked_in_at, pc.checkin_kind, pc.event_name
    FROM contacts c
    JOIN pco_checkins pc ON pc.contact_id = c.id
    WHERE c.organization_id = p_org_id
  ),
  household_checkins AS (
    SELECT hp.contact_id, pc.checked_in_at
    FROM household_person_ids hp
    JOIN pco_checkins pc ON pc.pc_person_id = hp.hh_person_id
    WHERE COALESCE(pc.checkin_kind, 'regular') <> 'volunteer'
  ),
  attendance_stats AS (
    SELECT
      contact_id,
      MAX(checked_in_at) AS last_attended,
      MIN(checked_in_at) AS first_attended,
      COUNT(*) FILTER (WHERE checked_in_at >= NOW() - (v_attend_days * INTERVAL '1 day')) AS in_recent,
      COUNT(DISTINCT date_trunc('week', checked_in_at))
        FILTER (WHERE checked_in_at >= NOW() - ((v_consistent_weeks_win * 7) * INTERVAL '1 day')) AS weeks_consistent_win,
      COUNT(DISTINCT date_trunc('week', checked_in_at))
        FILTER (WHERE checked_in_at >= NOW() - INTERVAL '84 days') AS weeks_last_12,
      COUNT(DISTINCT date_trunc('week', checked_in_at))
        FILTER (WHERE checked_in_at >= NOW() - INTERVAL '168 days'
                  AND checked_in_at <  NOW() - INTERVAL '84 days') AS weeks_prior_12,
      COUNT(*) AS total_ever,
      COUNT(*) FILTER (WHERE checkin_kind = 'guest' AND checked_in_at >= NOW() - (v_guest_days * INTERVAL '1 day')) AS guest_recent,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - (v_serve_recent_days * INTERVAL '1 day')) AS vol_recent,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - (v_serve_regular_days * INTERVAL '1 day')) AS vol_regular,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - (v_stopped_recent_days * INTERVAL '1 day')) AS vol_stopped_recent,
      COUNT(*) FILTER (WHERE checkin_kind = 'volunteer' AND checked_in_at >= NOW() - (v_stopped_lookback_days * INTERVAL '1 day')) AS vol_lookback,
      MAX(checked_in_at) FILTER (WHERE checkin_kind = 'volunteer') AS last_volunteered
    FROM own_checkins
    GROUP BY contact_id
  ),
  household_stats AS (
    SELECT contact_id, COUNT(*) AS hh_recent
    FROM household_checkins
    WHERE checked_in_at >= NOW() - (v_kids_days * INTERVAL '1 day')
    GROUP BY contact_id
  ),
  group_member_rows AS (
    SELECT gm.contact_id, gm.group_id, gm.id AS gm_id, gm.last_attended_at
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    JOIN contacts c ON c.id = gm.contact_id
    WHERE g.organization_id = p_org_id
      AND g.status = 'active'
      AND gm.status = 'active'
      AND c.organization_id = p_org_id
  ),
  recent_group_meetings AS (
    SELECT group_id, id AS meeting_id, meeting_date,
      row_number() OVER (PARTITION BY group_id ORDER BY meeting_date DESC) AS rn
    FROM group_meetings
    WHERE meeting_date IS NOT NULL
  ),
  group_attendance_rate AS (
    SELECT
      gmr.contact_id,
      COUNT(*) FILTER (WHERE rgm.meeting_id IS NOT NULL) AS meetings_count,
      COUNT(*) FILTER (WHERE ga.status = 'present') AS attended_count,
      MAX(ga.checked_in_at) FILTER (WHERE ga.status = 'present') AS last_group_attended
    FROM group_member_rows gmr
    LEFT JOIN recent_group_meetings rgm ON rgm.group_id = gmr.group_id AND rgm.rn <= 8
    LEFT JOIN group_attendance ga
      ON ga.group_member_id = gmr.gm_id
     AND ga.group_meeting_id = rgm.meeting_id
    GROUP BY gmr.contact_id
  ),
  flow_moment_stats AS (
    SELECT
      fm.contact_id,
      MAX(fm.occurred_at) AS last_moment,
      MAX(fm.occurred_at) FILTER (
        WHERE fm.occurred_at >= NOW() - INTERVAL '365 days'
          AND (fmt.category = 'salvation' OR fmt.name ILIKE '%salvation%' OR fmt.name ILIKE '%decision%')
      ) AS last_salvation,
      COUNT(*) FILTER (WHERE fm.occurred_at >= NOW() - (v_moment_days * INTERVAL '1 day')) AS moments_recent
    FROM flow_moments fm
    JOIN contacts c ON c.id = fm.contact_id
    LEFT JOIN flow_moment_types fmt ON fmt.id = fm.flow_moment_type_id
    WHERE c.organization_id = p_org_id
    GROUP BY fm.contact_id
  ),
  pipeline_stats AS (
    SELECT
      pc.contact_id,
      COUNT(*) AS active_flows,
      MIN(EXTRACT(EPOCH FROM (NOW() - pc.stage_entered_at)) / 86400.0) AS min_days_in_stage,
      MAX(EXTRACT(EPOCH FROM (NOW() - pc.stage_entered_at)) / 86400.0) AS max_days_in_stage
    FROM pipeline_contacts pc
    JOIN pipelines p ON p.id = pc.pipeline_id
    JOIN contacts c ON c.id = pc.contact_id
    WHERE c.organization_id = p_org_id
      AND p.organization_id = p_org_id
      AND pc.completed_end_at IS NULL
    GROUP BY pc.contact_id
  ),
  online_stats AS (
    SELECT
      coe.contact_id,
      COUNT(*) FILTER (WHERE coe.created_at >= NOW() - (v_online_days * INTERVAL '1 day')) AS watch_recent,
      COUNT(*) FILTER (WHERE coe.event_type ILIKE '%prayer%' AND coe.created_at >= NOW() - (v_prayer_days * INTERVAL '1 day')) AS prayer_recent
    FROM church_online_events coe
    JOIN contacts c ON c.id = coe.contact_id
    WHERE c.organization_id = p_org_id
    GROUP BY coe.contact_id
  ),
  base_contacts AS (
    SELECT id AS contact_id, created_at, source_type FROM contacts WHERE organization_id = p_org_id
  ),
  combined AS (
    SELECT
      bc.contact_id,
      bc.created_at AS contact_created_at,
      bc.source_type AS contact_source_type,
      COALESCE(a.in_recent, 0)             AS in_recent,
      COALESCE(a.weeks_consistent_win, 0)  AS weeks_consistent_win,
      COALESCE(a.weeks_last_12, 0)         AS weeks_last_12,
      COALESCE(a.weeks_prior_12, 0)        AS weeks_prior_12,
      COALESCE(a.total_ever, 0)            AS total_ever,
      a.last_attended,
      a.first_attended,
      COALESCE(a.guest_recent, 0)          AS guest_recent,
      COALESCE(a.vol_recent, 0)            AS vol_recent,
      COALESCE(a.vol_regular, 0)           AS vol_regular,
      COALESCE(a.vol_stopped_recent, 0)    AS vol_stopped_recent,
      COALESCE(a.vol_lookback, 0)          AS vol_lookback,
      a.last_volunteered,
      COALESCE(h.hh_recent, 0)             AS hh_recent,
      COALESCE(gar.meetings_count, 0)      AS group_meetings_count,
      COALESCE(gar.attended_count, 0)      AS group_attended_count,
      gar.last_group_attended,
      CASE WHEN EXISTS (SELECT 1 FROM group_member_rows g WHERE g.contact_id = bc.contact_id) THEN true ELSE false END AS in_group,
      fms.last_salvation,
      COALESCE(fms.moments_recent, 0)      AS moments_recent,
      COALESCE(ps.active_flows, 0)         AS active_flows,
      ps.max_days_in_stage,
      COALESCE(os.watch_recent, 0)         AS watch_recent,
      COALESCE(os.prayer_recent, 0)        AS prayer_recent
    FROM base_contacts bc
    LEFT JOIN attendance_stats a    ON a.contact_id   = bc.contact_id
    LEFT JOIN household_stats h     ON h.contact_id   = bc.contact_id
    LEFT JOIN group_attendance_rate gar ON gar.contact_id = bc.contact_id
    LEFT JOIN flow_moment_stats fms ON fms.contact_id = bc.contact_id
    LEFT JOIN pipeline_stats ps     ON ps.contact_id  = bc.contact_id
    LEFT JOIN online_stats os       ON os.contact_id  = bc.contact_id
  ),
  emitted AS (
    SELECT contact_id, key, value_text, value_numeric FROM (
      SELECT contact_id, 'attended_sunday_recent'::text AS key,
        'Last attended '||to_char(last_attended,'Mon DD') AS value_text,
        EXTRACT(EPOCH FROM (NOW() - last_attended))/86400.0 AS value_numeric
      FROM combined WHERE in_recent > 0
      UNION ALL
      SELECT contact_id, 'consistent_attender',
        weeks_consistent_win||' of last '||v_consistent_weeks_win||' weeks attended', weeks_consistent_win
      FROM combined WHERE weeks_consistent_win >= v_consistent_min_weeks
      UNION ALL
      SELECT contact_id, 'first_time_guest',
        CASE WHEN first_attended IS NOT NULL
          THEN 'First check-in '||to_char(first_attended,'Mon DD')
          ELSE 'Added '||to_char(contact_created_at,'Mon DD')||', no check-ins yet'
        END,
        ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(first_attended, contact_created_at)))/86400.0)
      FROM combined
      WHERE (first_attended IS NOT NULL AND first_attended >= NOW() - (v_guest_days * INTERVAL '1 day'))
         OR (first_attended IS NULL
             AND COALESCE(contact_source_type, '') <> 'planning_center'
             AND contact_created_at >= NOW() - (v_guest_days * INTERVAL '1 day'))
      UNION ALL
      SELECT contact_id, 'kids_checked_in',
        hh_recent||' kids check-in(s) in last '||v_kids_days||' days', hh_recent
      FROM combined WHERE hh_recent > 0
      UNION ALL
      SELECT contact_id, 'missed_3_sundays',
        'No attendance in '||v_missed_min_days||'+ days (previously regular)', NULL
      FROM combined
      WHERE total_ever >= v_missed_min_lifetime
        AND (last_attended IS NULL OR last_attended < NOW() - (v_missed_min_days * INTERVAL '1 day'))
        AND (last_attended IS NULL OR last_attended >= NOW() - (v_missed_max_days * INTERVAL '1 day'))
      UNION ALL
      SELECT contact_id, 'drifting_6_weeks',
        'No attendance in '||v_drift_days||'+ days (previously regular)', NULL
      FROM combined
      WHERE total_ever >= v_drift_min_lifetime
        AND (last_attended IS NULL OR last_attended < NOW() - (v_drift_days * INTERVAL '1 day'))
      UNION ALL
      SELECT contact_id, 'attendance_dropped',
        'Attended '||weeks_last_12||' of last 12 weeks vs '||weeks_prior_12||' of prior 12',
        weeks_prior_12 - weeks_last_12
      FROM combined
      WHERE weeks_prior_12 >= v_dropped_min_prior
        AND weeks_last_12 <= weeks_prior_12 / 2
        AND weeks_last_12 < weeks_prior_12
      UNION ALL
      SELECT contact_id, 'in_group', 'Active small-group member', NULL
      FROM combined WHERE in_group
      UNION ALL
      SELECT contact_id, 'group_attendance_high',
        group_attended_count||' of last '||group_meetings_count||' meetings',
        ROUND((group_attended_count::numeric / NULLIF(group_meetings_count,0)) * 100)
      FROM combined
      WHERE group_meetings_count >= 3
        AND group_attended_count::numeric / group_meetings_count >= 0.66
      UNION ALL
      SELECT contact_id, 'group_attendance_mid',
        group_attended_count||' of last '||group_meetings_count||' meetings',
        ROUND((group_attended_count::numeric / NULLIF(group_meetings_count,0)) * 100)
      FROM combined
      WHERE group_meetings_count >= 3
        AND group_attended_count::numeric / group_meetings_count >= 0.33
        AND group_attended_count::numeric / group_meetings_count <  0.66
      UNION ALL
      SELECT contact_id, 'group_attendance_low',
        group_attended_count||' of last '||group_meetings_count||' meetings',
        ROUND((group_attended_count::numeric / NULLIF(group_meetings_count,0)) * 100)
      FROM combined
      WHERE group_meetings_count >= 4
        AND group_attended_count::numeric / group_meetings_count < 0.33
      UNION ALL
      SELECT contact_id, 'group_inactive_30d',
        'In a group but no attendance in '||v_group_inactive_days||'+ days', NULL
      FROM combined
      WHERE in_group
        AND (last_group_attended IS NULL OR last_group_attended < NOW() - (v_group_inactive_days * INTERVAL '1 day'))
      UNION ALL
      SELECT contact_id, 'served_recently',
        'Served '||vol_recent||' time(s) in last '||v_serve_recent_days||' days', vol_recent
      FROM combined WHERE vol_recent > 0
      UNION ALL
      SELECT contact_id, 'serves_regularly',
        'Served '||vol_regular||' times in last '||v_serve_regular_days||' days', vol_regular
      FROM combined WHERE vol_regular >= v_serve_regular_min
      UNION ALL
      SELECT contact_id, 'stopped_serving',
        'Used to serve, none in '||v_stopped_quiet_days||'+ days', vol_lookback
      FROM combined
      WHERE vol_lookback >= v_stopped_min_times
        AND vol_stopped_recent = 0
        AND (last_volunteered IS NULL OR last_volunteered < NOW() - (v_stopped_quiet_days * INTERVAL '1 day'))
      UNION ALL
      SELECT contact_id, 'in_active_flow',
        'In '||active_flows||' active flow(s)', active_flows
      FROM combined WHERE active_flows > 0
      UNION ALL
      SELECT contact_id, 'stuck_in_stage_30d',
        ROUND(max_days_in_stage)||' days in current stage', ROUND(max_days_in_stage)
      FROM combined WHERE max_days_in_stage IS NOT NULL AND max_days_in_stage >= v_stuck_days
      UNION ALL
      SELECT contact_id, 'flow_moment_recent',
        moments_recent||' next step(s) in last '||v_moment_days||' days', moments_recent
      FROM combined WHERE moments_recent > 0
      UNION ALL
      SELECT contact_id, 'salvation_moment',
        'Salvation decision recorded', NULL
      FROM combined WHERE last_salvation IS NOT NULL
      UNION ALL
      SELECT contact_id, 'watched_online_recent',
        watch_recent||' online event(s) in last '||v_online_days||' days', watch_recent
      FROM combined WHERE watch_recent > 0
      UNION ALL
      SELECT contact_id, 'prayer_request_submitted',
        prayer_recent||' prayer request(s) in last '||v_prayer_days||' days', prayer_recent
      FROM combined WHERE prayer_recent > 0
    ) sub
  )
  INSERT INTO public.contact_markers (contact_id, organization_id, marker_key, polarity, value_text, value_numeric, computed_at)
  SELECT
    e.contact_id,
    p_org_id,
    e.key,
    md.polarity,
    e.value_text,
    e.value_numeric,
    NOW()
  FROM emitted e
  JOIN marker_definitions md ON md.key = e.key
  LEFT JOIN org_marker_settings oms
    ON oms.organization_id = p_org_id AND oms.marker_key = e.key
  WHERE COALESCE(oms.enabled, true);

  WITH marker_counts AS (
    SELECT
      cm.contact_id,
      COUNT(*) FILTER (WHERE cm.polarity = 'positive') AS pos,
      COUNT(*) FILTER (WHERE cm.polarity = 'negative') AS neg,
      bool_or(cm.marker_key = 'drifting_6_weeks')      AS is_drifting,
      bool_or(cm.marker_key IN ('missed_3_sundays','attendance_dropped','group_attendance_low','group_inactive_30d','stopped_serving')) AS is_slowing,
      bool_or(cm.marker_key = 'attended_sunday_recent') AS recent_attendance
    FROM contact_markers cm
    WHERE cm.organization_id = p_org_id
    GROUP BY cm.contact_id
  ),
  derived AS (
    SELECT
      ces.contact_id,
      CASE
        WHEN COALESCE(mc.is_drifting, false) THEN 'drifting'
        WHEN ces.total_checkins_90d = 0 AND ces.last_checkin_at IS NULL AND ces.weeks_attended_last_12 = 0
             AND NOT COALESCE(mc.pos > 0, false) THEN 'new'
        WHEN COALESCE(mc.is_slowing, false) AND COALESCE(mc.neg, 0) >= COALESCE(mc.pos, 0) THEN 'slowing'
        WHEN COALESCE(mc.pos, 0) >= 3 AND COALESCE(mc.neg, 0) = 0 AND COALESCE(mc.recent_attendance, false) THEN 'thriving'
        WHEN COALESCE(mc.pos, 0) >= 1 AND COALESCE(mc.neg, 0) <= 1 THEN 'steady'
        WHEN COALESCE(mc.neg, 0) >= 1 THEN 'slowing'
        ELSE 'new'
      END AS signal
    FROM contact_engagement_scores ces
    LEFT JOIN marker_counts mc ON mc.contact_id = ces.contact_id
    WHERE ces.organization_id = p_org_id
  )
  UPDATE contact_engagement_scores ces
  SET signal = d.signal
  FROM derived d
  WHERE ces.contact_id = d.contact_id;
END;
$$;


ALTER FUNCTION "public"."recompute_contact_markers_core"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remind_open_life_seasons"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count int := 0;
BEGIN
  WITH due AS (
    SELECT ls.id, ls.organization_id, ls.contact_id, ls.created_by_user_id, ls.started_on, c.name
    FROM public.contact_life_seasons ls
    JOIN public.contacts c ON c.id = ls.contact_id
    WHERE ls.ended_on IS NULL
      AND ls.created_by_user_id IS NOT NULL
      AND COALESCE(ls.last_reminded_at, ls.created_at) < now() - INTERVAL '30 days'
  ), ins AS (
    INSERT INTO public.notifications (organization_id, user_id, contact_id, type, title, message, metadata)
    SELECT due.organization_id, due.created_by_user_id, due.contact_id, 'life_season_reminder',
           'Is ' || due.name || ' still away?',
           due.name || '''s engagement score has been paused since ' || to_char(due.started_on, 'Mon FMDD, YYYY') || '.',
           jsonb_build_object('life_season_id', due.id)
    FROM due
    RETURNING 1
  ), upd AS (
    UPDATE public.contact_life_seasons ls
    SET last_reminded_at = now()
    WHERE ls.id IN (SELECT id FROM due)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."remind_open_life_seasons"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rename_org_tag"("p_org_id" "uuid", "p_old_tag" "text", "p_new_tag" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_new text := btrim(p_new_tag);
  v_affected integer := 0;
BEGIN
  IF NOT public.is_user_in_organization(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  IF v_new IS NULL OR v_new = '' THEN
    RAISE EXCEPTION 'New tag cannot be empty';
  END IF;
  IF v_new = p_old_tag THEN
    RETURN 0;
  END IF;

  -- Drop rows that would collide with an existing identical tag
  DELETE FROM public.contact_tags t
  USING public.contacts c
  WHERE c.id = t.contact_id
    AND c.organization_id = p_org_id
    AND t.tag = p_old_tag
    AND EXISTS (
      SELECT 1 FROM public.contact_tags x
      WHERE x.contact_id = t.contact_id AND x.tag = v_new
    );

  UPDATE public.contact_tags t
  SET tag = v_new
  FROM public.contacts c
  WHERE c.id = t.contact_id
    AND c.organization_id = p_org_id
    AND t.tag = p_old_tag;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;


ALTER FUNCTION "public"."rename_org_tag"("p_org_id" "uuid", "p_old_tag" "text", "p_new_tag" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_user_pco_visible_people"("_user" "uuid", "_org" "uuid", "_ids" "text"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE inserted_count integer;
BEGIN
  DELETE FROM public.user_pco_visible_people
  WHERE user_id = _user AND organization_id = _org;

  INSERT INTO public.user_pco_visible_people (user_id, organization_id, pc_person_id)
  SELECT _user, _org, unnest(_ids)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  UPDATE public.user_pco_connections
  SET visible_people_synced_at = now(),
      visible_people_count = inserted_count,
      updated_at = now()
  WHERE user_id = _user AND organization_id = _org;

  RETURN inserted_count;
END;
$$;


ALTER FUNCTION "public"."replace_user_pco_visible_people"("_user" "uuid", "_org" "uuid", "_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_visible_contacts"("_organization_id" "uuid", "_search_term" "text", "_limit" integer DEFAULT 8) RETURNS TABLE("id" "uuid", "name" "text", "email" "text", "phone" "text", "avatar" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH caller AS (
    SELECT auth.uid() AS user_id
  ), normalized AS (
    SELECT
      trim(COALESCE(_search_term, '')) AS term,
      regexp_replace(COALESCE(_search_term, ''), '[^0-9]', '', 'g') AS digits,
      LEAST(GREATEST(COALESCE(_limit, 8), 1), 25) AS result_limit
  )
  SELECT
    c.id, c.name, c.email, c.phone, c.avatar
  FROM public.contacts c
  CROSS JOIN caller
  CROSS JOIN normalized n
  WHERE c.organization_id = _organization_id
    AND n.term <> ''
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = c.organization_id AND om.user_id = caller.user_id
    )
    AND (
      c.name ILIKE ('%' || n.term || '%')
      OR c.email ILIKE ('%' || n.term || '%')
      OR (
        length(n.digits) >= 3
        AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') ILIKE ('%' || n.digits || '%')
      )
    )
    AND (
      NOT COALESCE((SELECT o.pco_enforce_user_permissions FROM public.organizations o WHERE o.id = c.organization_id), false)
      OR EXISTS (SELECT 1 FROM public.organization_members om_admin WHERE om_admin.organization_id = c.organization_id AND om_admin.user_id = caller.user_id AND om_admin.role IN ('owner','admin'))
      OR c.pc_person_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.user_pco_connections upc WHERE upc.user_id = caller.user_id AND upc.organization_id = c.organization_id AND upc.status = 'active')
      OR EXISTS (SELECT 1 FROM public.user_pco_visible_people v WHERE v.user_id = caller.user_id AND v.organization_id = c.organization_id AND v.pc_person_id = c.pc_person_id)
    )
  ORDER BY
    CASE WHEN c.name ILIKE (n.term || '%') THEN 0 ELSE 1 END,
    c.name ASC
  LIMIT (SELECT result_limit FROM normalized);
$$;


ALTER FUNCTION "public"."search_visible_contacts"("_organization_id" "uuid", "_search_term" "text", "_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_moment_types"("org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.flow_moment_types (organization_id, name, category, weight, description, icon, color) VALUES
    (org_id, 'Salvation Decision', 'salvation', 50, 'Made a decision to follow Christ', 'Heart', '#ef4444'),
    (org_id, 'Baptism', 'next_step', 40, 'Completed baptism', 'Waves', '#06b6d4'),
    (org_id, 'Join the Church', 'next_step', 30, 'Became a church member', 'Church', '#8b5cf6'),
    (org_id, 'Dream Team / Serving', 'serving', 25, 'Started serving on a team', 'Users', '#f59e0b'),
    (org_id, 'Small Group Joined', 'group', 20, 'Joined a small group or community', 'UsersRound', '#10b981'),
    (org_id, 'Fresh Start / Recommitment', 'salvation', 30, 'Recommitted their faith', 'Sparkles', '#ec4899'),
    (org_id, 'Leadership Training', 'serving', 20, 'Participated in leadership development', 'GraduationCap', '#6366f1'),
    (org_id, 'Welcome Party Attended', 'next_step', 15, 'Attended a welcome or connection event', 'PartyPopper', '#eab308')
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."seed_default_moment_types"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_org_features"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.organization_features (organization_id, feature_key, enabled)
  VALUES
    (NEW.id, 'texting', false),
    (NEW.id, 'calling', false),
    (NEW.id, 'content', false),
    (NEW.id, 'signals', false),
    (NEW.id, 'forms', false)
  ON CONFLICT (organization_id, feature_key) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."seed_default_org_features"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_group_config_for_org"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.group_settings (organization_id) VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  INSERT INTO public.group_type_definitions (organization_id, key, label, icon, color, sort_order, is_system)
  VALUES
    (NEW.id, 'small_group', 'Small Group', 'Users', '#6366f1', 0, true),
    (NEW.id, 'serving_team', 'Serving Team', 'HandHelping', '#10b981', 1, true),
    (NEW.id, 'class', 'Class', 'GraduationCap', '#f59e0b', 2, true),
    (NEW.id, 'ministry', 'Ministry', 'Church', '#ec4899', 3, true)
  ON CONFLICT (organization_id, key) DO NOTHING;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."seed_group_config_for_org"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_engagement_distribution_all"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  WITH agg AS (
    SELECT organization_id, engagement_level::text AS engagement_level, COUNT(*)::int AS count
    FROM public.contact_engagement_scores
    GROUP BY organization_id, engagement_level
  ),
  ins AS (
    INSERT INTO public.org_engagement_snapshots (organization_id, snapshot_date, engagement_level, count)
    SELECT organization_id, CURRENT_DATE, engagement_level, count FROM agg
    ON CONFLICT (organization_id, snapshot_date, engagement_level)
    DO UPDATE SET count = EXCLUDED.count, created_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM ins;
  RETURN inserted_count;
END;
$$;


ALTER FUNCTION "public"."snapshot_engagement_distribution_all"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_impersonation_session"("_target_org_id" "uuid", "_reason" "text", "_ip_address" "text" DEFAULT NULL::"text", "_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    session_id UUID;
    target_owner_id UUID;
BEGIN
    -- Verify caller is system admin
    IF NOT public.is_system_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only system administrators can start impersonation sessions';
    END IF;
    
    -- Get the organization owner
    SELECT user_id INTO target_owner_id
    FROM organization_members
    WHERE organization_id = _target_org_id
      AND role = 'owner'
    LIMIT 1;
    
    IF target_owner_id IS NULL THEN
        RAISE EXCEPTION 'No owner found for organization';
    END IF;
    
    -- Create impersonation session
    INSERT INTO impersonation_sessions (
        system_admin_user_id,
        target_user_id,
        target_organization_id,
        reason,
        ip_address,
        user_agent
    ) VALUES (
        auth.uid(),
        target_owner_id,
        _target_org_id,
        _reason,
        _ip_address,
        _user_agent
    )
    RETURNING id INTO session_id;
    
    RETURN session_id;
END;
$$;


ALTER FUNCTION "public"."start_impersonation_session"("_target_org_id" "uuid", "_reason" "text", "_ip_address" "text", "_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_impersonation_session"("_admin_user_id" "uuid", "_target_org_id" "uuid", "_reason" "text", "_ip_address" "text" DEFAULT NULL::"text", "_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    session_id UUID;
    target_owner_id UUID;
BEGIN
    -- Verify the passed admin user ID is a system admin
    IF NOT public.is_system_admin(_admin_user_id) THEN
        RAISE EXCEPTION 'Only system administrators can start impersonation sessions';
    END IF;
    
    -- Get the organization owner
    SELECT user_id INTO target_owner_id
    FROM organization_members
    WHERE organization_id = _target_org_id
      AND role = 'owner'
    LIMIT 1;
    
    IF target_owner_id IS NULL THEN
        RAISE EXCEPTION 'No owner found for organization';
    END IF;
    
    -- Create impersonation session
    INSERT INTO impersonation_sessions (
        system_admin_user_id,
        target_user_id,
        target_organization_id,
        reason,
        ip_address,
        user_agent
    ) VALUES (
        _admin_user_id,
        target_owner_id,
        _target_org_id,
        _reason,
        _ip_address,
        _user_agent
    )
    RETURNING id INTO session_id;
    
    RETURN session_id;
END;
$$;


ALTER FUNCTION "public"."start_impersonation_session"("_admin_user_id" "uuid", "_target_org_id" "uuid", "_reason" "text", "_ip_address" "text", "_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_pco_sync"("p_org_id" "uuid", "p_sync_type" "text" DEFAULT 'list_sync'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Insert or update today's stats
  INSERT INTO organization_activity_stats (
    organization_id,
    date,
    last_pco_sync,
    pco_sync_count,
    updated_at
  ) VALUES (
    p_org_id,
    CURRENT_DATE,
    NOW(),
    1,
    NOW()
  )
  ON CONFLICT (organization_id, date) 
  DO UPDATE SET
    last_pco_sync = NOW(),
    pco_sync_count = organization_activity_stats.pco_sync_count + 1,
    updated_at = NOW();
    
  -- Update organization's last_activity_at
  UPDATE organizations 
  SET last_activity_at = NOW()
  WHERE id = p_org_id;
END;
$$;


ALTER FUNCTION "public"."track_pco_sync"("p_org_id" "uuid", "p_sync_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_user_login"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Update today's activity stat
  INSERT INTO organization_activity_stats (organization_id, date, total_logins, last_login_at)
  VALUES (NEW.organization_id, CURRENT_DATE, 1, NEW.logged_in_at)
  ON CONFLICT (organization_id, date) 
  DO UPDATE SET 
    total_logins = organization_activity_stats.total_logins + 1,
    last_login_at = GREATEST(organization_activity_stats.last_login_at, NEW.logged_in_at);
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."track_user_login"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_user_login"("p_user_id" "uuid", "p_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_user_already_active BOOLEAN;
BEGIN
  -- Check if this user already logged in today
  SELECT EXISTS(
    SELECT 1 FROM organization_activity_stats
    WHERE organization_id = p_org_id 
    AND date = v_date
    AND unique_active_users > 0
  ) INTO v_user_already_active;
  
  -- Insert or update today's stats
  INSERT INTO organization_activity_stats (
    organization_id,
    date,
    last_login_at,
    total_logins,
    unique_active_users
  ) VALUES (
    p_org_id,
    v_date,
    NOW(),
    1,
    1
  )
  ON CONFLICT (organization_id, date) 
  DO UPDATE SET
    last_login_at = GREATEST(organization_activity_stats.last_login_at, NOW()),
    total_logins = organization_activity_stats.total_logins + 1,
    updated_at = NOW();
    
  -- Update organization's last_activity_at
  UPDATE organizations 
  SET last_activity_at = NOW()
  WHERE id = p_org_id;
  
  -- Insert into user_logins tracking table for unique user counting
  INSERT INTO user_logins (user_id, organization_id, logged_in_at)
  VALUES (p_user_id, p_org_id, NOW())
  ON CONFLICT DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."track_user_login"("p_user_id" "uuid", "p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_member_attendance_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE group_members
    SET 
      last_attended_at = CASE 
        WHEN NEW.status = 'present' THEN NEW.checked_in_at
        ELSE group_members.last_attended_at
      END,
      attendance_count = (
        SELECT COUNT(*) 
        FROM group_attendance ga
        WHERE ga.group_member_id = NEW.group_member_id
        AND ga.status = 'present'
      )
    WHERE id = NEW.group_member_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_member_attendance_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_onboarding_on_integration_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only update for Planning Center integrations with active status
  IF NEW.service_name = 'planning_center' AND NEW.status = 'active' THEN
    UPDATE organizations
    SET onboarding_progress = jsonb_set(
      COALESCE(onboarding_progress, '{}'::jsonb),
      '{pco_connected}',
      'true'::jsonb
    )
    WHERE id = NEW.organization_id
      AND COALESCE((onboarding_progress->>'pco_connected')::boolean, false) = false;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_onboarding_on_integration_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_onboarding_on_list_mapping"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Get the organization_id from the integration and update onboarding progress
  UPDATE organizations o
  SET onboarding_progress = jsonb_set(
    COALESCE(onboarding_progress, '{}'::jsonb),
    '{pco_lists_mapped}',
    'true'::jsonb
  )
  FROM integrations i
  WHERE i.id = NEW.integration_id
    AND i.organization_id = o.id
    AND COALESCE((o.onboarding_progress->>'pco_lists_mapped')::boolean, false) = false;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_onboarding_on_list_mapping"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pipeline_contact_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If moving to a start step, set entered_start_at
  IF EXISTS (
    SELECT 1 FROM public.pipeline_stages 
    WHERE id = NEW.stage_id AND is_start_step = true
  ) THEN
    NEW.entered_start_at = COALESCE(OLD.entered_start_at, now());
  END IF;
  
  -- If moving to an end step, set completed_end_at
  IF EXISTS (
    SELECT 1 FROM public.pipeline_stages 
    WHERE id = NEW.stage_id AND is_end_step = true
  ) THEN
    NEW.completed_end_at = now();
  END IF;
  
  -- If moving away from end step, clear completed_end_at
  IF OLD.stage_id IS NOT NULL AND NEW.stage_id != OLD.stage_id AND EXISTS (
    SELECT 1 FROM public.pipeline_stages 
    WHERE id = OLD.stage_id AND is_end_step = true
  ) THEN
    NEW.completed_end_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pipeline_contact_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pipeline_contacts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pipeline_contacts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stage_entered_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only update stage_entered_at if stage_id has actually changed
  IF (TG_OP = 'UPDATE' AND OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
    NEW.stage_entered_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stage_entered_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sync_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_sync_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_unique_active_users"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE organization_activity_stats
  SET unique_active_users = (
    SELECT COUNT(DISTINCT user_id)
    FROM user_logins
    WHERE organization_id = NEW.organization_id
    AND date = NEW.date
  )
  WHERE organization_id = NEW.organization_id
  AND date = NEW.date;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_unique_active_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_manage_group_image"("_path" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    JOIN public.organization_members om
      ON om.organization_id = g.organization_id
    WHERE om.user_id = auth.uid()
      AND _path LIKE 'groups/' || g.id::text || '-%'
  );
$$;


ALTER FUNCTION "public"."user_can_manage_group_image"("_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_active_pco_connection"("_user" "uuid", "_org" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_pco_connections
    WHERE user_id = _user AND organization_id = _org AND status = 'active'
  );
$$;


ALTER FUNCTION "public"."user_has_active_pco_connection"("_user" "uuid", "_org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_stage_assignee"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If default_assignee_user_id is set, verify they have flow access
  IF NEW.default_assignee_user_id IS NOT NULL THEN
    IF NOT is_flow_team_member(NEW.default_assignee_user_id, NEW.pipeline_id) THEN
      RAISE EXCEPTION 'User must be a team member of this flow to be set as default assignee';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_stage_assignee"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_action_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "requested_by_user_id" "uuid" NOT NULL,
    "tool_key" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "summary" "text" NOT NULL,
    "action_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result_payload" "jsonb",
    "expires_at" timestamp with time zone NOT NULL,
    "confirmed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_action_requests_status_valid" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'completed'::"text", 'cancelled'::"text", 'failed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."ai_action_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_suggestion_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "suggestion_type" "text" NOT NULL,
    "suggestion_title" "text" NOT NULL,
    "suggestion_description" "text" NOT NULL,
    "feedback_type" "text" NOT NULL,
    "action_taken" "text",
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_suggestion_feedback_action_taken_check" CHECK (("action_taken" = ANY (ARRAY['message_generated'::"text", 'stage_changed'::"text", 'dismissed'::"text", 'ignored'::"text"]))),
    CONSTRAINT "ai_suggestion_feedback_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['positive'::"text", 'negative'::"text", 'neutral'::"text"])))
);


ALTER TABLE "public"."ai_suggestion_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_tool_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "requested_by_user_id" "uuid" NOT NULL,
    "tool_key" "text" NOT NULL,
    "action_request_id" "uuid",
    "outcome" "text" NOT NULL,
    "affected_records" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_tool_audit_logs_outcome_valid" CHECK (("outcome" = ANY (ARRAY['prepared'::"text", 'completed'::"text", 'cancelled'::"text", 'failed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."ai_tool_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_tool_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "tool_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "safety_level" "text" DEFAULT 'read'::"text" NOT NULL,
    "updated_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_tool_settings_safety_level_valid" CHECK (("safety_level" = ANY (ARRAY['read'::"text", 'prepare'::"text", 'act'::"text"])))
);


ALTER TABLE "public"."ai_tool_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_verification_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "token_type" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "auth_verification_tokens_token_type_check" CHECK (("token_type" = ANY (ARRAY['signup'::"text", 'password_reset'::"text", 'email_change'::"text", 'magic_link'::"text"])))
);


ALTER TABLE "public"."auth_verification_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "twilio_call_sid" "text" NOT NULL,
    "from_number" "text" NOT NULL,
    "to_number" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "call_type" "text" NOT NULL,
    "duration" integer,
    "twilio_phone_number_id" "uuid",
    "initiated_by_user_id" "uuid",
    "recording_url" "text",
    "recording_sid" "text",
    "transcription" "text",
    "answered_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "error_code" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "call_records_call_type_check" CHECK (("call_type" = ANY (ARRAY['inbound'::"text", 'outbound'::"text", 'missed'::"text"]))),
    CONSTRAINT "call_records_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."call_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "pco_campus_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "city" "text",
    "state" "text",
    "zip_code" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" "text",
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_health_findings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "section" "text" NOT NULL,
    "key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "metric_value" numeric,
    "metric_label" "text",
    "contact_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chf_section_check" CHECK (("section" = ANY (ARRAY['guests'::"text", 'at_risk'::"text", 'volunteers'::"text", 'groups'::"text"]))),
    CONSTRAINT "chf_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."church_health_findings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_health_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "overall_score" numeric,
    "section_scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "pdf_storage_path" "text",
    "share_token" "text",
    "share_enabled" boolean DEFAULT false NOT NULL,
    "error" "text",
    "generated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chr_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'ready'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."church_health_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_online_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "subject" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "contact_id" "uuid",
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."church_online_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_online_flow_automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_filter" "jsonb" DEFAULT '{}'::"jsonb",
    "pipeline_id" "uuid",
    "stage_id" "uuid",
    "flow_moment_type_id" "uuid",
    "create_contact_if_missing" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."church_online_flow_automations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "address_type" "text" DEFAULT 'home'::"text" NOT NULL,
    "street_address" "text",
    "city" "text",
    "state" "text",
    "zip_code" "text",
    "country" "text" DEFAULT 'US'::"text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_demographics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "birthday" "date",
    "marital_status" "text",
    "occupation" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gender" "text"
);


ALTER TABLE "public"."contact_demographics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_engagement_scores" (
    "contact_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "total_checkins_90d" integer DEFAULT 0,
    "total_checkins_30d" integer DEFAULT 0,
    "weeks_attended_last_12" integer DEFAULT 0,
    "last_checkin_at" timestamp with time zone,
    "engagement_level" "text" DEFAULT 'new'::"text",
    "streak_weeks" integer DEFAULT 0,
    "volunteer_checkins_90d" integer DEFAULT 0,
    "score" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "signal" "text",
    "score_breakdown" "jsonb",
    "consecutive_streak_weeks" integer DEFAULT 0 NOT NULL
)
WITH ("autovacuum_vacuum_scale_factor"='0.05', "autovacuum_analyze_scale_factor"='0.05');


ALTER TABLE "public"."contact_engagement_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_family_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "relationship" "text" NOT NULL,
    "birthday" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar" "text",
    "is_child" boolean DEFAULT false,
    "pc_person_id" "text"
)
WITH ("autovacuum_vacuum_scale_factor"='0.05', "autovacuum_analyze_scale_factor"='0.05');


ALTER TABLE "public"."contact_family_members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."contact_family_members"."avatar" IS 'URL to the person avatar/photo';



COMMENT ON COLUMN "public"."contact_family_members"."is_child" IS 'Whether this person is a child (under 18)';



COMMENT ON COLUMN "public"."contact_family_members"."pc_person_id" IS 'Planning Center person ID for sync tracking';



CREATE TABLE IF NOT EXISTS "public"."contact_import_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_id" "uuid" NOT NULL,
    "row_number" integer NOT NULL,
    "contact_id" "uuid",
    "outcome" "text" NOT NULL,
    "reason" "text",
    "raw" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_import_rows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "total_rows" integer DEFAULT 0 NOT NULL,
    "mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "options" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "import_tag" "text",
    "pipeline_id" "uuid",
    "stage_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_count" integer DEFAULT 0 NOT NULL,
    "updated_count" integer DEFAULT 0 NOT NULL,
    "enrolled_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "undone_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "pipeline_id" "uuid",
    "interaction_type" "text" NOT NULL,
    "subject" "text",
    "details" "text",
    "outcome" "text",
    "scheduled_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stage_id" "uuid",
    "previous_stage_id" "uuid",
    "assigned_to_user_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."contact_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_life_seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "reason" "text" DEFAULT 'other'::"text" NOT NULL,
    "note" "text",
    "started_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "ended_on" "date",
    "end_reason" "text",
    "frozen_score" integer,
    "frozen_level" "text",
    "frozen_breakdown" "jsonb",
    "created_by_user_id" "uuid",
    "ended_by_user_id" "uuid",
    "last_reminded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_life_seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_markers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "marker_key" "text" NOT NULL,
    "polarity" "text" NOT NULL,
    "value_text" "text",
    "value_numeric" numeric,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_markers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "pipeline_id" "uuid",
    "content" "text" NOT NULL,
    "note_type" "text" DEFAULT 'general'::"text",
    "is_private" boolean DEFAULT false,
    "created_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_prayer_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid",
    "title" "text",
    "description" "text",
    "status" "text" DEFAULT 'active'::"text",
    "answered_at" timestamp with time zone,
    "answer_description" "text",
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid",
    "kind" "text" DEFAULT 'prayer'::"text" NOT NULL,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    "source" "text" DEFAULT 'internal'::"text" NOT NULL,
    "submitter_name" "text",
    "stage_id" "uuid"
);


ALTER TABLE "public"."contact_prayer_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "avatar" "text",
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "assigned_to_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pc_person_id" "text",
    "source_type" "text" DEFAULT 'manual'::"text",
    "last_synced_at" timestamp with time zone,
    "pc_household_id" "text",
    "campus_id" "uuid",
    "pc_membership" "text",
    "is_demo" boolean DEFAULT false NOT NULL,
    "telegram" "text",
    "facebook" "text",
    "whatsapp" "text",
    "instagram" "text"
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "summary" "text",
    "themes" "text"[] DEFAULT '{}'::"text"[],
    "story_patterns" "jsonb" DEFAULT '[]'::"jsonb",
    "key_quotes" "jsonb" DEFAULT '[]'::"jsonb",
    "impact_score" smallint,
    "model" "text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_analyses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "citations" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."content_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_chat_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "video_id" "uuid",
    "title" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_chat_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "source_video_id" "uuid",
    "title" "text" NOT NULL,
    "person_name" "text",
    "summary" "text",
    "category" "text",
    "story_format" "text" DEFAULT 'vertical_video'::"text" NOT NULL,
    "lead_media_url" "text",
    "lead_media_alt" "text",
    "reading_time_minutes" integer,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "cta_mode" "text" DEFAULT 'category_default'::"text" NOT NULL,
    "cta_headline" "text",
    "cta_description" "text",
    "cta_button_label" "text",
    "cta_url" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cta_preset_id" "uuid"
);


ALTER TABLE "public"."content_stories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_story_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "block_type" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "heading" "text",
    "body" "text",
    "quote_attribution" "text",
    "media_url" "text",
    "media_alt" "text",
    "caption" "text",
    "video_id" "text",
    "video_orientation" "text",
    "gallery_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_story_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_story_cta_defaults" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "headline" "text" NOT NULL,
    "description" "text",
    "button_label" "text" NOT NULL,
    "destination_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_global" boolean DEFAULT false NOT NULL,
    "destination_type" "text" DEFAULT 'url'::"text" NOT NULL,
    "form_id" "uuid"
);


ALTER TABLE "public"."content_story_cta_defaults" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_transcript_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "chunk_index" integer NOT NULL,
    "text" "text" NOT NULL,
    "start_seconds" integer DEFAULT 0 NOT NULL,
    "end_seconds" integer DEFAULT 0 NOT NULL,
    "embedding" "public"."vector"(384),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_transcript_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "youtube_id" "text" NOT NULL,
    "url" "text" NOT NULL,
    "title" "text",
    "channel_name" "text",
    "channel_id" "text",
    "description" "text",
    "thumbnail_url" "text",
    "duration_seconds" integer,
    "published_at" timestamp with time zone,
    "consent_level" "public"."content_consent_level" DEFAULT 'internal_use'::"public"."content_consent_level" NOT NULL,
    "ingest_status" "public"."content_ingest_status" DEFAULT 'pending'::"public"."content_ingest_status" NOT NULL,
    "error_message" "text",
    "ingested_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "short_description" "text",
    "is_featured" boolean DEFAULT false NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "last_retry_at" timestamp with time zone
);


ALTER TABLE "public"."content_videos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_signal_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "signal_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "matched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cleared_at" timestamp with time zone
);


ALTER TABLE "public"."custom_signal_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_signal_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "signal_id" "uuid" NOT NULL,
    "rule_combinator" "text" DEFAULT 'AND'::"text" NOT NULL,
    "conditions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "custom_signal_rules_rule_combinator_check" CHECK (("rule_combinator" = ANY (ARRAY['AND'::"text", 'OR'::"text"])))
);


ALTER TABLE "public"."custom_signal_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "polarity" "text" DEFAULT 'neutral'::"text" NOT NULL,
    "category" "text" DEFAULT 'Custom'::"text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visibility" "text" DEFAULT 'org'::"text" NOT NULL,
    CONSTRAINT "custom_signals_polarity_check" CHECK (("polarity" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text"]))),
    CONSTRAINT "custom_signals_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'watch'::"text", 'risk'::"text"]))),
    CONSTRAINT "custom_signals_visibility_check" CHECK (("visibility" = ANY (ARRAY['org'::"text", 'personal'::"text"])))
);


ALTER TABLE "public"."custom_signals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_verification_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "new_email" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."email_verification_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flow_moment_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "weight" integer DEFAULT 10 NOT NULL,
    "description" "text",
    "icon" "text",
    "color" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "flow_moment_types_category_check" CHECK (("category" = ANY (ARRAY['salvation'::"text", 'next_step'::"text", 'serving'::"text", 'group'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."flow_moment_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flow_moments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "flow_moment_type_id" "uuid" NOT NULL,
    "source_system" "text" DEFAULT 'pco'::"text" NOT NULL,
    "source_reference" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "flow_moments_source_system_check" CHECK (("source_system" = ANY (ARRAY['pco'::"text", 'manual'::"text", 'form'::"text", 'flow'::"text"])))
)
WITH ("autovacuum_vacuum_scale_factor"='0.05', "autovacuum_analyze_scale_factor"='0.05');


ALTER TABLE "public"."flow_moments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "field_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "options" "jsonb",
    "required" boolean DEFAULT false NOT NULL,
    "placeholder" "text",
    "help_text" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "form_fields_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'textarea'::"text", 'email'::"text", 'phone'::"text", 'number'::"text", 'date'::"text", 'select'::"text", 'radio'::"text", 'checkbox'::"text"])))
);


ALTER TABLE "public"."form_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_preview" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."form_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "pipeline_id" "uuid",
    "stage_id" "uuid",
    "is_published" boolean DEFAULT false NOT NULL,
    "brand_color" "text",
    "logo_url" "text",
    "redirect_url" "text",
    "success_message" "text" DEFAULT 'Thanks! We''ll be in touch soon.'::"text",
    "routing_rules" "jsonb",
    "submission_count" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."forms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_meeting_id" "uuid" NOT NULL,
    "group_member_id" "uuid",
    "contact_id" "uuid",
    "status" "text" DEFAULT 'present'::"text" NOT NULL,
    "checked_in_at" timestamp with time zone,
    "checked_in_by_user_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pco_attendance_id" "text",
    "pc_person_id" "text"
);


ALTER TABLE "public"."group_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_campuses" (
    "group_id" "uuid" NOT NULL,
    "campus_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."group_campuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "meeting_date" timestamp with time zone NOT NULL,
    "duration_minutes" integer DEFAULT 90,
    "location" "text",
    "meeting_type" "text" DEFAULT 'regular'::"text",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pco_event_id" "text",
    "attendance_submitted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."group_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_attended_at" timestamp with time zone,
    "attendance_count" integer DEFAULT 0,
    "notes" "text",
    "pco_membership_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pco_person_id" "text",
    "synced_at" timestamp with time zone
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_settings" (
    "organization_id" "uuid" NOT NULL,
    "default_meeting_frequency" "text" DEFAULT 'weekly'::"text",
    "default_visibility" "text" DEFAULT 'private'::"text",
    "default_allow_public_signup" boolean DEFAULT false,
    "default_capacity" integer,
    "directory_enabled" boolean DEFAULT true NOT NULL,
    "directory_hero_title" "text" DEFAULT 'Find Your Community'::"text",
    "directory_hero_subtitle" "text" DEFAULT 'Explore groups and join one that fits you.'::"text",
    "directory_show_meeting_time" boolean DEFAULT true NOT NULL,
    "directory_show_location" boolean DEFAULT true NOT NULL,
    "directory_show_capacity" boolean DEFAULT true NOT NULL,
    "auto_inactive_weeks" integer,
    "attendance_reminder_enabled" boolean DEFAULT false NOT NULL,
    "attendance_reminder_day" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "signup_confirmation_enabled" boolean DEFAULT true NOT NULL,
    "signup_confirmation_subject" "text",
    "signup_confirmation_body" "text",
    "leader_notification_enabled" boolean DEFAULT true NOT NULL,
    "leader_notification_subject" "text",
    "leader_notification_body" "text",
    "communication_reply_to" "text"
);


ALTER TABLE "public"."group_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_signup_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "contact_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "processed_by_user_id" "uuid",
    "notes" "text"
);


ALTER TABLE "public"."group_signup_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_type_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "icon" "text" DEFAULT 'Users'::"text",
    "color" "text" DEFAULT '#6366f1'::"text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "pco_group_type_id" "text",
    "is_hidden" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."group_type_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "group_type" "text" DEFAULT 'small_group'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "meeting_day" "text",
    "meeting_time" time without time zone,
    "meeting_frequency" "text",
    "location" "text",
    "capacity" integer,
    "leader_user_id" "uuid",
    "co_leader_user_id" "uuid",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "pco_group_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "public_signup_token" "uuid" DEFAULT "gen_random_uuid"(),
    "allow_public_signup" boolean DEFAULT false NOT NULL,
    "image_url" "text",
    "pco_group_type_id" "text",
    "pco_group_type_name" "text",
    "pco_location_id" "text",
    "member_count" integer DEFAULT 0 NOT NULL,
    "last_synced_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "last_meeting_at" timestamp with time zone,
    "campus_id" "uuid",
    "pco_campus_id" "text",
    "is_demo" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."impersonation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "impersonation_session_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "action_description" "text" NOT NULL,
    "page_url" "text",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "affected_table" "text",
    "affected_record_id" "uuid",
    "before_value" "jsonb",
    "after_value" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."impersonation_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."impersonation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "system_admin_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "target_organization_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "reason" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "actions_performed" "jsonb" DEFAULT '[]'::"jsonb",
    "pages_visited" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."impersonation_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_tier" "text" DEFAULT 'trial'::"text",
    "plan_price" numeric(10,2),
    "subscription_status" "text" DEFAULT 'trial'::"text",
    "trial_ends_at" timestamp with time zone,
    "billing_email" "text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "last_payment_date" timestamp with time zone,
    "next_billing_date" timestamp with time zone,
    "total_revenue" numeric(10,2) DEFAULT 0,
    "health_score" integer DEFAULT 0,
    "last_activity_at" timestamp with time zone,
    "onboarding_completed" boolean DEFAULT false,
    "onboarding_step" "text" DEFAULT 'signup'::"text",
    "primary_contact_name" "text",
    "primary_contact_email" "text",
    "primary_contact_phone" "text",
    "notes" "text",
    "tags" "text"[],
    "onboarding_progress" "jsonb" DEFAULT '{}'::"jsonb",
    "onboarding_stage_entered_at" timestamp with time zone,
    "fl_admin_assigned_to" "uuid",
    "fl_admin_notes" "text",
    "pco_enforce_user_permissions" boolean DEFAULT false NOT NULL,
    "logo_url" "text",
    "demo_seeded_at" timestamp with time zone,
    "demo_cleared_at" timestamp with time zone,
    CONSTRAINT "organizations_health_score_check" CHECK ((("health_score" >= 0) AND ("health_score" <= 100))),
    CONSTRAINT "organizations_plan_tier_check" CHECK (("plan_tier" = ANY (ARRAY['trial'::"text", 'starter'::"text", 'growth'::"text", 'enterprise'::"text", 'custom'::"text"]))),
    CONSTRAINT "organizations_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['trial'::"text", 'active'::"text", 'past_due'::"text", 'canceled'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "use_twilio_integration" boolean DEFAULT true,
    "onboarding_completed" boolean DEFAULT false,
    "onboarding_progress" "jsonb" DEFAULT '{"flows_reviewed": false, "first_interaction": false, "profile_completed": false}'::"jsonb",
    "onboarding_dismissed" boolean DEFAULT false,
    "phone" "text",
    "location" "text",
    "bio" "text",
    "job_title" "text",
    "department" "text",
    "notification_preferences" "jsonb" DEFAULT '{"email_digest_enabled": true}'::"jsonb",
    "signup_intent" "text",
    "signup_utm" "jsonb",
    "signup_referrer" "text",
    "email_verified_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."use_twilio_integration" IS 'When true, use Twilio for calls/SMS. When false, use native device actions (tel:/sms:)';



COMMENT ON COLUMN "public"."profiles"."phone" IS 'User phone number';



COMMENT ON COLUMN "public"."profiles"."location" IS 'User location/city';



COMMENT ON COLUMN "public"."profiles"."bio" IS 'User biography';



COMMENT ON COLUMN "public"."profiles"."job_title" IS 'User job title';



COMMENT ON COLUMN "public"."profiles"."department" IS 'User department';



CREATE OR REPLACE VIEW "public"."impersonation_audit_log" WITH ("security_invoker"='on') AS
 SELECT "s"."id" AS "session_id",
    "s"."started_at",
    "s"."ended_at",
    "s"."is_active",
    "s"."reason",
    "s"."ip_address",
    "admin_profile"."full_name" AS "admin_name",
    "admin_profile"."email" AS "admin_email",
    "o"."name" AS "organization_name",
    "target_profile"."full_name" AS "target_user_name",
    "target_profile"."email" AS "target_user_email",
        CASE
            WHEN ("s"."ended_at" IS NOT NULL) THEN (EXTRACT(epoch FROM ("s"."ended_at" - "s"."started_at")) / 60.0)
            ELSE (EXTRACT(epoch FROM ("now"() - "s"."started_at")) / 60.0)
        END AS "duration_minutes",
    ( SELECT "count"(*) AS "count"
           FROM "public"."impersonation_actions"
          WHERE ("impersonation_actions"."impersonation_session_id" = "s"."id")) AS "actions_count"
   FROM ((("public"."impersonation_sessions" "s"
     LEFT JOIN "public"."profiles" "admin_profile" ON (("admin_profile"."user_id" = "s"."system_admin_user_id")))
     LEFT JOIN "public"."profiles" "target_profile" ON (("target_profile"."user_id" = "s"."target_user_id")))
     LEFT JOIN "public"."organizations" "o" ON (("o"."id" = "s"."target_organization_id")))
  ORDER BY "s"."started_at" DESC;


ALTER VIEW "public"."impersonation_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_list_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "external_list_id" "text" NOT NULL,
    "external_list_name" "text" NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "auto_sync" boolean DEFAULT true NOT NULL,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."integration_list_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_list_metadata" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "external_list_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "member_count" integer,
    "list_type" "text",
    "last_updated_at" timestamp with time zone,
    "cached_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_list_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "status" "text" NOT NULL,
    "message" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integration_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "service_name" "text" NOT NULL,
    "credentials" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'disconnected'::"text" NOT NULL,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sync_frequency" "text" DEFAULT 'daily'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "auto_sync_all_people" boolean DEFAULT true,
    "last_full_sync_completed_at" timestamp with time zone,
    "auth_type" "text" DEFAULT 'pat'::"text" NOT NULL,
    "oauth_access_token" "text",
    "oauth_refresh_token" "text",
    "oauth_token_expires_at" timestamp with time zone,
    "oauth_scopes" "text",
    "oauth_connected_by_user_id" "uuid",
    "provider_account_id" "text",
    "provider_account_name" "text",
    CONSTRAINT "integrations_auth_type_check" CHECK (("auth_type" = ANY (ARRAY['pat'::"text", 'oauth'::"text"]))),
    CONSTRAINT "valid_sync_frequency" CHECK (("sync_frequency" = ANY (ARRAY['daily'::"text", 'twice_daily'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."integrations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."integrations"."auto_sync_all_people" IS 'When enabled, automatically syncs all people from Planning Center based on sync_frequency';



CREATE OR REPLACE VIEW "public"."integrations_public" WITH ("security_invoker"='on') AS
 SELECT "id",
    "user_id",
    "organization_id",
    "service_name",
    "settings",
    "status",
    "last_sync_at",
    "created_at",
    "updated_at",
    "sync_frequency",
    "metadata",
    "auto_sync_all_people",
    "last_full_sync_completed_at",
    "auth_type",
    "oauth_token_expires_at",
    "oauth_scopes",
    "oauth_connected_by_user_id",
    "provider_account_id",
    "provider_account_name"
   FROM "public"."integrations";


ALTER VIEW "public"."integrations_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "invited_by_user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pipeline_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "pipeline_assignments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."invitations"."pipeline_assignments" IS 'Array of {pipeline_id, role} objects to add the user to flows on accept';



CREATE TABLE IF NOT EXISTS "public"."marker_definitions" (
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "polarity" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "requires_integration" "text",
    "is_phase_two" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marker_definitions_polarity_check" CHECK (("polarity" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text"])))
);


ALTER TABLE "public"."marker_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "contact_id" "uuid",
    "pipeline_id" "uuid",
    "interaction_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email_digest_sent" boolean DEFAULT false,
    "email_digest_sent_at" timestamp with time zone
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_engagement_settings" (
    "organization_id" "uuid" NOT NULL,
    "preset_key" "text" DEFAULT 'balanced'::"text" NOT NULL,
    "weights" "jsonb" DEFAULT '{"giving": 0, "streak": 15, "recency": 20, "serving": 20, "leadership": 10, "consistency": 35, "flow_moments": 0, "event_attendance": 0, "form_submissions": 0, "group_membership": 0, "notes_interactions": 0}'::"jsonb" NOT NULL,
    "windows" "jsonb" DEFAULT '{"recency_days": 90, "serving_days": 90, "activity_days": 90, "consistency_weeks": 12}'::"jsonb" NOT NULL,
    "thresholds" "jsonb" DEFAULT '{"active": 50, "at_risk": 25, "highly_engaged": 75, "new_max_checkins": 3}'::"jsonb" NOT NULL,
    "ingredients" "jsonb" DEFAULT '{"giving": false, "serving": true, "leadership": true, "flow_moments": false, "event_attendance": false, "form_submissions": false, "group_attendance": true, "group_membership": false, "service_checkins": true, "notes_interactions": false}'::"jsonb" NOT NULL,
    "labels" "jsonb" DEFAULT '{"new": "New", "active": "Active", "at_risk": "At Risk", "inactive": "Inactive", "highly_engaged": "Highly Engaged"}'::"jsonb" NOT NULL,
    "safeguards" "jsonb" DEFAULT '{"household_credit": true, "count_partial_week": false, "streak_break_misses": 1, "serving_keeps_active": true, "recent_attendance_days": 14}'::"jsonb" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."org_engagement_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_engagement_snapshots" (
    "organization_id" "uuid" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "engagement_level" "text" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."org_engagement_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_marker_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "marker_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "custom_label" "text",
    "custom_description" "text",
    "params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "promoted_signal_id" "uuid"
);


ALTER TABLE "public"."org_marker_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_activity_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_logins" integer DEFAULT 0,
    "unique_active_users" integer DEFAULT 0,
    "last_login_at" timestamp with time zone,
    "flows_count" integer DEFAULT 0,
    "contacts_count" integer DEFAULT 0,
    "interactions_count" integer DEFAULT 0,
    "notes_created" integer DEFAULT 0,
    "last_pco_sync" timestamp with time zone,
    "pco_sync_count" integer DEFAULT 0,
    "ai_suggestions_used" integer DEFAULT 0,
    "ai_messages_generated" integer DEFAULT 0,
    "ai_descriptions_generated" integer DEFAULT 0,
    "total_ai_uses" integer DEFAULT 0,
    "daily_activity_score" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_activity_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by_user_id" "uuid"
);


ALTER TABLE "public"."organization_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_health_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_score" integer NOT NULL,
    "score_breakdown" "jsonb" NOT NULL,
    "metrics" "jsonb" NOT NULL,
    "previous_score" integer,
    "score_change" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_health_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipelines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "organization_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "flow_order" integer DEFAULT 0,
    "flow_type" "text" DEFAULT 'linear'::"text" NOT NULL,
    "cycle_days" integer,
    "completion_moment_type_id" "uuid",
    "is_demo" boolean DEFAULT false NOT NULL,
    CONSTRAINT "pipelines_cycle_days_check" CHECK ((("cycle_days" IS NULL) OR ("cycle_days" > 0))),
    CONSTRAINT "pipelines_flow_type_check" CHECK (("flow_type" = ANY (ARRAY['linear'::"text", 'recurring'::"text"])))
);


ALTER TABLE "public"."pipelines" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pipelines"."flow_type" IS 'Type of flow: linear (one-time completion) or recurring (cycles back to start)';



COMMENT ON COLUMN "public"."pipelines"."cycle_days" IS 'Days before cycling back to start step (only for recurring flows)';



CREATE OR REPLACE VIEW "public"."organization_health_view" WITH ("security_invoker"='on') AS
 SELECT "o"."id",
    "o"."name",
    "o"."slug",
    "o"."created_at",
    "o"."subscription_status",
    "o"."plan_tier",
    "o"."health_score",
    "om"."user_id" AS "admin_user_id",
    "p"."full_name" AS "admin_name",
    "p"."email" AS "admin_email",
    COALESCE("sum"("oas"."total_logins"), (0)::bigint) AS "total_logins_30d",
    "max"("oas"."last_login_at") AS "last_login",
    ( SELECT "count"(*) AS "count"
           FROM "public"."pipelines"
          WHERE ("pipelines"."organization_id" = "o"."id")) AS "flows_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."contacts"
          WHERE ("contacts"."organization_id" = "o"."id")) AS "contacts_count",
    ( SELECT "count"(DISTINCT "organization_members"."user_id") AS "count"
           FROM "public"."organization_members"
          WHERE ("organization_members"."organization_id" = "o"."id")) AS "active_users",
    "max"("oas"."last_pco_sync") AS "last_pco_sync",
    COALESCE("sum"("oas"."total_ai_uses"), (0)::bigint) AS "ai_uses_30d",
    (COALESCE("avg"("oas"."daily_activity_score"), (0)::numeric))::integer AS "avg_weekly_activity"
   FROM ((("public"."organizations" "o"
     LEFT JOIN "public"."organization_members" "om" ON ((("om"."organization_id" = "o"."id") AND ("om"."role" = 'owner'::"text"))))
     LEFT JOIN "public"."profiles" "p" ON (("p"."user_id" = "om"."user_id")))
     LEFT JOIN "public"."organization_activity_stats" "oas" ON ((("oas"."organization_id" = "o"."id") AND ("oas"."date" >= (CURRENT_DATE - '30 days'::interval)))))
  GROUP BY "o"."id", "o"."name", "o"."slug", "o"."created_at", "o"."subscription_status", "o"."plan_tier", "o"."health_score", "om"."user_id", "p"."full_name", "p"."email";


ALTER VIEW "public"."organization_health_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."organization_health_view" IS 'Protected view containing sensitive organization metrics. Access should only be through get_organizations_health_data() function which enforces system admin check.';



CREATE TABLE IF NOT EXISTS "public"."pco_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "pc_person_id" "text" NOT NULL,
    "event_name" "text",
    "event_time_name" "text",
    "location_name" "text",
    "checkin_kind" "text" DEFAULT 'regular'::"text",
    "checked_in_at" timestamp with time zone,
    "checked_out_at" timestamp with time zone,
    "pco_checkin_id" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
)
WITH ("autovacuum_vacuum_scale_factor"='0.02', "autovacuum_analyze_scale_factor"='0.02', "autovacuum_vacuum_threshold"='1000', "autovacuum_analyze_threshold"='1000', "autovacuum_vacuum_cost_limit"='2000');


ALTER TABLE "public"."pco_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pco_moment_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "pco_source_type" "text" DEFAULT 'custom_tab_field'::"text" NOT NULL,
    "pco_source_identifier" "text" NOT NULL,
    "pco_source_label" "text" NOT NULL,
    "pco_tab_name" "text",
    "flow_moment_type_id" "uuid" NOT NULL,
    "trigger_condition" "jsonb" DEFAULT '{"value": "Yes", "operator": "equals"}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rule_combinator" "text" DEFAULT 'AND'::"text" NOT NULL,
    "condition_group" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "pco_moment_mappings_pco_source_type_check" CHECK (("pco_source_type" = ANY (ARRAY['custom_tab_field'::"text", 'group'::"text", 'workflow'::"text"]))),
    CONSTRAINT "pco_moment_mappings_rule_combinator_check" CHECK (("rule_combinator" = ANY (ARRAY['AND'::"text", 'OR'::"text"])))
)
WITH ("autovacuum_vacuum_scale_factor"='0.05', "autovacuum_analyze_scale_factor"='0.05');


ALTER TABLE "public"."pco_moment_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pco_oauth_states" (
    "state" "text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "purpose" "text" NOT NULL,
    "redirect_to" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:05:00'::interval) NOT NULL,
    "consumed_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "pco_oauth_states_purpose_check" CHECK (("purpose" = ANY (ARRAY['org'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."pco_oauth_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pco_sync_debug_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pc_person_id" "text" NOT NULL,
    "contact_id" "uuid",
    "field_data_count" integer,
    "field_ids_returned" "text"[],
    "raw_response" "jsonb",
    "checked_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pco_sync_debug_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pco_sync_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "list_mapping_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "total_contacts" integer DEFAULT 0 NOT NULL,
    "processed_contacts" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "pco_sync_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."pco_sync_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pco_sync_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_job_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "chunk_data" "jsonb" NOT NULL,
    "chunk_number" integer NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "pco_sync_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'retrying'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."pco_sync_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "stage_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_type" "text" DEFAULT 'manual'::"text",
    "source_id" "text",
    "entered_start_at" timestamp with time zone,
    "completed_end_at" timestamp with time zone,
    "assigned_to_user_id" "uuid",
    "stage_entered_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pipeline_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "content" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_user_id" "uuid",
    "last_edited_by_user_id" "uuid"
);


ALTER TABLE "public"."pipeline_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "stage_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_start_step" boolean DEFAULT false NOT NULL,
    "is_end_step" boolean DEFAULT false NOT NULL,
    "default_assignee_user_id" "uuid",
    "description" "text"
);


ALTER TABLE "public"."pipeline_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline_team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pipeline_team_members_role_check" CHECK (("role" = ANY (ARRAY['lead'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."pipeline_team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prayer_request_prayers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prayer_request_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."prayer_request_prayers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prayer_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#6B7280'::"text" NOT NULL,
    "stage_order" integer DEFAULT 0 NOT NULL,
    "is_answered_step" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."prayer_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signal_agent_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "watch_signals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "allowed_actions" "jsonb" DEFAULT '["notify"]'::"jsonb" NOT NULL,
    "default_assignee_strategy" "text" DEFAULT 'assigned_user'::"text" NOT NULL,
    "quiet_hours" "jsonb" DEFAULT '{"end": "08:00", "start": "21:00"}'::"jsonb" NOT NULL,
    "max_suggestions_per_day" integer DEFAULT 25 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "signal_agent_configs_default_assignee_strategy_check" CHECK (("default_assignee_strategy" = ANY (ARRAY['assigned_user'::"text", 'campus_pastor'::"text", 'flow_owner'::"text"])))
);


ALTER TABLE "public"."signal_agent_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signal_agent_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "signal_key" "text" NOT NULL,
    "suggested_action" "text" NOT NULL,
    "action_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "signal_agent_rules_suggested_action_check" CHECK (("suggested_action" = ANY (ARRAY['notify'::"text", 'add_to_flow'::"text", 'create_task'::"text", 'draft_message'::"text"])))
);


ALTER TABLE "public"."signal_agent_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signal_agent_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "signal_key" "text" NOT NULL,
    "signal_source" "text" DEFAULT 'builtin'::"text" NOT NULL,
    "action_type" "text" NOT NULL,
    "action_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "reasoning" "text",
    "confidence" numeric(3,2),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "assignee_user_id" "uuid",
    "reviewer_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "executed_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "signal_agent_suggestions_action_type_check" CHECK (("action_type" = ANY (ARRAY['notify'::"text", 'add_to_flow'::"text", 'create_task'::"text", 'draft_message'::"text"]))),
    CONSTRAINT "signal_agent_suggestions_signal_source_check" CHECK (("signal_source" = ANY (ARRAY['builtin'::"text", 'custom'::"text"]))),
    CONSTRAINT "signal_agent_suggestions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'dismissed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."signal_agent_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "twilio_message_sid" "text" NOT NULL,
    "from_number" "text" NOT NULL,
    "to_number" "text" NOT NULL,
    "body" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "twilio_phone_number_id" "uuid",
    "sent_by_user_id" "uuid",
    "error_code" "text",
    "error_message" "text",
    "media_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sms_messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."sms_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."system_role" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);


ALTER TABLE "public"."system_user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "contact_id" "uuid",
    "assigned_to_user_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "due_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."twilio_phone_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "phone_number" "text" NOT NULL,
    "friendly_name" "text",
    "sid" "text" NOT NULL,
    "capabilities" "jsonb" DEFAULT '{"mms": false, "sms": true, "voice": true}'::"jsonb",
    "is_primary" boolean DEFAULT false,
    "assigned_to_user_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "provisioned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "released_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."twilio_phone_numbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_flow_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_flow_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_login_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "organization_id" "uuid",
    "logged_in_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_login_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_logins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "logged_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE "public"."user_logins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_pco_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "pc_person_id" "text",
    "email" "text",
    "oauth_access_token" "text",
    "oauth_refresh_token" "text",
    "oauth_token_expires_at" timestamp with time zone,
    "oauth_scopes" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "provider_account_id" "text",
    "permissions_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "permissions_refreshed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visible_people_synced_at" timestamp with time zone,
    "visible_people_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "user_pco_connections_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'reauth_required'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."user_pco_connections" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_pco_connections_public" WITH ("security_invoker"='on') AS
 SELECT "id",
    "user_id",
    "organization_id",
    "pc_person_id",
    "email",
    "oauth_token_expires_at",
    "oauth_scopes",
    "status",
    "provider_account_id",
    "permissions_json",
    "permissions_refreshed_at",
    "created_at",
    "updated_at"
   FROM "public"."user_pco_connections";


ALTER VIEW "public"."user_pco_connections_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_pco_field_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "selected_field_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hide_empty" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "open_by_default" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."user_pco_field_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_pco_visible_people" (
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "pc_person_id" "text" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_pco_visible_people" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_action_requests"
    ADD CONSTRAINT "ai_action_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_suggestion_feedback"
    ADD CONSTRAINT "ai_suggestion_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_tool_audit_logs"
    ADD CONSTRAINT "ai_tool_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_tool_settings"
    ADD CONSTRAINT "ai_tool_settings_organization_id_tool_key_key" UNIQUE ("organization_id", "tool_key");



ALTER TABLE ONLY "public"."ai_tool_settings"
    ADD CONSTRAINT "ai_tool_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_verification_tokens"
    ADD CONSTRAINT "auth_verification_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_verification_tokens"
    ADD CONSTRAINT "auth_verification_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."call_records"
    ADD CONSTRAINT "call_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_records"
    ADD CONSTRAINT "call_records_twilio_call_sid_key" UNIQUE ("twilio_call_sid");



ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_organization_id_pco_campus_id_key" UNIQUE ("organization_id", "pco_campus_id");



ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_health_findings"
    ADD CONSTRAINT "church_health_findings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_health_reports"
    ADD CONSTRAINT "church_health_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_health_reports"
    ADD CONSTRAINT "church_health_reports_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."church_online_events"
    ADD CONSTRAINT "church_online_events_integration_id_event_id_key" UNIQUE ("integration_id", "event_id");



ALTER TABLE ONLY "public"."church_online_events"
    ADD CONSTRAINT "church_online_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_online_flow_automations"
    ADD CONSTRAINT "church_online_flow_automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_addresses"
    ADD CONSTRAINT "contact_addresses_contact_id_address_type_key" UNIQUE ("contact_id", "address_type");



ALTER TABLE ONLY "public"."contact_addresses"
    ADD CONSTRAINT "contact_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_demographics"
    ADD CONSTRAINT "contact_demographics_contact_id_key" UNIQUE ("contact_id");



ALTER TABLE ONLY "public"."contact_demographics"
    ADD CONSTRAINT "contact_demographics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_engagement_scores"
    ADD CONSTRAINT "contact_engagement_scores_pkey" PRIMARY KEY ("contact_id");



ALTER TABLE ONLY "public"."contact_family_members"
    ADD CONSTRAINT "contact_family_members_contact_pc_person_unique" UNIQUE ("contact_id", "pc_person_id");



ALTER TABLE ONLY "public"."contact_family_members"
    ADD CONSTRAINT "contact_family_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_import_rows"
    ADD CONSTRAINT "contact_import_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_imports"
    ADD CONSTRAINT "contact_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_interactions"
    ADD CONSTRAINT "contact_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_life_seasons"
    ADD CONSTRAINT "contact_life_seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_markers"
    ADD CONSTRAINT "contact_markers_contact_id_marker_key_key" UNIQUE ("contact_id", "marker_key");



ALTER TABLE ONLY "public"."contact_markers"
    ADD CONSTRAINT "contact_markers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_notes"
    ADD CONSTRAINT "contact_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_prayer_requests"
    ADD CONSTRAINT "contact_prayer_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_tags"
    ADD CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pc_person_org_unique" UNIQUE ("pc_person_id", "organization_id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_analyses"
    ADD CONSTRAINT "content_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_chat_messages"
    ADD CONSTRAINT "content_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_chat_sessions"
    ADD CONSTRAINT "content_chat_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_stories"
    ADD CONSTRAINT "content_stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_stories"
    ADD CONSTRAINT "content_stories_source_video_id_key" UNIQUE ("source_video_id");



ALTER TABLE ONLY "public"."content_story_blocks"
    ADD CONSTRAINT "content_story_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_story_cta_defaults"
    ADD CONSTRAINT "content_story_cta_defaults_organization_id_category_key" UNIQUE ("organization_id", "category");



ALTER TABLE ONLY "public"."content_story_cta_defaults"
    ADD CONSTRAINT "content_story_cta_defaults_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_transcript_chunks"
    ADD CONSTRAINT "content_transcript_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_transcript_chunks"
    ADD CONSTRAINT "content_transcript_chunks_video_id_chunk_index_key" UNIQUE ("video_id", "chunk_index");



ALTER TABLE ONLY "public"."content_videos"
    ADD CONSTRAINT "content_videos_organization_id_youtube_id_key" UNIQUE ("organization_id", "youtube_id");



ALTER TABLE ONLY "public"."content_videos"
    ADD CONSTRAINT "content_videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_signal_contacts"
    ADD CONSTRAINT "custom_signal_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_signal_contacts"
    ADD CONSTRAINT "custom_signal_contacts_signal_id_contact_id_key" UNIQUE ("signal_id", "contact_id");



ALTER TABLE ONLY "public"."custom_signal_rules"
    ADD CONSTRAINT "custom_signal_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_signal_rules"
    ADD CONSTRAINT "custom_signal_rules_signal_id_key" UNIQUE ("signal_id");



ALTER TABLE ONLY "public"."custom_signals"
    ADD CONSTRAINT "custom_signals_organization_id_key_key" UNIQUE ("organization_id", "key");



ALTER TABLE ONLY "public"."custom_signals"
    ADD CONSTRAINT "custom_signals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."flow_moment_types"
    ADD CONSTRAINT "flow_moment_types_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."flow_moment_types"
    ADD CONSTRAINT "flow_moment_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flow_moments"
    ADD CONSTRAINT "flow_moments_contact_id_flow_moment_type_id_source_referenc_key" UNIQUE ("contact_id", "flow_moment_type_id", "source_reference");



ALTER TABLE ONLY "public"."flow_moments"
    ADD CONSTRAINT "flow_moments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_fields"
    ADD CONSTRAINT "form_fields_form_id_field_key_key" UNIQUE ("form_id", "field_key");



ALTER TABLE ONLY "public"."form_fields"
    ADD CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_submissions"
    ADD CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_org_slug_unique" UNIQUE ("organization_id", "slug");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_attendance"
    ADD CONSTRAINT "group_attendance_group_meeting_id_group_member_id_key" UNIQUE ("group_meeting_id", "group_member_id");



ALTER TABLE ONLY "public"."group_attendance"
    ADD CONSTRAINT "group_attendance_pco_attendance_id_key" UNIQUE ("pco_attendance_id");



ALTER TABLE ONLY "public"."group_attendance"
    ADD CONSTRAINT "group_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_campuses"
    ADD CONSTRAINT "group_campuses_pkey" PRIMARY KEY ("group_id", "campus_id");



ALTER TABLE ONLY "public"."group_meetings"
    ADD CONSTRAINT "group_meetings_pco_event_id_key" UNIQUE ("pco_event_id");



ALTER TABLE ONLY "public"."group_meetings"
    ADD CONSTRAINT "group_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_contact_id_key" UNIQUE ("group_id", "contact_id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_settings"
    ADD CONSTRAINT "group_settings_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."group_signup_requests"
    ADD CONSTRAINT "group_signup_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_type_definitions"
    ADD CONSTRAINT "group_type_definitions_organization_id_key_key" UNIQUE ("organization_id", "key");



ALTER TABLE ONLY "public"."group_type_definitions"
    ADD CONSTRAINT "group_type_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_organization_id_pco_group_id_key" UNIQUE ("organization_id", "pco_group_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."impersonation_actions"
    ADD CONSTRAINT "impersonation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_list_mappings"
    ADD CONSTRAINT "integration_list_mappings_integration_id_external_list_id_key" UNIQUE ("integration_id", "external_list_id");



ALTER TABLE ONLY "public"."integration_list_mappings"
    ADD CONSTRAINT "integration_list_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_list_metadata"
    ADD CONSTRAINT "integration_list_metadata_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_logs"
    ADD CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_user_id_organization_id_service_name_key" UNIQUE ("user_id", "organization_id", "service_name");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."marker_definitions"
    ADD CONSTRAINT "marker_definitions_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_engagement_settings"
    ADD CONSTRAINT "org_engagement_settings_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."org_engagement_snapshots"
    ADD CONSTRAINT "org_engagement_snapshots_pkey" PRIMARY KEY ("organization_id", "snapshot_date", "engagement_level");



ALTER TABLE ONLY "public"."org_marker_settings"
    ADD CONSTRAINT "org_marker_settings_organization_id_marker_key_key" UNIQUE ("organization_id", "marker_key");



ALTER TABLE ONLY "public"."org_marker_settings"
    ADD CONSTRAINT "org_marker_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_activity_stats"
    ADD CONSTRAINT "organization_activity_stats_organization_id_date_key" UNIQUE ("organization_id", "date");



ALTER TABLE ONLY "public"."organization_activity_stats"
    ADD CONSTRAINT "organization_activity_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_features"
    ADD CONSTRAINT "organization_features_organization_id_feature_key_key" UNIQUE ("organization_id", "feature_key");



ALTER TABLE ONLY "public"."organization_features"
    ADD CONSTRAINT "organization_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_health_history"
    ADD CONSTRAINT "organization_health_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."pco_checkins"
    ADD CONSTRAINT "pco_checkins_pco_checkin_id_key" UNIQUE ("pco_checkin_id");



ALTER TABLE ONLY "public"."pco_checkins"
    ADD CONSTRAINT "pco_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pco_moment_mappings"
    ADD CONSTRAINT "pco_moment_mappings_organization_id_pco_source_identifier_f_key" UNIQUE ("organization_id", "pco_source_identifier", "flow_moment_type_id");



ALTER TABLE ONLY "public"."pco_moment_mappings"
    ADD CONSTRAINT "pco_moment_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pco_oauth_states"
    ADD CONSTRAINT "pco_oauth_states_pkey" PRIMARY KEY ("state");



ALTER TABLE ONLY "public"."pco_sync_debug_logs"
    ADD CONSTRAINT "pco_sync_debug_logs_pc_person_id_key" UNIQUE ("pc_person_id");



ALTER TABLE ONLY "public"."pco_sync_debug_logs"
    ADD CONSTRAINT "pco_sync_debug_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pco_sync_jobs"
    ADD CONSTRAINT "pco_sync_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pco_sync_queue"
    ADD CONSTRAINT "pco_sync_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_contacts"
    ADD CONSTRAINT "pipeline_contacts_contact_id_pipeline_id_key" UNIQUE ("contact_id", "pipeline_id");



ALTER TABLE ONLY "public"."pipeline_contacts"
    ADD CONSTRAINT "pipeline_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_resources"
    ADD CONSTRAINT "pipeline_resources_pipeline_id_key" UNIQUE ("pipeline_id");



ALTER TABLE ONLY "public"."pipeline_resources"
    ADD CONSTRAINT "pipeline_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_stages"
    ADD CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_team_members"
    ADD CONSTRAINT "pipeline_team_members_pipeline_id_user_id_key" UNIQUE ("pipeline_id", "user_id");



ALTER TABLE ONLY "public"."pipeline_team_members"
    ADD CONSTRAINT "pipeline_team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipelines"
    ADD CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prayer_request_prayers"
    ADD CONSTRAINT "prayer_request_prayers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prayer_stages"
    ADD CONSTRAINT "prayer_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signal_agent_configs"
    ADD CONSTRAINT "signal_agent_configs_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."signal_agent_configs"
    ADD CONSTRAINT "signal_agent_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signal_agent_rules"
    ADD CONSTRAINT "signal_agent_rules_organization_id_signal_key_suggested_act_key" UNIQUE ("organization_id", "signal_key", "suggested_action");



ALTER TABLE ONLY "public"."signal_agent_rules"
    ADD CONSTRAINT "signal_agent_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signal_agent_suggestions"
    ADD CONSTRAINT "signal_agent_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_twilio_message_sid_key" UNIQUE ("twilio_message_sid");



ALTER TABLE ONLY "public"."system_user_roles"
    ADD CONSTRAINT "system_user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_user_roles"
    ADD CONSTRAINT "system_user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."twilio_phone_numbers"
    ADD CONSTRAINT "twilio_phone_numbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."twilio_phone_numbers"
    ADD CONSTRAINT "twilio_phone_numbers_sid_key" UNIQUE ("sid");



ALTER TABLE ONLY "public"."user_flow_preferences"
    ADD CONSTRAINT "user_flow_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_flow_preferences"
    ADD CONSTRAINT "user_flow_preferences_user_id_pipeline_id_key" UNIQUE ("user_id", "pipeline_id");



ALTER TABLE ONLY "public"."user_login_events"
    ADD CONSTRAINT "user_login_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_logins"
    ADD CONSTRAINT "user_logins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_logins"
    ADD CONSTRAINT "user_logins_user_id_organization_id_date_key" UNIQUE ("user_id", "organization_id", "date");



ALTER TABLE ONLY "public"."user_pco_connections"
    ADD CONSTRAINT "user_pco_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_pco_connections"
    ADD CONSTRAINT "user_pco_connections_user_id_organization_id_key" UNIQUE ("user_id", "organization_id");



ALTER TABLE ONLY "public"."user_pco_field_preferences"
    ADD CONSTRAINT "user_pco_field_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_pco_field_preferences"
    ADD CONSTRAINT "user_pco_field_preferences_user_id_organization_id_key" UNIQUE ("user_id", "organization_id");



ALTER TABLE ONLY "public"."user_pco_visible_people"
    ADD CONSTRAINT "user_pco_visible_people_pkey" PRIMARY KEY ("user_id", "organization_id", "pc_person_id");



CREATE INDEX "ai_action_requests_user_status_idx" ON "public"."ai_action_requests" USING "btree" ("requested_by_user_id", "status", "created_at" DESC);



CREATE INDEX "ai_tool_audit_logs_org_created_idx" ON "public"."ai_tool_audit_logs" USING "btree" ("organization_id", "created_at" DESC);



CREATE UNIQUE INDEX "contact_life_seasons_one_active" ON "public"."contact_life_seasons" USING "btree" ("contact_id") WHERE ("ended_on" IS NULL);



CREATE INDEX "contact_life_seasons_org_active" ON "public"."contact_life_seasons" USING "btree" ("organization_id") WHERE ("ended_on" IS NULL);



CREATE INDEX "contact_markers_contact_idx" ON "public"."contact_markers" USING "btree" ("contact_id");



CREATE INDEX "contact_markers_org_key_idx" ON "public"."contact_markers" USING "btree" ("organization_id", "marker_key");



CREATE INDEX "contact_markers_polarity_idx" ON "public"."contact_markers" USING "btree" ("organization_id", "polarity");



CREATE INDEX "content_stories_category_idx" ON "public"."content_stories" USING "btree" ("organization_id", "category") WHERE ("status" = 'published'::"text");



CREATE INDEX "content_stories_org_status_idx" ON "public"."content_stories" USING "btree" ("organization_id", "status", "published_at" DESC);



CREATE INDEX "content_story_blocks_story_order_idx" ON "public"."content_story_blocks" USING "btree" ("story_id", "sort_order");



CREATE UNIQUE INDEX "content_story_cta_defaults_one_global" ON "public"."content_story_cta_defaults" USING "btree" ("organization_id") WHERE "is_global";



CREATE INDEX "content_videos_featured_idx" ON "public"."content_videos" USING "btree" ("organization_id") WHERE ("is_featured" = true);



CREATE UNIQUE INDEX "group_attendance_pco_uidx" ON "public"."group_attendance" USING "btree" ("pco_attendance_id") WHERE ("pco_attendance_id" IS NOT NULL);



CREATE UNIQUE INDEX "group_meetings_pco_event_uidx" ON "public"."group_meetings" USING "btree" ("pco_event_id") WHERE ("pco_event_id" IS NOT NULL);



CREATE UNIQUE INDEX "group_members_pco_membership_uidx" ON "public"."group_members" USING "btree" ("pco_membership_id") WHERE ("pco_membership_id" IS NOT NULL);



CREATE INDEX "group_members_pco_person_idx" ON "public"."group_members" USING "btree" ("pco_person_id") WHERE ("pco_person_id" IS NOT NULL);



CREATE UNIQUE INDEX "group_type_definitions_org_pco_uniq" ON "public"."group_type_definitions" USING "btree" ("organization_id", "pco_group_type_id") WHERE ("pco_group_type_id" IS NOT NULL);



CREATE UNIQUE INDEX "groups_org_pco_group_id_uidx" ON "public"."groups" USING "btree" ("organization_id", "pco_group_id") WHERE ("pco_group_id" IS NOT NULL);



CREATE INDEX "idx_ai_feedback_contact" ON "public"."ai_suggestion_feedback" USING "btree" ("contact_id");



CREATE INDEX "idx_ai_feedback_created" ON "public"."ai_suggestion_feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_feedback_org" ON "public"."ai_suggestion_feedback" USING "btree" ("organization_id");



CREATE INDEX "idx_ai_feedback_type" ON "public"."ai_suggestion_feedback" USING "btree" ("feedback_type");



CREATE INDEX "idx_call_records_contact" ON "public"."call_records" USING "btree" ("contact_id");



CREATE INDEX "idx_call_records_created" ON "public"."call_records" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_call_records_org" ON "public"."call_records" USING "btree" ("organization_id");



CREATE INDEX "idx_campuses_organization_id" ON "public"."campuses" USING "btree" ("organization_id");



CREATE INDEX "idx_chat_conversations_user_updated" ON "public"."chat_conversations" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_chf_report" ON "public"."church_health_findings" USING "btree" ("report_id", "sort_order");



CREATE INDEX "idx_chr_org" ON "public"."church_health_reports" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_chr_share_token" ON "public"."church_health_reports" USING "btree" ("share_token") WHERE ("share_token" IS NOT NULL);



CREATE INDEX "idx_church_online_automations_event" ON "public"."church_online_flow_automations" USING "btree" ("event_type");



CREATE INDEX "idx_church_online_automations_integration" ON "public"."church_online_flow_automations" USING "btree" ("integration_id");



CREATE INDEX "idx_church_online_automations_org" ON "public"."church_online_flow_automations" USING "btree" ("organization_id");



CREATE INDEX "idx_church_online_events_contact" ON "public"."church_online_events" USING "btree" ("contact_id");



CREATE INDEX "idx_church_online_events_created" ON "public"."church_online_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_church_online_events_integration" ON "public"."church_online_events" USING "btree" ("integration_id");



CREATE INDEX "idx_church_online_events_org" ON "public"."church_online_events" USING "btree" ("organization_id");



CREATE INDEX "idx_church_online_events_type" ON "public"."church_online_events" USING "btree" ("event_type");



CREATE INDEX "idx_contact_family_members_pc_person_id" ON "public"."contact_family_members" USING "btree" ("pc_person_id") WHERE ("pc_person_id" IS NOT NULL);



CREATE INDEX "idx_contact_import_rows_import" ON "public"."contact_import_rows" USING "btree" ("import_id");



CREATE INDEX "idx_contact_imports_org" ON "public"."contact_imports" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_contacts_campus_id" ON "public"."contacts" USING "btree" ("campus_id");



CREATE INDEX "idx_contacts_household" ON "public"."contacts" USING "btree" ("organization_id", "pc_household_id") WHERE ("pc_household_id" IS NOT NULL);



CREATE INDEX "idx_contacts_org_is_demo" ON "public"."contacts" USING "btree" ("organization_id") WHERE "is_demo";



CREATE INDEX "idx_contacts_org_membership" ON "public"."contacts" USING "btree" ("organization_id", "pc_membership");



CREATE INDEX "idx_contacts_org_pcperson" ON "public"."contacts" USING "btree" ("organization_id", "pc_person_id");



CREATE INDEX "idx_contacts_pc_person_id" ON "public"."contacts" USING "btree" ("pc_person_id");



CREATE INDEX "idx_contacts_source_type" ON "public"."contacts" USING "btree" ("source_type");



CREATE INDEX "idx_content_analyses_video" ON "public"."content_analyses" USING "btree" ("video_id", "generated_at" DESC);



CREATE INDEX "idx_content_chat_messages_session" ON "public"."content_chat_messages" USING "btree" ("session_id", "created_at");



CREATE INDEX "idx_content_chat_sessions_user" ON "public"."content_chat_sessions" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_content_chunks_embedding" ON "public"."content_transcript_chunks" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_content_chunks_org" ON "public"."content_transcript_chunks" USING "btree" ("organization_id");



CREATE INDEX "idx_content_chunks_video" ON "public"."content_transcript_chunks" USING "btree" ("video_id", "chunk_index");



CREATE INDEX "idx_content_videos_org" ON "public"."content_videos" USING "btree" ("organization_id");



CREATE INDEX "idx_content_videos_public" ON "public"."content_videos" USING "btree" ("consent_level") WHERE ("consent_level" = 'public_search'::"public"."content_consent_level");



CREATE INDEX "idx_cpr_org_created" ON "public"."contact_prayer_requests" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_custom_signal_contacts_contact" ON "public"."custom_signal_contacts" USING "btree" ("contact_id") WHERE ("cleared_at" IS NULL);



CREATE INDEX "idx_custom_signal_contacts_lookup" ON "public"."custom_signal_contacts" USING "btree" ("organization_id", "signal_id", "contact_id") WHERE ("cleared_at" IS NULL);



CREATE INDEX "idx_custom_signals_org" ON "public"."custom_signals" USING "btree" ("organization_id") WHERE ("enabled" = true);



CREATE INDEX "idx_email_verification_tokens_token_hash" ON "public"."email_verification_tokens" USING "btree" ("token_hash");



CREATE INDEX "idx_email_verification_tokens_user_id" ON "public"."email_verification_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_engagement_scores_level" ON "public"."contact_engagement_scores" USING "btree" ("engagement_level");



CREATE INDEX "idx_engagement_scores_org" ON "public"."contact_engagement_scores" USING "btree" ("organization_id");



CREATE INDEX "idx_engagement_snapshots_org_date" ON "public"."org_engagement_snapshots" USING "btree" ("organization_id", "snapshot_date" DESC);



CREATE INDEX "idx_flow_moment_types_org" ON "public"."flow_moment_types" USING "btree" ("organization_id");



CREATE INDEX "idx_flow_moments_contact" ON "public"."flow_moments" USING "btree" ("contact_id");



CREATE INDEX "idx_flow_moments_type" ON "public"."flow_moments" USING "btree" ("flow_moment_type_id");



CREATE INDEX "idx_form_fields_form" ON "public"."form_fields" USING "btree" ("form_id", "sort_order");



CREATE INDEX "idx_form_submissions_form" ON "public"."form_submissions" USING "btree" ("form_id", "created_at" DESC);



CREATE INDEX "idx_form_submissions_org" ON "public"."form_submissions" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_forms_org" ON "public"."forms" USING "btree" ("organization_id");



CREATE INDEX "idx_forms_slug" ON "public"."forms" USING "btree" ("slug");



CREATE INDEX "idx_group_attendance_meeting" ON "public"."group_attendance" USING "btree" ("group_meeting_id");



CREATE INDEX "idx_group_attendance_member" ON "public"."group_attendance" USING "btree" ("group_member_id");



CREATE INDEX "idx_group_campuses_campus" ON "public"."group_campuses" USING "btree" ("campus_id");



CREATE INDEX "idx_group_campuses_group" ON "public"."group_campuses" USING "btree" ("group_id");



CREATE INDEX "idx_group_meetings_date" ON "public"."group_meetings" USING "btree" ("meeting_date");



CREATE INDEX "idx_group_meetings_group" ON "public"."group_meetings" USING "btree" ("group_id");



CREATE INDEX "idx_group_members_contact" ON "public"."group_members" USING "btree" ("contact_id");



CREATE INDEX "idx_group_members_group" ON "public"."group_members" USING "btree" ("group_id");



CREATE INDEX "idx_group_members_status" ON "public"."group_members" USING "btree" ("status");



CREATE INDEX "idx_groups_campus_id" ON "public"."groups" USING "btree" ("campus_id");



CREATE INDEX "idx_groups_leader" ON "public"."groups" USING "btree" ("leader_user_id");



CREATE INDEX "idx_groups_org_is_demo" ON "public"."groups" USING "btree" ("organization_id") WHERE "is_demo";



CREATE INDEX "idx_groups_organization" ON "public"."groups" USING "btree" ("organization_id");



CREATE INDEX "idx_groups_pco_campus_id" ON "public"."groups" USING "btree" ("pco_campus_id");



CREATE INDEX "idx_groups_public_signup_token" ON "public"."groups" USING "btree" ("public_signup_token") WHERE ("allow_public_signup" = true);



CREATE INDEX "idx_groups_status" ON "public"."groups" USING "btree" ("status");



CREATE INDEX "idx_impersonation_actions_session" ON "public"."impersonation_actions" USING "btree" ("impersonation_session_id");



CREATE INDEX "idx_impersonation_actions_timestamp" ON "public"."impersonation_actions" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_impersonation_active" ON "public"."impersonation_sessions" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_impersonation_admin_user" ON "public"."impersonation_sessions" USING "btree" ("system_admin_user_id");



CREATE INDEX "idx_impersonation_started" ON "public"."impersonation_sessions" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_impersonation_target_org" ON "public"."impersonation_sessions" USING "btree" ("target_organization_id");



CREATE INDEX "idx_integration_list_mappings_order" ON "public"."integration_list_mappings" USING "btree" ("integration_id", "display_order");



CREATE INDEX "idx_integration_list_metadata_external_list_id" ON "public"."integration_list_metadata" USING "btree" ("external_list_id");



CREATE INDEX "idx_integration_list_metadata_integration_id" ON "public"."integration_list_metadata" USING "btree" ("integration_id");



CREATE INDEX "idx_invitations_email" ON "public"."invitations" USING "btree" ("email");



CREATE INDEX "idx_invitations_organization_id" ON "public"."invitations" USING "btree" ("organization_id");



CREATE INDEX "idx_invitations_token" ON "public"."invitations" USING "btree" ("token");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_email_digest_pending" ON "public"."notifications" USING "btree" ("user_id", "email_digest_sent") WHERE ("email_digest_sent" = false);



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id", "read") WHERE ("read" = false);



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_org_activity_date" ON "public"."organization_activity_stats" USING "btree" ("date" DESC);



CREATE INDEX "idx_org_activity_org_date" ON "public"."organization_activity_stats" USING "btree" ("organization_id", "date" DESC);



CREATE INDEX "idx_org_marker_settings_org" ON "public"."org_marker_settings" USING "btree" ("organization_id");



CREATE INDEX "idx_organizations_health_score" ON "public"."organizations" USING "btree" ("health_score" DESC);



CREATE INDEX "idx_pco_checkins_checked_in_at" ON "public"."pco_checkins" USING "btree" ("checked_in_at");



CREATE INDEX "idx_pco_checkins_contact_id" ON "public"."pco_checkins" USING "btree" ("contact_id");



CREATE INDEX "idx_pco_checkins_org_id" ON "public"."pco_checkins" USING "btree" ("organization_id");



CREATE INDEX "idx_pco_checkins_pc_person_id" ON "public"."pco_checkins" USING "btree" ("pc_person_id");



CREATE INDEX "idx_pco_moment_mappings_integration" ON "public"."pco_moment_mappings" USING "btree" ("integration_id");



CREATE INDEX "idx_pco_moment_mappings_org" ON "public"."pco_moment_mappings" USING "btree" ("organization_id");



CREATE INDEX "idx_pco_oauth_states_expires" ON "public"."pco_oauth_states" USING "btree" ("expires_at");



CREATE INDEX "idx_pco_sync_debug_logs_checked_at" ON "public"."pco_sync_debug_logs" USING "btree" ("checked_at" DESC);



CREATE INDEX "idx_pco_sync_debug_logs_contact_id" ON "public"."pco_sync_debug_logs" USING "btree" ("contact_id");



CREATE INDEX "idx_pco_sync_debug_logs_pc_person_id" ON "public"."pco_sync_debug_logs" USING "btree" ("pc_person_id");



CREATE INDEX "idx_pco_sync_jobs_org" ON "public"."pco_sync_jobs" USING "btree" ("organization_id");



CREATE INDEX "idx_pco_sync_jobs_status" ON "public"."pco_sync_jobs" USING "btree" ("status");



CREATE INDEX "idx_pco_sync_queue_job" ON "public"."pco_sync_queue" USING "btree" ("sync_job_id");



CREATE INDEX "idx_pco_sync_queue_pending" ON "public"."pco_sync_queue" USING "btree" ("created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_pco_sync_queue_status" ON "public"."pco_sync_queue" USING "btree" ("status");



CREATE INDEX "idx_pipeline_contacts_assigned_to_user_id" ON "public"."pipeline_contacts" USING "btree" ("assigned_to_user_id");



CREATE INDEX "idx_pipeline_contacts_source" ON "public"."pipeline_contacts" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_pipeline_resources_organization_id" ON "public"."pipeline_resources" USING "btree" ("organization_id");



CREATE INDEX "idx_pipeline_resources_pipeline_id" ON "public"."pipeline_resources" USING "btree" ("pipeline_id");



CREATE INDEX "idx_pipeline_stages_default_assignee" ON "public"."pipeline_stages" USING "btree" ("default_assignee_user_id") WHERE ("default_assignee_user_id" IS NOT NULL);



CREATE INDEX "idx_pipelines_org_is_demo" ON "public"."pipelines" USING "btree" ("organization_id") WHERE "is_demo";



CREATE INDEX "idx_pipelines_organization_order" ON "public"."pipelines" USING "btree" ("organization_id", "flow_order");



CREATE INDEX "idx_prayer_stages_org" ON "public"."prayer_stages" USING "btree" ("organization_id", "stage_order");



CREATE INDEX "idx_profiles_onboarding_completed" ON "public"."profiles" USING "btree" ("onboarding_completed");



CREATE INDEX "idx_prp_request" ON "public"."prayer_request_prayers" USING "btree" ("prayer_request_id");



CREATE INDEX "idx_push_subscriptions_user" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_signal_suggestions_contact" ON "public"."signal_agent_suggestions" USING "btree" ("contact_id", "status");



CREATE INDEX "idx_signal_suggestions_dedupe" ON "public"."signal_agent_suggestions" USING "btree" ("organization_id", "contact_id", "signal_key", "action_type", "status");



CREATE INDEX "idx_signal_suggestions_org_status" ON "public"."signal_agent_suggestions" USING "btree" ("organization_id", "status", "created_at" DESC);



CREATE INDEX "idx_sms_messages_contact" ON "public"."sms_messages" USING "btree" ("contact_id");



CREATE INDEX "idx_sms_messages_created" ON "public"."sms_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sms_messages_org" ON "public"."sms_messages" USING "btree" ("organization_id");



CREATE INDEX "idx_sync_queue_org_status_created" ON "public"."pco_sync_queue" USING "btree" ("organization_id", "status", "created_at");



CREATE INDEX "idx_twilio_phone_numbers_assigned" ON "public"."twilio_phone_numbers" USING "btree" ("assigned_to_user_id");



CREATE INDEX "idx_twilio_phone_numbers_org" ON "public"."twilio_phone_numbers" USING "btree" ("organization_id");



CREATE INDEX "idx_upvp_user_org_person" ON "public"."user_pco_visible_people" USING "btree" ("user_id", "organization_id", "pc_person_id");



CREATE INDEX "idx_user_login_events_org" ON "public"."user_login_events" USING "btree" ("organization_id");



CREATE INDEX "idx_user_login_events_time" ON "public"."user_login_events" USING "btree" ("logged_in_at" DESC);



CREATE INDEX "idx_user_login_events_user" ON "public"."user_login_events" USING "btree" ("user_id");



CREATE INDEX "idx_user_logins_org_date" ON "public"."user_logins" USING "btree" ("organization_id", "date");



CREATE INDEX "idx_user_pco_visible_people_pc_person" ON "public"."user_pco_visible_people" USING "btree" ("organization_id", "pc_person_id");



CREATE INDEX "idx_user_pco_visible_people_user" ON "public"."user_pco_visible_people" USING "btree" ("user_id", "organization_id");



CREATE INDEX "idx_verification_tokens_expires" ON "public"."auth_verification_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_verification_tokens_hash" ON "public"."auth_verification_tokens" USING "btree" ("token_hash");



CREATE INDEX "idx_verification_tokens_user" ON "public"."auth_verification_tokens" USING "btree" ("user_id");



CREATE UNIQUE INDEX "pco_moment_mappings_rule_condition_uniq" ON "public"."pco_moment_mappings" USING "btree" ("integration_id", "flow_moment_type_id", "condition_group", "pco_source_identifier") WHERE ("pco_source_type" = 'custom_tab_field'::"text");



CREATE UNIQUE INDEX "pipeline_contacts_contact_pipeline_unique" ON "public"."pipeline_contacts" USING "btree" ("contact_id", "pipeline_id");



CREATE INDEX "profiles_email_verified_at_idx" ON "public"."profiles" USING "btree" ("email_verified_at");



CREATE INDEX "tasks_assignee_idx" ON "public"."tasks" USING "btree" ("assigned_to_user_id", "completed_at");



CREATE OR REPLACE TRIGGER "cleanup_stage_assignees_trigger" AFTER DELETE ON "public"."pipeline_team_members" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_stage_assignees"();



CREATE OR REPLACE TRIGGER "contact_life_seasons_updated_at" BEFORE UPDATE ON "public"."contact_life_seasons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "content_stories_updated_at" BEFORE UPDATE ON "public"."content_stories" FOR EACH ROW EXECUTE FUNCTION "public"."content_set_updated_at"();



CREATE OR REPLACE TRIGGER "content_story_blocks_updated_at" BEFORE UPDATE ON "public"."content_story_blocks" FOR EACH ROW EXECUTE FUNCTION "public"."content_set_updated_at"();



CREATE OR REPLACE TRIGGER "content_story_cta_defaults_updated_at" BEFORE UPDATE ON "public"."content_story_cta_defaults" FOR EACH ROW EXECUTE FUNCTION "public"."content_set_updated_at"();



CREATE OR REPLACE TRIGGER "cpr_set_org_trg" BEFORE INSERT ON "public"."contact_prayer_requests" FOR EACH ROW EXECUTE FUNCTION "public"."cpr_set_org"();



CREATE OR REPLACE TRIGGER "end_life_season_on_checkin" AFTER INSERT ON "public"."pco_checkins" FOR EACH ROW EXECUTE FUNCTION "public"."end_life_season_on_attendance"();



CREATE OR REPLACE TRIGGER "end_life_season_on_group_attendance" AFTER INSERT ON "public"."group_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."end_life_season_on_attendance"();



CREATE OR REPLACE TRIGGER "insert_pipeline_contact_progress_trigger" BEFORE INSERT ON "public"."pipeline_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_pipeline_contact_progress"();



CREATE OR REPLACE TRIGGER "on_org_member_removed" BEFORE DELETE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_pipeline_team_on_org_leave"();



CREATE OR REPLACE TRIGGER "org_engagement_settings_updated_at" BEFORE UPDATE ON "public"."org_engagement_settings" FOR EACH ROW EXECUTE FUNCTION "public"."chr_touch_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."ai_suggestion_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "tasks_touch_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."content_set_updated_at"();



CREATE OR REPLACE TRIGGER "track_login_activity" AFTER INSERT ON "public"."user_login_events" FOR EACH ROW EXECUTE FUNCTION "public"."track_user_login"();



CREATE OR REPLACE TRIGGER "trg_add_pipeline_creator_as_owner" AFTER INSERT ON "public"."pipelines" FOR EACH ROW EXECUTE FUNCTION "public"."add_pipeline_creator_as_owner"();



CREATE OR REPLACE TRIGGER "trg_auto_clear_demo_on_real_contact" AFTER INSERT ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."auto_clear_demo_on_real_contact"();



CREATE OR REPLACE TRIGGER "trg_check_reserved_org_slug" BEFORE INSERT OR UPDATE OF "slug" ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."check_reserved_org_slug"();



CREATE OR REPLACE TRIGGER "trg_chr_touch_updated_at" BEFORE UPDATE ON "public"."church_health_reports" FOR EACH ROW EXECUTE FUNCTION "public"."chr_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_content_chat_sessions_updated_at" BEFORE UPDATE ON "public"."content_chat_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."content_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_content_videos_updated_at" BEFORE UPDATE ON "public"."content_videos" FOR EACH ROW EXECUTE FUNCTION "public"."content_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_custom_signal_rules_updated_at" BEFORE UPDATE ON "public"."custom_signal_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_custom_signals_updated_at" BEFORE UPDATE ON "public"."custom_signals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_enroll_admin_on_org_pipelines" AFTER INSERT ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."enroll_admin_on_org_pipelines"();



CREATE OR REPLACE TRIGGER "trg_form_fields_updated_at" BEFORE UPDATE ON "public"."form_fields" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_forms_updated_at" BEFORE UPDATE ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_group_settings_updated" BEFORE UPDATE ON "public"."group_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_group_type_definitions_updated" BEFORE UPDATE ON "public"."group_type_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_notify_push_on_notification" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."notify_push_on_notification"();



CREATE OR REPLACE TRIGGER "trg_seed_default_org_features" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."seed_default_org_features"();



CREATE OR REPLACE TRIGGER "trg_seed_group_config_after_org_insert" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."seed_group_config_for_org"();



CREATE OR REPLACE TRIGGER "trg_signal_agent_configs_updated_at" BEFORE UPDATE ON "public"."signal_agent_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_signal_agent_rules_updated_at" BEFORE UPDATE ON "public"."signal_agent_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_signal_agent_suggestions_updated_at" BEFORE UPDATE ON "public"."signal_agent_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_user_pco_connections_updated_at" BEFORE UPDATE ON "public"."user_pco_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_log_pipeline_contact_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."pipeline_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."log_pipeline_contact_activity"();



CREATE OR REPLACE TRIGGER "trigger_update_onboarding_on_integration_created" AFTER INSERT OR UPDATE OF "status" ON "public"."integrations" FOR EACH ROW WHEN ((("new"."service_name" = 'planning_center'::"text") AND ("new"."status" = 'active'::"text"))) EXECUTE FUNCTION "public"."update_onboarding_on_integration_created"();



CREATE OR REPLACE TRIGGER "trigger_update_onboarding_on_list_mapping" AFTER INSERT ON "public"."integration_list_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_onboarding_on_list_mapping"();



CREATE OR REPLACE TRIGGER "trigger_update_stage_entered_at" BEFORE UPDATE ON "public"."pipeline_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_stage_entered_at"();



CREATE OR REPLACE TRIGGER "trigger_update_unique_active_users" AFTER INSERT ON "public"."user_logins" FOR EACH ROW EXECUTE FUNCTION "public"."update_unique_active_users"();



CREATE OR REPLACE TRIGGER "update_ai_action_requests_updated_at" BEFORE UPDATE ON "public"."ai_action_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_pipeline_contacts_updated_at"();



CREATE OR REPLACE TRIGGER "update_ai_tool_settings_updated_at" BEFORE UPDATE ON "public"."ai_tool_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_pipeline_contacts_updated_at"();



CREATE OR REPLACE TRIGGER "update_attendance_stats" AFTER INSERT OR UPDATE ON "public"."group_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."update_member_attendance_stats"();



CREATE OR REPLACE TRIGGER "update_call_records_updated_at" BEFORE UPDATE ON "public"."call_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_chat_conversations_updated_at" BEFORE UPDATE ON "public"."chat_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_pipeline_contacts_updated_at"();



CREATE OR REPLACE TRIGGER "update_church_online_automations_updated_at" BEFORE UPDATE ON "public"."church_online_flow_automations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_church_online_events_updated_at" BEFORE UPDATE ON "public"."church_online_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contact_addresses_updated_at" BEFORE UPDATE ON "public"."contact_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contact_demographics_updated_at" BEFORE UPDATE ON "public"."contact_demographics" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contact_family_members_updated_at" BEFORE UPDATE ON "public"."contact_family_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contact_imports_updated_at" BEFORE UPDATE ON "public"."contact_imports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contact_interactions_updated_at" BEFORE UPDATE ON "public"."contact_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contact_notes_updated_at" BEFORE UPDATE ON "public"."contact_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contact_prayer_requests_updated_at" BEFORE UPDATE ON "public"."contact_prayer_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_flow_moment_types_updated_at" BEFORE UPDATE ON "public"."flow_moment_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_flow_moments_updated_at" BEFORE UPDATE ON "public"."flow_moments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_group_attendance_updated_at" BEFORE UPDATE ON "public"."group_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_group_meetings_updated_at" BEFORE UPDATE ON "public"."group_meetings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_group_members_updated_at" BEFORE UPDATE ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_groups_updated_at" BEFORE UPDATE ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_integration_list_mappings_updated_at" BEFORE UPDATE ON "public"."integration_list_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_integration_list_metadata_updated_at" BEFORE UPDATE ON "public"."integration_list_metadata" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_integrations_updated_at" BEFORE UPDATE ON "public"."integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invitations_updated_at" BEFORE UPDATE ON "public"."invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_org_marker_settings_updated_at" BEFORE UPDATE ON "public"."org_marker_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organization_features_updated_at" BEFORE UPDATE ON "public"."organization_features" FOR EACH ROW EXECUTE FUNCTION "public"."update_pipeline_contacts_updated_at"();



CREATE OR REPLACE TRIGGER "update_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pco_moment_mappings_updated_at" BEFORE UPDATE ON "public"."pco_moment_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pco_sync_jobs_updated_at" BEFORE UPDATE ON "public"."pco_sync_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_sync_updated_at"();



CREATE OR REPLACE TRIGGER "update_pco_sync_queue_updated_at" BEFORE UPDATE ON "public"."pco_sync_queue" FOR EACH ROW EXECUTE FUNCTION "public"."update_sync_updated_at"();



CREATE OR REPLACE TRIGGER "update_pipeline_contact_progress_trigger" BEFORE UPDATE ON "public"."pipeline_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_pipeline_contact_progress"();



CREATE OR REPLACE TRIGGER "update_pipeline_contacts_updated_at" BEFORE UPDATE ON "public"."pipeline_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pipeline_contacts_updated_at_trigger" BEFORE UPDATE ON "public"."pipeline_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_pipeline_contacts_updated_at"();



CREATE OR REPLACE TRIGGER "update_pipeline_resources_updated_at" BEFORE UPDATE ON "public"."pipeline_resources" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pipeline_stages_updated_at" BEFORE UPDATE ON "public"."pipeline_stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pipeline_team_members_updated_at" BEFORE UPDATE ON "public"."pipeline_team_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pipelines_updated_at" BEFORE UPDATE ON "public"."pipelines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sms_messages_updated_at" BEFORE UPDATE ON "public"."sms_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_twilio_phone_numbers_updated_at" BEFORE UPDATE ON "public"."twilio_phone_numbers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_pco_field_preferences_updated_at" BEFORE UPDATE ON "public"."user_pco_field_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_stage_assignee_trigger" BEFORE INSERT OR UPDATE ON "public"."pipeline_stages" FOR EACH ROW EXECUTE FUNCTION "public"."validate_stage_assignee"();



ALTER TABLE ONLY "public"."ai_action_requests"
    ADD CONSTRAINT "ai_action_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_suggestion_feedback"
    ADD CONSTRAINT "ai_suggestion_feedback_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_suggestion_feedback"
    ADD CONSTRAINT "ai_suggestion_feedback_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_suggestion_feedback"
    ADD CONSTRAINT "ai_suggestion_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_tool_audit_logs"
    ADD CONSTRAINT "ai_tool_audit_logs_action_request_id_fkey" FOREIGN KEY ("action_request_id") REFERENCES "public"."ai_action_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_tool_audit_logs"
    ADD CONSTRAINT "ai_tool_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_tool_settings"
    ADD CONSTRAINT "ai_tool_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_verification_tokens"
    ADD CONSTRAINT "auth_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_records"
    ADD CONSTRAINT "call_records_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_records"
    ADD CONSTRAINT "call_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_records"
    ADD CONSTRAINT "call_records_twilio_phone_number_id_fkey" FOREIGN KEY ("twilio_phone_number_id") REFERENCES "public"."twilio_phone_numbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campuses"
    ADD CONSTRAINT "campuses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_health_findings"
    ADD CONSTRAINT "church_health_findings_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."church_health_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_health_reports"
    ADD CONSTRAINT "church_health_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_online_events"
    ADD CONSTRAINT "church_online_events_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."church_online_events"
    ADD CONSTRAINT "church_online_events_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_online_events"
    ADD CONSTRAINT "church_online_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_online_flow_automations"
    ADD CONSTRAINT "church_online_flow_automations_flow_moment_type_id_fkey" FOREIGN KEY ("flow_moment_type_id") REFERENCES "public"."flow_moment_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."church_online_flow_automations"
    ADD CONSTRAINT "church_online_flow_automations_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_online_flow_automations"
    ADD CONSTRAINT "church_online_flow_automations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_online_flow_automations"
    ADD CONSTRAINT "church_online_flow_automations_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."church_online_flow_automations"
    ADD CONSTRAINT "church_online_flow_automations_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_engagement_scores"
    ADD CONSTRAINT "contact_engagement_scores_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_engagement_scores"
    ADD CONSTRAINT "contact_engagement_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_import_rows"
    ADD CONSTRAINT "contact_import_rows_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contact_import_rows"
    ADD CONSTRAINT "contact_import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."contact_imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_imports"
    ADD CONSTRAINT "contact_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_imports"
    ADD CONSTRAINT "contact_imports_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contact_imports"
    ADD CONSTRAINT "contact_imports_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contact_life_seasons"
    ADD CONSTRAINT "contact_life_seasons_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_life_seasons"
    ADD CONSTRAINT "contact_life_seasons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_markers"
    ADD CONSTRAINT "contact_markers_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_markers"
    ADD CONSTRAINT "contact_markers_marker_key_fkey" FOREIGN KEY ("marker_key") REFERENCES "public"."marker_definitions"("key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_markers"
    ADD CONSTRAINT "contact_markers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_prayer_requests"
    ADD CONSTRAINT "contact_prayer_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_prayer_requests"
    ADD CONSTRAINT "contact_prayer_requests_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."prayer_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_analyses"
    ADD CONSTRAINT "content_analyses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_analyses"
    ADD CONSTRAINT "content_analyses_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."content_videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_chat_messages"
    ADD CONSTRAINT "content_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."content_chat_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_chat_sessions"
    ADD CONSTRAINT "content_chat_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_chat_sessions"
    ADD CONSTRAINT "content_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_chat_sessions"
    ADD CONSTRAINT "content_chat_sessions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."content_videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_stories"
    ADD CONSTRAINT "content_stories_cta_preset_id_fkey" FOREIGN KEY ("cta_preset_id") REFERENCES "public"."content_story_cta_defaults"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_stories"
    ADD CONSTRAINT "content_stories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_stories"
    ADD CONSTRAINT "content_stories_source_video_id_fkey" FOREIGN KEY ("source_video_id") REFERENCES "public"."content_videos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_story_blocks"
    ADD CONSTRAINT "content_story_blocks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_story_blocks"
    ADD CONSTRAINT "content_story_blocks_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."content_stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_story_cta_defaults"
    ADD CONSTRAINT "content_story_cta_defaults_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_story_cta_defaults"
    ADD CONSTRAINT "content_story_cta_defaults_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_transcript_chunks"
    ADD CONSTRAINT "content_transcript_chunks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_transcript_chunks"
    ADD CONSTRAINT "content_transcript_chunks_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."content_videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_videos"
    ADD CONSTRAINT "content_videos_ingested_by_fkey" FOREIGN KEY ("ingested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_videos"
    ADD CONSTRAINT "content_videos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_signal_contacts"
    ADD CONSTRAINT "custom_signal_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_signal_contacts"
    ADD CONSTRAINT "custom_signal_contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_signal_contacts"
    ADD CONSTRAINT "custom_signal_contacts_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "public"."custom_signals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_signal_rules"
    ADD CONSTRAINT "custom_signal_rules_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "public"."custom_signals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_signals"
    ADD CONSTRAINT "custom_signals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_signals"
    ADD CONSTRAINT "custom_signals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_tags"
    ADD CONSTRAINT "fk_contact_tags_contact_id" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_contacts"
    ADD CONSTRAINT "fk_pipeline_contacts_contact_id" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_contacts"
    ADD CONSTRAINT "fk_pipeline_contacts_pipeline_id" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_contacts"
    ADD CONSTRAINT "fk_pipeline_contacts_stage_id" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_stages"
    ADD CONSTRAINT "fk_pipeline_stages_pipeline_id" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pco_sync_queue"
    ADD CONSTRAINT "fk_sync_queue_organization" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flow_moment_types"
    ADD CONSTRAINT "flow_moment_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flow_moments"
    ADD CONSTRAINT "flow_moments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flow_moments"
    ADD CONSTRAINT "flow_moments_flow_moment_type_id_fkey" FOREIGN KEY ("flow_moment_type_id") REFERENCES "public"."flow_moment_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_fields"
    ADD CONSTRAINT "form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_submissions"
    ADD CONSTRAINT "form_submissions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_submissions"
    ADD CONSTRAINT "form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_submissions"
    ADD CONSTRAINT "form_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_attendance"
    ADD CONSTRAINT "group_attendance_checked_in_by_user_id_fkey" FOREIGN KEY ("checked_in_by_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."group_attendance"
    ADD CONSTRAINT "group_attendance_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_attendance"
    ADD CONSTRAINT "group_attendance_group_meeting_id_fkey" FOREIGN KEY ("group_meeting_id") REFERENCES "public"."group_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_attendance"
    ADD CONSTRAINT "group_attendance_group_member_id_fkey" FOREIGN KEY ("group_member_id") REFERENCES "public"."group_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_campuses"
    ADD CONSTRAINT "group_campuses_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_campuses"
    ADD CONSTRAINT "group_campuses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_meetings"
    ADD CONSTRAINT "group_meetings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."group_meetings"
    ADD CONSTRAINT "group_meetings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_settings"
    ADD CONSTRAINT "group_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_signup_requests"
    ADD CONSTRAINT "group_signup_requests_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_signup_requests"
    ADD CONSTRAINT "group_signup_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_signup_requests"
    ADD CONSTRAINT "group_signup_requests_processed_by_user_id_fkey" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_type_definitions"
    ADD CONSTRAINT "group_type_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_co_leader_user_id_fkey" FOREIGN KEY ("co_leader_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."impersonation_actions"
    ADD CONSTRAINT "impersonation_actions_impersonation_session_id_fkey" FOREIGN KEY ("impersonation_session_id") REFERENCES "public"."impersonation_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_system_admin_user_id_fkey" FOREIGN KEY ("system_admin_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_target_organization_id_fkey" FOREIGN KEY ("target_organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_list_mappings"
    ADD CONSTRAINT "integration_list_mappings_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_list_mappings"
    ADD CONSTRAINT "integration_list_mappings_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_list_mappings"
    ADD CONSTRAINT "integration_list_mappings_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_logs"
    ADD CONSTRAINT "integration_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."contact_interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_engagement_settings"
    ADD CONSTRAINT "org_engagement_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_engagement_snapshots"
    ADD CONSTRAINT "org_engagement_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_marker_settings"
    ADD CONSTRAINT "org_marker_settings_marker_key_fkey" FOREIGN KEY ("marker_key") REFERENCES "public"."marker_definitions"("key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_marker_settings"
    ADD CONSTRAINT "org_marker_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_marker_settings"
    ADD CONSTRAINT "org_marker_settings_promoted_signal_id_fkey" FOREIGN KEY ("promoted_signal_id") REFERENCES "public"."custom_signals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_activity_stats"
    ADD CONSTRAINT "organization_activity_stats_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_features"
    ADD CONSTRAINT "organization_features_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_health_history"
    ADD CONSTRAINT "organization_health_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_fl_admin_assigned_to_fkey" FOREIGN KEY ("fl_admin_assigned_to") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."pco_checkins"
    ADD CONSTRAINT "pco_checkins_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pco_checkins"
    ADD CONSTRAINT "pco_checkins_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pco_moment_mappings"
    ADD CONSTRAINT "pco_moment_mappings_flow_moment_type_id_fkey" FOREIGN KEY ("flow_moment_type_id") REFERENCES "public"."flow_moment_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pco_moment_mappings"
    ADD CONSTRAINT "pco_moment_mappings_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pco_moment_mappings"
    ADD CONSTRAINT "pco_moment_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pco_sync_debug_logs"
    ADD CONSTRAINT "pco_sync_debug_logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pco_sync_jobs"
    ADD CONSTRAINT "pco_sync_jobs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pco_sync_jobs"
    ADD CONSTRAINT "pco_sync_jobs_list_mapping_id_fkey" FOREIGN KEY ("list_mapping_id") REFERENCES "public"."integration_list_mappings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pco_sync_jobs"
    ADD CONSTRAINT "pco_sync_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pco_sync_queue"
    ADD CONSTRAINT "pco_sync_queue_sync_job_id_fkey" FOREIGN KEY ("sync_job_id") REFERENCES "public"."pco_sync_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_contacts"
    ADD CONSTRAINT "pipeline_contacts_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pipeline_resources"
    ADD CONSTRAINT "pipeline_resources_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pipeline_resources"
    ADD CONSTRAINT "pipeline_resources_last_edited_by_user_id_fkey" FOREIGN KEY ("last_edited_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pipeline_resources"
    ADD CONSTRAINT "pipeline_resources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_resources"
    ADD CONSTRAINT "pipeline_resources_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_stages"
    ADD CONSTRAINT "pipeline_stages_default_assignee_user_id_fkey" FOREIGN KEY ("default_assignee_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pipeline_team_members"
    ADD CONSTRAINT "pipeline_team_members_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_team_members"
    ADD CONSTRAINT "pipeline_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipelines"
    ADD CONSTRAINT "pipelines_completion_moment_type_id_fkey" FOREIGN KEY ("completion_moment_type_id") REFERENCES "public"."flow_moment_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prayer_request_prayers"
    ADD CONSTRAINT "prayer_request_prayers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prayer_request_prayers"
    ADD CONSTRAINT "prayer_request_prayers_prayer_request_id_fkey" FOREIGN KEY ("prayer_request_id") REFERENCES "public"."contact_prayer_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prayer_stages"
    ADD CONSTRAINT "prayer_stages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signal_agent_configs"
    ADD CONSTRAINT "signal_agent_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signal_agent_rules"
    ADD CONSTRAINT "signal_agent_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signal_agent_suggestions"
    ADD CONSTRAINT "signal_agent_suggestions_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."signal_agent_suggestions"
    ADD CONSTRAINT "signal_agent_suggestions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signal_agent_suggestions"
    ADD CONSTRAINT "signal_agent_suggestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signal_agent_suggestions"
    ADD CONSTRAINT "signal_agent_suggestions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_twilio_phone_number_id_fkey" FOREIGN KEY ("twilio_phone_number_id") REFERENCES "public"."twilio_phone_numbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_user_roles"
    ADD CONSTRAINT "system_user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."system_user_roles"
    ADD CONSTRAINT "system_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."twilio_phone_numbers"
    ADD CONSTRAINT "twilio_phone_numbers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_flow_preferences"
    ADD CONSTRAINT "user_flow_preferences_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_flow_preferences"
    ADD CONSTRAINT "user_flow_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_login_events"
    ADD CONSTRAINT "user_login_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_login_events"
    ADD CONSTRAINT "user_login_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_logins"
    ADD CONSTRAINT "user_logins_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage automations in their organization" ON "public"."church_online_flow_automations" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "church_online_flow_automations"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can manage phone numbers in their organization" ON "public"."twilio_phone_numbers" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "twilio_phone_numbers"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Anon can read fields of published forms" ON "public"."form_fields" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_fields"."form_id") AND ("f"."is_published" = true)))));



CREATE POLICY "Anon can read published forms" ON "public"."forms" FOR SELECT TO "anon" USING (("is_published" = true));



CREATE POLICY "Anyone can view groups with public signup enabled" ON "public"."groups" FOR SELECT USING ((("allow_public_signup" = true) AND ("visibility" = ANY (ARRAY['public'::"text", 'unlisted'::"text"]))));



CREATE POLICY "Anyone can view listed groups" ON "public"."groups" FOR SELECT USING ((("visibility" = 'public'::"text") AND ("status" = 'active'::"text") AND ("archived_at" IS NULL)));



CREATE POLICY "Anyone can view shared reports" ON "public"."church_health_reports" FOR SELECT TO "authenticated", "anon" USING ((("share_enabled" = true) AND ("share_token" IS NOT NULL)));



CREATE POLICY "Authenticated users can create organizations" ON "public"."organizations" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Create tasks in own org" ON "public"."tasks" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_user_in_organization"("auth"."uid"(), "organization_id") AND ("created_by_user_id" = "auth"."uid"())));



CREATE POLICY "Creator or admins can delete imports" ON "public"."contact_imports" FOR DELETE TO "authenticated" USING ((("created_by_user_id" = "auth"."uid"()) OR ("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))));



CREATE POLICY "Creator or admins can update imports" ON "public"."contact_imports" FOR UPDATE TO "authenticated" USING ((("created_by_user_id" = "auth"."uid"()) OR ("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))));



CREATE POLICY "Delete own or created tasks" ON "public"."tasks" FOR DELETE TO "authenticated" USING (("public"."is_user_in_organization"("auth"."uid"(), "organization_id") AND (("assigned_to_user_id" = "auth"."uid"()) OR ("created_by_user_id" = "auth"."uid"()))));



CREATE POLICY "Flow leads can delete pipelines" ON "public"."pipelines" FOR DELETE USING (("public"."get_flow_role"("auth"."uid"(), "id") = 'lead'::"text"));



CREATE POLICY "Flow leads can delete stages" ON "public"."pipeline_stages" FOR DELETE USING (("public"."get_flow_role"("auth"."uid"(), "pipeline_id") = 'lead'::"text"));



CREATE POLICY "Flow leads can manage team members" ON "public"."pipeline_team_members" USING (("public"."get_flow_role"("auth"."uid"(), "pipeline_id") = 'lead'::"text")) WITH CHECK (("public"."get_flow_role"("auth"."uid"(), "pipeline_id") = 'lead'::"text"));



CREATE POLICY "Flow leads can update pipelines" ON "public"."pipelines" FOR UPDATE USING (("public"."get_flow_role"("auth"."uid"(), "id") = 'lead'::"text")) WITH CHECK (("public"."get_flow_role"("auth"."uid"(), "id") = 'lead'::"text"));



CREATE POLICY "Flow leads/admins can create resources" ON "public"."pipeline_resources" FOR INSERT WITH CHECK (("public"."is_flow_team_member"("auth"."uid"(), "pipeline_id") OR (EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "pipeline_resources"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "Flow leads/admins can delete resources" ON "public"."pipeline_resources" FOR DELETE USING ((("public"."get_flow_role"("auth"."uid"(), "pipeline_id") = ANY (ARRAY['lead'::"text", 'manager'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "pipeline_resources"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "Flow leads/admins can update resources" ON "public"."pipeline_resources" FOR UPDATE USING ((("public"."get_flow_role"("auth"."uid"(), "pipeline_id") = ANY (ARRAY['lead'::"text", 'manager'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "pipeline_resources"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "Flow team members can create pipeline contacts" ON "public"."pipeline_contacts" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_flow_team_member"("auth"."uid"(), "pipeline_id"));



CREATE POLICY "Flow team members can create stages" ON "public"."pipeline_stages" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_flow_team_member"("auth"."uid"(), "pipeline_id"));



CREATE POLICY "Flow team members can delete pipeline contacts" ON "public"."pipeline_contacts" FOR DELETE TO "authenticated" USING ("public"."is_flow_team_member"("auth"."uid"(), "pipeline_id"));



CREATE POLICY "Flow team members can update pipeline contacts" ON "public"."pipeline_contacts" FOR UPDATE TO "authenticated" USING ("public"."is_flow_team_member"("auth"."uid"(), "pipeline_id")) WITH CHECK ("public"."is_flow_team_member"("auth"."uid"(), "pipeline_id"));



CREATE POLICY "Flow team members can update stages" ON "public"."pipeline_stages" FOR UPDATE TO "authenticated" USING ("public"."is_flow_team_member"("auth"."uid"(), "pipeline_id")) WITH CHECK ("public"."is_flow_team_member"("auth"."uid"(), "pipeline_id"));



CREATE POLICY "Impersonating admin can view target org" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND ("id" = "public"."get_impersonation_org_id"("auth"."uid"()))));



CREATE POLICY "Impersonating admin can view target org addresses" ON "public"."contact_addresses" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_addresses"."contact_id") AND ("c"."organization_id" = "public"."get_impersonation_org_id"("auth"."uid"())))))));



CREATE POLICY "Impersonating admin can view target org contacts" ON "public"."contacts" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND ("organization_id" = "public"."get_impersonation_org_id"("auth"."uid"()))));



CREATE POLICY "Impersonating admin can view target org demographics" ON "public"."contact_demographics" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_demographics"."contact_id") AND ("c"."organization_id" = "public"."get_impersonation_org_id"("auth"."uid"())))))));



CREATE POLICY "Impersonating admin can view target org family" ON "public"."contact_family_members" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_family_members"."contact_id") AND ("c"."organization_id" = "public"."get_impersonation_org_id"("auth"."uid"())))))));



CREATE POLICY "Impersonating admin can view target org interactions" ON "public"."contact_interactions" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_interactions"."contact_id") AND ("c"."organization_id" = "public"."get_impersonation_org_id"("auth"."uid"())))))));



CREATE POLICY "Impersonating admin can view target org members" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND ("organization_id" = "public"."get_impersonation_org_id"("auth"."uid"()))));



CREATE POLICY "Impersonating admin can view target org notes" ON "public"."contact_notes" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_notes"."contact_id") AND ("c"."organization_id" = "public"."get_impersonation_org_id"("auth"."uid"())))))));



CREATE POLICY "Impersonating admin can view target org pipeline contacts" ON "public"."pipeline_contacts" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pipelines" "p"
  WHERE (("p"."id" = "pipeline_contacts"."pipeline_id") AND ("p"."organization_id" = "public"."get_impersonation_org_id"("auth"."uid"())))))));



CREATE POLICY "Impersonating admin can view target org pipeline team" ON "public"."pipeline_team_members" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pipelines" "p"
  WHERE (("p"."id" = "pipeline_team_members"."pipeline_id") AND ("p"."organization_id" = "public"."get_impersonation_org_id"("auth"."uid"())))))));



CREATE POLICY "Impersonating admin can view target org pipelines" ON "public"."pipelines" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND ("organization_id" = "public"."get_impersonation_org_id"("auth"."uid"()))));



CREATE POLICY "Impersonating admin can view target org prayers" ON "public"."contact_prayer_requests" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_prayer_requests"."contact_id") AND ("c"."organization_id" = "public"."get_impersonation_org_id"("auth"."uid"())))))));



CREATE POLICY "Impersonating admin can view target org stages" ON "public"."pipeline_stages" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."pipelines" "p"
  WHERE (("p"."id" = "pipeline_stages"."pipeline_id") AND ("p"."organization_id" = "public"."get_impersonation_org_id"("auth"."uid"())))))));



CREATE POLICY "Impersonating admin can view target org tags" ON "public"."contact_tags" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND "public"."is_currently_impersonating"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."id" = "contact_tags"."contact_id") AND ("c"."organization_id" = "public"."get_impersonation_org_id"("auth"."uid"())))))));



CREATE POLICY "Members can create reports for their org" ON "public"."church_health_reports" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Members can delete their org reports" ON "public"."church_health_reports" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Members can manage findings for their org" ON "public"."church_health_findings" TO "authenticated" USING (("report_id" IN ( SELECT "church_health_reports"."id"
   FROM "public"."church_health_reports"
  WHERE ("church_health_reports"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))) WITH CHECK (("report_id" IN ( SELECT "church_health_reports"."id"
   FROM "public"."church_health_reports"
  WHERE ("church_health_reports"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Members can update their org reports" ON "public"."church_health_reports" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Members can view findings for their org" ON "public"."church_health_findings" FOR SELECT TO "authenticated" USING (("report_id" IN ( SELECT "church_health_reports"."id"
   FROM "public"."church_health_reports"
  WHERE ("church_health_reports"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Members can view their org reports" ON "public"."church_health_reports" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Members log own prayers" ON "public"."prayer_request_prayers" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_user_in_organization"("auth"."uid"(), "organization_id")));



CREATE POLICY "Members remove own prayers" ON "public"."prayer_request_prayers" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Org admins can create mappings" ON "public"."pco_moment_mappings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "pco_moment_mappings"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins can create moment types" ON "public"."flow_moment_types" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "flow_moment_types"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins can delete engagement settings" ON "public"."org_engagement_settings" FOR DELETE TO "authenticated" USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Org admins can delete integrations" ON "public"."integrations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "integrations"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins can delete mappings" ON "public"."pco_moment_mappings" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "pco_moment_mappings"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins can delete marker settings" ON "public"."org_marker_settings" FOR DELETE TO "authenticated" USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Org admins can delete moment types" ON "public"."flow_moment_types" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "flow_moment_types"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins can insert engagement settings" ON "public"."org_engagement_settings" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Org admins can insert marker settings" ON "public"."org_marker_settings" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Org admins can manage campuses" ON "public"."campuses" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "campuses"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "campuses"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins can manage group campuses" ON "public"."group_campuses" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."groups" "g"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("g"."id" = "group_campuses"."group_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."groups" "g"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("g"."id" = "group_campuses"."group_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins can update engagement settings" ON "public"."org_engagement_settings" FOR UPDATE TO "authenticated" USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))) WITH CHECK (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Org admins can update mappings" ON "public"."pco_moment_mappings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "pco_moment_mappings"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins can update marker settings" ON "public"."org_marker_settings" FOR UPDATE TO "authenticated" USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))) WITH CHECK (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Org admins can update moment types" ON "public"."flow_moment_types" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "flow_moment_types"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins can view invitations" ON "public"."invitations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "invitations"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins manage group settings" ON "public"."group_settings" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org admins manage types" ON "public"."group_type_definitions" TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Org members can add org prayer requests" ON "public"."contact_prayer_requests" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NOT NULL) AND "public"."is_user_in_organization"("auth"."uid"(), "organization_id")));



CREATE POLICY "Org members can create imports" ON "public"."contact_imports" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_user_in_organization"("auth"."uid"(), "organization_id") AND ("created_by_user_id" = "auth"."uid"())));



CREATE POLICY "Org members can create life seasons" ON "public"."contact_life_seasons" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Org members can delete life seasons" ON "public"."contact_life_seasons" FOR DELETE TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Org members can delete shared or own custom signals" ON "public"."custom_signals" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "custom_signals"."organization_id") AND ("om"."user_id" = "auth"."uid"())))) AND (("visibility" = 'org'::"text") OR ("created_by" IS NULL) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "Org members can delete submissions" ON "public"."form_submissions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "form_submissions"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can insert custom signals" ON "public"."custom_signals" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "custom_signals"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can manage agent config" ON "public"."signal_agent_configs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "signal_agent_configs"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "signal_agent_configs"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can manage agent rules" ON "public"."signal_agent_rules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "signal_agent_rules"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "signal_agent_rules"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can manage custom signal rules" ON "public"."custom_signal_rules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."custom_signals" "cs"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "cs"."organization_id")))
  WHERE (("cs"."id" = "custom_signal_rules"."signal_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."custom_signals" "cs"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "cs"."organization_id")))
  WHERE (("cs"."id" = "custom_signal_rules"."signal_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can manage fields" ON "public"."form_fields" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."forms" "f"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "f"."organization_id")))
  WHERE (("f"."id" = "form_fields"."form_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."forms" "f"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "f"."organization_id")))
  WHERE (("f"."id" = "form_fields"."form_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can manage their forms" ON "public"."forms" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "forms"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "forms"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can read campuses" ON "public"."campuses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "campuses"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can read markers" ON "public"."contact_markers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "contact_markers"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can update life seasons" ON "public"."contact_life_seasons" FOR UPDATE TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id")) WITH CHECK ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Org members can update org prayer requests" ON "public"."contact_prayer_requests" FOR UPDATE TO "authenticated" USING ((("organization_id" IS NOT NULL) AND "public"."is_user_in_organization"("auth"."uid"(), "organization_id"))) WITH CHECK ((("organization_id" IS NOT NULL) AND "public"."is_user_in_organization"("auth"."uid"(), "organization_id")));



CREATE POLICY "Org members can update shared or own custom signals" ON "public"."custom_signals" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "custom_signals"."organization_id") AND ("om"."user_id" = "auth"."uid"())))) AND (("visibility" = 'org'::"text") OR ("created_by" IS NULL) OR ("created_by" = "auth"."uid"())))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "custom_signals"."organization_id") AND ("om"."user_id" = "auth"."uid"())))) AND (("visibility" = 'org'::"text") OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "Org members can update suggestions" ON "public"."signal_agent_suggestions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "signal_agent_suggestions"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "signal_agent_suggestions"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view agent config" ON "public"."signal_agent_configs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "signal_agent_configs"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view agent rules" ON "public"."signal_agent_rules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "signal_agent_rules"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view all types" ON "public"."group_type_definitions" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Org members can view custom signal matches" ON "public"."custom_signal_contacts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "custom_signal_contacts"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view custom signal rules" ON "public"."custom_signal_rules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."custom_signals" "cs"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "cs"."organization_id")))
  WHERE (("cs"."id" = "custom_signal_rules"."signal_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view engagement settings" ON "public"."org_engagement_settings" FOR SELECT TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Org members can view engagement snapshots" ON "public"."org_engagement_snapshots" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "org_engagement_snapshots"."organization_id") AND ("om"."user_id" = "auth"."uid"())))) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "Org members can view fields" ON "public"."form_fields" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."forms" "f"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "f"."organization_id")))
  WHERE (("f"."id" = "form_fields"."form_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view group campuses" ON "public"."group_campuses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."groups" "g"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("g"."id" = "group_campuses"."group_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view group settings" ON "public"."group_settings" FOR SELECT TO "authenticated" USING (("public"."is_user_in_organization"("auth"."uid"(), "organization_id") OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "Org members can view import rows" ON "public"."contact_import_rows" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."contact_imports" "ci"
  WHERE (("ci"."id" = "contact_import_rows"."import_id") AND "public"."is_user_in_organization"("auth"."uid"(), "ci"."organization_id")))));



CREATE POLICY "Org members can view imports" ON "public"."contact_imports" FOR SELECT TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Org members can view life seasons" ON "public"."contact_life_seasons" FOR SELECT TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Org members can view marker settings" ON "public"."org_marker_settings" FOR SELECT TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Org members can view org prayer requests" ON "public"."contact_prayer_requests" FOR SELECT TO "authenticated" USING ((("organization_id" IS NOT NULL) AND "public"."is_user_in_organization"("auth"."uid"(), "organization_id")));



CREATE POLICY "Org members can view pipeline contacts in their organization" ON "public"."pipeline_contacts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "pipeline_contacts"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view shared or own custom signals" ON "public"."custom_signals" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "custom_signals"."organization_id") AND ("om"."user_id" = "auth"."uid"())))) AND (("visibility" = 'org'::"text") OR ("created_by" IS NULL) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "Org members can view submissions" ON "public"."form_submissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "form_submissions"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view suggestions" ON "public"."signal_agent_suggestions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "signal_agent_suggestions"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view their forms" ON "public"."forms" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "forms"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view their org features" ON "public"."organization_features" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "organization_features"."organization_id") AND ("om"."user_id" = "auth"."uid"())))) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "Org members manage prayer stages" ON "public"."prayer_stages" TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id")) WITH CHECK ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Org members view prayers" ON "public"."prayer_request_prayers" FOR SELECT TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Org owners and admins can view all org pipelines" ON "public"."pipelines" FOR SELECT TO "authenticated" USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Organization admins and owners can create invitations" ON "public"."invitations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "invitations"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Organization admins and owners can delete invitations" ON "public"."invitations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "invitations"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Organization admins and owners can update invitations" ON "public"."invitations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "invitations"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Organization admins can create AI tool settings" ON "public"."ai_tool_settings" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Organization admins can delete AI tool settings" ON "public"."ai_tool_settings" FOR DELETE TO "authenticated" USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Organization admins can update AI tool settings" ON "public"."ai_tool_settings" FOR UPDATE TO "authenticated" USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))) WITH CHECK (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Organization admins can update their phone numbers" ON "public"."twilio_phone_numbers" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "twilio_phone_numbers"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Organization members can view AI tool audit history" ON "public"."ai_tool_audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Organization members can view AI tool settings" ON "public"."ai_tool_settings" FOR SELECT TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Organization members can view their phone numbers" ON "public"."twilio_phone_numbers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "twilio_phone_numbers"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organization owners and admins can manage members" ON "public"."organization_members" TO "authenticated" USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "Organization owners can update their organization" ON "public"."organizations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organizations"."id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'owner'::"text")))));



CREATE POLICY "Organization staff can read story CTA defaults" ON "public"."content_story_cta_defaults" FOR SELECT TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Public can read next steps of churches with published stories" ON "public"."content_story_cta_defaults" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."content_stories" "s"
  WHERE (("s"."organization_id" = "content_story_cta_defaults"."organization_id") AND ("s"."status" = 'published'::"text")))));



CREATE POLICY "Service role can create notifications" ON "public"."notifications" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can insert pco sync debug logs" ON "public"."pco_sync_debug_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can manage user logins" ON "public"."user_logins" USING (false) WITH CHECK (false);



CREATE POLICY "Service role can record login events" ON "public"."user_login_events" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role full access to engagement_scores" ON "public"."contact_engagement_scores" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to pco_checkins" ON "public"."pco_checkins" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role only" ON "public"."auth_verification_tokens" USING (false);



CREATE POLICY "Signed-in users can read marker definitions" ON "public"."marker_definitions" FOR SELECT TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "System admins can create impersonation sessions" ON "public"."impersonation_sessions" FOR INSERT WITH CHECK (("public"."is_system_admin"("auth"."uid"()) AND ("system_admin_user_id" = "auth"."uid"())));



CREATE POLICY "System admins can delete org features" ON "public"."organization_features" FOR DELETE TO "authenticated" USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can end their own impersonation sessions" ON "public"."impersonation_sessions" FOR UPDATE USING (("public"."is_system_admin"("auth"."uid"()) AND ("system_admin_user_id" = "auth"."uid"())));



CREATE POLICY "System admins can insert health history" ON "public"."organization_health_history" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can insert org features" ON "public"."organization_features" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can manage activity stats" ON "public"."organization_activity_stats" USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can manage all phone numbers" ON "public"."twilio_phone_numbers" USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can record login events" ON "public"."user_login_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can update all organizations" ON "public"."organizations" FOR UPDATE USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can update org features" ON "public"."organization_features" FOR UPDATE TO "authenticated" USING ("public"."is_system_admin"("auth"."uid"())) WITH CHECK ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view all activity stats" ON "public"."organization_activity_stats" FOR SELECT USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view all contact addresses" ON "public"."contact_addresses" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all contact demographics" ON "public"."contact_demographics" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all contact family members" ON "public"."contact_family_members" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all contact interactions" ON "public"."contact_interactions" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all contact notes" ON "public"."contact_notes" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all contact tags" ON "public"."contact_tags" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all contacts" ON "public"."contacts" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all events" ON "public"."church_online_events" FOR SELECT USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view all feedback" ON "public"."ai_suggestion_feedback" FOR SELECT USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view all impersonation sessions" ON "public"."impersonation_sessions" FOR SELECT USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view all login events" ON "public"."user_login_events" FOR SELECT TO "authenticated" USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view all notifications" ON "public"."notifications" FOR SELECT USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view all organization members" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all phone numbers" ON "public"."twilio_phone_numbers" FOR SELECT USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view all pipeline contacts" ON "public"."pipeline_contacts" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all pipeline stages" ON "public"."pipeline_stages" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all pipeline team members" ON "public"."pipeline_team_members" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all pipelines" ON "public"."pipelines" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all prayer requests" ON "public"."contact_prayer_requests" FOR SELECT TO "authenticated" USING (("public"."is_system_admin"("auth"."uid"()) AND (NOT "public"."is_currently_impersonating"("auth"."uid"()))));



CREATE POLICY "System admins can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view debug logs" ON "public"."pco_sync_debug_logs" FOR SELECT TO "authenticated" USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view health history" ON "public"."organization_health_history" FOR SELECT TO "authenticated" USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "System admins can view impersonation actions" ON "public"."impersonation_actions" FOR SELECT USING ("public"."is_system_admin"("auth"."uid"()));



CREATE POLICY "Update own or created tasks" ON "public"."tasks" FOR UPDATE TO "authenticated" USING (("public"."is_user_in_organization"("auth"."uid"(), "organization_id") AND (("assigned_to_user_id" = "auth"."uid"()) OR ("created_by_user_id" = "auth"."uid"())))) WITH CHECK ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Users can create calls in their organization" ON "public"."call_records" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "call_records"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create contact tags in their organization" ON "public"."contact_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_tags"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create contacts in their organization" ON "public"."contacts" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "contacts"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create feedback in their organization" ON "public"."ai_suggestion_feedback" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "ai_suggestion_feedback"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create groups in their organization" ON "public"."groups" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "groups"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create integrations in their organization" ON "public"."integrations" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "integrations"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create list mappings for their organization integrati" ON "public"."integration_list_mappings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."integrations" "i"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "i"."organization_id")))
  WHERE (("i"."id" = "integration_list_mappings"."integration_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create moments for contacts in their organization" ON "public"."flow_moments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "flow_moments"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create pipelines in their organization" ON "public"."pipelines" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "pipelines"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create their own conversations" ON "public"."chat_conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete contact tags in their organization" ON "public"."contact_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_tags"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete contacts in their organization" ON "public"."contacts" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "contacts"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete groups in their organization" ON "public"."groups" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "groups"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete list mappings for their organization integrati" ON "public"."integration_list_mappings" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."integrations" "i"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "i"."organization_id")))
  WHERE (("i"."id" = "integration_list_mappings"."integration_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete moments for contacts in their organization" ON "public"."flow_moments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "flow_moments"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own conversations" ON "public"."chat_conversations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own pco field preferences" ON "public"."user_pco_field_preferences" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert checkins in their org" ON "public"."pco_checkins" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "pco_checkins"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own pco field preferences" ON "public"."user_pco_field_preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage addresses for contacts in their organization" ON "public"."contact_addresses" USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_addresses"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage demographics for contacts in their organizatio" ON "public"."contact_demographics" USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_demographics"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage family members for contacts in their organizat" ON "public"."contact_family_members" USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_family_members"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage group attendance in their organization" ON "public"."group_attendance" USING ((EXISTS ( SELECT 1
   FROM (("public"."group_meetings" "gm"
     JOIN "public"."groups" "g" ON (("g"."id" = "gm"."group_id")))
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("gm"."id" = "group_attendance"."group_meeting_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage group meetings in their organization" ON "public"."group_meetings" USING ((EXISTS ( SELECT 1
   FROM ("public"."groups" "g"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("g"."id" = "group_meetings"."group_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage group members in their organization" ON "public"."group_members" USING ((EXISTS ( SELECT 1
   FROM ("public"."groups" "g"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("g"."id" = "group_members"."group_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage interactions for contacts in their organizatio" ON "public"."contact_interactions" USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_interactions"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage list metadata for their organization integrati" ON "public"."integration_list_metadata" USING ((EXISTS ( SELECT 1
   FROM ("public"."integrations" "i"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "i"."organization_id")))
  WHERE (("i"."id" = "integration_list_metadata"."integration_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage notes for contacts in their organization" ON "public"."contact_notes" USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_notes"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage own flow preferences" ON "public"."user_flow_preferences" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage prayer requests for contacts in their organiza" ON "public"."contact_prayer_requests" USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_prayer_requests"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage signup requests for groups in their organizati" ON "public"."group_signup_requests" USING ((EXISTS ( SELECT 1
   FROM ("public"."groups" "g"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("g"."id" = "group_signup_requests"."group_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can send SMS in their organization" ON "public"."sms_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "sms_messages"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update SMS in their organization" ON "public"."sms_messages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "sms_messages"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update calls in their organization" ON "public"."call_records" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "call_records"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update contact tags in their organization" ON "public"."contact_tags" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_tags"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update contacts in their organization" ON "public"."contacts" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "contacts"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update groups in their organization" ON "public"."groups" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "groups"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update list mappings for their organization integrati" ON "public"."integration_list_mappings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."integrations" "i"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "i"."organization_id")))
  WHERE (("i"."id" = "integration_list_mappings"."integration_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update moments for contacts in their organization" ON "public"."flow_moments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "flow_moments"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own conversations" ON "public"."chat_conversations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own integrations" ON "public"."integrations" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "integrations"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own pco field preferences" ON "public"."user_pco_field_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view SMS in their organization" ON "public"."sms_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "sms_messages"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view addresses for contacts in their organization" ON "public"."contact_addresses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_addresses"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view automations in their organization" ON "public"."church_online_flow_automations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "church_online_flow_automations"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view calls in their organization" ON "public"."call_records" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "call_records"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view checkins in their org" ON "public"."pco_checkins" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "pco_checkins"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view contact tags in their organization" ON "public"."contact_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_tags"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view contacts in their organization" ON "public"."contacts" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "contacts"."organization_id") AND ("om"."user_id" = "auth"."uid"())))) AND ((NOT COALESCE(( SELECT "organizations"."pco_enforce_user_permissions"
   FROM "public"."organizations"
  WHERE ("organizations"."id" = "contacts"."organization_id")), false)) OR (EXISTS ( SELECT 1
   FROM "public"."organization_members" "om2"
  WHERE (("om2"."organization_id" = "contacts"."organization_id") AND ("om2"."user_id" = "auth"."uid"()) AND ("om2"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))) OR ("pc_person_id" IS NULL) OR (NOT (EXISTS ( SELECT 1
   FROM "public"."user_pco_connections" "upc"
  WHERE (("upc"."user_id" = "auth"."uid"()) AND ("upc"."organization_id" = "contacts"."organization_id") AND ("upc"."status" = 'active'::"text"))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_pco_visible_people" "v"
  WHERE (("v"."user_id" = "auth"."uid"()) AND ("v"."organization_id" = "contacts"."organization_id") AND ("v"."pc_person_id" = "contacts"."pc_person_id")))))));



CREATE POLICY "Users can view demographics for contacts in their organization" ON "public"."contact_demographics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_demographics"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view engagement scores in their org" ON "public"."contact_engagement_scores" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "contact_engagement_scores"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view events in their organization" ON "public"."church_online_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "church_online_events"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view family members for contacts in their organizatio" ON "public"."contact_family_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_family_members"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view feedback in their organization" ON "public"."ai_suggestion_feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "ai_suggestion_feedback"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view group attendance in their organization" ON "public"."group_attendance" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."group_meetings" "gm"
     JOIN "public"."groups" "g" ON (("g"."id" = "gm"."group_id")))
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("gm"."id" = "group_attendance"."group_meeting_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view group meetings in their organization" ON "public"."group_meetings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."groups" "g"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("g"."id" = "group_meetings"."group_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view group members in their organization" ON "public"."group_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."groups" "g"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("g"."id" = "group_members"."group_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view groups in their organization" ON "public"."groups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "groups"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view integrations in their organization" ON "public"."integrations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "integrations"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view interactions for contacts in their organization" ON "public"."contact_interactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_interactions"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view list mappings for their organization integration" ON "public"."integration_list_mappings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."integrations" "i"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "i"."organization_id")))
  WHERE (("i"."id" = "integration_list_mappings"."integration_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view list metadata for their organization integration" ON "public"."integration_list_metadata" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."integrations" "i"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "i"."organization_id")))
  WHERE (("i"."id" = "integration_list_metadata"."integration_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view logs for their integrations" ON "public"."integration_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."integrations" "i"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "i"."organization_id")))
  WHERE (("i"."id" = "integration_logs"."integration_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view mappings in their organization" ON "public"."pco_moment_mappings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "pco_moment_mappings"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view members of their organizations" ON "public"."organization_members" FOR SELECT TO "authenticated" USING ("public"."is_user_in_organization"("auth"."uid"(), "organization_id"));



CREATE POLICY "Users can view moment types in their organization" ON "public"."flow_moment_types" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "flow_moment_types"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view moments for contacts in their organization" ON "public"."flow_moments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "flow_moments"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view notes for contacts in their organization" ON "public"."contact_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_notes"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view organizations they belong to" ON "public"."organizations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organizations"."id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own pco connection" ON "public"."user_pco_connections" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own visible-people rows" ON "public"."user_pco_visible_people" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view phone numbers in their organization" ON "public"."twilio_phone_numbers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "twilio_phone_numbers"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view pipelines they have access to" ON "public"."pipelines" FOR SELECT TO "authenticated" USING ("public"."is_flow_team_member"("auth"."uid"(), "id"));



CREATE POLICY "Users can view prayer requests for contacts in their organizati" ON "public"."contact_prayer_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."contacts" "c"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "c"."organization_id")))
  WHERE (("c"."id" = "contact_prayer_requests"."contact_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view profiles in their organization" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om1"
     JOIN "public"."organization_members" "om2" ON (("om1"."organization_id" = "om2"."organization_id")))
  WHERE (("om1"."user_id" = "auth"."uid"()) AND ("om2"."user_id" = "profiles"."user_id")))));



CREATE POLICY "Users can view queue items for their organization" ON "public"."pco_sync_queue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."pco_sync_jobs"
     JOIN "public"."organization_members" ON (("organization_members"."organization_id" = "pco_sync_jobs"."organization_id")))
  WHERE (("pco_sync_jobs"."id" = "pco_sync_queue"."sync_job_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view resources for their organization flows" ON "public"."pipeline_resources" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."pipelines" "p"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "p"."organization_id")))
  WHERE (("p"."id" = "pipeline_resources"."pipeline_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view signup requests for groups in their organization" ON "public"."group_signup_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."groups" "g"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "g"."organization_id")))
  WHERE (("g"."id" = "group_signup_requests"."group_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view stages of flows they have access to" ON "public"."pipeline_stages" FOR SELECT TO "authenticated" USING ("public"."is_flow_team_member"("auth"."uid"(), "pipeline_id"));



CREATE POLICY "Users can view sync jobs for their organization" ON "public"."pco_sync_jobs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "pco_sync_jobs"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view team members for flows they have access to" ON "public"."pipeline_team_members" FOR SELECT TO "authenticated" USING ("public"."is_flow_team_member"("auth"."uid"(), "pipeline_id"));



CREATE POLICY "Users can view their own AI action requests" ON "public"."ai_action_requests" FOR SELECT TO "authenticated" USING ((("requested_by_user_id" = "auth"."uid"()) OR ("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))));



CREATE POLICY "Users can view their own conversations" ON "public"."chat_conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own pco field preferences" ON "public"."user_pco_field_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own system roles" ON "public"."system_user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own verification tokens" ON "public"."email_verification_tokens" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own push subscriptions" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own push subscriptions" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own push subscriptions" ON "public"."push_subscriptions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own push subscriptions" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "View own or created tasks" ON "public"."tasks" FOR SELECT TO "authenticated" USING (("public"."is_user_in_organization"("auth"."uid"(), "organization_id") AND (("assigned_to_user_id" = "auth"."uid"()) OR ("created_by_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."ai_action_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_suggestion_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_tool_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_tool_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_verification_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_health_findings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_health_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_online_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_online_flow_automations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_demographics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_engagement_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_family_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_import_rows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_imports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_life_seasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_markers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_prayer_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_analyses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_analyses: org members view" ON "public"."content_analyses" FOR SELECT USING ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_analyses: org members write" ON "public"."content_analyses" USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL)) WITH CHECK (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL));



CREATE POLICY "content_analyses: public via video consent (anon)" ON "public"."content_analyses" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."content_videos" "v"
  WHERE (("v"."id" = "content_analyses"."video_id") AND ("v"."consent_level" = 'public_search'::"public"."content_consent_level")))));



CREATE POLICY "content_analyses: public via video consent (auth)" ON "public"."content_analyses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."content_videos" "v"
  WHERE (("v"."id" = "content_analyses"."video_id") AND ("v"."consent_level" = 'public_search'::"public"."content_consent_level")))));



ALTER TABLE "public"."content_chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_chat_messages: owner via session" ON "public"."content_chat_messages" USING ((EXISTS ( SELECT 1
   FROM "public"."content_chat_sessions" "s"
  WHERE (("s"."id" = "content_chat_messages"."session_id") AND ("s"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."content_chat_sessions" "s"
  WHERE (("s"."id" = "content_chat_messages"."session_id") AND ("s"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."content_chat_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_chat_sessions: owner only" ON "public"."content_chat_sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND ("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL)));



CREATE POLICY "content_chunks: org members can view" ON "public"."content_transcript_chunks" FOR SELECT USING ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_chunks: org members can write" ON "public"."content_transcript_chunks" USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL)) WITH CHECK (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL));



CREATE POLICY "content_chunks: public via video consent (anon)" ON "public"."content_transcript_chunks" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."content_videos" "v"
  WHERE (("v"."id" = "content_transcript_chunks"."video_id") AND ("v"."consent_level" = 'public_search'::"public"."content_consent_level")))));



CREATE POLICY "content_chunks: public via video consent (auth)" ON "public"."content_transcript_chunks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."content_videos" "v"
  WHERE (("v"."id" = "content_transcript_chunks"."video_id") AND ("v"."consent_level" = 'public_search'::"public"."content_consent_level")))));



ALTER TABLE "public"."content_stories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_stories admins can create" ON "public"."content_stories" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_stories admins can delete" ON "public"."content_stories" FOR DELETE TO "authenticated" USING ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_stories admins can update" ON "public"."content_stories" FOR UPDATE TO "authenticated" USING ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"()))) WITH CHECK ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_stories authenticated can view" ON "public"."content_stories" FOR SELECT TO "authenticated" USING ((("status" = 'published'::"text") OR ("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_stories public can view published" ON "public"."content_stories" FOR SELECT TO "anon" USING (("status" = 'published'::"text"));



ALTER TABLE "public"."content_story_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_story_blocks admins can create" ON "public"."content_story_blocks" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_story_blocks admins can delete" ON "public"."content_story_blocks" FOR DELETE TO "authenticated" USING ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_story_blocks admins can update" ON "public"."content_story_blocks" FOR UPDATE TO "authenticated" USING ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"()))) WITH CHECK ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_story_blocks authenticated can view" ON "public"."content_story_blocks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."content_stories" "s"
  WHERE (("s"."id" = "content_story_blocks"."story_id") AND (("s"."status" = 'published'::"text") OR ("public"."get_user_organization_role"("auth"."uid"(), "s"."organization_id") IS NOT NULL) OR "public"."is_system_admin"("auth"."uid"()))))));



CREATE POLICY "content_story_blocks public can view published" ON "public"."content_story_blocks" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."content_stories" "s"
  WHERE (("s"."id" = "content_story_blocks"."story_id") AND ("s"."status" = 'published'::"text")))));



ALTER TABLE "public"."content_story_cta_defaults" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_story_cta_defaults admins can create" ON "public"."content_story_cta_defaults" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_story_cta_defaults admins can delete" ON "public"."content_story_cta_defaults" FOR DELETE TO "authenticated" USING ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_story_cta_defaults admins can update" ON "public"."content_story_cta_defaults" FOR UPDATE TO "authenticated" USING ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"()))) WITH CHECK ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"())));



ALTER TABLE "public"."content_transcript_chunks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_videos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_videos: org admins can delete" ON "public"."content_videos" FOR DELETE USING ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_videos: org members can insert" ON "public"."content_videos" FOR INSERT WITH CHECK (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL));



CREATE POLICY "content_videos: org members can update" ON "public"."content_videos" FOR UPDATE USING (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL)) WITH CHECK (("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL));



CREATE POLICY "content_videos: org members can view" ON "public"."content_videos" FOR SELECT USING ((("public"."get_user_organization_role"("auth"."uid"(), "organization_id") IS NOT NULL) OR "public"."is_system_admin"("auth"."uid"())));



CREATE POLICY "content_videos: public_search readable by anon" ON "public"."content_videos" FOR SELECT TO "anon" USING (("consent_level" = 'public_search'::"public"."content_consent_level"));



CREATE POLICY "content_videos: public_search readable by authenticated" ON "public"."content_videos" FOR SELECT TO "authenticated" USING (("consent_level" = 'public_search'::"public"."content_consent_level"));



ALTER TABLE "public"."custom_signal_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_signal_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_signals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_verification_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flow_moment_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flow_moments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_campuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_meetings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_signup_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_type_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."impersonation_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."impersonation_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_list_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_list_metadata" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marker_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_engagement_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_engagement_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_marker_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_activity_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_health_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pco_checkins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pco_moment_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pco_oauth_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pco_sync_debug_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pco_sync_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pco_sync_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipeline_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipeline_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipeline_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipeline_team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipelines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prayer_request_prayers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prayer_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signal_agent_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signal_agent_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."signal_agent_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."twilio_phone_numbers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_flow_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_login_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_logins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_pco_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_pco_field_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_pco_visible_people" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."add_pipeline_creator_as_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_pipeline_creator_as_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_pipeline_creator_as_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_delete_organization"("_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_delete_organization"("_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_organization"("_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_org_members_activity"("p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_org_members_activity"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_org_members_activity"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_org_members_activity"("p_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."auto_clear_demo_on_real_contact"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auto_clear_demo_on_real_contact"() TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_engagement_scores"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_engagement_scores"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_engagement_scores"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_health_score_v2"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_health_score_v2"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_health_score_v2"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_organization_health_score"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_organization_health_score"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_organization_health_score"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_user_see_contact"("_user" "uuid", "_contact_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_user_see_contact"("_user" "uuid", "_contact_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_user_see_contact"("_user" "uuid", "_contact_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_reserved_org_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_reserved_org_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_reserved_org_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."chr_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."chr_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."chr_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_pipeline_team_on_org_leave"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_pipeline_team_on_org_leave"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_pipeline_team_on_org_leave"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_stage_assignees"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_stage_assignees"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_stage_assignees"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."clear_demo_data_for_org"("_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clear_demo_data_for_org"("_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."compute_engagement_rows"("p_org_id" "uuid", "p_settings" "jsonb", "p_sample_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compute_engagement_rows"("p_org_id" "uuid", "p_settings" "jsonb", "p_sample_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_engagement_rows"("p_org_id" "uuid", "p_settings" "jsonb", "p_sample_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."content_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."content_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."content_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cpr_set_org"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cpr_set_org"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_assignment_notification"("_user_id" "uuid", "_organization_id" "uuid", "_type" "text", "_title" "text", "_message" "text", "_contact_id" "uuid", "_pipeline_id" "uuid", "_interaction_id" "uuid", "_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_assignment_notification"("_user_id" "uuid", "_organization_id" "uuid", "_type" "text", "_title" "text", "_message" "text", "_contact_id" "uuid", "_pipeline_id" "uuid", "_interaction_id" "uuid", "_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_assignment_notification"("_user_id" "uuid", "_organization_id" "uuid", "_type" "text", "_title" "text", "_message" "text", "_contact_id" "uuid", "_pipeline_id" "uuid", "_interaction_id" "uuid", "_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_pipelines"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_pipelines"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_pipelines"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_personal_flow_for_user"("p_user_id" "uuid", "p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_personal_flow_for_user"("p_user_id" "uuid", "p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_personal_flow_for_user"("p_user_id" "uuid", "p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_org_tag"("p_org_id" "uuid", "p_tag" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_org_tag"("p_org_id" "uuid", "p_tag" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_org_tag"("p_org_id" "uuid", "p_tag" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."end_impersonation_session"("_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."end_impersonation_session"("_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_impersonation_session"("_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."end_life_season_on_attendance"() TO "anon";
GRANT ALL ON FUNCTION "public"."end_life_season_on_attendance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_life_season_on_attendance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."engagement_settings_for_org"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."engagement_settings_for_org"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enroll_admin_on_org_pipelines"() TO "anon";
GRANT ALL ON FUNCTION "public"."enroll_admin_on_org_pipelines"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enroll_admin_on_org_pipelines"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_contact_signal"("p_contact_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_contact_signal"("p_contact_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_contact_signal"("p_contact_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_engagement_snapshot"("p_org_id" "uuid", "p_as_of" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_engagement_snapshot"("p_org_id" "uuid", "p_as_of" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_engagement_snapshot"("p_org_id" "uuid", "p_as_of" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_engagement_snapshot_series"("p_org_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_engagement_snapshot_series"("p_org_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_engagement_snapshot_series"("p_org_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_flow_role"("_user_id" "uuid", "_pipeline_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_flow_role"("_user_id" "uuid", "_pipeline_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_flow_role"("_user_id" "uuid", "_pipeline_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_impersonation_org_id"("_admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_impersonation_org_id"("_admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_impersonation_org_id"("_admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_marker_catalog"("p_org_id" "uuid", "p_campus_id" "uuid", "p_assigned_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_marker_catalog"("p_org_id" "uuid", "p_campus_id" "uuid", "p_assigned_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_marker_catalog"("p_org_id" "uuid", "p_campus_id" "uuid", "p_assigned_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_checkin_counts"("p_org_id" "uuid", "p_week_start" timestamp with time zone, "p_month_start" timestamp with time zone, "p_campus_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_checkin_counts"("p_org_id" "uuid", "p_week_start" timestamp with time zone, "p_month_start" timestamp with time zone, "p_campus_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_checkin_counts"("p_org_id" "uuid", "p_week_start" timestamp with time zone, "p_month_start" timestamp with time zone, "p_campus_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_engagement_distribution"("p_org_id" "uuid", "p_campus_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_engagement_distribution"("p_org_id" "uuid", "p_campus_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_engagement_distribution"("p_org_id" "uuid", "p_campus_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_tag_stats"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_tag_stats"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_tag_stats"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_team_activity_stats"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_team_activity_stats"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_team_activity_stats"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organizations_health_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_organizations_health_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organizations_health_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_content_video"("p_slug" "text", "p_video_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_content_video"("p_slug" "text", "p_video_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_content_video"("p_slug" "text", "p_video_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_group_settings"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_group_settings"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_group_settings"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_group_types"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_group_types"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_group_types"("p_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_public_organization"("p_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_organization"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_organization"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_organization"("p_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_public_story"("p_slug" "text", "p_content_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_story"("p_slug" "text", "p_content_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_story"("p_slug" "text", "p_content_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_story"("p_slug" "text", "p_content_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_organization_role"("_user_id" "uuid", "_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organization_role"("_user_id" "uuid", "_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organization_role"("_user_id" "uuid", "_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_system_role"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_system_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_system_role"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ai_stat"("org_id" "uuid", "stat_column" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ai_stat"("org_id" "uuid", "stat_column" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ai_stat"("org_id" "uuid", "stat_column" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_currently_impersonating"("_admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_currently_impersonating"("_admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_currently_impersonating"("_admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_flow_team_member"("_user_id" "uuid", "_pipeline_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_flow_team_member"("_user_id" "uuid", "_pipeline_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_flow_team_member"("_user_id" "uuid", "_pipeline_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_system_admin"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_system_admin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_system_admin"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_in_organization"("_user_id" "uuid", "_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_in_organization"("_user_id" "uuid", "_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_in_organization"("_user_id" "uuid", "_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_impersonation_action"("_session_id" "uuid", "_action_type" "text", "_action_description" "text", "_page_url" "text", "_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_impersonation_action"("_session_id" "uuid", "_action_type" "text", "_action_description" "text", "_page_url" "text", "_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_impersonation_action"("_session_id" "uuid", "_action_type" "text", "_action_description" "text", "_page_url" "text", "_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_pipeline_contact_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_pipeline_contact_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_pipeline_contact_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."marker_param"("p_org_id" "uuid", "p_key" "text", "p_param" "text", "p_default" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."marker_param"("p_org_id" "uuid", "p_key" "text", "p_param" "text", "p_default" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."marker_param"("p_org_id" "uuid", "p_key" "text", "p_param" "text", "p_default" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_content_chunks"("query_embedding" "public"."vector", "p_org_id" "uuid", "p_video_id" "uuid", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_content_chunks"("query_embedding" "public"."vector", "p_org_id" "uuid", "p_video_id" "uuid", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_content_chunks"("query_embedding" "public"."vector", "p_org_id" "uuid", "p_video_id" "uuid", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_content_chunks_public"("query_embedding" "public"."vector", "p_org_slug" "text", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_content_chunks_public"("query_embedding" "public"."vector", "p_org_slug" "text", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_content_chunks_public"("query_embedding" "public"."vector", "p_org_slug" "text", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_org_tags"("p_org_id" "uuid", "p_source_tags" "text"[], "p_target_tag" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."merge_org_tags"("p_org_id" "uuid", "p_source_tags" "text"[], "p_target_tag" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_org_tags"("p_org_id" "uuid", "p_source_tags" "text"[], "p_target_tag" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_push_on_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_push_on_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_push_on_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."preview_engagement_settings"("p_org_id" "uuid", "p_settings" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."preview_engagement_settings"("p_org_id" "uuid", "p_settings" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."preview_engagement_settings"("p_org_id" "uuid", "p_settings" "jsonb", "p_sample_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preview_engagement_settings"("p_org_id" "uuid", "p_settings" "jsonb", "p_sample_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."preview_engagement_settings"("p_org_id" "uuid", "p_settings" "jsonb", "p_sample_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_contact_markers"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_contact_markers"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_contact_markers"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_contact_markers_core"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_contact_markers_core"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_contact_markers_core"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remind_open_life_seasons"() TO "anon";
GRANT ALL ON FUNCTION "public"."remind_open_life_seasons"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."remind_open_life_seasons"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rename_org_tag"("p_org_id" "uuid", "p_old_tag" "text", "p_new_tag" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rename_org_tag"("p_org_id" "uuid", "p_old_tag" "text", "p_new_tag" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rename_org_tag"("p_org_id" "uuid", "p_old_tag" "text", "p_new_tag" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_user_pco_visible_people"("_user" "uuid", "_org" "uuid", "_ids" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_user_pco_visible_people"("_user" "uuid", "_org" "uuid", "_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."replace_user_pco_visible_people"("_user" "uuid", "_org" "uuid", "_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_user_pco_visible_people"("_user" "uuid", "_org" "uuid", "_ids" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_visible_contacts"("_organization_id" "uuid", "_search_term" "text", "_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_visible_contacts"("_organization_id" "uuid", "_search_term" "text", "_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_visible_contacts"("_organization_id" "uuid", "_search_term" "text", "_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_moment_types"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_moment_types"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_moment_types"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_org_features"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_org_features"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_org_features"() TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_group_config_for_org"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_group_config_for_org"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_group_config_for_org"() TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_engagement_distribution_all"() TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_engagement_distribution_all"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_engagement_distribution_all"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."start_impersonation_session"("_target_org_id" "uuid", "_reason" "text", "_ip_address" "text", "_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."start_impersonation_session"("_target_org_id" "uuid", "_reason" "text", "_ip_address" "text", "_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_impersonation_session"("_target_org_id" "uuid", "_reason" "text", "_ip_address" "text", "_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."start_impersonation_session"("_admin_user_id" "uuid", "_target_org_id" "uuid", "_reason" "text", "_ip_address" "text", "_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."start_impersonation_session"("_admin_user_id" "uuid", "_target_org_id" "uuid", "_reason" "text", "_ip_address" "text", "_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_impersonation_session"("_admin_user_id" "uuid", "_target_org_id" "uuid", "_reason" "text", "_ip_address" "text", "_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."track_pco_sync"("p_org_id" "uuid", "p_sync_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."track_pco_sync"("p_org_id" "uuid", "p_sync_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_pco_sync"("p_org_id" "uuid", "p_sync_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."track_user_login"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_user_login"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_user_login"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_user_login"("p_user_id" "uuid", "p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."track_user_login"("p_user_id" "uuid", "p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_user_login"("p_user_id" "uuid", "p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_member_attendance_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_member_attendance_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_member_attendance_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_onboarding_on_integration_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_onboarding_on_integration_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_onboarding_on_integration_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_onboarding_on_list_mapping"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_onboarding_on_list_mapping"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_onboarding_on_list_mapping"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pipeline_contact_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pipeline_contact_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pipeline_contact_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pipeline_contacts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pipeline_contacts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pipeline_contacts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stage_entered_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stage_entered_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stage_entered_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sync_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sync_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sync_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_unique_active_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_unique_active_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_unique_active_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."user_can_manage_group_image"("_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_can_manage_group_image"("_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_manage_group_image"("_path" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_active_pco_connection"("_user" "uuid", "_org" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_active_pco_connection"("_user" "uuid", "_org" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_active_pco_connection"("_user" "uuid", "_org" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_stage_assignee"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_stage_assignee"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_stage_assignee"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";















GRANT ALL ON TABLE "public"."ai_action_requests" TO "anon";
GRANT ALL ON TABLE "public"."ai_action_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_action_requests" TO "service_role";



GRANT ALL ON TABLE "public"."ai_suggestion_feedback" TO "anon";
GRANT ALL ON TABLE "public"."ai_suggestion_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_suggestion_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."ai_tool_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."ai_tool_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_tool_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_tool_settings" TO "anon";
GRANT ALL ON TABLE "public"."ai_tool_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_tool_settings" TO "service_role";



GRANT ALL ON TABLE "public"."auth_verification_tokens" TO "anon";
GRANT ALL ON TABLE "public"."auth_verification_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_verification_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."call_records" TO "anon";
GRANT ALL ON TABLE "public"."call_records" TO "authenticated";
GRANT ALL ON TABLE "public"."call_records" TO "service_role";



GRANT ALL ON TABLE "public"."campuses" TO "anon";
GRANT ALL ON TABLE "public"."campuses" TO "authenticated";
GRANT ALL ON TABLE "public"."campuses" TO "service_role";



GRANT ALL ON TABLE "public"."chat_conversations" TO "anon";
GRANT ALL ON TABLE "public"."chat_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."church_health_findings" TO "anon";
GRANT ALL ON TABLE "public"."church_health_findings" TO "authenticated";
GRANT ALL ON TABLE "public"."church_health_findings" TO "service_role";



GRANT ALL ON TABLE "public"."church_health_reports" TO "anon";
GRANT ALL ON TABLE "public"."church_health_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."church_health_reports" TO "service_role";



GRANT ALL ON TABLE "public"."church_online_events" TO "anon";
GRANT ALL ON TABLE "public"."church_online_events" TO "authenticated";
GRANT ALL ON TABLE "public"."church_online_events" TO "service_role";



GRANT ALL ON TABLE "public"."church_online_flow_automations" TO "anon";
GRANT ALL ON TABLE "public"."church_online_flow_automations" TO "authenticated";
GRANT ALL ON TABLE "public"."church_online_flow_automations" TO "service_role";



GRANT ALL ON TABLE "public"."contact_addresses" TO "anon";
GRANT ALL ON TABLE "public"."contact_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."contact_demographics" TO "anon";
GRANT ALL ON TABLE "public"."contact_demographics" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_demographics" TO "service_role";



GRANT ALL ON TABLE "public"."contact_engagement_scores" TO "anon";
GRANT ALL ON TABLE "public"."contact_engagement_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_engagement_scores" TO "service_role";



GRANT ALL ON TABLE "public"."contact_family_members" TO "anon";
GRANT ALL ON TABLE "public"."contact_family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_family_members" TO "service_role";



GRANT ALL ON TABLE "public"."contact_import_rows" TO "anon";
GRANT ALL ON TABLE "public"."contact_import_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_import_rows" TO "service_role";



GRANT ALL ON TABLE "public"."contact_imports" TO "anon";
GRANT ALL ON TABLE "public"."contact_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_imports" TO "service_role";



GRANT ALL ON TABLE "public"."contact_interactions" TO "anon";
GRANT ALL ON TABLE "public"."contact_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."contact_life_seasons" TO "anon";
GRANT ALL ON TABLE "public"."contact_life_seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_life_seasons" TO "service_role";



GRANT ALL ON TABLE "public"."contact_markers" TO "anon";
GRANT ALL ON TABLE "public"."contact_markers" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_markers" TO "service_role";



GRANT ALL ON TABLE "public"."contact_notes" TO "anon";
GRANT ALL ON TABLE "public"."contact_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_notes" TO "service_role";



GRANT ALL ON TABLE "public"."contact_prayer_requests" TO "anon";
GRANT ALL ON TABLE "public"."contact_prayer_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_prayer_requests" TO "service_role";



GRANT ALL ON TABLE "public"."contact_tags" TO "anon";
GRANT ALL ON TABLE "public"."contact_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_tags" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."content_analyses" TO "anon";
GRANT ALL ON TABLE "public"."content_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."content_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."content_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."content_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."content_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."content_chat_sessions" TO "anon";
GRANT ALL ON TABLE "public"."content_chat_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."content_chat_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."content_stories" TO "anon";
GRANT ALL ON TABLE "public"."content_stories" TO "authenticated";
GRANT ALL ON TABLE "public"."content_stories" TO "service_role";



GRANT ALL ON TABLE "public"."content_story_blocks" TO "anon";
GRANT ALL ON TABLE "public"."content_story_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."content_story_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."content_story_cta_defaults" TO "authenticated";
GRANT ALL ON TABLE "public"."content_story_cta_defaults" TO "service_role";
GRANT SELECT ON TABLE "public"."content_story_cta_defaults" TO "anon";



GRANT ALL ON TABLE "public"."content_transcript_chunks" TO "anon";
GRANT ALL ON TABLE "public"."content_transcript_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."content_transcript_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."content_videos" TO "anon";
GRANT ALL ON TABLE "public"."content_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."content_videos" TO "service_role";



GRANT ALL ON TABLE "public"."custom_signal_contacts" TO "anon";
GRANT ALL ON TABLE "public"."custom_signal_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_signal_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."custom_signal_rules" TO "anon";
GRANT ALL ON TABLE "public"."custom_signal_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_signal_rules" TO "service_role";



GRANT ALL ON TABLE "public"."custom_signals" TO "anon";
GRANT ALL ON TABLE "public"."custom_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_signals" TO "service_role";



GRANT ALL ON TABLE "public"."email_verification_tokens" TO "anon";
GRANT ALL ON TABLE "public"."email_verification_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."email_verification_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."flow_moment_types" TO "anon";
GRANT ALL ON TABLE "public"."flow_moment_types" TO "authenticated";
GRANT ALL ON TABLE "public"."flow_moment_types" TO "service_role";



GRANT ALL ON TABLE "public"."flow_moments" TO "anon";
GRANT ALL ON TABLE "public"."flow_moments" TO "authenticated";
GRANT ALL ON TABLE "public"."flow_moments" TO "service_role";



GRANT ALL ON TABLE "public"."form_fields" TO "anon";
GRANT ALL ON TABLE "public"."form_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."form_fields" TO "service_role";



GRANT ALL ON TABLE "public"."form_submissions" TO "anon";
GRANT ALL ON TABLE "public"."form_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."form_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."forms" TO "anon";
GRANT ALL ON TABLE "public"."forms" TO "authenticated";
GRANT ALL ON TABLE "public"."forms" TO "service_role";



GRANT ALL ON TABLE "public"."group_attendance" TO "anon";
GRANT ALL ON TABLE "public"."group_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."group_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."group_campuses" TO "anon";
GRANT ALL ON TABLE "public"."group_campuses" TO "authenticated";
GRANT ALL ON TABLE "public"."group_campuses" TO "service_role";



GRANT ALL ON TABLE "public"."group_meetings" TO "anon";
GRANT ALL ON TABLE "public"."group_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."group_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT ALL ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON TABLE "public"."group_settings" TO "anon";
GRANT ALL ON TABLE "public"."group_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."group_settings" TO "service_role";



GRANT ALL ON TABLE "public"."group_signup_requests" TO "anon";
GRANT ALL ON TABLE "public"."group_signup_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."group_signup_requests" TO "service_role";



GRANT ALL ON TABLE "public"."group_type_definitions" TO "anon";
GRANT ALL ON TABLE "public"."group_type_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."group_type_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."impersonation_actions" TO "anon";
GRANT ALL ON TABLE "public"."impersonation_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."impersonation_actions" TO "service_role";



GRANT ALL ON TABLE "public"."impersonation_sessions" TO "anon";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."impersonation_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."impersonation_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."impersonation_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."integration_list_mappings" TO "anon";
GRANT ALL ON TABLE "public"."integration_list_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_list_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."integration_list_metadata" TO "anon";
GRANT ALL ON TABLE "public"."integration_list_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_list_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."integration_logs" TO "anon";
GRANT ALL ON TABLE "public"."integration_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_logs" TO "service_role";



GRANT ALL ON TABLE "public"."integrations" TO "anon";
GRANT ALL ON TABLE "public"."integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations" TO "service_role";



GRANT ALL ON TABLE "public"."integrations_public" TO "anon";
GRANT ALL ON TABLE "public"."integrations_public" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations_public" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."marker_definitions" TO "anon";
GRANT ALL ON TABLE "public"."marker_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."marker_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."org_engagement_settings" TO "anon";
GRANT ALL ON TABLE "public"."org_engagement_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."org_engagement_settings" TO "service_role";



GRANT ALL ON TABLE "public"."org_engagement_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."org_engagement_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."org_engagement_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."org_marker_settings" TO "anon";
GRANT ALL ON TABLE "public"."org_marker_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."org_marker_settings" TO "service_role";



GRANT ALL ON TABLE "public"."organization_activity_stats" TO "anon";
GRANT ALL ON TABLE "public"."organization_activity_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_activity_stats" TO "service_role";



GRANT ALL ON TABLE "public"."organization_features" TO "anon";
GRANT ALL ON TABLE "public"."organization_features" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_features" TO "service_role";



GRANT ALL ON TABLE "public"."organization_health_history" TO "anon";
GRANT ALL ON TABLE "public"."organization_health_history" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_health_history" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."pipelines" TO "anon";
GRANT ALL ON TABLE "public"."pipelines" TO "authenticated";
GRANT ALL ON TABLE "public"."pipelines" TO "service_role";



GRANT ALL ON TABLE "public"."organization_health_view" TO "anon";
GRANT ALL ON TABLE "public"."organization_health_view" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_health_view" TO "service_role";



GRANT ALL ON TABLE "public"."pco_checkins" TO "anon";
GRANT ALL ON TABLE "public"."pco_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."pco_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."pco_moment_mappings" TO "anon";
GRANT ALL ON TABLE "public"."pco_moment_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."pco_moment_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."pco_oauth_states" TO "anon";
GRANT ALL ON TABLE "public"."pco_oauth_states" TO "authenticated";
GRANT ALL ON TABLE "public"."pco_oauth_states" TO "service_role";



GRANT ALL ON TABLE "public"."pco_sync_debug_logs" TO "anon";
GRANT ALL ON TABLE "public"."pco_sync_debug_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."pco_sync_debug_logs" TO "service_role";



GRANT ALL ON TABLE "public"."pco_sync_jobs" TO "anon";
GRANT ALL ON TABLE "public"."pco_sync_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."pco_sync_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."pco_sync_queue" TO "anon";
GRANT ALL ON TABLE "public"."pco_sync_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."pco_sync_queue" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_contacts" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_resources" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_resources" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_resources" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_stages" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_stages" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_team_members" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_team_members" TO "service_role";



GRANT ALL ON TABLE "public"."prayer_request_prayers" TO "anon";
GRANT ALL ON TABLE "public"."prayer_request_prayers" TO "authenticated";
GRANT ALL ON TABLE "public"."prayer_request_prayers" TO "service_role";



GRANT ALL ON TABLE "public"."prayer_stages" TO "anon";
GRANT ALL ON TABLE "public"."prayer_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."prayer_stages" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."signal_agent_configs" TO "anon";
GRANT ALL ON TABLE "public"."signal_agent_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."signal_agent_configs" TO "service_role";



GRANT ALL ON TABLE "public"."signal_agent_rules" TO "anon";
GRANT ALL ON TABLE "public"."signal_agent_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."signal_agent_rules" TO "service_role";



GRANT ALL ON TABLE "public"."signal_agent_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."signal_agent_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."signal_agent_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."sms_messages" TO "anon";
GRANT ALL ON TABLE "public"."sms_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_messages" TO "service_role";



GRANT ALL ON TABLE "public"."system_user_roles" TO "anon";
GRANT ALL ON TABLE "public"."system_user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."system_user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."twilio_phone_numbers" TO "anon";
GRANT ALL ON TABLE "public"."twilio_phone_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."twilio_phone_numbers" TO "service_role";



GRANT ALL ON TABLE "public"."user_flow_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_flow_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_flow_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_login_events" TO "anon";
GRANT ALL ON TABLE "public"."user_login_events" TO "authenticated";
GRANT ALL ON TABLE "public"."user_login_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_logins" TO "anon";
GRANT ALL ON TABLE "public"."user_logins" TO "authenticated";
GRANT ALL ON TABLE "public"."user_logins" TO "service_role";



GRANT ALL ON TABLE "public"."user_pco_connections" TO "anon";
GRANT ALL ON TABLE "public"."user_pco_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pco_connections" TO "service_role";



GRANT ALL ON TABLE "public"."user_pco_connections_public" TO "anon";
GRANT ALL ON TABLE "public"."user_pco_connections_public" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pco_connections_public" TO "service_role";



GRANT ALL ON TABLE "public"."user_pco_field_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_pco_field_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pco_field_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_pco_visible_people" TO "anon";
GRANT ALL ON TABLE "public"."user_pco_visible_people" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pco_visible_people" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
