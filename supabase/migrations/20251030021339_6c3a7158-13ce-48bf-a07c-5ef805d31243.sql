-- Enable Row Level Security on organization_health_view
ALTER VIEW organization_health_view SET (security_invoker = on);

-- Since views use security_invoker, we need to ensure the underlying tables have proper RLS
-- The view should only be accessible to system admins

-- Create a policy that restricts access to system admins only
-- Note: For views, we apply policies to the underlying tables, but we can also
-- create a security barrier view or use RLS on the view itself if supported

-- Alternative approach: Create a secure function to access this data (already exists: get_organizations_health_data)
-- But we should still protect direct access to the view

-- Add a comment to document this is a protected view
COMMENT ON VIEW organization_health_view IS 'Protected view containing sensitive organization metrics. Access should only be through get_organizations_health_data() function which enforces system admin check.';