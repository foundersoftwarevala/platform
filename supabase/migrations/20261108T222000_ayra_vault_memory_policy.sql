-- VPS-only AYRA credentials, private memory storage, and global agent respect policy.
-- Apply to sv_platform only. External credential tokens are AES-256-GCM encrypted
-- by the server before insert; browser clients never read the encrypted column.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.ayra_external_credentials (
  service_name text PRIMARY KEY CHECK (service_name IN (
    'google_cloud', 'cloudflare', 'github', 'facebook', 'instagram', 'youtube'
  )),
  encrypted_token text,
  status text NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('not_configured', 'stored', 'revoked')),
  last_updated timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT ayra_external_credentials_encryption CHECK (
    (status = 'stored' AND encrypted_token LIKE 'enc:v1:%')
    OR (status IN ('not_configured', 'revoked') AND encrypted_token IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.ayra_external_credential_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL CHECK (service_name IN (
    'google_cloud', 'cloudflare', 'github', 'facebook', 'instagram', 'youtube'
  )),
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('credential_stored', 'credential_revoked')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ayra_external_credential_audit_recent_idx
  ON public.ayra_external_credential_audit (occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.ayra_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  context text NOT NULL CHECK (length(btrim(context)) BETWEEN 1 AND 2000),
  action_taken text NOT NULL CHECK (length(btrim(action_taken)) BETWEEN 1 AND 1000),
  result text NOT NULL CHECK (length(btrim(result)) BETWEEN 1 AND 2000),
  feedback_score smallint CHECK (feedback_score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ayra_memory_user_recent_idx
  ON public.ayra_memory (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ayra_memory_vectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 2000),
  embedding vector(1536) NOT NULL,
  embedding_model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ayra_memory_vectors_user_recent_idx
  ON public.ayra_memory_vectors (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ayra_memory_vectors_embedding_hnsw_idx
  ON public.ayra_memory_vectors USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS public.ayra_agent_improvement_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  proposal_kind text NOT NULL CHECK (proposal_kind IN ('prompt', 'code_review')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
  proposed_prompt text,
  proposed_patch text,
  base_prompt_hash text,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected')),
  success_rate_snapshot numeric(5,2),
  created_by uuid,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CHECK (proposal_kind <> 'prompt' OR (proposed_prompt IS NOT NULL AND base_prompt_hash IS NOT NULL)),
  CHECK (proposal_kind <> 'code_review' OR proposed_patch IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ayra_agent_improvement_proposals_queue_idx
  ON public.ayra_agent_improvement_proposals (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ayra_agent_prompt_proposal_pending_idx
  ON public.ayra_agent_improvement_proposals (agent_id)
  WHERE proposal_kind = 'prompt' AND status = 'pending_review';

DO $secure_tables$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ayra_external_credentials',
    'ayra_external_credential_audit',
    'ayra_memory',
    'ayra_memory_vectors',
    'ayra_agent_improvement_proposals'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', table_name);
    END IF;
  END LOOP;
END
$secure_tables$;

CREATE OR REPLACE FUNCTION public.ayra_agent_respect_prompt(p_prompt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT CASE
    WHEN position(
      'NEVER use abusive/rude language. Always remain calm, professional, and respectful, regardless of user behavior.'
      IN coalesce(p_prompt, '')
    ) > 0 THEN coalesce(p_prompt, '')
    ELSE concat_ws(
      E'\n\n',
      nullif(btrim(coalesce(p_prompt, '')), ''),
      'NEVER use abusive/rude language. Always remain calm, professional, and respectful, regardless of user behavior.'
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.ayra_agent_respect_policy_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  NEW.system_prompt := public.ayra_agent_respect_prompt(NEW.system_prompt);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ai_agents_respect_policy ON public.ai_agents;
CREATE TRIGGER ai_agents_respect_policy
  BEFORE INSERT OR UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.ayra_agent_respect_policy_trigger();

UPDATE public.ai_agents
   SET system_prompt = public.ayra_agent_respect_prompt(system_prompt)
 WHERE position(
   'NEVER use abusive/rude language. Always remain calm, professional, and respectful, regardless of user behavior.'
   IN coalesce(system_prompt, '')
 ) = 0;

COMMENT ON TABLE public.ayra_external_credentials IS
  'AYRA external service credentials encrypted with server-side AES-256-GCM; token values are never returned to clients.';
COMMENT ON TABLE public.ayra_memory_vectors IS
  'User-scoped local-model memory vectors. Embeddings are generated on the VPS and never sent to an external provider.';
COMMENT ON TABLE public.ayra_agent_improvement_proposals IS
  'Human-review queue only. Proposals do not modify agent prompts or push code until approved.';

COMMIT;
