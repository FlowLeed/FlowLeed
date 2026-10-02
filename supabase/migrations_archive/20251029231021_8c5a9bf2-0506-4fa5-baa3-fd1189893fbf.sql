-- Update start_impersonation_session to accept admin_user_id parameter
CREATE OR REPLACE FUNCTION public.start_impersonation_session(
    _admin_user_id uuid,
    _target_org_id uuid, 
    _reason text, 
    _ip_address text DEFAULT NULL, 
    _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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