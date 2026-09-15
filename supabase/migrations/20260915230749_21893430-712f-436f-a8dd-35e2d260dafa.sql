DROP POLICY IF EXISTS "Org members can view shared or own custom signals" ON public.custom_signals;
CREATE POLICY "Org members can view shared or own custom signals"
ON public.custom_signals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_signals.organization_id
      AND om.user_id = auth.uid()
  )
  AND (visibility = 'org' OR created_by IS NULL OR created_by = auth.uid())
);

DROP POLICY IF EXISTS "Org members can update shared or own custom signals" ON public.custom_signals;
CREATE POLICY "Org members can update shared or own custom signals"
ON public.custom_signals
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_signals.organization_id
      AND om.user_id = auth.uid()
  )
  AND (visibility = 'org' OR created_by IS NULL OR created_by = auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_signals.organization_id
      AND om.user_id = auth.uid()
  )
  AND (visibility = 'org' OR created_by = auth.uid())
);

DROP POLICY IF EXISTS "Org members can delete shared or own custom signals" ON public.custom_signals;
CREATE POLICY "Org members can delete shared or own custom signals"
ON public.custom_signals
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = custom_signals.organization_id
      AND om.user_id = auth.uid()
  )
  AND (visibility = 'org' OR created_by IS NULL OR created_by = auth.uid())
);