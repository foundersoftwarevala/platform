-- Language system foundation.
--
-- 1. i18n_languages: the language registry. The same rows as
--    src/lib/i18n/registry.ts (140 active languages and 2 retired ones kept so
--    stored values still resolve), generated from one table; a test compares them.
--    Linked to registry_languages by ISO 639-1 code where one exists.
-- 2. i18n_resolve_language(): the registry's resolution rules, for SQL.
-- 3. marketplace_translations becomes translation memory. It already held
--    machine translations keyed by (source_hash, locale), but `locale` was
--    whatever string a caller sent ("HI", "Hindi", "AR5"), so one language
--    could be cached under several keys and "AM" was ambiguous. Rows now carry
--    canonical source and target languages, a context, a status, a quality
--    score, the engine that produced them and a version. Existing rows are
--    kept and marked 'legacy': they were produced from ambiguous codes and are
--    never served again, but nothing is deleted.
-- 4. i18n_translation_revisions: every change to a memory row, kept.
-- 5. i18n_glossary_terms: controlled terminology.
-- 6. i18n_request_quota + i18n_consume_quota(): cost control for the public
--    translation endpoint, shared by every server instance.

-- ---------------------------------------------------------------------------
-- 1. Registry
-- ---------------------------------------------------------------------------
create table if not exists public.i18n_languages (
  code               text primary key
                       check (code ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$'),
  iso639_1           text references public.registry_languages(code),
  iso639_3           text not null check (iso639_3 ~ '^[a-z]{3}$'),
  locale             text not null,
  format_locale      text not null,
  plural_locale      text,
  name               text not null,
  native_name        text not null,
  script             text not null check (script ~ '^[A-Z][a-z]{3}$'),
  direction          text not null check (direction in ('ltr', 'rtl')),
  region             text check (region is null or region ~ '^[A-Z]{2}$'),
  flag               text,
  legacy_code        text unique,
  fallback           text[] not null default '{}',
  aliases            text[] not null default '{}',
  sort_order         integer not null,
  enabled            boolean not null default true,
  translation_status text not null default 'machine'
                       check (translation_status in ('source', 'partial', 'complete', 'machine', 'retired')),
  replaced_by        text references public.i18n_languages(code),
  registry_version   text not null,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.i18n_languages is
  'Language registry. Mirrors src/lib/i18n/registry.ts; code is a canonical BCP 47 tag.';

create or replace function public.i18n_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists i18n_languages_touch on public.i18n_languages;
create trigger i18n_languages_touch
  before update on public.i18n_languages
  for each row execute function public.i18n_touch_updated_at();

alter table public.i18n_languages enable row level security;

drop policy if exists i18n_languages_read on public.i18n_languages;
create policy i18n_languages_read on public.i18n_languages
  for select to anon, authenticated using (true);

drop policy if exists i18n_languages_operator_write on public.i18n_languages;
create policy i18n_languages_operator_write on public.i18n_languages
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'boss'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'boss'::public.app_role));

insert into public.i18n_languages
  (code, iso639_1, iso639_3, locale, format_locale, plural_locale, name, native_name, script,
   direction, region, flag, legacy_code, fallback, aliases, replaced_by, sort_order,
   enabled, translation_status, registry_version)
select v.*,
       v.replaced_by is null,
       case
         when v.replaced_by is not null then 'retired'
         when v.code = 'en' then 'source'
         when v.code in ('hi', 'es', 'fr', 'de', 'ar', 'zh-Hans', 'ko', 'ja', 'pt', 'bn', 'ur') then 'partial'
         else 'machine'
       end,
       '2026.09.2'
from (values
  ('en', 'en', 'eng', 'en-US', 'en-US', 'en-US', 'English', 'English', 'Latn', 'ltr', NULL, '🇺🇸', 'EN', ARRAY[]::text[], ARRAY['en-us']::text[], NULL, 1),
  ('hi', 'hi', 'hin', 'hi-IN', 'hi-IN', 'hi-IN', 'Hindi', 'हिन्दी', 'Deva', 'ltr', NULL, '🇮🇳', 'HI', ARRAY['en']::text[], ARRAY[]::text[], NULL, 2),
  ('bn', 'bn', 'ben', 'bn-BD', 'bn-BD', 'bn-BD', 'Bengali', 'বাংলা', 'Beng', 'ltr', NULL, '🇧🇩', 'BN', ARRAY['en']::text[], ARRAY[]::text[], NULL, 3),
  ('ta', 'ta', 'tam', 'ta-IN', 'ta-IN', 'ta-IN', 'Tamil', 'தமிழ்', 'Taml', 'ltr', NULL, '🇮🇳', 'TA', ARRAY['en']::text[], ARRAY[]::text[], NULL, 4),
  ('te', 'te', 'tel', 'te-IN', 'te-IN', 'te-IN', 'Telugu', 'తెలుగు', 'Telu', 'ltr', NULL, '🇮🇳', 'TE', ARRAY['en']::text[], ARRAY[]::text[], NULL, 5),
  ('mr', 'mr', 'mar', 'mr-IN', 'mr-IN', 'mr-IN', 'Marathi', 'मराठी', 'Deva', 'ltr', NULL, '🇮🇳', 'MR', ARRAY['en']::text[], ARRAY[]::text[], NULL, 6),
  ('gu', 'gu', 'guj', 'gu-IN', 'gu-IN', 'gu-IN', 'Gujarati', 'ગુજરાતી', 'Gujr', 'ltr', NULL, '🇮🇳', 'GU', ARRAY['en']::text[], ARRAY[]::text[], NULL, 7),
  ('kn', 'kn', 'kan', 'kn-IN', 'kn-IN', 'kn-IN', 'Kannada', 'ಕನ್ನಡ', 'Knda', 'ltr', NULL, '🇮🇳', 'KN', ARRAY['en']::text[], ARRAY[]::text[], NULL, 8),
  ('ml', 'ml', 'mal', 'ml-IN', 'ml-IN', 'ml-IN', 'Malayalam', 'മലയാളം', 'Mlym', 'ltr', NULL, '🇮🇳', 'ML', ARRAY['en']::text[], ARRAY[]::text[], NULL, 9),
  ('pa', 'pa', 'pan', 'pa-IN', 'pa-IN', 'pa-IN', 'Punjabi', 'ਪੰਜਾਬੀ', 'Guru', 'ltr', NULL, '🇮🇳', 'PA', ARRAY['en']::text[], ARRAY['pa-guru']::text[], NULL, 10),
  ('or', 'or', 'ory', 'or-IN', 'or-IN', 'or-IN', 'Odia', 'ଓଡ଼ିଆ', 'Orya', 'ltr', NULL, '🇮🇳', 'OR', ARRAY['en']::text[], ARRAY[]::text[], NULL, 11),
  ('as', 'as', 'asm', 'as-IN', 'as-IN', 'as-IN', 'Assamese', 'অসমীয়া', 'Beng', 'ltr', NULL, '🇮🇳', 'AS', ARRAY['en']::text[], ARRAY[]::text[], NULL, 12),
  ('ur', 'ur', 'urd', 'ur-PK', 'ur-PK', 'ur-PK', 'Urdu', 'اردو', 'Arab', 'rtl', NULL, '🇵🇰', 'UR', ARRAY['en']::text[], ARRAY[]::text[], NULL, 13),
  ('ne', 'ne', 'nep', 'ne-NP', 'ne-NP', 'ne-NP', 'Nepali', 'नेपाली', 'Deva', 'ltr', NULL, '🇳🇵', 'NE', ARRAY['en']::text[], ARRAY[]::text[], NULL, 14),
  ('si', 'si', 'sin', 'si-LK', 'si-LK', 'si-LK', 'Sinhala', 'සිංහල', 'Sinh', 'ltr', NULL, '🇱🇰', 'SI', ARRAY['en']::text[], ARRAY[]::text[], NULL, 15),
  ('my', 'my', 'mya', 'my-MM', 'my-MM', 'my-MM', 'Burmese', 'မြန်မာ', 'Mymr', 'ltr', NULL, '🇲🇲', 'MY', ARRAY['en']::text[], ARRAY[]::text[], NULL, 16),
  ('th', 'th', 'tha', 'th-TH', 'th-TH', 'th-TH', 'Thai', 'ไทย', 'Thai', 'ltr', NULL, '🇹🇭', 'TH', ARRAY['en']::text[], ARRAY[]::text[], NULL, 17),
  ('lo', 'lo', 'lao', 'lo-LA', 'lo-LA', 'lo-LA', 'Lao', 'ລາວ', 'Laoo', 'ltr', NULL, '🇱🇦', 'LO', ARRAY['en']::text[], ARRAY[]::text[], NULL, 18),
  ('km', 'km', 'khm', 'km-KH', 'km-KH', 'km-KH', 'Khmer', 'ខ្មែរ', 'Khmr', 'ltr', NULL, '🇰🇭', 'KM', ARRAY['en']::text[], ARRAY[]::text[], NULL, 19),
  ('vi', 'vi', 'vie', 'vi-VN', 'vi-VN', 'vi-VN', 'Vietnamese', 'Tiếng Việt', 'Latn', 'ltr', NULL, '🇻🇳', 'VI', ARRAY['en']::text[], ARRAY[]::text[], NULL, 20),
  ('id', 'id', 'ind', 'id-ID', 'id-ID', 'id-ID', 'Indonesian', 'Bahasa Indonesia', 'Latn', 'ltr', NULL, '🇮🇩', 'ID', ARRAY['en']::text[], ARRAY['in']::text[], NULL, 21),
  ('ms', 'ms', 'msa', 'ms-MY', 'ms-MY', 'ms-MY', 'Malay', 'Bahasa Melayu', 'Latn', 'ltr', NULL, '🇲🇾', 'MS', ARRAY['en']::text[], ARRAY[]::text[], NULL, 22),
  ('fil', NULL, 'fil', 'fil-PH', 'fil-PH', 'fil-PH', 'Filipino', 'Filipino', 'Latn', 'ltr', NULL, '🇵🇭', 'TL', ARRAY['en']::text[], ARRAY['tl','tl-ph']::text[], NULL, 23),
  ('zh-Hans', 'zh', 'zho', 'zh-CN', 'zh-CN', 'zh-CN', 'Chinese (Simplified)', '简体中文', 'Hans', 'ltr', NULL, '🇨🇳', 'ZH', ARRAY['en']::text[], ARRAY['zh','zh-cn','zh-sg','zh-my','zh-hans-cn','cmn','cmn-hans']::text[], NULL, 24),
  ('zh-Hant', 'zh', 'zho', 'zh-TW', 'zh-TW', 'zh-TW', 'Chinese (Traditional)', '繁體中文', 'Hant', 'ltr', NULL, '🇹🇼', 'ZT', ARRAY['en']::text[], ARRAY['zh-tw','zh-hk','zh-mo','zh-hant-tw','zh-hant-hk','cmn-hant']::text[], NULL, 25),
  ('jv', 'jv', 'jav', 'jv-ID', 'jv-ID', 'jv-ID', 'Javanese', 'Basa Jawa', 'Latn', 'ltr', NULL, '🇮🇩', NULL, ARRAY['en']::text[], ARRAY[]::text[], NULL, 26),
  ('ja', 'ja', 'jpn', 'ja-JP', 'ja-JP', 'ja-JP', 'Japanese', '日本語', 'Jpan', 'ltr', NULL, '🇯🇵', 'JA', ARRAY['en']::text[], ARRAY[]::text[], NULL, 27),
  ('ko', 'ko', 'kor', 'ko-KR', 'ko-KR', 'ko-KR', 'Korean', '한국어', 'Kore', 'ltr', NULL, '🇰🇷', 'KO', ARRAY['en']::text[], ARRAY[]::text[], NULL, 28),
  ('mn', 'mn', 'mon', 'mn-MN', 'mn-MN', 'mn-MN', 'Mongolian', 'Монгол', 'Cyrl', 'ltr', NULL, '🇲🇳', 'MN', ARRAY['en']::text[], ARRAY['mn-cyrl']::text[], NULL, 29),
  ('ar', 'ar', 'ara', 'ar-SA', 'ar-SA', 'ar-SA', 'Arabic', 'العربية', 'Arab', 'rtl', NULL, '🇸🇦', 'AR', ARRAY['en']::text[], ARRAY[]::text[], NULL, 30),
  ('fa', 'fa', 'fas', 'fa-IR', 'fa-IR', 'fa-IR', 'Persian', 'فارسی', 'Arab', 'rtl', NULL, '🇮🇷', 'FA', ARRAY['en']::text[], ARRAY['pes']::text[], NULL, 31),
  ('ps', 'ps', 'pus', 'ps-AF', 'ps-AF', 'ps-AF', 'Pashto', 'پښتو', 'Arab', 'rtl', NULL, '🇦🇫', 'PS', ARRAY['en']::text[], ARRAY[]::text[], NULL, 32),
  ('ckb', NULL, 'ckb', 'ckb-IQ', 'ckb-IQ', 'ckb-IQ', 'Central Kurdish (Sorani)', 'کوردیی ناوەندی', 'Arab', 'rtl', NULL, '🇮🇶', 'KU', ARRAY['en']::text[], ARRAY['ku-arab','ku-iq','ku-ir']::text[], NULL, 33),
  ('tt', 'tt', 'tat', 'tt-RU', 'tt-RU', 'tr', 'Tatar', 'Татарча', 'Cyrl', 'ltr', NULL, '🇷🇺', NULL, ARRAY['ru','en']::text[], ARRAY[]::text[], NULL, 34),
  ('he', 'he', 'heb', 'he-IL', 'he-IL', 'he-IL', 'Hebrew', 'עברית', 'Hebr', 'rtl', NULL, '🇮🇱', 'HE', ARRAY['en']::text[], ARRAY['iw','iw-il']::text[], NULL, 35),
  ('tr', 'tr', 'tur', 'tr-TR', 'tr-TR', 'tr-TR', 'Turkish', 'Türkçe', 'Latn', 'ltr', NULL, '🇹🇷', 'TR', ARRAY['en']::text[], ARRAY[]::text[], NULL, 36),
  ('az', 'az', 'aze', 'az-AZ', 'az-AZ', 'az-AZ', 'Azerbaijani', 'Azərbaycan', 'Latn', 'ltr', NULL, '🇦🇿', 'AZ', ARRAY['en']::text[], ARRAY['az-latn']::text[], NULL, 37),
  ('hy', 'hy', 'hye', 'hy-AM', 'hy-AM', 'hy-AM', 'Armenian', 'Հայերեն', 'Armn', 'ltr', NULL, '🇦🇲', 'AM', ARRAY['en']::text[], ARRAY[]::text[], NULL, 38),
  ('ka', 'ka', 'kat', 'ka-GE', 'ka-GE', 'ka-GE', 'Georgian', 'ქართული', 'Geor', 'ltr', NULL, '🇬🇪', 'KA', ARRAY['en']::text[], ARRAY[]::text[], NULL, 39),
  ('kk', 'kk', 'kaz', 'kk-KZ', 'kk-KZ', 'kk-KZ', 'Kazakh', 'Қазақша', 'Cyrl', 'ltr', NULL, '🇰🇿', 'KK', ARRAY['en']::text[], ARRAY[]::text[], NULL, 40),
  ('uz', 'uz', 'uzb', 'uz-UZ', 'uz-UZ', 'uz-UZ', 'Uzbek', 'Oʻzbekcha', 'Latn', 'ltr', NULL, '🇺🇿', 'UZ', ARRAY['en']::text[], ARRAY['uz-latn']::text[], NULL, 41),
  ('ky', 'ky', 'kir', 'ky-KG', 'ky-KG', 'ky-KG', 'Kyrgyz', 'Кыргызча', 'Cyrl', 'ltr', NULL, '🇰🇬', 'KY', ARRAY['en']::text[], ARRAY[]::text[], NULL, 42),
  ('tg', 'tg', 'tgk', 'tg-TJ', 'tg-TJ', 'fa', 'Tajik', 'Тоҷикӣ', 'Cyrl', 'ltr', NULL, '🇹🇯', 'TG', ARRAY['en']::text[], ARRAY[]::text[], NULL, 43),
  ('tk', 'tk', 'tuk', 'tk-TM', 'tk-TM', 'tk-TM', 'Turkmen', 'Türkmençe', 'Latn', 'ltr', NULL, '🇹🇲', 'TK', ARRAY['en']::text[], ARRAY[]::text[], NULL, 44),
  ('ru', 'ru', 'rus', 'ru-RU', 'ru-RU', 'ru-RU', 'Russian', 'Русский', 'Cyrl', 'ltr', NULL, '🇷🇺', 'RU', ARRAY['en']::text[], ARRAY[]::text[], NULL, 45),
  ('uk', 'uk', 'ukr', 'uk-UA', 'uk-UA', 'uk-UA', 'Ukrainian', 'Українська', 'Cyrl', 'ltr', NULL, '🇺🇦', 'UK', ARRAY['en']::text[], ARRAY[]::text[], NULL, 46),
  ('be', 'be', 'bel', 'be-BY', 'be-BY', 'be-BY', 'Belarusian', 'Беларуская', 'Cyrl', 'ltr', NULL, '🇧🇾', 'BE', ARRAY['en']::text[], ARRAY[]::text[], NULL, 47),
  ('pl', 'pl', 'pol', 'pl-PL', 'pl-PL', 'pl-PL', 'Polish', 'Polski', 'Latn', 'ltr', NULL, '🇵🇱', 'PL', ARRAY['en']::text[], ARRAY[]::text[], NULL, 48),
  ('cs', 'cs', 'ces', 'cs-CZ', 'cs-CZ', 'cs-CZ', 'Czech', 'Čeština', 'Latn', 'ltr', NULL, '🇨🇿', 'CS', ARRAY['en']::text[], ARRAY[]::text[], NULL, 49),
  ('sk', 'sk', 'slk', 'sk-SK', 'sk-SK', 'sk-SK', 'Slovak', 'Slovenčina', 'Latn', 'ltr', NULL, '🇸🇰', 'SK', ARRAY['en']::text[], ARRAY[]::text[], NULL, 50),
  ('hu', 'hu', 'hun', 'hu-HU', 'hu-HU', 'hu-HU', 'Hungarian', 'Magyar', 'Latn', 'ltr', NULL, '🇭🇺', 'HU', ARRAY['en']::text[], ARRAY[]::text[], NULL, 51),
  ('ro', 'ro', 'ron', 'ro-RO', 'ro-RO', 'ro-RO', 'Romanian', 'Română', 'Latn', 'ltr', NULL, '🇷🇴', 'RO', ARRAY['en']::text[], ARRAY['mo']::text[], NULL, 52),
  ('bg', 'bg', 'bul', 'bg-BG', 'bg-BG', 'bg-BG', 'Bulgarian', 'Български', 'Cyrl', 'ltr', NULL, '🇧🇬', 'BG', ARRAY['en']::text[], ARRAY[]::text[], NULL, 53),
  ('sr', 'sr', 'srp', 'sr-RS', 'sr-RS', 'sr-RS', 'Serbian', 'Српски', 'Cyrl', 'ltr', NULL, '🇷🇸', 'SR', ARRAY['en']::text[], ARRAY['sr-cyrl']::text[], NULL, 54),
  ('hr', 'hr', 'hrv', 'hr-HR', 'hr-HR', 'hr-HR', 'Croatian', 'Hrvatski', 'Latn', 'ltr', NULL, '🇭🇷', 'HR', ARRAY['en']::text[], ARRAY[]::text[], NULL, 55),
  ('bs', 'bs', 'bos', 'bs-BA', 'bs-BA', 'bs-BA', 'Bosnian', 'Bosanski', 'Latn', 'ltr', NULL, '🇧🇦', 'BS', ARRAY['en']::text[], ARRAY['bs-latn']::text[], NULL, 56),
  ('sl', 'sl', 'slv', 'sl-SI', 'sl-SI', 'sl-SI', 'Slovenian', 'Slovenščina', 'Latn', 'ltr', NULL, '🇸🇮', 'SL', ARRAY['en']::text[], ARRAY[]::text[], NULL, 57),
  ('mk', 'mk', 'mkd', 'mk-MK', 'mk-MK', 'mk-MK', 'Macedonian', 'Македонски', 'Cyrl', 'ltr', NULL, '🇲🇰', 'MK', ARRAY['en']::text[], ARRAY[]::text[], NULL, 58),
  ('sq', 'sq', 'sqi', 'sq-AL', 'sq-AL', 'sq-AL', 'Albanian', 'Shqip', 'Latn', 'ltr', NULL, '🇦🇱', 'SQ', ARRAY['en']::text[], ARRAY[]::text[], NULL, 59),
  ('el', 'el', 'ell', 'el-GR', 'el-GR', 'el-GR', 'Greek', 'Ελληνικά', 'Grek', 'ltr', NULL, '🇬🇷', 'EL', ARRAY['en']::text[], ARRAY[]::text[], NULL, 60),
  ('it', 'it', 'ita', 'it-IT', 'it-IT', 'it-IT', 'Italian', 'Italiano', 'Latn', 'ltr', NULL, '🇮🇹', 'IT', ARRAY['en']::text[], ARRAY[]::text[], NULL, 61),
  ('fr', 'fr', 'fra', 'fr-FR', 'fr-FR', 'fr-FR', 'French', 'Français', 'Latn', 'ltr', NULL, '🇫🇷', 'FR', ARRAY['en']::text[], ARRAY[]::text[], NULL, 62),
  ('es', 'es', 'spa', 'es-ES', 'es-ES', 'es-ES', 'Spanish', 'Español', 'Latn', 'ltr', NULL, '🇪🇸', 'ES', ARRAY['en']::text[], ARRAY['es-419']::text[], NULL, 63),
  ('pt', 'pt', 'por', 'pt-PT', 'pt-PT', 'pt-PT', 'Portuguese', 'Português', 'Latn', 'ltr', NULL, '🇵🇹', 'PT', ARRAY['en']::text[], ARRAY[]::text[], NULL, 64),
  ('pt-BR', 'pt', 'por', 'pt-BR', 'pt-BR', 'pt-BR', 'Portuguese (Brazil)', 'Português (Brasil)', 'Latn', 'ltr', 'BR', '🇧🇷', 'BR', ARRAY['pt','en']::text[], ARRAY[]::text[], NULL, 65),
  ('de', 'de', 'deu', 'de-DE', 'de-DE', 'de-DE', 'German', 'Deutsch', 'Latn', 'ltr', NULL, '🇩🇪', 'DE', ARRAY['en']::text[], ARRAY[]::text[], NULL, 66),
  ('nl', 'nl', 'nld', 'nl-NL', 'nl-NL', 'nl-NL', 'Dutch', 'Nederlands', 'Latn', 'ltr', NULL, '🇳🇱', 'NL', ARRAY['en']::text[], ARRAY[]::text[], NULL, 67),
  ('nl-BE', 'nl', 'nld', 'nl-BE', 'nl-BE', 'nl-BE', 'Flemish (Dutch, Belgium)', 'Vlaams (Nederlands, België)', 'Latn', 'ltr', 'BE', '🇧🇪', 'BE2', ARRAY['nl','en']::text[], ARRAY['flemish','vlaams']::text[], NULL, 68),
  ('da', 'da', 'dan', 'da-DK', 'da-DK', 'da-DK', 'Danish', 'Dansk', 'Latn', 'ltr', NULL, '🇩🇰', 'DA', ARRAY['en']::text[], ARRAY[]::text[], NULL, 69),
  ('sv', 'sv', 'swe', 'sv-SE', 'sv-SE', 'sv-SE', 'Swedish', 'Svenska', 'Latn', 'ltr', NULL, '🇸🇪', 'SV', ARRAY['en']::text[], ARRAY[]::text[], NULL, 70),
  ('nb', 'nb', 'nob', 'nb-NO', 'nb-NO', 'nb-NO', 'Norwegian (Bokmål)', 'Norsk bokmål', 'Latn', 'ltr', NULL, '🇳🇴', 'NO', ARRAY['en']::text[], ARRAY['no','no-no','nb-no']::text[], NULL, 71),
  ('fi', 'fi', 'fin', 'fi-FI', 'fi-FI', 'fi-FI', 'Finnish', 'Suomi', 'Latn', 'ltr', NULL, '🇫🇮', 'FI', ARRAY['en']::text[], ARRAY[]::text[], NULL, 72),
  ('is', 'is', 'isl', 'is-IS', 'is-IS', 'is-IS', 'Icelandic', 'Íslenska', 'Latn', 'ltr', NULL, '🇮🇸', 'IS', ARRAY['en']::text[], ARRAY[]::text[], NULL, 73),
  ('et', 'et', 'est', 'et-EE', 'et-EE', 'et-EE', 'Estonian', 'Eesti', 'Latn', 'ltr', NULL, '🇪🇪', 'ET', ARRAY['en']::text[], ARRAY[]::text[], NULL, 74),
  ('lv', 'lv', 'lav', 'lv-LV', 'lv-LV', 'lv-LV', 'Latvian', 'Latviešu', 'Latn', 'ltr', NULL, '🇱🇻', 'LV', ARRAY['en']::text[], ARRAY[]::text[], NULL, 75),
  ('lt', 'lt', 'lit', 'lt-LT', 'lt-LT', 'lt-LT', 'Lithuanian', 'Lietuvių', 'Latn', 'ltr', NULL, '🇱🇹', 'LT', ARRAY['en']::text[], ARRAY[]::text[], NULL, 76),
  ('ga', 'ga', 'gle', 'ga-IE', 'ga-IE', 'ga-IE', 'Irish', 'Gaeilge', 'Latn', 'ltr', NULL, '🇮🇪', 'GA', ARRAY['en']::text[], ARRAY[]::text[], NULL, 77),
  ('gd', 'gd', 'gla', 'gd-GB', 'gd-GB', 'gd-GB', 'Scottish Gaelic', 'Gàidhlig', 'Latn', 'ltr', NULL, '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'GD', ARRAY['en']::text[], ARRAY[]::text[], NULL, 78),
  ('cy', 'cy', 'cym', 'cy-GB', 'cy-GB', 'cy-GB', 'Welsh', 'Cymraeg', 'Latn', 'ltr', NULL, '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'CY', ARRAY['en']::text[], ARRAY[]::text[], NULL, 79),
  ('eu', 'eu', 'eus', 'eu-ES', 'eu-ES', 'eu-ES', 'Basque', 'Euskara', 'Latn', 'ltr', NULL, '🇪🇸', 'EU', ARRAY['en']::text[], ARRAY[]::text[], NULL, 80),
  ('ca', 'ca', 'cat', 'ca-ES', 'ca-ES', 'ca-ES', 'Catalan', 'Català', 'Latn', 'ltr', NULL, '🇪🇸', 'CA', ARRAY['en']::text[], ARRAY[]::text[], NULL, 81),
  ('gl', 'gl', 'glg', 'gl-ES', 'gl-ES', 'gl-ES', 'Galician', 'Galego', 'Latn', 'ltr', NULL, '🇪🇸', 'GL', ARRAY['en']::text[], ARRAY[]::text[], NULL, 82),
  ('mt', 'mt', 'mlt', 'mt-MT', 'mt-MT', 'mt-MT', 'Maltese', 'Malti', 'Latn', 'ltr', NULL, '🇲🇹', 'MT', ARRAY['en']::text[], ARRAY[]::text[], NULL, 83),
  ('lb', 'lb', 'ltz', 'lb-LU', 'lb-LU', 'lb-LU', 'Luxembourgish', 'Lëtzebuergesch', 'Latn', 'ltr', NULL, '🇱🇺', 'LB', ARRAY['en']::text[], ARRAY[]::text[], NULL, 84),
  ('af', 'af', 'afr', 'af-ZA', 'af-ZA', 'af-ZA', 'Afrikaans', 'Afrikaans', 'Latn', 'ltr', NULL, '🇿🇦', 'AF', ARRAY['en']::text[], ARRAY[]::text[], NULL, 85),
  ('zu', 'zu', 'zul', 'zu-ZA', 'zu-ZA', 'zu-ZA', 'Zulu', 'isiZulu', 'Latn', 'ltr', NULL, '🇿🇦', 'ZU', ARRAY['en']::text[], ARRAY[]::text[], NULL, 86),
  ('xh', 'xh', 'xho', 'xh-ZA', 'xh-ZA', 'xh-ZA', 'Xhosa', 'isiXhosa', 'Latn', 'ltr', NULL, '🇿🇦', 'XH', ARRAY['en']::text[], ARRAY[]::text[], NULL, 87),
  ('sw', 'sw', 'swa', 'sw-KE', 'sw-KE', 'sw-KE', 'Swahili', 'Kiswahili', 'Latn', 'ltr', NULL, '🇰🇪', 'SW', ARRAY['en']::text[], ARRAY[]::text[], NULL, 88),
  ('am', 'am', 'amh', 'am-ET', 'am-ET', 'am-ET', 'Amharic', 'አማርኛ', 'Ethi', 'ltr', NULL, '🇪🇹', 'AM2', ARRAY['en']::text[], ARRAY[]::text[], NULL, 89),
  ('ti', 'ti', 'tir', 'ti-ER', 'ti-ER', 'ti-ER', 'Tigrinya', 'ትግርኛ', 'Ethi', 'ltr', NULL, '🇪🇷', 'TI', ARRAY['en']::text[], ARRAY[]::text[], NULL, 90),
  ('so', 'so', 'som', 'so-SO', 'so-SO', 'so-SO', 'Somali', 'Soomaali', 'Latn', 'ltr', NULL, '🇸🇴', 'SO', ARRAY['en']::text[], ARRAY[]::text[], NULL, 91),
  ('ha', 'ha', 'hau', 'ha-NG', 'ha-NG', 'ha-NG', 'Hausa', 'Hausa', 'Latn', 'ltr', NULL, '🇳🇬', 'HA', ARRAY['en']::text[], ARRAY[]::text[], NULL, 92),
  ('yo', 'yo', 'yor', 'yo-NG', 'yo-NG', 'yo-NG', 'Yoruba', 'Yorùbá', 'Latn', 'ltr', NULL, '🇳🇬', 'YO', ARRAY['en']::text[], ARRAY[]::text[], NULL, 93),
  ('ig', 'ig', 'ibo', 'ig-NG', 'ig-NG', 'ig-NG', 'Igbo', 'Igbo', 'Latn', 'ltr', NULL, '🇳🇬', 'IG', ARRAY['en']::text[], ARRAY[]::text[], NULL, 94),
  ('rw', 'rw', 'kin', 'rw-RW', 'rw-RW', 'sw', 'Kinyarwanda', 'Ikinyarwanda', 'Latn', 'ltr', NULL, '🇷🇼', 'RW', ARRAY['en']::text[], ARRAY[]::text[], NULL, 95),
  ('mg', 'mg', 'mlg', 'mg-MG', 'mg-MG', 'mg-MG', 'Malagasy', 'Malagasy', 'Latn', 'ltr', NULL, '🇲🇬', 'MG', ARRAY['en']::text[], ARRAY[]::text[], NULL, 96),
  ('sn', 'sn', 'sna', 'sn-ZW', 'sn-ZW', 'sn-ZW', 'Shona', 'chiShona', 'Latn', 'ltr', NULL, '🇿🇼', 'SN', ARRAY['en']::text[], ARRAY[]::text[], NULL, 97),
  ('st', 'st', 'sot', 'st-LS', 'st-LS', 'st-LS', 'Sesotho', 'Sesotho', 'Latn', 'ltr', NULL, '🇱🇸', 'ST', ARRAY['en']::text[], ARRAY[]::text[], NULL, 98),
  ('tn', 'tn', 'tsn', 'tn-BW', 'tn-BW', 'tn-BW', 'Setswana', 'Setswana', 'Latn', 'ltr', NULL, '🇧🇼', 'TN', ARRAY['en']::text[], ARRAY[]::text[], NULL, 99),
  ('om', 'om', 'orm', 'om-ET', 'om-ET', 'om-ET', 'Oromo', 'Oromoo', 'Latn', 'ltr', NULL, '🇪🇹', NULL, ARRAY['en']::text[], ARRAY[]::text[], NULL, 100),
  ('sg', 'sg', 'sag', 'sg-CF', 'sg-CF', 'sg-CF', 'Sango', 'Sängö', 'Latn', 'ltr', NULL, '🇨🇫', 'SG', ARRAY['en']::text[], ARRAY[]::text[], NULL, 101),
  ('ak', 'ak', 'aka', 'ak-GH', 'ak-GH', 'ak-GH', 'Akan', 'Akan', 'Latn', 'ltr', NULL, '🇬🇭', 'AK', ARRAY['en']::text[], ARRAY[]::text[], NULL, 102),
  ('wo', 'wo', 'wol', 'wo-SN', 'wo-SN', 'wo-SN', 'Wolof', 'Wolof', 'Latn', 'ltr', NULL, '🇸🇳', 'WO', ARRAY['en']::text[], ARRAY[]::text[], NULL, 103),
  ('bm', 'bm', 'bam', 'bm-ML', 'bm-ML', 'bm-ML', 'Bambara', 'Bamanankan', 'Latn', 'ltr', NULL, '🇲🇱', 'BM', ARRAY['en']::text[], ARRAY[]::text[], NULL, 104),
  ('ff', 'ff', 'ful', 'ff-SN', 'ff-SN', 'ff-SN', 'Fulah', 'Fulfulde', 'Latn', 'ltr', NULL, '🇸🇳', 'FF', ARRAY['en']::text[], ARRAY[]::text[], NULL, 105),
  ('ln', 'ln', 'lin', 'ln-CD', 'ln-CD', 'ln-CD', 'Lingala', 'Lingála', 'Latn', 'ltr', NULL, '🇨🇩', 'LN', ARRAY['en']::text[], ARRAY[]::text[], NULL, 106),
  ('ar-EG', 'ar', 'ara', 'ar-EG', 'ar-EG', 'ar-EG', 'Arabic (Egypt)', 'العربية (مصر)', 'Arab', 'rtl', 'EG', '🇪🇬', 'AR2', ARRAY['ar','en']::text[], ARRAY[]::text[], NULL, 107),
  ('ar-AE', 'ar', 'ara', 'ar-AE', 'ar-AE', 'ar-AE', 'Arabic (Gulf)', 'العربية (الخليج)', 'Arab', 'rtl', 'AE', '🇦🇪', 'AR3', ARRAY['ar','en']::text[], ARRAY['ar-kw','ar-qa','ar-bh','ar-om']::text[], NULL, 108),
  ('ar-MA', 'ar', 'ara', 'ar-MA', 'ar-MA', 'ar-MA', 'Arabic (Maghreb)', 'العربية (المغرب العربي)', 'Arab', 'rtl', 'MA', '🇲🇦', 'AR4', ARRAY['ar','en']::text[], ARRAY['ar-dz','ar-tn','ar-ly']::text[], NULL, 109),
  ('es-MX', 'es', 'spa', 'es-MX', 'es-MX', 'es-MX', 'Spanish (Mexico)', 'Español (México)', 'Latn', 'ltr', 'MX', '🇲🇽', 'MX', ARRAY['es','en']::text[], ARRAY[]::text[], NULL, 110),
  ('es-AR', 'es', 'spa', 'es-AR', 'es-AR', 'es-AR', 'Spanish (Argentina)', 'Español (Argentina)', 'Latn', 'ltr', 'AR', '🇦🇷', 'AR5', ARRAY['es','en']::text[], ARRAY[]::text[], NULL, 111),
  ('es-CO', 'es', 'spa', 'es-CO', 'es-CO', 'es-CO', 'Spanish (Colombia)', 'Español (Colombia)', 'Latn', 'ltr', 'CO', '🇨🇴', 'CO', ARRAY['es','en']::text[], ARRAY[]::text[], NULL, 112),
  ('es-CL', 'es', 'spa', 'es-CL', 'es-CL', 'es-CL', 'Spanish (Chile)', 'Español (Chile)', 'Latn', 'ltr', 'CL', '🇨🇱', 'CL', ARRAY['es','en']::text[], ARRAY[]::text[], NULL, 113),
  ('es-PE', 'es', 'spa', 'es-PE', 'es-PE', 'es-PE', 'Spanish (Peru)', 'Español (Perú)', 'Latn', 'ltr', 'PE', '🇵🇪', 'PE', ARRAY['es','en']::text[], ARRAY[]::text[], NULL, 114),
  ('fr-CA', 'fr', 'fra', 'fr-CA', 'fr-CA', 'fr-CA', 'French (Canada)', 'Français (Canada)', 'Latn', 'ltr', 'CA', '🇨🇦', 'FR2', ARRAY['fr','en']::text[], ARRAY[]::text[], NULL, 115),
  ('fr-BE', 'fr', 'fra', 'fr-BE', 'fr-BE', 'fr-BE', 'French (Belgium)', 'Français (Belgique)', 'Latn', 'ltr', 'BE', '🇧🇪', 'FR3', ARRAY['fr','en']::text[], ARRAY[]::text[], NULL, 116),
  ('fr-CH', 'fr', 'fra', 'fr-CH', 'fr-CH', 'fr-CH', 'French (Switzerland)', 'Français (Suisse)', 'Latn', 'ltr', 'CH', '🇨🇭', 'FR4', ARRAY['fr','en']::text[], ARRAY[]::text[], NULL, 117),
  ('de-AT', 'de', 'deu', 'de-AT', 'de-AT', 'de-AT', 'German (Austria)', 'Deutsch (Österreich)', 'Latn', 'ltr', 'AT', '🇦🇹', 'DE2', ARRAY['de','en']::text[], ARRAY[]::text[], NULL, 118),
  ('de-CH', 'de', 'deu', 'de-CH', 'de-CH', 'de-CH', 'German (Switzerland)', 'Deutsch (Schweiz)', 'Latn', 'ltr', 'CH', '🇨🇭', 'DE3', ARRAY['de','en']::text[], ARRAY[]::text[], NULL, 119),
  ('en-GB', 'en', 'eng', 'en-GB', 'en-GB', 'en-GB', 'English (United Kingdom)', 'English (United Kingdom)', 'Latn', 'ltr', 'GB', '🇬🇧', 'EN2', ARRAY['en']::text[], ARRAY['en-uk']::text[], NULL, 120),
  ('en-AU', 'en', 'eng', 'en-AU', 'en-AU', 'en-AU', 'English (Australia)', 'English (Australia)', 'Latn', 'ltr', 'AU', '🇦🇺', 'EN3', ARRAY['en-GB','en']::text[], ARRAY[]::text[], NULL, 121),
  ('en-CA', 'en', 'eng', 'en-CA', 'en-CA', 'en-CA', 'English (Canada)', 'English (Canada)', 'Latn', 'ltr', 'CA', '🇨🇦', 'EN4', ARRAY['en']::text[], ARRAY[]::text[], NULL, 122),
  ('en-IN', 'en', 'eng', 'en-IN', 'en-IN', 'en-IN', 'English (India)', 'English (India)', 'Latn', 'ltr', 'IN', '🇮🇳', 'EN5', ARRAY['en-GB','en']::text[], ARRAY[]::text[], NULL, 123),
  ('en-SG', 'en', 'eng', 'en-SG', 'en-SG', 'en-SG', 'English (Singapore)', 'English (Singapore)', 'Latn', 'ltr', 'SG', '🇸🇬', 'EN6', ARRAY['en-GB','en']::text[], ARRAY[]::text[], NULL, 124),
  ('en-NZ', 'en', 'eng', 'en-NZ', 'en-NZ', 'en-NZ', 'English (New Zealand)', 'English (New Zealand)', 'Latn', 'ltr', 'NZ', '🇳🇿', 'EN7', ARRAY['en-GB','en']::text[], ARRAY[]::text[], NULL, 125),
  ('en-IE', 'en', 'eng', 'en-IE', 'en-IE', 'en-IE', 'English (Ireland)', 'English (Ireland)', 'Latn', 'ltr', 'IE', '🇮🇪', 'EN8', ARRAY['en-GB','en']::text[], ARRAY[]::text[], NULL, 126),
  ('haw', NULL, 'haw', 'haw-US', 'haw-US', 'haw-US', 'Hawaiian', 'ʻŌlelo Hawaiʻi', 'Latn', 'ltr', NULL, '🇺🇸', 'HAW', ARRAY['en']::text[], ARRAY[]::text[], NULL, 127),
  ('sm', 'sm', 'smo', 'sm-WS', 'en-WS', NULL, 'Samoan', 'Gagana Sāmoa', 'Latn', 'ltr', NULL, '🇼🇸', 'SM', ARRAY['en']::text[], ARRAY[]::text[], NULL, 128),
  ('to', 'to', 'ton', 'to-TO', 'to-TO', 'to-TO', 'Tongan', 'Lea Faka-Tonga', 'Latn', 'ltr', NULL, '🇹🇴', 'TO', ARRAY['en']::text[], ARRAY[]::text[], NULL, 129),
  ('fj', 'fj', 'fij', 'fj-FJ', 'en-FJ', NULL, 'Fijian', 'Vosa Vakaviti', 'Latn', 'ltr', NULL, '🇫🇯', 'FJ', ARRAY['en']::text[], ARRAY[]::text[], NULL, 130),
  ('mi', 'mi', 'mri', 'mi-NZ', 'mi-NZ', NULL, 'Māori', 'Te Reo Māori', 'Latn', 'ltr', NULL, '🇳🇿', 'MI', ARRAY['en']::text[], ARRAY[]::text[], NULL, 131),
  ('ht', 'ht', 'hat', 'ht-HT', 'fr-HT', NULL, 'Haitian Creole', 'Kreyòl Ayisyen', 'Latn', 'ltr', NULL, '🇭🇹', 'HT', ARRAY['fr','en']::text[], ARRAY[]::text[], NULL, 132),
  ('gn', 'gn', 'grn', 'gn-PY', 'es-PY', NULL, 'Guarani', 'Avañeʼẽ', 'Latn', 'ltr', NULL, '🇵🇾', 'GN', ARRAY['es','en']::text[], ARRAY[]::text[], NULL, 133),
  ('mai', NULL, 'mai', 'mai-IN', 'mai-IN', 'hi', 'Maithili', 'मैथिली', 'Deva', 'ltr', NULL, '🇮🇳', NULL, ARRAY['hi','en']::text[], ARRAY[]::text[], NULL, 134),
  ('dv', 'dv', 'div', 'dv-MV', 'en-MV', 'dv', 'Dhivehi', 'ދިވެހި', 'Thaa', 'rtl', NULL, '🇲🇻', NULL, ARRAY['en']::text[], ARRAY[]::text[], NULL, 135),
  ('la', 'la', 'lat', 'la', 'it-VA', 'en', 'Latin', 'Latina', 'Latn', 'ltr', NULL, '🇻🇦', 'LA', ARRAY['en']::text[], ARRAY[]::text[], NULL, 136),
  ('eo', 'eo', 'epo', 'eo', 'eo', 'eo', 'Esperanto', 'Esperanto', 'Latn', 'ltr', NULL, '🌐', 'EO', ARRAY['en']::text[], ARRAY[]::text[], NULL, 137),
  ('sd', 'sd', 'snd', 'sd-PK', 'sd-PK', 'sd-PK', 'Sindhi', 'سنڌي', 'Arab', 'rtl', NULL, '🇵🇰', NULL, ARRAY['en']::text[], ARRAY['sd-arab']::text[], NULL, 138),
  ('ug', 'ug', 'uig', 'ug-CN', 'ug-CN', 'ug-CN', 'Uyghur', 'ئۇيغۇرچە', 'Arab', 'rtl', NULL, '🇨🇳', NULL, ARRAY['en']::text[], ARRAY['ug-arab']::text[], NULL, 139),
  ('yi', 'yi', 'yid', 'yi', 'yi', 'yi', 'Yiddish', 'ייִדיש', 'Hebr', 'rtl', NULL, '🌐', NULL, ARRAY['en']::text[], ARRAY['ji']::text[], NULL, 140),
  ('yue', NULL, 'yue', 'yue-HK', 'yue-HK', 'yue-HK', 'Cantonese', '廣東話', 'Hant', 'ltr', NULL, '🇭🇰', 'YU', ARRAY['zh-Hant','en']::text[], ARRAY['yue-hant','yue-hk','zh-yue']::text[], 'zh-Hant', 141),
  ('ng', 'ng', 'ndo', 'ng-NA', 'ng-NA', 'ng-NA', 'Ndonga', 'Oshindonga', 'Latn', 'ltr', NULL, '🇳🇦', 'NG', ARRAY['en']::text[], ARRAY[]::text[], 'en', 142),
  ('ku', 'ku', 'kur', 'ku-TR', 'ku-TR', 'ku-TR', 'Kurdish (Kurmanji)', 'Kurdî (Kurmancî)', 'Latn', 'ltr', NULL, '🇹🇷', NULL, ARRAY['en']::text[], ARRAY['kmr','ku-latn']::text[], 'ckb', 143),
  ('qu', 'qu', 'que', 'qu-PE', 'qu-PE', NULL, 'Quechua', 'Runa Simi', 'Latn', 'ltr', NULL, '🇵🇪', 'QU', ARRAY['es','en']::text[], ARRAY[]::text[], 'es', 144),
  ('ay', 'ay', 'aym', 'ay-BO', 'es-BO', NULL, 'Aymara', 'Aymar aru', 'Latn', 'ltr', NULL, '🇧🇴', 'AY', ARRAY['es','en']::text[], ARRAY[]::text[], 'es', 145)
) as v (code, iso639_1, iso639_3, locale, format_locale, plural_locale, name, native_name,
        script, direction, region, flag, legacy_code, fallback, aliases, replaced_by, sort_order)
where true
on conflict (code) do update set
  iso639_1           = excluded.iso639_1,
  iso639_3           = excluded.iso639_3,
  locale             = excluded.locale,
  format_locale      = excluded.format_locale,
  plural_locale      = excluded.plural_locale,
  name               = excluded.name,
  native_name        = excluded.native_name,
  script             = excluded.script,
  direction          = excluded.direction,
  region             = excluded.region,
  flag               = excluded.flag,
  legacy_code        = excluded.legacy_code,
  fallback           = excluded.fallback,
  aliases            = excluded.aliases,
  replaced_by        = excluded.replaced_by,
  sort_order         = excluded.sort_order,
  registry_version   = excluded.registry_version;
  -- `enabled` and `translation_status` are left alone on conflict: an
  -- operator's decision is not overwritten by a re-run.

-- ---------------------------------------------------------------------------
-- 2. Resolution
-- ---------------------------------------------------------------------------
-- Canonical code for an input, or null. p_legacy reads values written by the
-- previous catalogue ("AM" = Armenian); without it, input is read as a
-- language tag ("am" = Amharic).
create or replace function public.i18n_resolve_language(p_input text, p_legacy boolean default false)
returns text
language sql
stable
set search_path = public
as $$
  with v as (
    select nullif(btrim(p_input), '') as raw,
           lower(replace(btrim(p_input), '_', '-')) as tag
  )
  select coalesce(r.replaced_by, r.code)
  from (
  select coalesce(
    (select l.code from public.i18n_languages l, v
      where p_legacy and l.legacy_code = upper(v.raw) limit 1),
    (select l.code from public.i18n_languages l, v
      where lower(l.code) = v.tag limit 1),
    (select l.code from public.i18n_languages l, v
      where v.tag = any (l.aliases) order by l.sort_order limit 1),
    (select l.code from public.i18n_languages l, v
      where lower(l.code) = split_part(v.tag, '-', 1) limit 1),
    (select l.code from public.i18n_languages l, v
      where split_part(v.tag, '-', 1) = any (l.aliases) order by l.sort_order limit 1),
    (select l.code from public.i18n_languages l, v
      where lower(l.name) = lower(v.raw) or l.native_name = v.raw
      order by l.sort_order limit 1)
  ) as code
  from v
  where v.raw is not null
  ) x
  join public.i18n_languages r on r.code = x.code;
$$;

-- ---------------------------------------------------------------------------
-- 3. Translation memory
-- ---------------------------------------------------------------------------
alter table public.marketplace_translations
  add column if not exists source_language text,
  add column if not exists target_language text,
  add column if not exists translation_key text,
  add column if not exists namespace       text not null default 'ui',
  add column if not exists context         text,
  add column if not exists context_hash    text,
  -- Rows that exist before this migration become 'legacy'; the default is
  -- changed to 'machine' below, after they have taken it.
  add column if not exists status          text not null default 'legacy',
  add column if not exists quality_score   numeric(4, 3),
  add column if not exists quality_flags   text[] not null default '{}',
  add column if not exists engine          text,
  add column if not exists engine_version  text,
  add column if not exists version         integer not null default 1,
  add column if not exists reviewed_by     uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at     timestamptz,
  -- Set by a person's review action; an automatic write never changes it.
  add column if not exists review_note     text,
  add column if not exists metadata        jsonb not null default '{}'::jsonb;

alter table public.marketplace_translations alter column status set default 'machine';

-- Existing rows: canonical languages, the context hash the application
-- computes for namespace 'ui' with no context, and the old locale kept.
update public.marketplace_translations
   set source_language = coalesce(source_language, 'en'),
       target_language = coalesce(target_language, public.i18n_resolve_language(locale, true)),
       context_hash    = coalesce(context_hash,
                           substr(encode(sha256(convert_to(namespace || chr(31) || coalesce(context, ''), 'UTF8')), 'hex'), 1, 32)),
       engine          = coalesce(engine, provider),
       engine_version  = coalesce(engine_version, model),
       metadata        = metadata || jsonb_build_object('legacy_locale', locale)
 where source_language is null or context_hash is null;

-- "HI" and "Hindi" rows for the same sentence now resolve to the same key.
-- The newest keeps it; the others are kept too, detached from the key.
with ranked as (
  select id,
         row_number() over (
           partition by source_hash, source_language, target_language, context_hash
           order by updated_at desc, created_at desc
         ) as rn
    from public.marketplace_translations
   where target_language is not null
)
update public.marketplace_translations t
   set target_language = null,
       metadata = t.metadata || jsonb_build_object('detached_duplicate', true)
  from ranked
 where ranked.id = t.id and ranked.rn > 1;

alter table public.marketplace_translations
  alter column source_language set default 'en',
  alter column source_language set not null,
  alter column context_hash set not null;

alter table public.marketplace_translations
  drop constraint if exists marketplace_translations_source_language_fkey,
  add constraint marketplace_translations_source_language_fkey
    foreign key (source_language) references public.i18n_languages(code) on update cascade,
  drop constraint if exists marketplace_translations_target_language_fkey,
  add constraint marketplace_translations_target_language_fkey
    foreign key (target_language) references public.i18n_languages(code) on update cascade,
  drop constraint if exists marketplace_translations_status_check,
  add constraint marketplace_translations_status_check
    check (status in ('machine', 'verified', 'needs_review', 'rejected', 'legacy', 'stale')),
  drop constraint if exists marketplace_translations_quality_check,
  add constraint marketplace_translations_quality_check
    check (quality_score is null or (quality_score >= 0 and quality_score <= 1)),
  drop constraint if exists marketplace_translations_namespace_check,
  add constraint marketplace_translations_namespace_check
    check (namespace ~ '^[a-z0-9][a-z0-9._-]{0,47}$'),
  drop constraint if exists marketplace_translations_context_hash_check,
  add constraint marketplace_translations_context_hash_check
    check (context_hash ~ '^[0-9a-f]{32}$'),
  -- A live row must name its target language.
  drop constraint if exists marketplace_translations_live_target_check,
  add constraint marketplace_translations_live_target_check
    check (target_language is not null or status in ('legacy', 'stale'));

-- The old key was (source_hash, locale). Memory is keyed by what a
-- translation depends on: the text, both languages and the context.
alter table public.marketplace_translations
  drop constraint if exists marketplace_translations_source_hash_locale_key;

create unique index if not exists marketplace_translations_memory_key
  on public.marketplace_translations (source_hash, source_language, target_language, context_hash);

create index if not exists marketplace_translations_memory_lookup_idx
  on public.marketplace_translations (target_language, source_language, source_hash)
  where status in ('machine', 'verified', 'needs_review', 'rejected');

create index if not exists marketplace_translations_review_idx
  on public.marketplace_translations (status, target_language)
  where status in ('needs_review', 'machine');

comment on column public.marketplace_translations.locale is
  'Deprecated: kept for compatibility, always equal to target_language for new rows.';
comment on column public.marketplace_translations.status is
  'machine: engine output that passed validation (served). verified: reviewed by a person (served, preferred). '
  'needs_review: engine output that failed validation (not served). rejected: refused by a person (not served). '
  'legacy: written before the registry existed (not served). stale: source changed (not served).';

-- Revisions: every change to a memory row.
create table if not exists public.i18n_translation_revisions (
  id               uuid primary key default gen_random_uuid(),
  translation_id   uuid not null references public.marketplace_translations(id) on delete cascade,
  version          integer not null,
  translated_text  text not null,
  status           text not null,
  quality_score    numeric(4, 3),
  engine           text,
  engine_version   text,
  changed_by       uuid,
  changed_at       timestamptz not null default now()
);

create index if not exists i18n_translation_revisions_translation_idx
  on public.i18n_translation_revisions (translation_id, version desc);

alter table public.i18n_translation_revisions enable row level security;

drop policy if exists i18n_translation_revisions_operator_read on public.i18n_translation_revisions;
create policy i18n_translation_revisions_operator_read on public.i18n_translation_revisions
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'boss'::public.app_role));

create or replace function public.i18n_translation_memory_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- An automatic write never replaces a decision a person made. A person
    -- reopening a row sets review_note, which automatic writes never touch.
    if old.status in ('verified', 'rejected')
       and new.status in ('machine', 'needs_review')
       and new.review_note is not distinct from old.review_note then
      return old;
    end if;
    if new.translated_text is distinct from old.translated_text
       or new.status is distinct from old.status then
      insert into public.i18n_translation_revisions
        (translation_id, version, translated_text, status, quality_score, engine, engine_version, changed_by)
      values
        (old.id, old.version, old.translated_text, old.status, old.quality_score, old.engine,
         old.engine_version, auth.uid());
      new.version := old.version + 1;
    end if;
    new.updated_at := now();
  end if;

  if new.status = 'verified' and new.reviewed_at is null then
    new.reviewed_at := now();
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  end if;
  new.locale := coalesce(new.target_language, new.locale);
  return new;
end;
$$;

drop trigger if exists marketplace_translations_memory_guard on public.marketplace_translations;
create trigger marketplace_translations_memory_guard
  before insert or update on public.marketplace_translations
  for each row execute function public.i18n_translation_memory_guard();

-- Public reads see only servable rows. Operators keep full access through
-- "translations operator write"; the server writes with its own key.
drop policy if exists "translations public read" on public.marketplace_translations;
create policy "translations public read"
  on public.marketplace_translations for select
  to anon, authenticated
  using (status in ('machine', 'verified'));

-- ---------------------------------------------------------------------------
-- 5. Glossary
-- ---------------------------------------------------------------------------
-- rule = locked:    source_term is never translated; target_term, when set,
--                   is the one fixed rendering to use instead.
-- rule = preferred: target_term is the rendering the translation should use.
-- rule = forbidden: target_term must not appear in the translation.
-- target_language null means the term applies to every language.
create table if not exists public.i18n_glossary_terms (
  id               uuid primary key default gen_random_uuid(),
  source_language  text not null default 'en'
                     references public.i18n_languages(code) on update cascade,
  target_language  text references public.i18n_languages(code) on update cascade,
  source_term      text not null check (char_length(btrim(source_term)) between 1 and 200),
  target_term      text check (target_term is null or char_length(btrim(target_term)) between 1 and 200),
  rule             text not null default 'preferred'
                     check (rule in ('locked', 'preferred', 'forbidden')),
  case_sensitive   boolean not null default true,
  namespace        text check (namespace is null or namespace ~ '^[a-z0-9][a-z0-9._-]{0,47}$'),
  context          text,
  status           text not null default 'draft'
                     check (status in ('draft', 'approved', 'deprecated')),
  notes            text,
  created_by       uuid references auth.users(id) on delete set null,
  approved_by      uuid references auth.users(id) on delete set null,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint i18n_glossary_target_required
    check (rule = 'locked' or target_term is not null)
);

create unique index if not exists i18n_glossary_terms_unique
  on public.i18n_glossary_terms
     (lower(source_term), source_language, coalesce(target_language, '*'), coalesce(namespace, '*'), rule);

create index if not exists i18n_glossary_terms_lookup_idx
  on public.i18n_glossary_terms (source_language, target_language)
  where status = 'approved';

drop trigger if exists i18n_glossary_terms_touch on public.i18n_glossary_terms;
create trigger i18n_glossary_terms_touch
  before update on public.i18n_glossary_terms
  for each row execute function public.i18n_touch_updated_at();

alter table public.i18n_glossary_terms enable row level security;

drop policy if exists i18n_glossary_read on public.i18n_glossary_terms;
create policy i18n_glossary_read on public.i18n_glossary_terms
  for select to anon, authenticated using (status = 'approved');

drop policy if exists i18n_glossary_operator_write on public.i18n_glossary_terms;
create policy i18n_glossary_operator_write on public.i18n_glossary_terms
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'boss'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'boss'::public.app_role));

-- The platform's own names. These are the trademarks the interface already
-- prints ("Software Vala™", "Vala TV", "Vala AI"); they are never translated.
insert into public.i18n_glossary_terms
  (source_language, target_language, source_term, target_term, rule, case_sensitive, status, notes, approved_at)
values
  ('en', null, 'Software Vala', null, 'locked', true, 'approved', 'Brand name. Never translated.', now()),
  ('en', null, 'Vala TV',       null, 'locked', true, 'approved', 'Product name. Never translated.', now()),
  ('en', null, 'Vala AI',       null, 'locked', true, 'approved', 'Product name. Never translated.', now())
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 6. Quota
-- ---------------------------------------------------------------------------
create table if not exists public.i18n_request_quota (
  subject       text not null,
  window_start  timestamptz not null,
  units         bigint not null default 0,
  primary key (subject, window_start)
);

-- No policies: only the server (service role) reaches this table.
alter table public.i18n_request_quota enable row level security;

-- Adds p_units to the subject's current window and says whether the total is
-- still within p_limit. Atomic across server instances.
create or replace function public.i18n_consume_quota(
  p_subject text,
  p_units integer,
  p_limit bigint,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_units  bigint;
begin
  if p_subject is null or length(p_subject) > 200 or p_units < 0 or p_limit < 0
     or p_window_seconds < 1 then
    raise exception 'invalid quota request';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.i18n_request_quota as q (subject, window_start, units)
  values (p_subject, v_window, p_units)
  on conflict (subject, window_start) do update set units = q.units + excluded.units
  returning q.units into v_units;

  if random() < 0.01 then
    delete from public.i18n_request_quota where window_start < now() - interval '2 days';
  end if;

  return v_units <= p_limit;
end;
$$;

revoke all on function public.i18n_consume_quota(text, integer, bigint, integer) from public, anon, authenticated;
grant execute on function public.i18n_consume_quota(text, integer, bigint, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The top bar's description of the picker, which counted 143 languages and
-- said nothing was translated.
-- ---------------------------------------------------------------------------
update public.marketplace_topbar_modules
   set description = 'Language picker. Languages come from the registry in src/lib/i18n/registry.ts (140 entries, mirrored in i18n_languages).',
       config = config
                - 'note'
                || jsonb_build_object(
                     'source', 'src/lib/i18n/registry.ts',
                     'registry_table', 'i18n_languages',
                     'memory_table', 'marketplace_translations')
 where module_key = 'language';
