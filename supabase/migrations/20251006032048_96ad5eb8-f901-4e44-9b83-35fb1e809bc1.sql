-- Add missing FK for PostgREST relationships so nested selects work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pipeline_team_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.pipeline_team_members
      ADD CONSTRAINT pipeline_team_members_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.profiles(user_id)
      ON DELETE CASCADE;
  END IF;
END $$;