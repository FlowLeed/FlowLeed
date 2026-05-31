
-- Phase 1: PCO OAuth foundation

-- 1. Extend integrations
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'pat',
  ADD COLUMN IF NOT EXISTS oauth_access_token text,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token text,
  ADD COLUMN IF NOT EXISTS oauth_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS oauth_scopes text,
  ADD COLUMN IF NOT EXISTS oauth_connected_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS provider_account_id text,
  ADD COLUMN IF NOT EXISTS provider_account_name text;

ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_auth_type_check;
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_auth_type_check CHECK (auth_type IN ('pat','oauth'));

-- Status: allow 'reauth_required' alongside existing free-text values (no existing CHECK constraint)
-- documented by convention.

-- 2. integrations_public view (no token columns)
DROP VIEW IF EXISTS public.integrations_public;
CREATE VIEW public.integrations_public
WITH (security_invoker=on) AS
SELECT
  id, user_id, organization_id, service_name,
  settings, status, last_sync_at, created_at, updated_at,
  sync_frequency, metadata, auto_sync_all_people, last_full_sync_completed_at,
  auth_type, oauth_token_expires_at, oauth_scopes, oauth_connected_by_user_id,
  provider_account_id, provider_account_name
FROM public.integrations;

GRANT SELECT ON public.integrations_public TO authenticated;
GRANT SELECT ON public.integrations_public TO service_role;

-- 3. pco_oauth_states (CSRF / handshake)
CREATE TABLE IF NOT EXISTS public.pco_oauth_states (
  state text PRIMARY KEY,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('org','user')),
  redirect_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  consumed_at timestamptz
);

GRANT ALL ON public.pco_oauth_states TO service_role;
ALTER TABLE public.pco_oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated. Service role bypasses RLS.

CREATE INDEX IF NOT EXISTS idx_pco_oauth_states_expires ON public.pco_oauth_states(expires_at);

-- 4. user_pco_connections
CREATE TABLE IF NOT EXISTS public.user_pco_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  pc_person_id text,
  email text,
  oauth_access_token text,
  oauth_refresh_token text,
  oauth_token_expires_at timestamptz,
  oauth_scopes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','reauth_required','revoked')),
  provider_account_id text,
  permissions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  permissions_refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

GRANT SELECT ON public.user_pco_connections TO authenticated;
GRANT ALL ON public.user_pco_connections TO service_role;

ALTER TABLE public.user_pco_connections ENABLE ROW LEVEL SECURITY;

-- Users may read non-token metadata of their own row via a view; for the base table block direct SELECT
-- but allow them to see their own row (token columns will be hidden via a view below)
CREATE POLICY "Users can view own pco connection"
  ON public.user_pco_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_pco_connections_updated_at
  BEFORE UPDATE ON public.user_pco_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Safe view excluding tokens (preferred read path from app)
DROP VIEW IF EXISTS public.user_pco_connections_public;
CREATE VIEW public.user_pco_connections_public
WITH (security_invoker=on) AS
SELECT
  id, user_id, organization_id, pc_person_id, email,
  oauth_token_expires_at, oauth_scopes, status, provider_account_id,
  permissions_json, permissions_refreshed_at, created_at, updated_at
FROM public.user_pco_connections;

GRANT SELECT ON public.user_pco_connections_public TO authenticated;
GRANT SELECT ON public.user_pco_connections_public TO service_role;
