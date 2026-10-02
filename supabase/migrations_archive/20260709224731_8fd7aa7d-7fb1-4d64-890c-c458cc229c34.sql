
-- Backfill: keep existing orgs on for these 4 modules
INSERT INTO public.organization_features (organization_id, feature_key, enabled)
SELECT o.id, k.key, true
FROM public.organizations o
CROSS JOIN (VALUES ('texting'),('calling'),('content'),('signals')) AS k(key)
ON CONFLICT (organization_id, feature_key) DO NOTHING;

-- Trigger: new orgs get these 4 features explicitly disabled
CREATE OR REPLACE FUNCTION public.seed_default_org_features()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_features (organization_id, feature_key, enabled)
  VALUES
    (NEW.id, 'texting', false),
    (NEW.id, 'calling', false),
    (NEW.id, 'content', false),
    (NEW.id, 'signals', false)
  ON CONFLICT (organization_id, feature_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_org_features ON public.organizations;
CREATE TRIGGER trg_seed_default_org_features
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.seed_default_org_features();
