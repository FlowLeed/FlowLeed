
-- Fix contacts table RLS policies to only allow authenticated users
-- Drop existing policies that use 'public' role
DROP POLICY IF EXISTS "Users can create contacts in their organization" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their organization" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts in their organization" ON public.contacts;
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON public.contacts;

-- Recreate policies with 'authenticated' role restriction
CREATE POLICY "Users can create contacts in their organization" 
ON public.contacts
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_members.organization_id = contacts.organization_id 
      AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete contacts in their organization" 
ON public.contacts
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_members.organization_id = contacts.organization_id 
      AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update contacts in their organization" 
ON public.contacts
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_members.organization_id = contacts.organization_id 
      AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view contacts in their organization" 
ON public.contacts
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_members.organization_id = contacts.organization_id 
      AND organization_members.user_id = auth.uid()
  )
);
