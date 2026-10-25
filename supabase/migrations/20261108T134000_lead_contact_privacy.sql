-- Lead contact details are available to browser clients only through these
-- permission-aware reads. Column grants keep PostgREST from bypassing them.
REVOKE SELECT ON TABLE public.leads FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, name, company, industry, source, sub_source, campaign, category, status,
  priority, temperature, country, state, city, requirements, budget_range,
  deal_value, ai_score, intent_score, conversion_probability, duplicate_score,
  fraud_score, is_duplicate, duplicate_of, spam_reason, lost_reason,
  assigned_agent_id, assigned_at, last_contact_at, next_follow_up, closed_at,
  language, device, ip_address, created_at, updated_at, product_id, cta_action,
  source_page
) ON TABLE public.leads TO authenticated;

CREATE OR REPLACE FUNCTION public.lead_manager_can_read_contacts()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'boss')
      OR public.has_role(auth.uid(), 'founder')
      OR public.has_role(auth.uid(), 'sales')
      OR public.has_role(auth.uid(), 'support')
    );
$$;

CREATE OR REPLACE FUNCTION public.lead_manager_can_unmask_contacts()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT coalesce(bool_and(agent.can_unmask), false)
  FROM public.lead_agents AS agent
  WHERE lower(btrim(agent.email)) = lower(btrim(auth.jwt() ->> 'email'));
$$;

CREATE OR REPLACE FUNCTION public.lead_manager_get_lead(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  lead_row public.leads%ROWTYPE;
  can_unmask boolean;
  phone_digits text;
  masked_phone text;
BEGIN
  IF NOT public.lead_manager_can_read_contacts() THEN
    RAISE EXCEPTION 'Lead Manager access required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO lead_row
  FROM public.leads AS lead
  WHERE lead.id = p_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  can_unmask := public.lead_manager_can_unmask_contacts();
  phone_digits := regexp_replace(coalesce(lead_row.phone, ''), '\D', '', 'g');
  masked_phone := CASE
    WHEN length(phone_digits) > 5 THEN
      left(phone_digits, 2)
      || repeat('*', length(phone_digits) - 5)
      || right(phone_digits, 3)
    ELSE repeat('*', greatest(length(phone_digits), 1))
  END;

  RETURN to_jsonb(lead_row) || jsonb_build_object(
    'email',
    CASE
      WHEN can_unmask THEN lead_row.email
      WHEN position('@' IN lead_row.email) > 0 THEN
        left(split_part(lead_row.email, '@', 1), 1)
        || repeat('*', greatest(length(split_part(lead_row.email, '@', 1)) - 1, 3))
        || '@' || split_part(lead_row.email, '@', 2)
      ELSE '***'
    END,
    'phone', CASE WHEN can_unmask THEN lead_row.phone ELSE masked_phone END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lead_manager_list_leads(
  p_status text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  can_unmask boolean;
  term text := left(btrim(coalesce(p_search, '')), 120);
  result jsonb;
BEGIN
  IF NOT public.lead_manager_can_read_contacts() THEN
    RAISE EXCEPTION 'Lead Manager access required' USING ERRCODE = '42501';
  END IF;

  can_unmask := public.lead_manager_can_unmask_contacts();

  SELECT coalesce(jsonb_agg(page.lead_json ORDER BY page.created_at DESC, page.id DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      lead.id,
      lead.created_at,
      to_jsonb(lead) || jsonb_build_object(
        'email',
        CASE
          WHEN can_unmask THEN lead.email
          WHEN position('@' IN lead.email) > 0 THEN
            left(split_part(lead.email, '@', 1), 1)
            || repeat('*', greatest(length(split_part(lead.email, '@', 1)) - 1, 3))
            || '@' || split_part(lead.email, '@', 2)
          ELSE '***'
        END,
        'phone',
        CASE
          WHEN can_unmask THEN lead.phone
          WHEN length(regexp_replace(coalesce(lead.phone, ''), '\D', '', 'g')) > 5 THEN
            left(regexp_replace(coalesce(lead.phone, ''), '\D', '', 'g'), 2)
            || repeat(
              '*',
              length(regexp_replace(coalesce(lead.phone, ''), '\D', '', 'g')) - 5
            )
            || right(regexp_replace(coalesce(lead.phone, ''), '\D', '', 'g'), 3)
          ELSE repeat(
            '*',
            greatest(length(regexp_replace(coalesce(lead.phone, ''), '\D', '', 'g')), 1)
          )
        END
      ) AS lead_json
    FROM public.leads AS lead
    WHERE (p_status IS NULL OR p_status = '' OR p_status = 'all' OR lead.status::text = p_status)
      AND (p_source IS NULL OR p_source = '' OR p_source = 'all' OR lead.source::text = p_source)
      AND (
        term = ''
        OR strpos(lower(lead.name), lower(term)) > 0
        OR strpos(lower(lead.email), lower(term)) > 0
        OR strpos(lower(coalesce(lead.company, '')), lower(term)) > 0
        OR strpos(lower(coalesce(lead.city, '')), lower(term)) > 0
      )
    ORDER BY lead.created_at DESC, lead.id DESC
    LIMIT least(greatest(coalesce(p_limit, 200), 1), 1000)
    OFFSET greatest(coalesce(p_offset, 0), 0)
  ) AS page;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.lead_manager_can_read_contacts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_manager_can_unmask_contacts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_manager_get_lead(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_manager_list_leads(text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_manager_get_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_manager_list_leads(text, text, text, integer, integer)
  TO authenticated;
