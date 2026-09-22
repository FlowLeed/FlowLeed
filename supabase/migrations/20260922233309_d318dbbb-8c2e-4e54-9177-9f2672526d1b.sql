CREATE OR REPLACE FUNCTION public.engagement_settings_for_org(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'weights', '{"consistency":35,"recency":20,"streak":15,"group_attendance":15,"serving":20,"leadership":10}'::jsonb || COALESCE(s.weights, '{}'::jsonb),
    'windows', COALESCE(s.windows, '{"consistency_weeks":12,"recency_days":90,"serving_days":90,"activity_days":90}'::jsonb),
    'thresholds', COALESCE(s.thresholds, '{"highly_engaged":75,"active":50,"at_risk":25,"new_max_checkins":3}'::jsonb),
    'ingredients', COALESCE(s.ingredients, '{"service_checkins":true,"group_attendance":true,"serving":true,"leadership":true}'::jsonb),
    'safeguards', COALESCE(s.safeguards, '{"serving_keeps_active":true,"recent_attendance_days":14,"household_credit":true,"streak_break_misses":1,"count_partial_week":false}'::jsonb)
  )
  FROM (SELECT p_org_id AS org) q
  LEFT JOIN public.org_engagement_settings s ON s.organization_id = q.org;
$function$;

REVOKE ALL ON FUNCTION public.engagement_settings_for_org(uuid) FROM anon;

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

  -- Group attendance rows are written for absent members too; only a real
  -- present attendance should end an engagement pause.
  IF TG_TABLE_NAME = 'group_attendance' AND COALESCE(NEW.status, '') <> 'present' THEN
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

  IF v_season.created_by_user_id IS NOT NULL THEN
    INSERT INTO public.contact_notes (contact_id, content, note_type, created_by_user_id)
    VALUES (
      NEW.contact_id,
      'Engagement pause ended automatically — attended ' || to_char(v_when, 'Mon FMDD, YYYY') || '.',
      'general',
      v_season.created_by_user_id
    );
  END IF;

  RETURN NEW;
END;
$$;