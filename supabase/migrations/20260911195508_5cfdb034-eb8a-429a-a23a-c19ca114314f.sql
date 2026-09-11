CREATE OR REPLACE FUNCTION public.get_marker_catalog(p_org_id uuid, p_campus_id uuid DEFAULT NULL, p_assigned_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  key text,
  label text,
  description text,
  category text,
  polarity text,
  sort_order integer,
  requires_integration text,
  is_phase_two boolean,
  contact_count bigint,
  enabled boolean,
  default_label text,
  default_description text,
  params jsonb,
  is_customized boolean,
  promoted_signal_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    md.key,
    COALESCE(oms.custom_label, md.label) AS label,
    COALESCE(oms.custom_description, md.description) AS description,
    md.category,
    COALESCE(cs.polarity, md.polarity) AS polarity,
    md.sort_order,
    md.requires_integration,
    md.is_phase_two,
    CASE
      WHEN oms.promoted_signal_id IS NOT NULL THEN COALESCE(custom_cnt.contact_count, 0)
      ELSE COALESCE(marker_cnt.contact_count, 0)
    END AS contact_count,
    CASE
      WHEN oms.promoted_signal_id IS NOT NULL THEN COALESCE(cs.enabled, false)
      ELSE COALESCE(oms.enabled, true)
    END AS enabled,
    md.label AS default_label,
    md.description AS default_description,
    COALESCE(oms.params, '{}'::jsonb) AS params,
    (oms.id IS NOT NULL AND (
      oms.custom_label IS NOT NULL
      OR oms.custom_description IS NOT NULL
      OR COALESCE(oms.params, '{}'::jsonb) <> '{}'::jsonb
      OR oms.enabled = false
      OR oms.promoted_signal_id IS NOT NULL
    )) AS is_customized,
    oms.promoted_signal_id
  FROM public.marker_definitions md
  LEFT JOIN public.org_marker_settings oms
    ON oms.organization_id = p_org_id AND oms.marker_key = md.key
  LEFT JOIN public.custom_signals cs
    ON cs.id = oms.promoted_signal_id
  LEFT JOIN (
    SELECT cm.marker_key, COUNT(DISTINCT cm.contact_id) AS contact_count
    FROM public.contact_markers cm
    JOIN public.contacts c ON c.id = cm.contact_id
    WHERE cm.organization_id = p_org_id
      AND (p_campus_id IS NULL OR c.campus_id = p_campus_id)
      AND (p_assigned_user_id IS NULL OR c.assigned_to_user_id = p_assigned_user_id)
    GROUP BY cm.marker_key
  ) marker_cnt ON marker_cnt.marker_key = md.key
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT csc.contact_id) AS contact_count
    FROM public.custom_signal_contacts csc
    JOIN public.contacts c ON c.id = csc.contact_id
    WHERE csc.signal_id = oms.promoted_signal_id
      AND csc.organization_id = p_org_id
      AND csc.cleared_at IS NULL
      AND (p_campus_id IS NULL OR c.campus_id = p_campus_id)
      AND (p_assigned_user_id IS NULL OR c.assigned_to_user_id = p_assigned_user_id)
  ) custom_cnt ON oms.promoted_signal_id IS NOT NULL
  ORDER BY md.sort_order, md.key
$$;

GRANT EXECUTE ON FUNCTION public.get_marker_catalog(uuid, uuid, uuid) TO authenticated;