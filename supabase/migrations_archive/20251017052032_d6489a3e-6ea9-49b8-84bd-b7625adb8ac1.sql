-- Function to get user's system role
CREATE OR REPLACE FUNCTION public.get_user_system_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.system_user_roles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Function to get all organizations health data for super admins
CREATE OR REPLACE FUNCTION public.get_organizations_health_data()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  admin_name text,
  admin_email text,
  admin_user_id uuid,
  plan_tier text,
  subscription_status text,
  created_at timestamptz,
  last_login timestamptz,
  total_logins_30d bigint,
  last_pco_sync timestamptz,
  flows_count bigint,
  active_users bigint,
  contacts_count bigint,
  avg_weekly_activity integer,
  ai_uses_30d bigint,
  health_score integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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