-- Make "Duplicates blocked" true.
--
-- The Bulk Add screen tells the operator, in its own warning banner, that
-- duplicates are blocked. They were not: `demos` had exactly one unique index,
-- on its primary key, so the same demo URL could be inserted any number of
-- times. With twelve thousand URLs to load, and a load that may be run again
-- after a failure part-way through, that is not a theoretical risk.
--
-- `demos.normalized_url` already existed and was never populated. It is what
-- this needs: a form of the URL that is the same for two links that point at
-- the same demo, so the database can refuse the second one.
--
-- The normalisation is deliberately conservative. It lowercases the scheme and
-- host, drops a default port, drops the fragment and drops one trailing slash.
-- It does NOT touch the path case or the query string, because a demo URL of
-- the form ?tenant=school-2 is a different demo, and collapsing those would
-- lose rows rather than duplicates.

create or replace function public.demo_normalize_url(p_url text)
returns text
language plpgsql immutable as $$
declare
  v text;
  v_lower text;
  v_scheme text;
  v_host text;
  v_rest text;
  v_sep int;
begin
  if p_url is null or btrim(p_url) = '' then
    return null;
  end if;

  v := regexp_replace(btrim(p_url), '#.*$', '');   -- drop the fragment
  v_lower := lower(v);

  -- Postgres's regular expressions do not take an inline (?i) here, so the
  -- scheme and host are found on a lowercased copy and the original is used
  -- for the path, whose case is meaningful and is left alone.
  if v_lower like 'https://%' then
    v_scheme := 'https';
  elsif v_lower like 'http://%' then
    v_scheme := 'http';
  else
    -- Not an absolute http(s) URL. Normalise only the trailing slash rather
    -- than guessing at a scheme.
    return regexp_replace(v, '/+$', '');
  end if;

  v_rest := substring(v from length(v_scheme) + 4);           -- after '://'
  v_sep := coalesce(nullif(strpos(v_rest, '/'), 0), nullif(strpos(v_rest, '?'), 0), 0);
  if v_sep = 0 then
    v_host := v_rest;
    v_rest := '';
  else
    v_host := substring(v_rest from 1 for v_sep - 1);
    v_rest := substring(v_rest from v_sep);
  end if;

  v_host := lower(v_host);
  v_host := regexp_replace(v_host, ':(80|443)$', '');
  v_rest := regexp_replace(v_rest, '/+$', '');                -- drop trailing slash

  return v_scheme || '://' || v_host || v_rest;
end;
$$;

-- Fill it in for anything already there, and keep it filled from now on.
update public.demos
   set normalized_url = public.demo_normalize_url(url)
 where normalized_url is distinct from public.demo_normalize_url(url);

create or replace function public.demos_set_normalized_url()
returns trigger language plpgsql as $$
begin
  new.normalized_url := public.demo_normalize_url(new.url);
  return new;
end;
$$;

drop trigger if exists demos_normalize_url on public.demos;
create trigger demos_normalize_url
  before insert or update of url on public.demos
  for each row execute function public.demos_set_normalized_url();

-- The refusal itself. Partial, because a row with no URL has nothing to
-- collide on - and `url` is NOT NULL, so in practice this covers every row.
create unique index if not exists demos_normalized_url_key
  on public.demos (normalized_url)
  where normalized_url is not null;

comment on column public.demos.normalized_url is
  'The URL in a form that is identical for two links pointing at the same demo. Maintained by a trigger and uniquely indexed, which is what makes the Bulk Add screen''s "duplicates blocked" true.';
