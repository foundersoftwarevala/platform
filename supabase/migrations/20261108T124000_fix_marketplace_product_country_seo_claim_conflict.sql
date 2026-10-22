-- The claim RPC returns a product_id column; naming the ON CONFLICT columns
-- therefore collides with its PL/pgSQL output parameter. Target the existing
-- unique constraint by name instead.
DO $$
DECLARE
  function_definition text;
  old_clause constant text := 'ON CONFLICT (product_id, country_code) DO NOTHING';
  new_clause constant text :=
    'ON CONFLICT ON CONSTRAINT marketplace_product_country_seo_product_country_key DO NOTHING';
BEGIN
  IF to_regprocedure('public.claim_marketplace_product_country_seo_batch(jsonb,integer)') IS NULL THEN
    RAISE EXCEPTION 'Marketplace product-country SEO claim RPC is missing';
  END IF;

  function_definition := pg_get_functiondef(
    'public.claim_marketplace_product_country_seo_batch(jsonb,integer)'::regprocedure
  );

  IF position(new_clause IN function_definition) > 0 THEN
    RETURN;
  END IF;

  IF position(old_clause IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace SEO claim RPC has an unexpected conflict clause';
  END IF;

  EXECUTE replace(function_definition, old_clause, new_clause);
END;
$$;
