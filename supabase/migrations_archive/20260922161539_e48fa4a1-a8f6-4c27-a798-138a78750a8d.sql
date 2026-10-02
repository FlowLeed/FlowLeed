DO $migration$
DECLARE
  fn text;
  updated_fn text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'compute_engagement_rows'
    AND pg_get_function_identity_arguments(p.oid) = 'p_org_id uuid, p_settings jsonb, p_sample_limit integer';

  IF fn IS NULL THEN
    RAISE EXCEPTION 'compute_engagement_rows(uuid,jsonb,integer) was not found';
  END IF;

  updated_fn := fn;

  updated_fn := replace(updated_fn,
    'w_recency numeric := COALESCE((p_settings->''weights''->>''recency'')::numeric, 0);',
    'w_recency numeric := COALESCE((p_settings->''weights''->>''recency'')::numeric, 0);' || chr(10) ||
    '  w_groupatt numeric := COALESCE((p_settings->''weights''->>''group_attendance'')::numeric, 0);');

  updated_fn := replace(updated_fn,
    'v_recency numeric;',
    'v_recency numeric;' || chr(10) || '  v_groupatt numeric;');

  updated_fn := replace(updated_fn,
    '(CASE WHEN i_service OR i_groupatt THEN w_consistency + w_recency + w_streak ELSE 0 END)',
    '(CASE WHEN i_service THEN w_consistency + w_recency + w_streak ELSE 0 END)' || chr(10) ||
    '    + (CASE WHEN i_groupatt THEN w_groupatt ELSE 0 END)');

  updated_fn := replace(updated_fn,
    'SELECT ga_contact_id, at FROM group_att',
    'SELECT ga_contact_id, at FROM group_att WHERE false');

  updated_fn := replace(updated_fn,
    'vol_only AS (',
    'group_att_agg AS (' || chr(10) ||
    '      SELECT ga_contact_id AS gaa_contact_id, MAX(at) AS last_group_attended' || chr(10) ||
    '      FROM group_att GROUP BY ga_contact_id' || chr(10) ||
    '    ),' || chr(10) ||
    '    vol_only AS (');

  updated_fn := replace(updated_fn,
    'UNION SELECT sa_contact_id FROM serving_agg',
    'UNION SELECT gaa_contact_id FROM group_att_agg' || chr(10) ||
    '      UNION SELECT sa_contact_id FROM serving_agg');

  updated_fn := replace(updated_fn,
    's.last_serving AS r_last_serving,',
    's.last_serving AS r_last_serving,' || chr(10) ||
    '      ga.last_group_attended AS r_last_group_attended,');

  updated_fn := replace(updated_fn,
    'LEFT JOIN vol_only v ON v.vo_contact_id = i.id_contact',
    'LEFT JOIN group_att_agg ga ON ga.gaa_contact_id = i.id_contact' || chr(10) ||
    '    LEFT JOIN vol_only v ON v.vo_contact_id = i.id_contact');

  updated_fn := replace(updated_fn,
    'v_consistency := CASE WHEN (i_service OR i_groupatt)',
    'v_consistency := CASE WHEN i_service');

  updated_fn := replace(updated_fn,
    'v_last_activity := GREATEST(COALESCE(r.r_last_attended, ''epoch''::timestamptz), COALESCE(r.r_last_serving, ''epoch''::timestamptz));' || chr(10) ||
    '    IF (i_service OR i_groupatt) AND v_last_activity > ''epoch''::timestamptz THEN',
    'v_last_activity := COALESCE(r.r_last_attended, ''epoch''::timestamptz);' || chr(10) ||
    '    IF i_service AND v_last_activity > ''epoch''::timestamptz THEN');

  updated_fn := replace(updated_fn,
    'v_streak := CASE WHEN (i_service OR i_groupatt)',
    'v_streak := CASE WHEN i_service');

  updated_fn := replace(updated_fn,
    'v_serving := CASE WHEN i_serving',
    'v_groupatt := CASE WHEN i_groupatt AND r.r_last_group_attended IS NOT NULL' || chr(10) ||
    '      THEN GREATEST(w_groupatt - ((EXTRACT(EPOCH FROM (NOW() - r.r_last_group_attended)) / 86400.0) / win_activity * w_groupatt), 0)' || chr(10) ||
    '      ELSE 0 END;' || chr(10) ||
    '    v_serving := CASE WHEN i_serving');

  updated_fn := replace(updated_fn,
    'v_earned := v_consistency + v_recency + v_streak + v_serving + v_leaderp',
    'v_earned := v_consistency + v_recency + v_streak + v_groupatt + v_serving + v_leaderp');

  updated_fn := replace(updated_fn,
    '''streak'', jsonb_build_object(''earned'', ROUND(v_streak,1), ''max'', w_streak),',
    '''streak'', jsonb_build_object(''earned'', ROUND(v_streak,1), ''max'', w_streak),' || chr(10) ||
    '        ''group_attendance'', jsonb_build_object(''earned'', ROUND(v_groupatt,1), ''max'', w_groupatt),');

  IF updated_fn = fn THEN
    RAISE EXCEPTION 'No scoring changes were applied';
  END IF;

  EXECUTE updated_fn;
END;
$migration$;

REVOKE ALL ON FUNCTION public.compute_engagement_rows(uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_engagement_rows(uuid, jsonb, integer) TO authenticated, service_role;