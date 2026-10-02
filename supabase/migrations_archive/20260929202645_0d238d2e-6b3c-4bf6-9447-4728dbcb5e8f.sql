CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to_user_id uuid NOT NULL,
  created_by_user_id uuid NOT NULL,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX tasks_assignee_idx ON public.tasks(assigned_to_user_id, completed_at);
CREATE POLICY "View own or created tasks" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_user_in_organization(auth.uid(), organization_id) AND (assigned_to_user_id = auth.uid() OR created_by_user_id = auth.uid()));
CREATE POLICY "Create tasks in own org" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_user_in_organization(auth.uid(), organization_id) AND created_by_user_id = auth.uid());
CREATE POLICY "Update own or created tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_user_in_organization(auth.uid(), organization_id) AND (assigned_to_user_id = auth.uid() OR created_by_user_id = auth.uid()))
  WITH CHECK (public.is_user_in_organization(auth.uid(), organization_id));
CREATE POLICY "Delete own or created tasks" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_user_in_organization(auth.uid(), organization_id) AND (assigned_to_user_id = auth.uid() OR created_by_user_id = auth.uid()));
CREATE TRIGGER tasks_touch_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.content_set_updated_at();