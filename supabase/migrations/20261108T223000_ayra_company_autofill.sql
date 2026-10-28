-- VPS-only company profile and explicit field mapping for AYRA form autofill.
-- The browser-side integration only fills same-origin pages; it never submits forms.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ayra_company_profile (
  profile_key text PRIMARY KEY DEFAULT 'softwarevala'
    CHECK (profile_key = 'softwarevala'),
  company_name text NOT NULL DEFAULT '' CHECK (length(company_name) <= 200),
  contact_name text NOT NULL DEFAULT '' CHECK (length(contact_name) <= 200),
  email text NOT NULL DEFAULT '' CHECK (length(email) <= 320),
  phone text NOT NULL DEFAULT '' CHECK (length(phone) <= 80),
  address text NOT NULL DEFAULT '' CHECK (length(address) <= 300),
  address_line_2 text NOT NULL DEFAULT '' CHECK (length(address_line_2) <= 200),
  city text NOT NULL DEFAULT '' CHECK (length(city) <= 120),
  region text NOT NULL DEFAULT '' CHECK (length(region) <= 120),
  postal_code text NOT NULL DEFAULT '' CHECK (length(postal_code) <= 40),
  country text NOT NULL DEFAULT '' CHECK (length(country) <= 120),
  website text NOT NULL DEFAULT '' CHECK (length(website) <= 500),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ayra_form_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_field_name text NOT NULL UNIQUE
    CHECK (form_field_name = lower(btrim(form_field_name)) AND length(form_field_name) BETWEEN 1 AND 120),
  profile_field_name text NOT NULL CHECK (profile_field_name IN (
    'company_name', 'contact_name', 'email', 'phone', 'address',
    'address_line_2', 'city', 'region', 'postal_code', 'country', 'website'
  )),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ayra_form_mappings (form_field_name, profile_field_name) VALUES
  ('company', 'company_name'),
  ('company name', 'company_name'),
  ('business name', 'company_name'),
  ('legal business name', 'company_name'),
  ('organization', 'company_name'),
  ('organization name', 'company_name'),
  ('organization legal name', 'company_name'),
  ('organisation', 'company_name'),
  ('organisation name', 'company_name'),
  ('contact name', 'contact_name'),
  ('contact person', 'contact_name'),
  ('primary contact', 'contact_name'),
  ('email', 'email'),
  ('email address', 'email'),
  ('business email', 'email'),
  ('work email', 'email'),
  ('phone', 'phone'),
  ('phone number', 'phone'),
  ('telephone', 'phone'),
  ('business phone', 'phone'),
  ('work phone', 'phone'),
  ('address', 'address'),
  ('street address', 'address'),
  ('address line 1', 'address'),
  ('address line 1', 'address'),
  ('billing address', 'address'),
  ('company address', 'address'),
  ('address line 2', 'address_line_2'),
  ('address level 1', 'region'),
  ('address level1', 'region'),
  ('address level 2', 'city'),
  ('address level2', 'city'),
  ('suite', 'address_line_2'),
  ('unit', 'address_line_2'),
  ('city', 'city'),
  ('town', 'city'),
  ('state', 'region'),
  ('province', 'region'),
  ('region', 'region'),
  ('postal code', 'postal_code'),
  ('zip', 'postal_code'),
  ('zip code', 'postal_code'),
  ('country', 'country'),
  ('country name', 'country'),
  ('country region', 'country'),
  ('website', 'website'),
  ('company website', 'website'),
  ('business website', 'website'),
  ('url', 'website')
ON CONFLICT (form_field_name) DO NOTHING;

DO $secure_tables$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['ayra_company_profile', 'ayra_form_mappings'] LOOP
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

COMMENT ON TABLE public.ayra_company_profile IS
  'Single executive-managed Software Vala company profile used only for explicitly requested same-origin form autofill.';
COMMENT ON TABLE public.ayra_form_mappings IS
  'Exact normalized form-label aliases mapped to allowlisted company profile fields; values are never used as SQL identifiers.';

COMMIT;
