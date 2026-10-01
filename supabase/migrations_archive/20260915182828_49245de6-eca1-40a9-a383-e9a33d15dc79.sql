ALTER TABLE public.custom_signals
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'org';

ALTER TABLE public.custom_signals
  DROP CONSTRAINT IF EXISTS custom_signals_visibility_check;
ALTER TABLE public.custom_signals
  ADD CONSTRAINT custom_signals_visibility_check CHECK (visibility IN ('org','personal'));

DROP POLICY IF EXISTS "Org members can view custom signals" ON public.custom_signals;
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
  AND (visibility = 'org' OR created_by = auth.uid())
);

DROP POLICY IF EXISTS "Org members can update custom signals" ON public.custom_signals;
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
  AND (visibility = 'org' OR created_by = auth.uid())
);

DROP POLICY IF EXISTS "Org members can delete custom signals" ON public.custom_signals;
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
  AND (visibility = 'org' OR created_by = auth.uid())
);