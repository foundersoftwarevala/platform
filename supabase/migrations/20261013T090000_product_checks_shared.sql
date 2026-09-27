-- One definition of "is this product fit to publish".
--
-- `mm_submission_checks` already held the real gate: product name, description
-- length, category, price, licence, demo, imagery, the seller record read from
-- Author Manager, and any unresolved violation read from Legal Manager. It is
-- correct, and it is the reason the Approval Workflow can refuse an approval
-- the UI would otherwise have allowed.
--
-- What it could not do was answer the question the Quality Gate screen asks,
-- which is about the catalogue rather than about one submission: how many
-- products would pass, and which check is failing most often. That screen has
-- been showing nine hardcoded checks against a product called "Vala ERP Pro"
-- that is not in the catalogue, over the counts 146 / 24 / 6 / 82%.
--
-- The obvious way to answer it would be to write the same eleven checks a
-- second time, as a set-based query over marketplace_products. That is exactly
-- the duplicate source of truth to avoid: the two would drift, and then the
-- screen and the gate would disagree about what "ready" means.
--
-- So the checks move into mm_product_checks, and mm_submission_checks calls it.
-- The submission function keeps its own behaviour exactly: the same
-- unknown_submission and product_missing answers, and the same seller — the
-- one recorded on the submission, which is not always the one on the product.
--
--   mm_product_checks(product, seller)  the checks, with the seller stated
--   mm_product_checks(product)          the checks, seller taken from the product
--   mm_submission_checks(submission)    unchanged for every caller

CREATE OR REPLACE FUNCTION public.mm_product_checks(p_product uuid, p_seller uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_p record; v_seller record; v_checks jsonb := '[]'::jsonb;
begin
  select * into v_p from public.marketplace_products where id = p_product;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'product_missing',
      'blocking', true,
      'checks', jsonb_build_array(jsonb_build_object(
        'key','product_exists','label','The product still exists',
        'mandatory', true, 'passed', false,
        'detail','The product this submission refers to has been deleted.')));
  end if;

  select * into v_seller from public.marketplace_sellers where id = p_seller;

  v_checks := jsonb_build_array(
    jsonb_build_object('key','product_exists','label','Product record exists',
      'mandatory', true, 'passed', true, 'detail', v_p.name),

    jsonb_build_object('key','name','label','Product name',
      'mandatory', true, 'passed', coalesce(btrim(v_p.name),'') <> '',
      'detail', coalesce(v_p.name,'missing')),

    jsonb_build_object('key','description','label','Description',
      'mandatory', true, 'passed', length(coalesce(btrim(v_p.description),'')) >= 40,
      'detail', case when coalesce(btrim(v_p.description),'') = '' then 'missing'
                     else format('%s characters', length(btrim(v_p.description))) end),

    jsonb_build_object('key','category','label','Category assigned',
      'mandatory', true, 'passed', v_p.category_id is not null,
      'detail', coalesce((select name from public.marketplace_categories c
                           where c.id = v_p.category_id), 'no category')),

    jsonb_build_object('key','pricing','label','Price set',
      'mandatory', true, 'passed', coalesce(btrim(v_p.price_label),'') <> '',
      'detail', coalesce(nullif(btrim(v_p.price_label),''),'missing')),

    jsonb_build_object('key','license','label','Licence stated',
      'mandatory', true, 'passed', coalesce(btrim(v_p.license),'') <> '',
      'detail', coalesce(nullif(btrim(v_p.license),''),'missing')),

    jsonb_build_object('key','demo','label','Live demo',
      'mandatory', false, 'passed', coalesce(btrim(v_p.demo_url),'') <> '',
      'detail', coalesce(nullif(btrim(v_p.demo_url),''),'no demo URL')),

    jsonb_build_object('key','media','label','Product imagery',
      'mandatory', false,
      'passed', coalesce(btrim(v_p.thumbnail_url),'') <> ''
             or coalesce(btrim(v_p.cover_image),'') <> '',
      'detail', case when coalesce(btrim(v_p.thumbnail_url),'') <> ''
                       or coalesce(btrim(v_p.cover_image),'') <> ''
                     then 'present' else 'no thumbnail or cover image' end),

    -- Author Manager is the source of truth. This reads it; it never copies it.
    jsonb_build_object('key','author','label','Author record',
      'mandatory', false,
      'passed', v_seller.id is not null,
      'detail', case when v_seller.id is null
                     then 'No seller is attached — this is a first-party product.'
                     else format('%s (%s)', v_seller.display_name, v_seller.status) end),

    jsonb_build_object('key','author_approved','label','Author is approved',
      'mandatory', v_seller.id is not null,
      'passed', v_seller.id is null or v_seller.status = 'approved',
      'detail', case when v_seller.id is null then 'not applicable to a first-party product'
                     else format('seller status is %s', v_seller.status) end),

    -- Legal Manager decides this, not us. An unresolved violation or a failed
    -- binding blocks approval; both tables are read, never written.
    jsonb_build_object('key','legal','label','No blocking legal record',
      'mandatory', true,
      'passed', not exists (
        select 1 from public.legal_violations v
         where v.violator_id = v_p.id::text
           and coalesce(v.status,'open') not in ('resolved','dismissed')),
      'detail', case when exists (
          select 1 from public.legal_violations v
           where v.violator_id = v_p.id::text
             and coalesce(v.status,'open') not in ('resolved','dismissed'))
        then 'Legal Manager has an unresolved violation against this product.'
        else 'No unresolved violation recorded in Legal Manager.' end)
  );

  return jsonb_build_object(
    'ok', true,
    'checks', v_checks,
    'mandatory_failed', (select count(*) from jsonb_array_elements(v_checks) c
                          where (c->>'mandatory')::boolean and not (c->>'passed')::boolean),
    'advisory_failed', (select count(*) from jsonb_array_elements(v_checks) c
                         where not (c->>'mandatory')::boolean and not (c->>'passed')::boolean),
    'blocking', (select count(*) from jsonb_array_elements(v_checks) c
                  where (c->>'mandatory')::boolean and not (c->>'passed')::boolean) > 0);
end;
$function$;

-- The catalogue-facing form: the seller is whoever the product says it is.
CREATE OR REPLACE FUNCTION public.mm_product_checks(p_product uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.mm_product_checks(
    p_product,
    (SELECT seller_id FROM public.marketplace_products WHERE id = p_product));
$function$;

-- Unchanged for every caller: same answers, same seller, one less copy of the
-- checks. The submission's own seller is passed through explicitly, because a
-- submission can name a seller the product record does not.
CREATE OR REPLACE FUNCTION public.mm_submission_checks(p_submission uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_s record;
begin
  select * into v_s from public.author_submissions where id = p_submission;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_submission');
  end if;

  return public.mm_product_checks(v_s.product_id, v_s.seller_id);
end;
$function$;

REVOKE ALL ON FUNCTION public.mm_product_checks(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.mm_product_checks(uuid)       FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_product_checks(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mm_product_checks(uuid)       TO service_role;

COMMENT ON FUNCTION public.mm_product_checks(uuid, uuid) IS
  'The publish gate for one product, against a stated seller: name, description, category, price, licence, demo, imagery, the seller record from Author Manager and any unresolved violation from Legal Manager. The single definition of ready — mm_submission_checks and the Quality Gate overview both call it.';

COMMENT ON FUNCTION public.mm_product_checks(uuid) IS
  'mm_product_checks for a product, taking the seller from the product record. For catalogue-wide checks, where there is no submission to name a seller.';
