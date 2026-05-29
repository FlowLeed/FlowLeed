DROP INDEX IF EXISTS public.group_meetings_pco_event_id_key;
DROP INDEX IF EXISTS public.group_attendance_pco_attendance_id_key;
ALTER TABLE public.group_meetings ADD CONSTRAINT group_meetings_pco_event_id_key UNIQUE (pco_event_id);
ALTER TABLE public.group_attendance ADD CONSTRAINT group_attendance_pco_attendance_id_key UNIQUE (pco_attendance_id);