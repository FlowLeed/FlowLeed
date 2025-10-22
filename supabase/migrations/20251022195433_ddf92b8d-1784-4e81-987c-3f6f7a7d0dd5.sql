-- Clean up duplicate organization for molodist+7@gmail.com
-- This organization (1bb570c9-4936-4d31-b2cf-52e94924a077) is empty with no data

-- Remove organization membership
DELETE FROM public.organization_members 
WHERE organization_id = '1bb570c9-4936-4d31-b2cf-52e94924a077';

-- Delete the empty organization
DELETE FROM public.organizations 
WHERE id = '1bb570c9-4936-4d31-b2cf-52e94924a077';