CREATE OR REPLACE FUNCTION public.clear_demo_data_for_org(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contacts uuid[];
  _groups uuid[];
  _flows uuid[];
  _meetings uuid[];
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO _contacts
  FROM public.contacts WHERE organization_id = _org_id AND is_demo;

  SELECT coalesce(array_agg(id), '{}') INTO _groups
  FROM public.groups WHERE organization_id = _org_id AND is_demo;

  SELECT coalesce(array_agg(id), '{}') INTO _flows
  FROM public.pipelines WHERE organization_id = _org_id AND is_demo;

  IF array_length(_contacts, 1) IS NULL
     AND array_length(_groups, 1) IS NULL
     AND array_length(_flows, 1) IS NULL THEN
    RETURN;
  END IF;

  IF array_length(_groups, 1) IS NOT NULL THEN
    SELECT coalesce(array_agg(id), '{}') INTO _meetings
    FROM public.group_meetings WHERE group_id = ANY(_groups);
    DELETE FROM public.group_attendance WHERE group_meeting_id = ANY(_meetings);
    DELETE FROM public.group_meetings WHERE id = ANY(_meetings);
    DELETE FROM public.group_members WHERE group_id = ANY(_groups);
  END IF;

  IF array_length(_contacts, 1) IS NOT NULL THEN
    DELETE FROM public.signal_agent_suggestions WHERE contact_id = ANY(_contacts);
    DELETE FROM public.flow_moments WHERE contact_id = ANY(_contacts);
    DELETE FROM public.contact_interactions WHERE contact_id = ANY(_contacts);
    DELETE FROM public.contact_notes WHERE contact_id = ANY(_contacts);
    DELETE FROM public.contact_engagement_scores WHERE contact_id = ANY(_contacts);
    DELETE FROM public.contact_tags WHERE contact_id = ANY(_contacts);
    DELETE FROM public.pipeline_contacts WHERE contact_id = ANY(_contacts);
    DELETE FROM public.group_members WHERE contact_id = ANY(_contacts);
  END IF;

  IF array_length(_groups, 1) IS NOT NULL THEN
    DELETE FROM public.group_campuses WHERE group_id = ANY(_groups);
    DELETE FROM public.groups WHERE id = ANY(_groups);
  END IF;

  IF array_length(_flows, 1) IS NOT NULL THEN
    DELETE FROM public.pipeline_contacts WHERE pipeline_id = ANY(_flows);
    DELETE FROM public.pipeline_team_members WHERE pipeline_id = ANY(_flows);
    DELETE FROM public.pipeline_resources WHERE pipeline_id = ANY(_flows);
    DELETE FROM public.pipeline_stages WHERE pipeline_id = ANY(_flows);
    DELETE FROM public.pipelines WHERE id = ANY(_flows);
  END IF;

  IF array_length(_contacts, 1) IS NOT NULL THEN
    DELETE FROM public.contacts WHERE id = ANY(_contacts);
  END IF;

  UPDATE public.organizations
  SET demo_cleared_at = now()
  WHERE id = _org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_demo_data_for_org(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auto_clear_demo_on_real_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_demo THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contacts
    WHERE organization_id = NEW.organization_id AND is_demo
  ) THEN
    PERFORM public.clear_demo_data_for_org(NEW.organization_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_clear_demo_on_real_contact ON public.contacts;
CREATE TRIGGER trg_auto_clear_demo_on_real_contact
AFTER INSERT ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.auto_clear_demo_on_real_contact();