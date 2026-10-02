
-- Phase 4: Per-user PCO permission enforcement

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS pco_enforce_user_permissions boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_pco_connections
  ADD COLUMN IF NOT EXISTS visible_people_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS visible_people_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.user_pco_visible_people (
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  pc_person_id text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, pc_person_id)
);

GRANT SELECT ON public.user_pco_visible_people TO authenticated;
GRANT ALL ON public.user_pco_visible_people TO service_role;

ALTER TABLE public.user_pco_visible_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own visible-people rows"
  ON public.user_pco_visible_people
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_pco_visible_people_user
  ON public.user_pco_visible_people(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_user_pco_visible_people_pc_person
  ON public.user_pco_visible_people(organization_id, pc_person_id);

CREATE OR REPLACE FUNCTION public.user_has_active_pco_connection(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_pco_connections
    WHERE user_id = _user AND organization_id = _org AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_user_see_contact(_user uuid, _contact_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    SELECT id, organization_id, pc_person_id
    FROM public.contacts WHERE id = _contact_id
  )
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM c) THEN false
      WHEN (SELECT pco_enforce_user_permissions FROM public.organizations
              WHERE id = (SELECT organization_id FROM c)) = false THEN true
      WHEN public.is_system_admin(_user) THEN true
      WHEN EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = _user
          AND organization_id = (SELECT organization_id FROM c)
          AND role IN ('owner','admin')
      ) THEN true
      WHEN (SELECT pc_person_id FROM c) IS NULL THEN true
      WHEN NOT public.user_has_active_pco_connection(_user, (SELECT organization_id FROM c)) THEN true
      WHEN EXISTS (
        SELECT 1 FROM public.user_pco_visible_people v
        WHERE v.user_id = _user
          AND v.organization_id = (SELECT organization_id FROM c)
          AND v.pc_person_id = (SELECT pc_person_id FROM c)
      ) THEN true
      ELSE false
    END;
$$;

DROP POLICY IF EXISTS "Users can view contacts in their organization" ON public.contacts;
CREATE POLICY "Users can view contacts in their organization"
ON public.contacts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contacts.organization_id
      AND om.user_id = auth.uid()
  )
  AND public.can_user_see_contact(auth.uid(), contacts.id)
);

DROP POLICY IF EXISTS "Users can view contacts in flows they have access to" ON public.pipeline_contacts;
CREATE POLICY "Users can view contacts in flows they have access to"
ON public.pipeline_contacts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contacts c
    JOIN public.organization_members om
      ON om.organization_id = c.organization_id AND om.user_id = auth.uid()
    WHERE c.id = pipeline_contacts.contact_id
  )
  AND public.can_user_see_contact(auth.uid(), pipeline_contacts.contact_id)
);

CREATE OR REPLACE FUNCTION public.replace_user_pco_visible_people(
  _user uuid, _org uuid, _ids text[]
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted_count integer;
BEGIN
  DELETE FROM public.user_pco_visible_people
  WHERE user_id = _user AND organization_id = _org;

  INSERT INTO public.user_pco_visible_people (user_id, organization_id, pc_person_id)
  SELECT _user, _org, unnest(_ids)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  UPDATE public.user_pco_connections
  SET visible_people_synced_at = now(),
      visible_people_count = inserted_count,
      updated_at = now()
  WHERE user_id = _user AND organization_id = _org;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_user_pco_visible_people(uuid, uuid, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_user_pco_visible_people(uuid, uuid, text[]) TO service_role;
