-- Enable RLS on twilio_phone_numbers
ALTER TABLE twilio_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Allow system admins to view all phone numbers
CREATE POLICY "System admins can view all phone numbers"
ON twilio_phone_numbers
FOR SELECT
USING (is_system_admin(auth.uid()));

-- Allow organization members to view their organization's phone numbers
CREATE POLICY "Organization members can view their phone numbers"
ON twilio_phone_numbers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = twilio_phone_numbers.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Allow system admins to manage all phone numbers
CREATE POLICY "System admins can manage all phone numbers"
ON twilio_phone_numbers
FOR ALL
USING (is_system_admin(auth.uid()));

-- Allow organization admins/owners to update their phone numbers
CREATE POLICY "Organization admins can update their phone numbers"
ON twilio_phone_numbers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = twilio_phone_numbers.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role IN ('owner', 'admin')
  )
);