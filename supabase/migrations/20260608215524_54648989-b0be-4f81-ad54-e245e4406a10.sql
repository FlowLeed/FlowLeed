ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS pc_membership text;
CREATE INDEX IF NOT EXISTS idx_contacts_org_membership ON public.contacts(organization_id, pc_membership);