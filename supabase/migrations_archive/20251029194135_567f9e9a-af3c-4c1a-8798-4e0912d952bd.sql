-- Create function to track Planning Center sync activity
CREATE OR REPLACE FUNCTION public.track_pco_sync(
  p_org_id UUID,
  p_sync_type TEXT DEFAULT 'list_sync'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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