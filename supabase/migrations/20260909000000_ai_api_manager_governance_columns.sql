-- AI API Manager — governance columns.
--
-- Additive only. Every column is nullable or carries a default, no column is
-- dropped or renamed, no existing row is rewritten, and no table is created.
-- The AI API Manager screens keep reading exactly what they read today.
--
-- Why each column exists, from the Product-wise API Control specification:
--
--   §1 "Each mapping must store: model ID, capability, priority, fallback
--       provider, quota, budget, created by, updated by, timestamps"
--       -> product_apis gains those. It currently stores only product,
--          service_id, enabled, quota_monthly, used_this_month, plan, notes.
--
--   §9 "Clicking a product's usage/cost data must allow tracing Product ->
--       Request ID -> User -> Role -> Provider -> Model -> Capability -> ...
--       -> Wallet transaction -> Audit event"
--       -> usage_events gains those. It currently has no user, role,
--          capability, provider or request identifier, so requests-per-user
--          and requests-per-role cannot be answered at all.
--
--   §14 "indexed product_id, indexed provider_id, indexed model_id, indexed
--        timestamp"
--       -> the indexes at the end. usage_events currently has one index,
--          on occurred_at.

-- ---------------------------------------------------------------- product_apis

ALTER TABLE public.product_apis
  ADD COLUMN IF NOT EXISTS model_id            uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capability          text,
  ADD COLUMN IF NOT EXISTS priority            integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS fallback_service_id uuid REFERENCES public.api_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quota_daily         integer,
  ADD COLUMN IF NOT EXISTS used_today          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS token_quota_monthly bigint,
  ADD COLUMN IF NOT EXISTS tokens_this_month   bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_monthly_usd  numeric(12,4),
  ADD COLUMN IF NOT EXISTS budget_daily_usd    numeric(12,4),
  ADD COLUMN IF NOT EXISTS spend_this_month    numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_concurrent      integer,
  ADD COLUMN IF NOT EXISTS approval_required   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by          uuid,
  ADD COLUMN IF NOT EXISTS updated_by          uuid,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

-- --------------------------------------------------------------- usage_events

ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS user_id        uuid,
  ADD COLUMN IF NOT EXISTS actor_role     text,
  ADD COLUMN IF NOT EXISTS tenant_id      uuid,
  ADD COLUMN IF NOT EXISTS capability     text,
  ADD COLUMN IF NOT EXISTS provider_id    uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_id     text,
  ADD COLUMN IF NOT EXISTS error_category text,
  ADD COLUMN IF NOT EXISTS retry_count    integer NOT NULL DEFAULT 0;

-- ------------------------------------------------- role_api_permissions extras
--
-- §11 asks for provider, model, capability, token and budget limits per role.
-- The table currently holds can_read / can_write / can_admin and a per-minute
-- rate limit only.

ALTER TABLE public.role_api_permissions
  ADD COLUMN IF NOT EXISTS allowed_capabilities text[],
  ADD COLUMN IF NOT EXISTS token_quota_monthly  bigint,
  ADD COLUMN IF NOT EXISTS budget_monthly_usd   numeric(12,4),
  ADD COLUMN IF NOT EXISTS approval_required    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz NOT NULL DEFAULT now();

-- ------------------------------------------------------------------- indexes
--
-- Every analytics query in AI API Manager filters or groups on one of these.

CREATE INDEX IF NOT EXISTS usage_events_product_occurred_idx
  ON public.usage_events (product, occurred_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_service_occurred_idx
  ON public.usage_events (service_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_user_occurred_idx
  ON public.usage_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_role_occurred_idx
  ON public.usage_events (actor_role, occurred_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_source_occurred_idx
  ON public.usage_events (source, occurred_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_success_occurred_idx
  ON public.usage_events (success, occurred_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_request_id_idx
  ON public.usage_events (request_id);

CREATE INDEX IF NOT EXISTS product_apis_product_idx
  ON public.product_apis (product);

CREATE INDEX IF NOT EXISTS product_apis_service_idx
  ON public.product_apis (service_id);

CREATE INDEX IF NOT EXISTS role_api_permissions_role_idx
  ON public.role_api_permissions (role_name);

-- --------------------------------------------------------- enforcement switch
--
-- Reused system_settings rather than a new table. The gate in
-- lib/ai-policy.server.ts reads this key. It stays false until the product
-- mappings name real Software Vala modules, because turning it on before that
-- would refuse every AI request in the platform.

INSERT INTO public.system_settings (key, label, value, value_type, category, description)
VALUES (
  'ai_policy.require_mapping',
  'Require a product API mapping',
  'false',
  'boolean',
  'ai',
  'When true, an AI request from a product with no row in product_apis is refused.'
)
ON CONFLICT (key) DO NOTHING;
