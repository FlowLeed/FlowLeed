
CREATE OR REPLACE FUNCTION public.get_marker_catalog(
  p_org_id uuid,
  p_campus_id uuid DEFAULT NULL,
  p_assigned_user_id uuid DEFAULT NULL
)
RETURNS TABLE(key text, label text, description text, category text, polarity text, sort_order integer, requires_integration text, is_phase_two boolean, contact_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    md.key, md.label, md.description, md.category, md.polarity, md.sort_order,
    md.requires_integration, md.is_phase_two,
    COALESCE(c.cnt, 0) AS contact_count
  FROM marker_definitions md
  LEFT JOIN (
    SELECT cm.marker_key, COUNT(*)::bigint AS cnt
    FROM contact_markers cm
    JOIN contacts ct ON ct.id = cm.contact_id
    WHERE cm.organization_id = p_org_id
      AND (p_campus_id IS NULL OR ct.campus_id = p_campus_id)
      AND (p_assigned_user_id IS NULL OR ct.assigned_to_user_id = p_assigned_user_id)
    GROUP BY cm.marker_key
  ) c ON c.marker_key = md.key
  WHERE EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()
  )
  ORDER BY md.is_phase_two, md.category, md.sort_order;
$function$;
