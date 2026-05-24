
-- groups
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS pco_group_type_id text,
  ADD COLUMN IF NOT EXISTS pco_group_type_name text,
  ADD COLUMN IF NOT EXISTS pco_location_id text,
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_meeting_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS groups_org_pco_group_id_uidx
  ON public.groups (organization_id, pco_group_id)
  WHERE pco_group_id IS NOT NULL;

-- group_members
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS pco_person_id text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS group_members_pco_membership_uidx
  ON public.group_members (pco_membership_id)
  WHERE pco_membership_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS group_members_pco_person_idx
  ON public.group_members (pco_person_id)
  WHERE pco_person_id IS NOT NULL;

-- group_meetings
ALTER TABLE public.group_meetings
  ADD COLUMN IF NOT EXISTS pco_event_id text,
  ADD COLUMN IF NOT EXISTS attendance_submitted boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS group_meetings_pco_event_uidx
  ON public.group_meetings (pco_event_id)
  WHERE pco_event_id IS NOT NULL;

-- group_attendance
ALTER TABLE public.group_attendance
  ADD COLUMN IF NOT EXISTS pco_attendance_id text,
  ADD COLUMN IF NOT EXISTS pc_person_id text;

CREATE UNIQUE INDEX IF NOT EXISTS group_attendance_pco_uidx
  ON public.group_attendance (pco_attendance_id)
  WHERE pco_attendance_id IS NOT NULL;

-- Make group_member_id and contact_id nullable for PCO-sourced attendance
-- where we may know the person but not yet the FlowLeed member/contact row
ALTER TABLE public.group_attendance
  ALTER COLUMN group_member_id DROP NOT NULL,
  ALTER COLUMN contact_id DROP NOT NULL;
