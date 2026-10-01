DROP POLICY IF EXISTS "Public read active types" ON public.group_type_definitions;
CREATE POLICY "Public read group types" ON public.group_type_definitions FOR SELECT USING (true);