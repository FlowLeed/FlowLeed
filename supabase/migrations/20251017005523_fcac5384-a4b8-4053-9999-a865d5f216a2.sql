-- Phase 1: Database Foundation for Admin Dashboard + Impersonation System

-- 1.1 Create System Roles Infrastructure
CREATE TYPE public.system_role AS ENUM ('super_admin', 'support_admin', 'viewer');

CREATE TABLE public.system_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.system_role NOT NULL,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    UNIQUE (user_id, role)
);

-- Security definer function to check system admin status
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'support_admin')
  )
$$;

-- Enable RLS on system_user_roles
ALTER TABLE public.system_user_roles ENABLE ROW LEVEL SECURITY;

-- Only system admins can view system roles
CREATE POLICY "System admins can view all system roles"
ON public.system_user_roles FOR SELECT
USING (public.is_system_admin(auth.uid()));

-- Only super admins can manage system roles
CREATE POLICY "Super admins can manage system roles"
ON public.system_user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.system_user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- 1.2 Extend Organizations Table for SaaS Metrics
ALTER TABLE public.organizations ADD COLUMN
  plan_tier TEXT DEFAULT 'trial' CHECK (plan_tier IN ('trial', 'starter', 'growth', 'enterprise', 'custom')),
ADD COLUMN plan_price DECIMAL(10,2),
ADD COLUMN subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'suspended')),
ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN billing_email TEXT,
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN next_billing_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN total_revenue DECIMAL(10,2) DEFAULT 0,
ADD COLUMN health_score INTEGER DEFAULT 0 CHECK (health_score >= 0 AND health_score <= 100),
ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN onboarding_step TEXT DEFAULT 'signup',
ADD COLUMN primary_contact_name TEXT,
ADD COLUMN primary_contact_email TEXT,
ADD COLUMN primary_contact_phone TEXT,
ADD COLUMN notes TEXT,
ADD COLUMN tags TEXT[];

-- 1.3 Organization Activity Stats Table
CREATE TABLE public.organization_activity_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Login metrics
    total_logins INTEGER DEFAULT 0,
    unique_active_users INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Feature usage
    flows_count INTEGER DEFAULT 0,
    contacts_count INTEGER DEFAULT 0,
    interactions_count INTEGER DEFAULT 0,
    notes_created INTEGER DEFAULT 0,
    
    -- Integration metrics
    last_pco_sync TIMESTAMP WITH TIME ZONE,
    pco_sync_count INTEGER DEFAULT 0,
    
    -- AI usage
    ai_suggestions_used INTEGER DEFAULT 0,
    ai_messages_generated INTEGER DEFAULT 0,
    ai_descriptions_generated INTEGER DEFAULT 0,
    total_ai_uses INTEGER DEFAULT 0,
    
    -- Daily activity score
    daily_activity_score INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    UNIQUE (organization_id, date)
);

CREATE INDEX idx_org_activity_org_date ON public.organization_activity_stats(organization_id, date DESC);
CREATE INDEX idx_org_activity_date ON public.organization_activity_stats(date DESC);

ALTER TABLE public.organization_activity_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view all activity stats"
ON public.organization_activity_stats FOR SELECT
USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage activity stats"
ON public.organization_activity_stats FOR ALL
USING (public.is_system_admin(auth.uid()));

-- 1.4 Impersonation Tracking Tables
CREATE TABLE public.impersonation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who is impersonating
    system_admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Who they're impersonating
    target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    target_organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    
    -- Session tracking
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    -- Audit information (REQUIRED)
    reason TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    
    -- Session metadata
    actions_performed JSONB DEFAULT '[]'::jsonb,
    pages_visited TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_impersonation_admin_user ON public.impersonation_sessions(system_admin_user_id);
CREATE INDEX idx_impersonation_target_org ON public.impersonation_sessions(target_organization_id);
CREATE INDEX idx_impersonation_active ON public.impersonation_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_impersonation_started ON public.impersonation_sessions(started_at DESC);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view all impersonation sessions"
ON public.impersonation_sessions FOR SELECT
USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can create impersonation sessions"
ON public.impersonation_sessions FOR INSERT
WITH CHECK (
    public.is_system_admin(auth.uid()) AND
    system_admin_user_id = auth.uid()
);

CREATE POLICY "System admins can end their own impersonation sessions"
ON public.impersonation_sessions FOR UPDATE
USING (
    public.is_system_admin(auth.uid()) AND
    system_admin_user_id = auth.uid()
);

-- Impersonation Actions Table
CREATE TABLE public.impersonation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    impersonation_session_id UUID REFERENCES public.impersonation_sessions(id) ON DELETE CASCADE NOT NULL,
    
    -- What was done
    action_type TEXT NOT NULL,
    action_description TEXT NOT NULL,
    
    -- Where and when
    page_url TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    
    -- What data was affected
    affected_table TEXT,
    affected_record_id UUID,
    before_value JSONB,
    after_value JSONB,
    
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_impersonation_actions_session ON public.impersonation_actions(impersonation_session_id);
CREATE INDEX idx_impersonation_actions_timestamp ON public.impersonation_actions(timestamp DESC);

ALTER TABLE public.impersonation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view impersonation actions"
ON public.impersonation_actions FOR SELECT
USING (public.is_system_admin(auth.uid()));

-- 1.5 Create Database Views & Functions

-- Organization Health View
CREATE OR REPLACE VIEW public.organization_health_view AS
SELECT 
    o.id,
    o.name,
    o.slug,
    o.created_at,
    o.subscription_status,
    o.plan_tier,
    o.health_score,
    
    -- Admin info from organization_members
    om.user_id as admin_user_id,
    p.full_name as admin_name,
    p.email as admin_email,
    
    -- Recent activity (last 30 days)
    COALESCE(SUM(oas.total_logins), 0) as total_logins_30d,
    MAX(oas.last_login_at) as last_login,
    
    -- Feature adoption
    (SELECT COUNT(*) FROM pipelines WHERE organization_id = o.id) as flows_count,
    (SELECT COUNT(*) FROM contacts WHERE organization_id = o.id) as contacts_count,
    (SELECT COUNT(DISTINCT user_id) FROM organization_members WHERE organization_id = o.id) as active_users,
    
    -- Integration status
    MAX(oas.last_pco_sync) as last_pco_sync,
    
    -- AI usage
    COALESCE(SUM(oas.total_ai_uses), 0) as ai_uses_30d,
    
    -- Weekly activity average
    COALESCE(AVG(oas.daily_activity_score), 0)::INTEGER as avg_weekly_activity
    
FROM public.organizations o
LEFT JOIN public.organization_members om ON om.organization_id = o.id AND om.role = 'owner'
LEFT JOIN public.profiles p ON p.user_id = om.user_id
LEFT JOIN public.organization_activity_stats oas ON oas.organization_id = o.id 
    AND oas.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY o.id, o.name, o.slug, o.created_at, o.subscription_status, o.plan_tier, 
         o.health_score, om.user_id, p.full_name, p.email;

-- Health Score Calculator Function
CREATE OR REPLACE FUNCTION public.calculate_organization_health_score(org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Impersonation Session Management Functions
CREATE OR REPLACE FUNCTION public.start_impersonation_session(
    _target_org_id UUID,
    _reason TEXT,
    _ip_address TEXT DEFAULT NULL,
    _user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.end_impersonation_session(_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.log_impersonation_action(
    _session_id UUID,
    _action_type TEXT,
    _action_description TEXT,
    _page_url TEXT DEFAULT NULL,
    _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 1.6 User Login Tracking
CREATE TABLE public.user_login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    logged_in_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_user_login_events_user ON public.user_login_events(user_id);
CREATE INDEX idx_user_login_events_org ON public.user_login_events(organization_id);
CREATE INDEX idx_user_login_events_time ON public.user_login_events(logged_in_at DESC);

CREATE OR REPLACE FUNCTION public.track_user_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE TRIGGER track_login_activity
AFTER INSERT ON user_login_events
FOR EACH ROW EXECUTE FUNCTION track_user_login();

-- 1.7 RLS Policies for Admin Access to Organizations
CREATE POLICY "System admins can view all organizations"
ON public.organizations FOR SELECT
USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can update all organizations"
ON public.organizations FOR UPDATE
USING (public.is_system_admin(auth.uid()));

-- Impersonation Audit Log View
CREATE OR REPLACE VIEW public.impersonation_audit_log AS
SELECT 
    s.id as session_id,
    s.started_at,
    s.ended_at,
    s.is_active,
    s.reason,
    s.ip_address,
    
    -- Admin info
    admin_profile.full_name as admin_name,
    admin_profile.email as admin_email,
    
    -- Target org/user info
    o.name as organization_name,
    target_profile.full_name as target_user_name,
    target_profile.email as target_user_email,
    
    -- Session duration
    CASE 
        WHEN s.ended_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60.0
        ELSE EXTRACT(EPOCH FROM (now() - s.started_at)) / 60.0
    END as duration_minutes,
    
    -- Action count
    (SELECT COUNT(*) FROM impersonation_actions WHERE impersonation_session_id = s.id) as actions_count
    
FROM impersonation_sessions s
LEFT JOIN profiles admin_profile ON admin_profile.user_id = s.system_admin_user_id
LEFT JOIN profiles target_profile ON target_profile.user_id = s.target_user_id
LEFT JOIN organizations o ON o.id = s.target_organization_id
ORDER BY s.started_at DESC;