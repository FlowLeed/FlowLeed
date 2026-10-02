CREATE TABLE public.user_pco_field_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  selected_field_ids text[] NOT NULL DEFAULT '{}',
  hide_empty boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

ALTER TABLE public.user_pco_field_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pco field preferences"
ON public.user_pco_field_preferences FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pco field preferences"
ON public.user_pco_field_preferences FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pco field preferences"
ON public.user_pco_field_preferences FOR UPDATE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pco field preferences"
ON public.user_pco_field_preferences FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_user_pco_field_preferences_updated_at
BEFORE UPDATE ON public.user_pco_field_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();