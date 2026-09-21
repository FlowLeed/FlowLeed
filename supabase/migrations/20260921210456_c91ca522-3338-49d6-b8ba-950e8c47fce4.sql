-- End an active life season automatically when the person attends again
CREATE OR REPLACE FUNCTION public.end_life_season_on_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_season public.contact_life_seasons;
  v_when date;
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_season
  FROM public.contact_life_seasons
  WHERE contact_id = NEW.contact_id AND ended_on IS NULL
  LIMIT 1;

  IF v_season.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_when := COALESCE(NEW.checked_in_at::date, CURRENT_DATE);

  UPDATE public.contact_life_seasons
  SET ended_on = CURRENT_DATE,
      end_reason = 'auto_attended',
      updated_at = now()
  WHERE id = v_season.id;

  INSERT INTO public.contact_notes (contact_id, content, note_type, created_by_user_id)
  VALUES (
    NEW.contact_id,
    'Engagement pause ended automatically — attended ' || to_char(v_when, 'Mon FMDD, YYYY') || '.',
    'general',
    v_season.created_by_user_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS end_life_season_on_checkin ON public.pco_checkins;
CREATE TRIGGER end_life_season_on_checkin
AFTER INSERT ON public.pco_checkins
FOR EACH ROW EXECUTE FUNCTION public.end_life_season_on_attendance();

DROP TRIGGER IF EXISTS end_life_season_on_group_attendance ON public.group_attendance;
CREATE TRIGGER end_life_season_on_group_attendance
AFTER INSERT ON public.group_attendance
FOR EACH ROW EXECUTE FUNCTION public.end_life_season_on_attendance();

-- Daily reminder for open-ended life seasons
CREATE OR REPLACE FUNCTION public.remind_open_life_seasons()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int := 0;
BEGIN
  WITH due AS (
    SELECT ls.id, ls.organization_id, ls.contact_id, ls.created_by_user_id, ls.started_on, c.name
    FROM public.contact_life_seasons ls
    JOIN public.contacts c ON c.id = ls.contact_id
    WHERE ls.ended_on IS NULL
      AND ls.created_by_user_id IS NOT NULL
      AND COALESCE(ls.last_reminded_at, ls.created_at) < now() - INTERVAL '30 days'
  ), ins AS (
    INSERT INTO public.notifications (organization_id, user_id, contact_id, type, title, message, metadata)
    SELECT due.organization_id, due.created_by_user_id, due.contact_id, 'life_season_reminder',
           'Is ' || due.name || ' still away?',
           due.name || '''s engagement score has been paused since ' || to_char(due.started_on, 'Mon FMDD, YYYY') || '.',
           jsonb_build_object('life_season_id', due.id)
    FROM due
    RETURNING 1
  ), upd AS (
    UPDATE public.contact_life_seasons ls
    SET last_reminded_at = now()
    WHERE ls.id IN (SELECT id FROM due)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN v_count;
END;
$$;

SELECT cron.unschedule('remind-open-life-seasons')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'remind-open-life-seasons');

SELECT cron.schedule('remind-open-life-seasons', '30 8 * * *', $$SELECT public.remind_open_life_seasons();$$);