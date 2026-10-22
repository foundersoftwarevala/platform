-- Qualify the inserted row ID because id is also a PL/pgSQL output parameter.
DO $$
DECLARE
  function_definition text;
  old_insert constant text := 'INSERT INTO public.marketplace_product_country_seo (';
  new_insert constant text := 'INSERT INTO public.marketplace_product_country_seo AS seo_row (';
  old_returning constant text := 'RETURNING id INTO inserted_id;';
  new_returning constant text := 'RETURNING seo_row.id INTO inserted_id;';
BEGIN
  IF to_regprocedure('public.claim_marketplace_product_country_seo_batch(jsonb,integer)') IS NULL THEN
    RAISE EXCEPTION 'Marketplace product-country SEO claim RPC is missing';
  END IF;

  function_definition := pg_get_functiondef(
    'public.claim_marketplace_product_country_seo_batch(jsonb,integer)'::regprocedure
  );

  IF position(old_insert IN function_definition) > 0 THEN
    function_definition := replace(function_definition, old_insert, new_insert);
  ELSIF position(new_insert IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace SEO claim RPC has an unexpected insert target';
  END IF;

  IF position(old_returning IN function_definition) > 0 THEN
    function_definition := replace(function_definition, old_returning, new_returning);
  ELSIF position(new_returning IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace SEO claim RPC has an unexpected returning clause';
  END IF;

  EXECUTE function_definition;
END;
$$;
