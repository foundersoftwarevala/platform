-- The reference data the module needs to work, and nothing that pretends to be
-- a legal finding.
--
-- Section 10 says jurisdiction configuration must be data-driven rather than
-- conditionals inside components, so the countries the business actually
-- operates in are seeded as rows. Section 19 lists the regulation areas the
-- module should be able to track, so those exist as records to be filled in.
--
-- What is deliberately NOT seeded is any assertion about them. Every row goes
-- in unverified, with no source reference and status 'under_review', because
-- section 35 forbids inventing statutes, regulation numbers or authorities and
-- section 19 forbids hardcoding legal advice as universal truth. Whether GDPR
-- applies to a given product in a given country is a question for a lawyer, not
-- a default value in a migration.
--
-- The source seeds policies with compliance scores and trademark assets with
-- registration numbers. A registration number is a claim about a public
-- register; inventing one is the single most dangerous kind of fabricated data
-- this platform could carry, so none is seeded.

insert into public.legal_jurisdictions (country_code, country_name, default_language, notes) values
  ('IN', 'India',          'en', 'Primary operating jurisdiction. Requirements to be confirmed by counsel.'),
  ('US', 'United States',  'en', 'State-level requirements vary. To be confirmed by counsel.'),
  ('GB', 'United Kingdom', 'en', 'To be confirmed by counsel.'),
  ('AE', 'United Arab Emirates', 'en', 'To be confirmed by counsel.'),
  ('SG', 'Singapore',      'en', 'To be confirmed by counsel.'),
  ('AU', 'Australia',      'en', 'To be confirmed by counsel.'),
  ('CA', 'Canada',         'en', 'To be confirmed by counsel.'),
  ('DE', 'Germany',        'de', 'To be confirmed by counsel.'),
  ('FR', 'France',         'fr', 'To be confirmed by counsel.')
on conflict (country_code) do nothing;

-- The areas section 19 names, as records awaiting review. Applicability,
-- section references and sources are left empty on purpose: they are findings,
-- and a finding nobody has made is not a default.
insert into public.legal_regulations (code, name, country_code, applies_to, status, notes) values
  ('GDPR',        'General Data Protection Regulation', null, 'data_privacy',    'under_review', 'Applicability and obligations to be confirmed by counsel.'),
  ('CCPA',        'California Consumer Privacy Act',    'US',  'data_privacy',    'under_review', 'Applicability and obligations to be confirmed by counsel.'),
  ('DPDP',        'Digital Personal Data Protection',   'IN',  'data_privacy',    'under_review', 'Applicability and obligations to be confirmed by counsel.'),
  ('IT_ACT',      'Information Technology Act',         'IN',  'technology',      'under_review', 'Applicability and obligations to be confirmed by counsel.'),
  ('DMCA',        'Digital Millennium Copyright Act',   'US',  'copyright',       'under_review', 'Applicability and obligations to be confirmed by counsel.'),
  ('CONSUMER_IN', 'Consumer Protection',                'IN',  'consumer',        'under_review', 'Applicability and obligations to be confirmed by counsel.'),
  ('PDPA_SG',     'Personal Data Protection Act',       'SG',  'data_privacy',    'under_review', 'Applicability and obligations to be confirmed by counsel.')
on conflict (code, country_code) do nothing;
