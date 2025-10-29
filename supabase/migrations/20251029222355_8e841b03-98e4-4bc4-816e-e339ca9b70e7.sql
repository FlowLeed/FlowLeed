-- Add SELECT policies for system admins to view all contact-related tables
-- This allows impersonation to work properly without hanging

CREATE POLICY "System admins can view all contact interactions"
ON public.contact_interactions
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can view all contact notes"
ON public.contact_notes
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can view all prayer requests"
ON public.contact_prayer_requests
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can view all contact demographics"
ON public.contact_demographics
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can view all contact addresses"
ON public.contact_addresses
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can view all contact family members"
ON public.contact_family_members
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));