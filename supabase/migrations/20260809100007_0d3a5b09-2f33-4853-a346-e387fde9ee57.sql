CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $fn$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'admin','boss','founder','developer','employee','vendor','author','affiliate',
    'influencer','reseller','franchise','seo','marketing','sales','finance','support',
    'customer','marketplace-user'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $fn$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $fn$;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, username)
SELECT u.id, u.email, split_part(COALESCE(u.email, ''), '@', 1)
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrap_admin AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();

CREATE TABLE IF NOT EXISTS public.license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  status text NOT NULL DEFAULT 'active',
  plan text,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_keys TO authenticated;
GRANT ALL ON public.license_keys TO service_role;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "license_keys_admin_all" ON public.license_keys FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.auth_qr_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_email text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.auth_qr_sessions TO authenticated;
GRANT ALL ON public.auth_qr_sessions TO service_role;
ALTER TABLE public.auth_qr_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qr_admin_all" ON public.auth_qr_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.marketplace_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  image_key text,
  tone text,
  sort_order int NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_categories TO authenticated;
GRANT ALL ON public.marketplace_categories TO service_role;
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.marketplace_categories FOR SELECT USING (is_hidden = false);
CREATE POLICY "categories admin read" ON public.marketplace_categories FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE POLICY "categories admin write" ON public.marketplace_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_marketplace_categories_updated BEFORE UPDATE ON public.marketplace_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketplace_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  industry_label text,
  icon text,
  price_label text NOT NULL DEFAULT '',
  price_period text,
  rating numeric NOT NULL DEFAULT 0,
  downloads int NOT NULL DEFAULT 0,
  downloads_label text,
  badge text CHECK (badge IN ('NEW','HOT','TOP','DEAL') OR badge IS NULL),
  is_featured boolean NOT NULL DEFAULT false,
  is_trending boolean NOT NULL DEFAULT false,
  is_new_release boolean NOT NULL DEFAULT false,
  is_best_seller boolean NOT NULL DEFAULT false,
  is_ai boolean NOT NULL DEFAULT false,
  category_id uuid REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  publish_at timestamptz,
  unpublish_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_products TO authenticated;
GRANT ALL ON public.marketplace_products TO service_role;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.marketplace_products FOR SELECT USING (
  visible = true
  AND (publish_at IS NULL OR publish_at <= now())
  AND (unpublish_at IS NULL OR unpublish_at > now())
);
CREATE POLICY "products admin read" ON public.marketplace_products FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE POLICY "products admin write" ON public.marketplace_products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_marketplace_products_updated BEFORE UPDATE ON public.marketplace_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketplace_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  country text,
  verified boolean NOT NULL DEFAULT false,
  rating numeric NOT NULL DEFAULT 0,
  product_count int NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_vendors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_vendors TO authenticated;
GRANT ALL ON public.marketplace_vendors TO service_role;
ALTER TABLE public.marketplace_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors public read" ON public.marketplace_vendors FOR SELECT USING (visible = true);
CREATE POLICY "vendors admin write" ON public.marketplace_vendors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_marketplace_vendors_updated BEFORE UPDATE ON public.marketplace_vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketplace_homepage_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_homepage_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_homepage_sections TO authenticated;
GRANT ALL ON public.marketplace_homepage_sections TO service_role;
ALTER TABLE public.marketplace_homepage_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sections public read" ON public.marketplace_homepage_sections FOR SELECT USING (enabled = true);
CREATE POLICY "sections admin read" ON public.marketplace_homepage_sections FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE POLICY "sections admin write" ON public.marketplace_homepage_sections FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_marketplace_sections_updated BEFORE UPDATE ON public.marketplace_homepage_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.marketplace_homepage_sections (key, title, sort_order, enabled) VALUES
  ('hero',         'Hero Slides',        10, true),
  ('categories',   'Industries',         20, true),
  ('featured',     'Featured Products',  30, true),
  ('trending',     'Trending',           40, true),
  ('best_sellers', 'Best Sellers',       50, true),
  ('new_releases', 'New Releases',       60, true),
  ('ai_products',  'AI Products',        70, true),
  ('vendors',      'Top Vendors',        80, true);

CREATE TABLE IF NOT EXISTS public.product_demo_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  demo_name TEXT NOT NULL,
  role_name TEXT NOT NULL DEFAULT 'User',
  url TEXT NOT NULL,
  username TEXT,
  password TEXT,
  description TEXT,
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  last_response_ms INTEGER,
  last_http_status INTEGER,
  last_result TEXT NOT NULL DEFAULT 'unknown',
  ssl_valid BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_demo_urls TO authenticated;
GRANT ALL ON public.product_demo_urls TO service_role;
ALTER TABLE public.product_demo_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boss or admin can view demo urls"
  ON public.product_demo_urls FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
CREATE POLICY "Boss or admin can insert demo urls"
  ON public.product_demo_urls FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
CREATE POLICY "Boss or admin can update demo urls"
  ON public.product_demo_urls FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
CREATE POLICY "Boss or admin can delete demo urls"
  ON public.product_demo_urls FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
CREATE TRIGGER update_product_demo_urls_updated_at
  BEFORE UPDATE ON public.product_demo_urls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS product_demo_urls_product_id_idx ON public.product_demo_urls(product_id);
CREATE INDEX IF NOT EXISTS product_demo_urls_status_idx ON public.product_demo_urls(status);

CREATE TABLE public.demo_url_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demo_url_id UUID,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.demo_url_audit_log TO authenticated;
GRANT ALL ON public.demo_url_audit_log TO service_role;
ALTER TABLE public.demo_url_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boss and admin can view audit log"
  ON public.demo_url_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
CREATE POLICY "Authenticated can insert audit entries as self"
  ON public.demo_url_audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE INDEX idx_demo_url_audit_log_demo_url_id ON public.demo_url_audit_log(demo_url_id);
CREATE INDEX idx_demo_url_audit_log_created_at ON public.demo_url_audit_log(created_at DESC);