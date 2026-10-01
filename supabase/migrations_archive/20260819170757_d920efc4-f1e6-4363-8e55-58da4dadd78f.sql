-- Org-scoped tag stats (no row caps)
CREATE OR REPLACE FUNCTION public.get_org_tag_stats(p_org_id uuid)
RETURNS TABLE(tag text, contact_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.tag, count(DISTINCT t.contact_id)::bigint
  FROM public.contact_tags t
  JOIN public.contacts c ON c.id = t.contact_id
  WHERE c.organization_id = p_org_id
    AND public.is_user_in_organization(auth.uid(), p_org_id)
  GROUP BY t.tag
  ORDER BY count(DISTINCT t.contact_id) DESC, t.tag ASC
$$;

-- Rename a tag across the whole org
CREATE OR REPLACE FUNCTION public.rename_org_tag(p_org_id uuid, p_old_tag text, p_new_tag text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new text := btrim(p_new_tag);
  v_affected integer := 0;
BEGIN
  IF NOT public.is_user_in_organization(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  IF v_new IS NULL OR v_new = '' THEN
    RAISE EXCEPTION 'New tag cannot be empty';
  END IF;
  IF v_new = p_old_tag THEN
    RETURN 0;
  END IF;

  -- Drop rows that would collide with an existing identical tag
  DELETE FROM public.contact_tags t
  USING public.contacts c
  WHERE c.id = t.contact_id
    AND c.organization_id = p_org_id
    AND t.tag = p_old_tag
    AND EXISTS (
      SELECT 1 FROM public.contact_tags x
      WHERE x.contact_id = t.contact_id AND x.tag = v_new
    );

  UPDATE public.contact_tags t
  SET tag = v_new
  FROM public.contacts c
  WHERE c.id = t.contact_id
    AND c.organization_id = p_org_id
    AND t.tag = p_old_tag;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;

-- Delete a tag across the whole org
CREATE OR REPLACE FUNCTION public.delete_org_tag(p_org_id uuid, p_tag text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected integer := 0;
BEGIN
  IF NOT public.is_user_in_organization(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  DELETE FROM public.contact_tags t
  USING public.contacts c
  WHERE c.id = t.contact_id
    AND c.organization_id = p_org_id
    AND t.tag = p_tag;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;

-- Merge several tags into one across the whole org
CREATE OR REPLACE FUNCTION public.merge_org_tags(p_org_id uuid, p_source_tags text[], p_target_tag text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target text := btrim(p_target_tag);
  v_inserted integer := 0;
BEGIN
  IF NOT public.is_user_in_organization(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  IF v_target IS NULL OR v_target = '' THEN
    RAISE EXCEPTION 'Target tag cannot be empty';
  END IF;

  -- Add the target tag to everyone holding a source tag
  INSERT INTO public.contact_tags (contact_id, tag)
  SELECT DISTINCT t.contact_id, v_target
  FROM public.contact_tags t
  JOIN public.contacts c ON c.id = t.contact_id
  WHERE c.organization_id = p_org_id
    AND t.tag = ANY(p_source_tags)
    AND NOT EXISTS (
      SELECT 1 FROM public.contact_tags x
      WHERE x.contact_id = t.contact_id AND x.tag = v_target
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Remove the source tags (except the target itself)
  DELETE FROM public.contact_tags t
  USING public.contacts c
  WHERE c.id = t.contact_id
    AND c.organization_id = p_org_id
    AND t.tag = ANY(p_source_tags)
    AND t.tag <> v_target;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_tag_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_org_tag(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_org_tag(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_org_tags(uuid, text[], text) TO authenticated;