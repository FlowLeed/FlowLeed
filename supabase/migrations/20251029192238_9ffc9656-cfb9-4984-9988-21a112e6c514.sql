-- Create function to track user logins
CREATE OR REPLACE FUNCTION public.track_user_login(
  p_user_id UUID,
  p_org_id UUID
) RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create table to track individual user logins
CREATE TABLE IF NOT EXISTS public.user_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, organization_id, date)
);

-- Enable RLS on user_logins
ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;

-- Create policy for user_logins
CREATE POLICY "System can manage user logins"
  ON public.user_logins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_logins_org_date ON user_logins(organization_id, date);

-- Create trigger to update unique_active_users count
CREATE OR REPLACE FUNCTION public.update_unique_active_users()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_unique_active_users
  AFTER INSERT ON public.user_logins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_unique_active_users();