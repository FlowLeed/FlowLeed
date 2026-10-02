ALTER TABLE public.pco_moment_mappings
  ADD COLUMN IF NOT EXISTS rule_combinator text NOT NULL DEFAULT 'AND',
  ADD COLUMN IF NOT EXISTS condition_group integer NOT NULL DEFAULT 0;

ALTER TABLE public.pco_moment_mappings
  DROP CONSTRAINT IF EXISTS pco_moment_mappings_rule_combinator_check;
ALTER TABLE public.pco_moment_mappings
  ADD CONSTRAINT pco_moment_mappings_rule_combinator_check
  CHECK (rule_combinator IN ('AND','OR'));

CREATE UNIQUE INDEX IF NOT EXISTS pco_moment_mappings_rule_condition_uniq
  ON public.pco_moment_mappings (integration_id, flow_moment_type_id, condition_group, pco_source_identifier)
  WHERE pco_source_type = 'custom_tab_field';