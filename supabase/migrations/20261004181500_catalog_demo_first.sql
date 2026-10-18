-- Rank active demos before an automatic row's LIMIT is applied. Manual
-- membership is preserved; the catalogue reader partitions its resolved order.
DO $migration$
DECLARE
  definition text;
  anchor text := E'      order by\n        case rw.auto_rule';
  ranking text := E'      order by\n        exists (\n          select 1 from public.product_demo_urls d\n          where d.product_id = p.id and d.status = ''active''\n            and nullif(btrim(d.url), '''') is not null\n        ) desc,\n        case rw.auto_rule';
BEGIN
  SELECT pg_get_functiondef('public.mm_row_products(text)'::regprocedure)
    INTO definition;
  IF position(ranking IN definition) > 0 THEN
    RETURN;
  END IF;
  IF position(anchor IN definition) = 0
     OR length(definition) - length(replace(definition, anchor, '')) <> length(anchor) THEN
    RAISE EXCEPTION 'mm_row_products ordering differs from the verified definition; refusing replacement';
  END IF;
  EXECUTE replace(definition, anchor, ranking);
END;
$migration$;
