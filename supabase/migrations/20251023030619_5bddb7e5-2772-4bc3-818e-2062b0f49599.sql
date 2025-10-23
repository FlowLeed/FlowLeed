-- Create twilio_phone_numbers table
CREATE TABLE public.twilio_phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  friendly_name TEXT,
  sid TEXT NOT NULL UNIQUE,
  capabilities JSONB DEFAULT '{"voice": true, "sms": true, "mms": false}'::jsonb,
  is_primary BOOLEAN DEFAULT false,
  assigned_to_user_id UUID,
  status TEXT NOT NULL DEFAULT 'active',
  provisioned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  released_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sms_messages table
CREATE TABLE public.sms_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  twilio_message_sid TEXT NOT NULL UNIQUE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'queued',
  twilio_phone_number_id UUID REFERENCES public.twilio_phone_numbers(id) ON DELETE SET NULL,
  sent_by_user_id UUID,
  error_code TEXT,
  error_message TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call_records table
CREATE TABLE public.call_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  twilio_call_sid TEXT NOT NULL UNIQUE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'queued',
  call_type TEXT NOT NULL CHECK (call_type IN ('inbound', 'outbound', 'missed')),
  duration INTEGER,
  twilio_phone_number_id UUID REFERENCES public.twilio_phone_numbers(id) ON DELETE SET NULL,
  initiated_by_user_id UUID,
  recording_url TEXT,
  recording_sid TEXT,
  transcription TEXT,
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_twilio_phone_numbers_org ON public.twilio_phone_numbers(organization_id);
CREATE INDEX idx_twilio_phone_numbers_assigned ON public.twilio_phone_numbers(assigned_to_user_id);
CREATE INDEX idx_sms_messages_org ON public.sms_messages(organization_id);
CREATE INDEX idx_sms_messages_contact ON public.sms_messages(contact_id);
CREATE INDEX idx_sms_messages_created ON public.sms_messages(created_at DESC);
CREATE INDEX idx_call_records_org ON public.call_records(organization_id);
CREATE INDEX idx_call_records_contact ON public.call_records(contact_id);
CREATE INDEX idx_call_records_created ON public.call_records(created_at DESC);

-- Enable RLS
ALTER TABLE public.twilio_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for twilio_phone_numbers
CREATE POLICY "Users can view phone numbers in their organization"
  ON public.twilio_phone_numbers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = twilio_phone_numbers.organization_id
    AND user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage phone numbers in their organization"
  ON public.twilio_phone_numbers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = twilio_phone_numbers.organization_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  ));

-- RLS Policies for sms_messages
CREATE POLICY "Users can view SMS in their organization"
  ON public.sms_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = sms_messages.organization_id
    AND user_id = auth.uid()
  ));

CREATE POLICY "Users can send SMS in their organization"
  ON public.sms_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = sms_messages.organization_id
    AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update SMS in their organization"
  ON public.sms_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = sms_messages.organization_id
    AND user_id = auth.uid()
  ));

-- RLS Policies for call_records
CREATE POLICY "Users can view calls in their organization"
  ON public.call_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = call_records.organization_id
    AND user_id = auth.uid()
  ));

CREATE POLICY "Users can create calls in their organization"
  ON public.call_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = call_records.organization_id
    AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update calls in their organization"
  ON public.call_records FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = call_records.organization_id
    AND user_id = auth.uid()
  ));

-- Triggers for updated_at
CREATE TRIGGER update_twilio_phone_numbers_updated_at
  BEFORE UPDATE ON public.twilio_phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_messages_updated_at
  BEFORE UPDATE ON public.sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_records_updated_at
  BEFORE UPDATE ON public.call_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();