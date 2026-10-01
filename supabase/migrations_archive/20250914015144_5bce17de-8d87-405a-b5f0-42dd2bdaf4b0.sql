-- Create invitations table for team member invitations
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by_user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for invitations
CREATE POLICY "Users can view invitations for their organization" 
ON public.invitations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_id = invitations.organization_id 
  AND user_id = auth.uid()
));

CREATE POLICY "Organization admins and owners can create invitations" 
ON public.invitations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_id = invitations.organization_id 
  AND user_id = auth.uid() 
  AND role IN ('owner', 'admin')
));

CREATE POLICY "Organization admins and owners can update invitations" 
ON public.invitations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_id = invitations.organization_id 
  AND user_id = auth.uid() 
  AND role IN ('owner', 'admin')
));

CREATE POLICY "Organization admins and owners can delete invitations" 
ON public.invitations 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM organization_members 
  WHERE organization_id = invitations.organization_id 
  AND user_id = auth.uid() 
  AND role IN ('owner', 'admin')
));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_invitations_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_organization_id ON public.invitations(organization_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);