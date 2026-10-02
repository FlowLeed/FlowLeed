-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL DEFAULT 'small_group', -- small_group, serving_team, class, ministry
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive, archived
  meeting_day TEXT, -- monday, tuesday, etc
  meeting_time TIME,
  meeting_frequency TEXT, -- weekly, biweekly, monthly
  location TEXT,
  capacity INTEGER,
  leader_user_id UUID REFERENCES profiles(user_id),
  co_leader_user_id UUID REFERENCES profiles(user_id),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  pco_group_id TEXT, -- for PCO sync
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, pco_group_id)
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- member, leader, co_leader, host
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive, pending
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attended_at TIMESTAMPTZ,
  attendance_count INTEGER DEFAULT 0,
  notes TEXT,
  pco_membership_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, contact_id)
);

-- Create group_meetings table
CREATE TABLE IF NOT EXISTS public.group_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 90,
  location TEXT,
  meeting_type TEXT DEFAULT 'regular', -- regular, special, social, service
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled
  notes TEXT,
  created_by_user_id UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create group_attendance table
CREATE TABLE IF NOT EXISTS public.group_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_meeting_id UUID NOT NULL REFERENCES group_meetings(id) ON DELETE CASCADE,
  group_member_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present', -- present, absent, late, excused
  checked_in_at TIMESTAMPTZ,
  checked_in_by_user_id UUID REFERENCES profiles(user_id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_meeting_id, group_member_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_groups_organization ON groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_groups_leader ON groups(leader_user_id);
CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_contact ON group_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_group_members_status ON group_members(status);
CREATE INDEX IF NOT EXISTS idx_group_meetings_group ON group_meetings(group_id);
CREATE INDEX IF NOT EXISTS idx_group_meetings_date ON group_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_group_attendance_meeting ON group_attendance(group_meeting_id);
CREATE INDEX IF NOT EXISTS idx_group_attendance_member ON group_attendance(group_member_id);

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups
CREATE POLICY "Users can view groups in their organization"
  ON public.groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = groups.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create groups in their organization"
  ON public.groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = groups.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update groups in their organization"
  ON public.groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = groups.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete groups in their organization"
  ON public.groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = groups.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- RLS Policies for group_members
CREATE POLICY "Users can view group members in their organization"
  ON public.group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN organization_members om ON om.organization_id = g.organization_id
      WHERE g.id = group_members.group_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage group members in their organization"
  ON public.group_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN organization_members om ON om.organization_id = g.organization_id
      WHERE g.id = group_members.group_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS Policies for group_meetings
CREATE POLICY "Users can view group meetings in their organization"
  ON public.group_meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN organization_members om ON om.organization_id = g.organization_id
      WHERE g.id = group_meetings.group_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage group meetings in their organization"
  ON public.group_meetings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN organization_members om ON om.organization_id = g.organization_id
      WHERE g.id = group_meetings.group_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS Policies for group_attendance
CREATE POLICY "Users can view group attendance in their organization"
  ON public.group_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_meetings gm
      JOIN groups g ON g.id = gm.group_id
      JOIN organization_members om ON om.organization_id = g.organization_id
      WHERE gm.id = group_attendance.group_meeting_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage group attendance in their organization"
  ON public.group_attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM group_meetings gm
      JOIN groups g ON g.id = gm.group_id
      JOIN organization_members om ON om.organization_id = g.organization_id
      WHERE gm.id = group_attendance.group_meeting_id
      AND om.user_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_members_updated_at
  BEFORE UPDATE ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_meetings_updated_at
  BEFORE UPDATE ON group_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_attendance_updated_at
  BEFORE UPDATE ON group_attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update member attendance stats
CREATE OR REPLACE FUNCTION update_member_attendance_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE group_members
    SET 
      last_attended_at = CASE 
        WHEN NEW.status = 'present' THEN NEW.checked_in_at
        ELSE group_members.last_attended_at
      END,
      attendance_count = (
        SELECT COUNT(*) 
        FROM group_attendance ga
        WHERE ga.group_member_id = NEW.group_member_id
        AND ga.status = 'present'
      )
    WHERE id = NEW.group_member_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_attendance_stats
  AFTER INSERT OR UPDATE ON group_attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_member_attendance_stats();