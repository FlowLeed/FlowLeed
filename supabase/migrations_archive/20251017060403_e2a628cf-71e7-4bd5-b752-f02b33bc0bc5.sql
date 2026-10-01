-- Add onboarding_progress field to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_progress jsonb DEFAULT '{}'::jsonb;

-- Add index on health_score for efficient sorting
CREATE INDEX IF NOT EXISTS idx_organizations_health_score ON organizations(health_score DESC);

-- Create organization_health_history table
CREATE TABLE IF NOT EXISTS organization_health_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  calculated_at timestamp with time zone DEFAULT now() NOT NULL,
  total_score integer NOT NULL,
  score_breakdown jsonb NOT NULL,
  metrics jsonb NOT NULL,
  previous_score integer,
  score_change integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on health history
ALTER TABLE organization_health_history ENABLE ROW LEVEL SECURITY;

-- System admins can view all health history
CREATE POLICY "System admins can view health history"
ON organization_health_history FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

-- System admins can insert health history
CREATE POLICY "System admins can insert health history"
ON organization_health_history FOR INSERT
TO authenticated
WITH CHECK (is_system_admin(auth.uid()));

-- Create comprehensive health score calculation function
CREATE OR REPLACE FUNCTION calculate_health_score_v2(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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