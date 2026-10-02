
-- Per-org unique form slug
ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_slug_key;
DROP INDEX IF EXISTS public.forms_slug_key;
ALTER TABLE public.forms ADD CONSTRAINT forms_org_slug_unique UNIQUE (organization_id, slug);
-- idx_forms_slug already exists as a non-unique index; leave it for legacy /f/:slug lookups

-- Reserved org slugs
CREATE OR REPLACE FUNCTION public.check_reserved_org_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NOT NULL AND lower(NEW.slug) = ANY (ARRAY[
    'auth','verify-email','invite','pco','dev','fl-admin','audit','f','org',
    'groups','content','flows','contacts','signals','messages','calls','tasks',
    'team','integrations','analytics','profile','calendar','forms','api','admin',
    'settings','dashboard','home','about','login','logout','signup','signin',
    'fl-admin','public','static','assets','favicon.ico','robots.txt'
  ]) THEN
    RAISE EXCEPTION 'Organization slug "%" is reserved', NEW.slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_reserved_org_slug ON public.organizations;
CREATE TRIGGER trg_check_reserved_org_slug
BEFORE INSERT OR UPDATE OF slug ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.check_reserved_org_slug();
