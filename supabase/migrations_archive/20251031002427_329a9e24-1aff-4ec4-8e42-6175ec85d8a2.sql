-- Create ai_suggestion_feedback table to track user feedback on AI suggestions
CREATE TABLE IF NOT EXISTS public.ai_suggestion_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL,
  suggestion_title TEXT NOT NULL,
  suggestion_description TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'neutral')),
  action_taken TEXT CHECK (action_taken IN ('message_generated', 'stage_changed', 'dismissed', 'ignored')),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_suggestion_feedback ENABLE ROW LEVEL SECURITY;

-- Users can create feedback for contacts in their organization
CREATE POLICY "Users can create feedback in their organization"
  ON public.ai_suggestion_feedback
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ai_suggestion_feedback.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Users can view feedback for contacts in their organization
CREATE POLICY "Users can view feedback in their organization"
  ON public.ai_suggestion_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ai_suggestion_feedback.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- System admins can view all feedback
CREATE POLICY "System admins can view all feedback"
  ON public.ai_suggestion_feedback
  FOR SELECT
  USING (is_system_admin(auth.uid()));

-- Create index for efficient queries
CREATE INDEX idx_ai_feedback_contact ON public.ai_suggestion_feedback(contact_id);
CREATE INDEX idx_ai_feedback_org ON public.ai_suggestion_feedback(organization_id);
CREATE INDEX idx_ai_feedback_type ON public.ai_suggestion_feedback(feedback_type);
CREATE INDEX idx_ai_feedback_created ON public.ai_suggestion_feedback(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.ai_suggestion_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();