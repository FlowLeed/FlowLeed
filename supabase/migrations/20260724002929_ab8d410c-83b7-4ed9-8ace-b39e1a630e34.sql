
-- Group Type Definitions
CREATE TABLE public.group_type_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT DEFAULT 'Users',
  color TEXT DEFAULT '#6366f1',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, key)
);

GRANT SELECT ON public.group_type_definitions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_type_definitions TO authenticated;
GRANT ALL ON public.group_type_definitions TO service_role;

ALTER TABLE public.group_type_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active types" ON public.group_type_definitions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Org members can view all types" ON public.group_type_definitions
  FOR SELECT TO authenticated USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Org admins manage types" ON public.group_type_definitions
  FOR ALL TO authenticated USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  ) WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- Group Settings (one row per org)
CREATE TABLE public.group_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  default_meeting_frequency TEXT DEFAULT 'weekly',
  default_visibility TEXT DEFAULT 'private',
  default_allow_public_signup BOOLEAN DEFAULT false,
  default_capacity INT,
  directory_enabled BOOLEAN NOT NULL DEFAULT true,
  directory_hero_title TEXT DEFAULT 'Find Your Community',
  directory_hero_subtitle TEXT DEFAULT 'Explore groups and join one that fits you.',
  directory_show_meeting_time BOOLEAN NOT NULL DEFAULT true,
  directory_show_location BOOLEAN NOT NULL DEFAULT true,
  directory_show_capacity BOOLEAN NOT NULL DEFAULT true,
  auto_inactive_weeks INT,
  attendance_reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  attendance_reminder_day INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.group_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_settings TO authenticated;
GRANT ALL ON public.group_settings TO service_role;

ALTER TABLE public.group_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read group settings" ON public.group_settings
  FOR SELECT USING (true);

CREATE POLICY "Org admins manage group settings" ON public.group_settings
  FOR ALL TO authenticated USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  ) WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_group_type_definitions_updated
  BEFORE UPDATE ON public.group_type_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_group_settings_updated
  BEFORE UPDATE ON public.group_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults for existing orgs
INSERT INTO public.group_type_definitions (organization_id, key, label, icon, color, sort_order, is_system)
SELECT o.id, t.key, t.label, t.icon, t.color, t.sort_order, true
FROM public.organizations o
CROSS JOIN (VALUES
  ('small_group', 'Small Group', 'Users', '#6366f1', 0),
  ('serving_team', 'Serving Team', 'HandHelping', '#10b981', 1),
  ('class', 'Class', 'GraduationCap', '#f59e0b', 2),
  ('ministry', 'Ministry', 'Church', '#ec4899', 3)
) AS t(key, label, icon, color, sort_order)
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO public.group_settings (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

-- Auto-seed on org creation
CREATE OR REPLACE FUNCTION public.seed_group_config_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_settings (organization_id) VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  INSERT INTO public.group_type_definitions (organization_id, key, label, icon, color, sort_order, is_system)
  VALUES
    (NEW.id, 'small_group', 'Small Group', 'Users', '#6366f1', 0, true),
    (NEW.id, 'serving_team', 'Serving Team', 'HandHelping', '#10b981', 1, true),
    (NEW.id, 'class', 'Class', 'GraduationCap', '#f59e0b', 2, true),
    (NEW.id, 'ministry', 'Ministry', 'Church', '#ec4899', 3, true)
  ON CONFLICT (organization_id, key) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_seed_group_config_after_org_insert
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_group_config_for_org();
