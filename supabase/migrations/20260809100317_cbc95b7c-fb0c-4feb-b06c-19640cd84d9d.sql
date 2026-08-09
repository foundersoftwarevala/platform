CREATE TABLE public.home_hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  kicker text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL,
  highlight text NOT NULL DEFAULT '',
  cta_primary text NOT NULL,
  cta_secondary text NOT NULL,
  cta_link text NOT NULL DEFAULT '/demos',
  gradient text NOT NULL,
  icon_name text NOT NULL,
  accent text NOT NULL,
  position int NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  unpublish_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_hero_slides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_hero_slides TO authenticated;
GRANT ALL ON public.home_hero_slides TO service_role;
ALTER TABLE public.home_hero_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "home_hero public read" ON public.home_hero_slides FOR SELECT TO anon, authenticated
  USING (visible = true AND (published_at IS NULL OR published_at <= now()) AND (unpublish_at IS NULL OR unpublish_at > now()));
CREATE POLICY "home_hero admin read all" ON public.home_hero_slides FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE POLICY "home_hero admin insert" ON public.home_hero_slides FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE POLICY "home_hero admin update" ON public.home_hero_slides FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE POLICY "home_hero admin delete" ON public.home_hero_slides FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_home_hero_updated BEFORE UPDATE ON public.home_hero_slides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.site_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'info',
  link_url text,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_notifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_notifications TO authenticated;
GRANT ALL ON public.site_notifications TO service_role;
ALTER TABLE public.site_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published notifications are public" ON public.site_notifications FOR SELECT USING (is_published = true);
CREATE POLICY "Admins manage notifications" ON public.site_notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_site_notifications_updated BEFORE UPDATE ON public.site_notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.site_notifications (title, body, kind, link_url, sort_order) VALUES
  ('Lifetime deal live — $249', '40% OFF on the full catalog. One-time payment, lifetime access, full source code.', 'promo', '/#pricing', 1),
  ('2-hour delivery guarantee', 'Source code, database and deployment guide delivered within 2 hours of purchase.', 'info', null, 2),
  ('20 live demos available', 'Try any product before you buy — 20 fully hosted live demos across master categories.', 'info', null, 3),
  ('Vendor & reseller applications open', 'Apply as Vendor, Reseller, Author, Affiliate or Franchise partner.', 'update', '/apply', 4),
  ('1 year free support included', 'Every purchase includes 12 months of updates and technical support.', 'info', null, 5);

CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_settings public read" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "site_settings admin write" ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_site_settings_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  badge text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  icon_name text NOT NULL DEFAULT 'PartyPopper',
  gradient text NOT NULL DEFAULT 'from-amber-500 via-orange-500 to-red-500',
  position integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements public read" ON public.announcements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "announcements admin write" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_announcements_updated BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.feature_strip_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  icon_name text NOT NULL DEFAULT 'ShieldCheck',
  color_class text NOT NULL DEFAULT 'text-cyan-300',
  position integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_strip_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feature_strip_items TO authenticated;
GRANT ALL ON public.feature_strip_items TO service_role;
ALTER TABLE public.feature_strip_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_strip public read" ON public.feature_strip_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "feature_strip admin write" ON public.feature_strip_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_feature_strip_updated BEFORE UPDATE ON public.feature_strip_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.homepage_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.homepage_sections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.homepage_sections TO authenticated;
GRANT ALL ON public.homepage_sections TO service_role;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "homepage_sections public read" ON public.homepage_sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "homepage_sections admin write" ON public.homepage_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_homepage_sections_updated BEFORE UPDATE ON public.homepage_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.site_settings (key, value) VALUES
  ('brand', '{"name":"Software Vala","tagline":"- The Name of Trust"}'::jsonb),
  ('header_badges', '{"lifetime_deal":"$249 Lifetime Deal","discount":"40% OFF","show_manager_link":true,"show_boss_portal":true}'::jsonb),
  ('footer', '{"copyright":"© 2024 Software Vala - The Name of Trust. All rights reserved.","tagline":"55 Master Categories • Software Solutions • 20 Live Demos Ready"}'::jsonb);

INSERT INTO public.announcements (title, badge, text, icon_name, gradient, position) VALUES
  ('🎉 Mega Software Sale —', 'Flat 40% OFF', 'Lifetime access on all products!', 'PartyPopper', 'from-amber-500 via-orange-500 to-red-500', 0),
  ('⚡ Instant Deployment —', '2-Hour Delivery', 'Source code + setup delivered same day.', 'Truck', 'from-amber-500 via-orange-500 to-red-500', 1),
  ('🔒 Buyer Protection —', 'No Advance Payment', 'Pay only after live demo approval.', 'ShieldCheck', 'from-amber-500 via-orange-500 to-red-500', 2),
  ('🌍 Global Support —', '24×7 Live Help', 'Human + AI assistance in 12 languages.', 'Headphones', 'from-amber-500 via-orange-500 to-red-500', 3);

INSERT INTO public.feature_strip_items (label, icon_name, color_class, position) VALUES
  ('No Advance Payment', 'ShieldCheck', 'text-emerald-300', 0),
  ('2-Hour Delivery', 'Clock', 'text-cyan-300', 1),
  ('No Hidden Charges', 'BadgeCheck', 'text-amber-300', 2),
  ('Trademark Protected', 'Lock', 'text-rose-300', 3),
  ('204+ Solutions', 'Boxes', 'text-violet-300', 4);

INSERT INTO public.homepage_sections (section_key, label, position, visible) VALUES
  ('hero', 'Hero Carousel', 0, true),
  ('feature_strip', 'Feature Strip', 10, true),
  ('categories', 'Category Slider', 20, true),
  ('festive_banner', 'Festive Banner', 30, true),
  ('featured', 'Featured Products', 40, true),
  ('trending', 'Trending', 50, true),
  ('best_sellers', 'Best Sellers', 60, true),
  ('new_releases', 'New Releases', 70, true),
  ('ai_products', 'AI Products', 80, true),
  ('vendors', 'Top Vendors', 90, true);

DO $$ BEGIN
  CREATE TYPE public.demo_status AS ENUM ('active','inactive','maintenance','down');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.demo_tech_stack AS ENUM ('php','node','java','python','react','angular','vue','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.demo_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demo_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.demo_categories TO authenticated;
GRANT ALL ON public.demo_categories TO service_role;
ALTER TABLE public.demo_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_categories public read" ON public.demo_categories FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "demo_categories admin all" ON public.demo_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));

CREATE TABLE public.demo_technologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  stack public.demo_tech_stack NOT NULL DEFAULT 'other',
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demo_technologies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.demo_technologies TO authenticated;
GRANT ALL ON public.demo_technologies TO service_role;
ALTER TABLE public.demo_technologies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_technologies public read" ON public.demo_technologies FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "demo_technologies admin all" ON public.demo_technologies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));

CREATE TABLE public.demos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  url text NOT NULL,
  normalized_url text,
  masked_url text,
  backup_url text,
  login_url text,
  video_fallback_url text,
  category text NOT NULL DEFAULT 'general',
  category_id uuid REFERENCES public.demo_categories(id) ON DELETE SET NULL,
  technology_id uuid REFERENCES public.demo_technologies(id) ON DELETE SET NULL,
  tech_stack public.demo_tech_stack NOT NULL DEFAULT 'other',
  demo_type text NOT NULL DEFAULT 'live',
  status public.demo_status NOT NULL DEFAULT 'active',
  lifecycle_status text NOT NULL DEFAULT 'live',
  verification_status text NOT NULL DEFAULT 'unverified',
  demo_banner_text text,
  health_score numeric(5,2) NOT NULL DEFAULT 100,
  health_check_interval integer NOT NULL DEFAULT 60,
  http_status integer,
  response_time_ms integer,
  uptime_percentage numeric(5,2) NOT NULL DEFAULT 100,
  last_health_check timestamptz,
  last_verified_at timestamptz,
  expiry_date timestamptz,
  renewal_date timestamptz,
  activated_at timestamptz,
  activated_by uuid,
  is_bulk_created boolean NOT NULL DEFAULT false,
  is_trending boolean NOT NULL DEFAULT false,
  multi_login_enabled boolean NOT NULL DEFAULT false,
  max_concurrent_logins integer NOT NULL DEFAULT 1,
  total_login_roles integer NOT NULL DEFAULT 0,
  disable_destructive boolean NOT NULL DEFAULT true,
  disable_exports boolean NOT NULL DEFAULT true,
  ai_category_suggestion text,
  ai_tech_suggestion text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.demos TO authenticated;
GRANT ALL ON public.demos TO service_role;
ALTER TABLE public.demos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demos public read active" ON public.demos FOR SELECT TO anon, authenticated
  USING (status = 'active' AND (expiry_date IS NULL OR expiry_date > now()));
CREATE POLICY "demos admin read all" ON public.demos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE POLICY "demos admin write" ON public.demos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_demos_updated BEFORE UPDATE ON public.demos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX demos_status_idx ON public.demos(status);
CREATE INDEX demos_category_idx ON public.demos(category);

CREATE TABLE public.product_demo_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  demo_id uuid NOT NULL REFERENCES public.demos(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  linked_by uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, demo_id)
);
GRANT SELECT ON public.product_demo_mappings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_demo_mappings TO authenticated;
GRANT ALL ON public.product_demo_mappings TO service_role;
ALTER TABLE public.product_demo_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mappings public read" ON public.product_demo_mappings FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "mappings admin read all" ON public.product_demo_mappings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE POLICY "mappings admin write" ON public.product_demo_mappings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE INDEX product_demo_mappings_product_idx ON public.product_demo_mappings(product_id);
CREATE INDEX product_demo_mappings_demo_idx ON public.product_demo_mappings(demo_id);

CREATE TABLE public.demo_login_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid NOT NULL REFERENCES public.demos(id) ON DELETE CASCADE,
  role_type text NOT NULL DEFAULT 'user',
  username text NOT NULL,
  password text NOT NULL,
  login_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_login_credentials TO authenticated;
GRANT ALL ON public.demo_login_credentials TO service_role;
ALTER TABLE public.demo_login_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credentials admin all" ON public.demo_login_credentials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));

CREATE TABLE public.demo_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid NOT NULL REFERENCES public.demos(id) ON DELETE CASCADE,
  status public.demo_status NOT NULL DEFAULT 'active',
  response_time integer,
  http_status integer,
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.demo_health TO authenticated;
GRANT ALL ON public.demo_health TO service_role;
ALTER TABLE public.demo_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_health admin all" ON public.demo_health FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE INDEX demo_health_demo_idx ON public.demo_health(demo_id, checked_at DESC);

CREATE TABLE public.demo_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid NOT NULL REFERENCES public.demos(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.marketplace_products(id) ON DELETE SET NULL,
  user_id uuid,
  device_type text,
  browser text,
  country text,
  region text,
  city text,
  referrer text,
  session_duration integer,
  converted boolean NOT NULL DEFAULT false,
  clicked_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.demo_clicks TO anon, authenticated;
GRANT SELECT ON public.demo_clicks TO authenticated;
GRANT ALL ON public.demo_clicks TO service_role;
ALTER TABLE public.demo_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_clicks anyone insert" ON public.demo_clicks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo_clicks admin read" ON public.demo_clicks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE INDEX demo_clicks_demo_idx ON public.demo_clicks(demo_id, clicked_at DESC);

CREATE TABLE public.demo_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid NOT NULL REFERENCES public.demos(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  total_views integer NOT NULL DEFAULT 0,
  unique_views integer NOT NULL DEFAULT 0,
  conversion_count integer NOT NULL DEFAULT 0,
  conversion_rate numeric(5,2) NOT NULL DEFAULT 0,
  bounce_rate numeric(5,2) NOT NULL DEFAULT 0,
  avg_duration_seconds integer NOT NULL DEFAULT 0,
  device_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  region_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (demo_id, date)
);
GRANT SELECT, INSERT, UPDATE ON public.demo_analytics TO authenticated;
GRANT ALL ON public.demo_analytics TO service_role;
ALTER TABLE public.demo_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_analytics admin all" ON public.demo_analytics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));

CREATE TABLE public.demo_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid REFERENCES public.demos(id) ON DELETE CASCADE,
  alert_type text NOT NULL DEFAULT 'health',
  severity text NOT NULL DEFAULT 'medium',
  message text NOT NULL,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_alerts TO authenticated;
GRANT ALL ON public.demo_alerts TO service_role;
ALTER TABLE public.demo_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_alerts admin all" ON public.demo_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));

CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid REFERENCES public.demos(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.marketplace_products(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  company text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.demo_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.demo_requests TO authenticated;
GRANT ALL ON public.demo_requests TO service_role;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_requests anyone insert" ON public.demo_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo_requests admin manage" ON public.demo_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));
CREATE TRIGGER trg_demo_requests_updated BEFORE UPDATE ON public.demo_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();