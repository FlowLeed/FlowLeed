CREATE OR REPLACE FUNCTION public.cpr_set_org() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.contact_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM public.contacts WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.cpr_set_org() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cpr_set_org_trg BEFORE INSERT ON public.contact_prayer_requests FOR EACH ROW EXECUTE FUNCTION public.cpr_set_org();