ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS demo_seeded_at timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS demo_cleared_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_org_is_demo ON public.contacts (organization_id) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_pipelines_org_is_demo ON public.pipelines (organization_id) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_groups_org_is_demo ON public.groups (organization_id) WHERE is_demo;