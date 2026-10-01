
-- Create campuses table
CREATE TABLE public.campuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pco_campus_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, pco_campus_id)
);

-- Add campus_id FK to contacts
ALTER TABLE public.contacts ADD COLUMN campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read their org's campuses
CREATE POLICY "Org members can read campuses"
  ON public.campuses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = campuses.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- RLS: org admins/owners can manage campuses
CREATE POLICY "Org admins can manage campuses"
  ON public.campuses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = campuses.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = campuses.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Index for faster lookups
CREATE INDEX idx_contacts_campus_id ON public.contacts(campus_id);
CREATE INDEX idx_campuses_organization_id ON public.campuses(organization_id);
