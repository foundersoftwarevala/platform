CREATE TABLE IF NOT EXISTS public.marketplace_product_country_seo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  country_name text NOT NULL,
  generation_status text NOT NULL DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'processing', 'completed', 'failed')),
  meta_title text,
  meta_description text,
  blog_snippet text,
  hashtags text[] NOT NULL DEFAULT '{}',
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text,
  claim_token uuid,
  claimed_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_product_country_seo_product_country_key UNIQUE (product_id, country_code),
  CONSTRAINT marketplace_product_country_seo_claim_check CHECK (
    (generation_status = 'processing' AND claim_token IS NOT NULL AND claimed_at IS NOT NULL)
    OR (generation_status <> 'processing' AND claim_token IS NULL AND claimed_at IS NULL)
  ),
  CONSTRAINT marketplace_product_country_seo_completed_content_check CHECK (
    generation_status <> 'completed'
    OR (
      meta_title IS NOT NULL
      AND length(meta_title) BETWEEN 1 AND 60
      AND meta_description IS NOT NULL
      AND length(meta_description) BETWEEN 1 AND 160
      AND blog_snippet IS NOT NULL
      AND cardinality(hashtags) = 35
      AND hashtags[35] = '#softwarevala'
    )
  )
);

CREATE INDEX IF NOT EXISTS marketplace_product_country_seo_queue_idx
  ON public.marketplace_product_country_seo (created_at, id)
  WHERE generation_status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS marketplace_product_country_seo_claim_expiry_idx
  ON public.marketplace_product_country_seo (claimed_at)
  WHERE generation_status = 'processing';

CREATE INDEX IF NOT EXISTS marketplace_product_country_seo_progress_idx
  ON public.marketplace_product_country_seo (country_code, generation_status, product_id)
  WHERE generation_status IN ('processing', 'completed', 'failed');

CREATE INDEX IF NOT EXISTS marketplace_products_public_seo_eligible_idx
  ON public.marketplace_products (category_id, id)
  WHERE visible = true
    AND content_status = 'published'
    AND moderation_status = 'approved'
    AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.marketplace_product_country_seo_queue_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  last_product_id uuid,
  last_country_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_product_country_seo_cursor_check CHECK (
    (last_product_id IS NULL AND last_country_code IS NULL)
    OR (last_product_id IS NOT NULL AND last_country_code IS NOT NULL)
  )
);

INSERT INTO public.marketplace_product_country_seo_queue_state (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.marketplace_product_country_seo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_product_country_seo FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.marketplace_product_country_seo TO service_role;
ALTER TABLE public.marketplace_product_country_seo_queue_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_product_country_seo_queue_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.marketplace_product_country_seo_queue_state TO service_role;

CREATE OR REPLACE FUNCTION public.claim_marketplace_product_country_seo_batch(
  p_countries jsonb,
  p_limit integer
)
RETURNS TABLE(
  id uuid,
  product_id uuid,
  country_code text,
  country_name text,
  claim_token uuid,
  product_name text,
  category_name text,
  product_description text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  batch_token uuid := gen_random_uuid();
  batch_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  claimed_count integer := 0;
  cursor_product_id uuid;
  cursor_country_code text;
  inserted_id uuid;
  inserted boolean;
  wrapped boolean := false;
  item record;
BEGIN
  IF p_countries IS NULL
    OR jsonb_typeof(p_countries) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_countries) < 1
    OR jsonb_array_length(p_countries) > 100
  THEN
    RAISE EXCEPTION 'Expected between 1 and 100 countries';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_countries) AS country(code text, name text)
    WHERE country.code IS NULL
       OR country.code !~ '^[A-Z]{2}$'
       OR nullif(btrim(country.name), '') IS NULL
  ) OR (
    SELECT count(DISTINCT country.code)
    FROM jsonb_to_recordset(p_countries) AS country(code text, name text)
  ) <> jsonb_array_length(p_countries) THEN
    RAISE EXCEPTION 'Country list contains invalid or duplicate entries';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('marketplace_product_country_seo_claim'));
  SELECT state.last_product_id, state.last_country_code
    INTO cursor_product_id, cursor_country_code
  FROM public.marketplace_product_country_seo_queue_state AS state
  WHERE state.singleton = true
  FOR UPDATE;

  UPDATE public.marketplace_product_country_seo AS queue
  SET generation_status = CASE
        WHEN queue.attempt_count >= 3 THEN 'failed'
        ELSE 'pending'
      END,
      claim_token = NULL,
      claimed_at = NULL,
      last_error = 'The previous generation claim expired.',
      updated_at = now()
  WHERE queue.generation_status = 'processing'
    AND queue.claimed_at < now() - interval '30 minutes';

  FOR item IN
    WITH picked AS (
      SELECT queue.id
      FROM public.marketplace_product_country_seo AS queue
      WHERE queue.generation_status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.marketplace_products AS product
          JOIN public.marketplace_categories AS category
            ON category.id = product.category_id
           AND category.is_hidden = false
          WHERE product.id = queue.product_id
            AND product.visible = true
            AND product.content_status = 'published'
            AND product.moderation_status = 'approved'
            AND product.deleted_at IS NULL
        )
      ORDER BY queue.created_at, queue.id
      LIMIT batch_limit
      FOR UPDATE SKIP LOCKED
    ),
    claimed AS (
    UPDATE public.marketplace_product_country_seo AS queue
    SET generation_status = 'processing',
        claim_token = batch_token,
        claimed_at = now(),
        attempt_count = queue.attempt_count + 1,
        last_error = NULL,
        updated_at = now()
    FROM picked
    WHERE queue.id = picked.id
    RETURNING queue.id, queue.product_id, queue.country_code, queue.country_name, queue.claim_token
    )
    SELECT claimed.id, claimed.product_id, claimed.country_code, claimed.country_name,
           claimed.claim_token, product.name AS product_name,
           coalesce(category.name, product.industry_label, product.subcategory, 'Software')
             AS category_name,
           left(coalesce(product.description, ''), 1800) AS product_description
    FROM claimed
    JOIN public.marketplace_products AS product ON product.id = claimed.product_id
    LEFT JOIN public.marketplace_categories AS category ON category.id = product.category_id
  LOOP
    id := item.id;
    product_id := item.product_id;
    country_code := item.country_code;
    country_name := item.country_name;
    claim_token := item.claim_token;
    product_name := item.product_name;
    category_name := item.category_name;
    product_description := item.product_description;
    RETURN NEXT;
    claimed_count := claimed_count + 1;
  END LOOP;

  WHILE claimed_count < batch_limit LOOP
    SELECT product.id AS product_id,
           country.code AS country_code,
           btrim(country.name) AS country_name,
           product.name AS product_name,
           coalesce(category.name, product.industry_label, product.subcategory, 'Software')
             AS category_name,
           left(coalesce(product.description, ''), 1800) AS product_description
      INTO item
    FROM public.marketplace_products AS product
    JOIN public.marketplace_categories AS category
      ON category.id = product.category_id
     AND category.is_hidden = false
    CROSS JOIN jsonb_to_recordset(p_countries) AS country(code text, name text)
    WHERE product.visible = true
      AND product.content_status = 'published'
      AND product.moderation_status = 'approved'
      AND product.deleted_at IS NULL
      AND (
        cursor_product_id IS NULL
        OR (product.id, country.code) > (cursor_product_id, cursor_country_code)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.marketplace_product_country_seo AS existing
        WHERE existing.product_id = product.id
          AND existing.country_code = country.code
      )
    ORDER BY product.id, country.code
    LIMIT 1;

    IF NOT FOUND THEN
      IF NOT wrapped AND cursor_product_id IS NOT NULL THEN
        cursor_product_id := NULL;
        cursor_country_code := NULL;
        wrapped := true;
        UPDATE public.marketplace_product_country_seo_queue_state
        SET last_product_id = NULL, last_country_code = NULL, updated_at = now()
        WHERE singleton = true;
        CONTINUE;
      END IF;
      EXIT;
    END IF;

    INSERT INTO public.marketplace_product_country_seo (
      product_id, country_code, country_name, generation_status,
      attempt_count, claim_token, claimed_at
    )
    VALUES (
      item.product_id, item.country_code, item.country_name,
      'processing', 1, batch_token, now()
    )
    ON CONFLICT (product_id, country_code) DO NOTHING
    RETURNING id INTO inserted_id;
    inserted := FOUND;

    cursor_product_id := item.product_id;
    cursor_country_code := item.country_code;
    UPDATE public.marketplace_product_country_seo_queue_state
    SET last_product_id = cursor_product_id,
        last_country_code = cursor_country_code,
        updated_at = now()
    WHERE singleton = true;

    IF NOT inserted THEN
      CONTINUE;
    END IF;

    id := inserted_id;
    product_id := item.product_id;
    country_code := item.country_code;
    country_name := item.country_name;
    claim_token := batch_token;
    product_name := item.product_name;
    category_name := item.category_name;
    product_description := item.product_description;
    RETURN NEXT;
    claimed_count := claimed_count + 1;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_product_country_seo_progress(p_countries jsonb)
RETURNS TABLE(
  total_items bigint,
  completed_count bigint,
  processing_count bigint,
  failed_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH countries AS (
    SELECT country.code
    FROM jsonb_to_recordset(p_countries) AS country(code text, name text)
  ),
  eligible_products AS (
    SELECT count(*) AS product_count
    FROM public.marketplace_products AS product
    JOIN public.marketplace_categories AS category
      ON category.id = product.category_id
     AND category.is_hidden = false
    WHERE product.visible = true
      AND product.content_status = 'published'
      AND product.moderation_status = 'approved'
      AND product.deleted_at IS NULL
  ),
  stored AS (
    SELECT
      count(*) FILTER (WHERE queue.generation_status = 'completed') AS completed_count,
      count(*) FILTER (
        WHERE queue.generation_status = 'processing'
          AND queue.claimed_at >= now() - interval '30 minutes'
      ) AS processing_count,
      count(*) FILTER (WHERE queue.generation_status = 'failed') AS failed_count
    FROM public.marketplace_product_country_seo AS queue
    JOIN countries ON countries.code = queue.country_code
    JOIN public.marketplace_products AS product ON product.id = queue.product_id
    JOIN public.marketplace_categories AS category
      ON category.id = product.category_id
     AND category.is_hidden = false
    WHERE product.visible = true
      AND product.content_status = 'published'
      AND product.moderation_status = 'approved'
      AND product.deleted_at IS NULL
  )
  SELECT
    eligible_products.product_count * (SELECT count(*) FROM countries),
    coalesce(stored.completed_count, 0),
    coalesce(stored.processing_count, 0),
    coalesce(stored.failed_count, 0)
  FROM eligible_products CROSS JOIN stored;
$$;

CREATE OR REPLACE FUNCTION public.retry_failed_marketplace_product_country_seo(
  p_countries jsonb,
  p_limit integer
)
RETURNS TABLE(requeued_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requeued bigint;
  batch_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
BEGIN
  WITH retryable AS (
    SELECT queue.id
    FROM public.marketplace_product_country_seo AS queue
    WHERE queue.generation_status = 'failed'
      AND queue.country_code IN (
        SELECT country.code
        FROM jsonb_to_recordset(p_countries) AS country(code text, name text)
      )
      AND EXISTS (
        SELECT 1
        FROM public.marketplace_products AS product
        JOIN public.marketplace_categories AS category
          ON category.id = product.category_id
         AND category.is_hidden = false
        WHERE product.id = queue.product_id
          AND product.visible = true
          AND product.content_status = 'published'
          AND product.moderation_status = 'approved'
          AND product.deleted_at IS NULL
      )
    ORDER BY queue.updated_at, queue.id
    LIMIT batch_limit
    FOR UPDATE OF queue SKIP LOCKED
  )
  UPDATE public.marketplace_product_country_seo AS queue
  SET generation_status = 'pending',
      attempt_count = 0,
      last_error = NULL,
      updated_at = now()
  FROM retryable
  WHERE queue.id = retryable.id;

  GET DIAGNOSTICS requeued = ROW_COUNT;
  RETURN QUERY SELECT requeued;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_marketplace_product_country_seo_batch(jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_product_country_seo_progress(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_failed_marketplace_product_country_seo(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketplace_product_country_seo_batch(jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_product_country_seo_progress(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_failed_marketplace_product_country_seo(jsonb, integer) TO service_role;
