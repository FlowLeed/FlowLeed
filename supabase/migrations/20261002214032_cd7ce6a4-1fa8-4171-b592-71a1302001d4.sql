CREATE OR REPLACE FUNCTION public.notify_prayer_request_circle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_title text;
  v_msg text;
BEGIN
  IF NEW.contact_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.contact_id IS NOT DISTINCT FROM NEW.contact_id THEN RETURN NEW; END IF;

  SELECT name INTO v_name FROM contacts WHERE id = NEW.contact_id;
  v_title := CASE WHEN NEW.kind = 'praise' THEN 'New praise report' ELSE 'New prayer request' END
             || ' · ' || CASE WHEN NEW.is_anonymous THEN 'Private' ELSE coalesce(v_name, 'Someone') END;
  v_msg := CASE WHEN NEW.is_anonymous
    THEN 'Someone in your Flow shared a private care need. Open to see details.'
    ELSE '"' || left(coalesce(NEW.description, ''), 120) || CASE WHEN length(coalesce(NEW.description,'')) > 120 THEN '…' ELSE '' END || '"' END;

  INSERT INTO notifications (user_id, organization_id, type, title, message, contact_id, pipeline_id, metadata)
  SELECT DISTINCT ON (r.user_id) r.user_id, NEW.organization_id, 'prayer_request', v_title,
         v_msg || ' — in your Flow: ' || p.name, NEW.contact_id, p.id,
         jsonb_build_object('prayer_request_id', NEW.id, 'kind', NEW.kind)
  FROM (
    SELECT ptm.user_id, pc.pipeline_id FROM pipeline_contacts pc
      JOIN pipeline_team_members ptm ON ptm.pipeline_id = pc.pipeline_id AND ptm.role = 'lead'
      WHERE pc.contact_id = NEW.contact_id AND pc.completed_end_at IS NULL
    UNION
    SELECT pc.assigned_to_user_id, pc.pipeline_id FROM pipeline_contacts pc
      WHERE pc.contact_id = NEW.contact_id AND pc.completed_end_at IS NULL AND pc.assigned_to_user_id IS NOT NULL
  ) r
  JOIN pipelines p ON p.id = r.pipeline_id
  WHERE r.user_id IS NOT NULL
  ORDER BY r.user_id, p.name;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_prayer_request_circle failed: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_prayer_request_circle ON public.contact_prayer_requests;
CREATE TRIGGER trg_notify_prayer_request_circle
AFTER INSERT OR UPDATE OF contact_id ON public.contact_prayer_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_prayer_request_circle();