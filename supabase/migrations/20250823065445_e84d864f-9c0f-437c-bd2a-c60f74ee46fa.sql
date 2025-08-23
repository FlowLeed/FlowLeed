-- Create contact_demographics table for extended personal information
CREATE TABLE public.contact_demographics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  birthday DATE,
  marital_status TEXT,
  occupation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contact_family_members table for family relationships
CREATE TABLE public.contact_family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  birthday DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contact_addresses table for physical addresses
CREATE TABLE public.contact_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  address_type TEXT NOT NULL DEFAULT 'home',
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contact_interactions table for tracking communications
CREATE TABLE public.contact_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  pipeline_id UUID,
  interaction_type TEXT NOT NULL,
  subject TEXT,
  details TEXT,
  outcome TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contact_notes table for general and pipeline-specific notes
CREATE TABLE public.contact_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  pipeline_id UUID,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'general',
  is_private BOOLEAN DEFAULT false,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contact_prayer_requests table
CREATE TABLE public.contact_prayer_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  answered_at TIMESTAMP WITH TIME ZONE,
  answer_description TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all new tables
ALTER TABLE public.contact_demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_prayer_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contact_demographics
CREATE POLICY "Users can view demographics for contacts in their organization"
ON public.contact_demographics FOR SELECT
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_demographics.contact_id AND om.user_id = auth.uid()
));

CREATE POLICY "Users can manage demographics for contacts in their organization"
ON public.contact_demographics FOR ALL
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_demographics.contact_id AND om.user_id = auth.uid()
));

-- Create RLS policies for contact_family_members
CREATE POLICY "Users can view family members for contacts in their organization"
ON public.contact_family_members FOR SELECT
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_family_members.contact_id AND om.user_id = auth.uid()
));

CREATE POLICY "Users can manage family members for contacts in their organization"
ON public.contact_family_members FOR ALL
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_family_members.contact_id AND om.user_id = auth.uid()
));

-- Create RLS policies for contact_addresses
CREATE POLICY "Users can view addresses for contacts in their organization"
ON public.contact_addresses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_addresses.contact_id AND om.user_id = auth.uid()
));

CREATE POLICY "Users can manage addresses for contacts in their organization"
ON public.contact_addresses FOR ALL
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_addresses.contact_id AND om.user_id = auth.uid()
));

-- Create RLS policies for contact_interactions
CREATE POLICY "Users can view interactions for contacts in their organization"
ON public.contact_interactions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_interactions.contact_id AND om.user_id = auth.uid()
));

CREATE POLICY "Users can manage interactions for contacts in their organization"
ON public.contact_interactions FOR ALL
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_interactions.contact_id AND om.user_id = auth.uid()
));

-- Create RLS policies for contact_notes
CREATE POLICY "Users can view notes for contacts in their organization"
ON public.contact_notes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_notes.contact_id AND om.user_id = auth.uid()
));

CREATE POLICY "Users can manage notes for contacts in their organization"
ON public.contact_notes FOR ALL
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_notes.contact_id AND om.user_id = auth.uid()
));

-- Create RLS policies for contact_prayer_requests
CREATE POLICY "Users can view prayer requests for contacts in their organization"
ON public.contact_prayer_requests FOR SELECT
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_prayer_requests.contact_id AND om.user_id = auth.uid()
));

CREATE POLICY "Users can manage prayer requests for contacts in their organization"
ON public.contact_prayer_requests FOR ALL
USING (EXISTS (
  SELECT 1 FROM contacts c
  JOIN organization_members om ON om.organization_id = c.organization_id
  WHERE c.id = contact_prayer_requests.contact_id AND om.user_id = auth.uid()
));

-- Create triggers for updated_at columns
CREATE TRIGGER update_contact_demographics_updated_at
  BEFORE UPDATE ON public.contact_demographics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contact_family_members_updated_at
  BEFORE UPDATE ON public.contact_family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contact_addresses_updated_at
  BEFORE UPDATE ON public.contact_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contact_interactions_updated_at
  BEFORE UPDATE ON public.contact_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contact_notes_updated_at
  BEFORE UPDATE ON public.contact_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contact_prayer_requests_updated_at
  BEFORE UPDATE ON public.contact_prayer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();