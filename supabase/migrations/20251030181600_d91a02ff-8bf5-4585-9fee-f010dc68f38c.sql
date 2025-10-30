-- Add RLS policy to allow organization owners and admins to view all pipelines in their organization
CREATE POLICY "Org owners and admins can view all org pipelines"
ON public.pipelines
FOR SELECT
TO authenticated
USING (
  get_user_organization_role(auth.uid(), organization_id) IN ('owner', 'admin')
);