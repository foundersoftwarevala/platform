import { useState, useRef } from "react";
import { useServerFn } from "@/lib/marketplace-manager/localFn";
import {
  Sparkles,
  Globe2,
  Hash,
  Tag,
  Link as LinkIcon,
  FileCode2,
  Languages,
  Map as MapIcon,
  Bot,
  Image as ImageIcon,
  ShieldCheck,
  CheckCircle2,
  Plus,
  X,
  Loader2,
  Search,
  Smartphone,
  Monitor,
  AlertTriangle,
  Star,
  MessageSquare,
  Linkedin,
  Copy,
  GitCompare,
  XCircle,
  RotateCcw,
  Minus,
} from "lucide-react";
import { Card, EmptyHint, PageHeader, PillButton, StatCard, SubNav } from "../ui";
import { generateSeo } from "@/lib/marketplace-manager/seo-ai.functions";

type PageType = "homepage" | "category" | "product" | "collection";

const PAGE_TYPES: { id: PageType; label: string }[] = [
  { id: "homepage", label: "Homepage" },
  { id: "category", label: "Category" },
  { id: "product", label: "Product" },
  { id: "collection", label: "Collection" },
];

// Global SEO APIs & extensions (worldwide) – free + freemium
const GLOBAL_SEO_APIS = [
  { name: "Google Search Console", region: "Global", free: true, type: "API" },
  { name: "Bing Webmaster Tools", region: "Global", free: true, type: "API" },
  { name: "Yandex Webmaster", region: "RU / CIS", free: true, type: "API" },
  { name: "Baidu Ziyuan", region: "China", free: true, type: "API" },
  { name: "Naver Search Advisor", region: "Korea", free: true, type: "API" },
  { name: "Seznam Webmaster", region: "Czechia", free: true, type: "API" },
  { name: "DuckDuckGo Index", region: "Global", free: true, type: "Crawler" },
  { name: "Brave Search API", region: "Global", free: true, type: "API" },
  { name: "Google PageSpeed Insights", region: "Global", free: true, type: "API" },
  { name: "Google Rich Results Test", region: "Global", free: true, type: "API" },
  { name: "Schema.org Validator", region: "Global", free: true, type: "API" },
  { name: "Open Graph Debugger", region: "Global", free: true, type: "Tool" },
  { name: "Twitter Card Validator", region: "Global", free: true, type: "Tool" },
  { name: "LinkedIn Post Inspector", region: "Global", free: true, type: "Tool" },
  { name: "Ubersuggest API", region: "Global", free: false, type: "API" },
  { name: "SEMrush API", region: "Global", free: false, type: "API" },
  { name: "Ahrefs API", region: "Global", free: false, type: "API" },
  { name: "Moz API", region: "Global", free: false, type: "API" },
  { name: "Serpstat API", region: "Global", free: false, type: "API" },
  { name: "DataForSEO", region: "Global", free: false, type: "API" },
];

const BROWSER_EXTS = [
  "Yoast SEO",
  "Rank Math",
  "All in One SEO",
  "MozBar",
  "SEO Minion",
  "Ahrefs SEO Toolbar",
  "SEMrush SEO Toolbar",
  "Detailed SEO",
  "Keywords Everywhere",
  "META SEO Inspector",
  "SEO META in 1 CLICK",
  "Screaming Frog",
  "Web Developer",
  "Lighthouse",
  "Wappalyzer",
];

// 20 nano/micro SEO controls every page needs
const SEO_CHECKLIST = [
  "Title Tag",
  "Meta Description",
  "H1 Tag",
  "H2/H3 Outline",
  "Canonical URL",
  "Robots Meta",
  "Open Graph",
  "Twitter Card",
  "JSON-LD Schema",
  "Breadcrumb Schema",
  "FAQ Schema",
  "Product Schema",
  "Image Alt Text",
  "Hreflang Tags",
  "Sitemap.xml",
  "Robots.txt",
  "Internal Links",
  "Hashtags / Social",
  "Favicon / Manifest",
  "Core Web Vitals",
];

export function SeoSection() {
  const [tab, setTab] = useState("Page Editor");
  const [pageType, setPageType] = useState<PageType>("homepage");
  const [topic, setTopic] = useState("Software Vala Marketplace");
  const [locale, setLocale] = useState("global / en");
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [h1, setH1] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [twitterTitle, setTwitterTitle] = useState("");
  const [twitterDescription, setTwitterDescription] = useState("");
  const [canonical, setCanonical] = useState("");
  const [schema, setSchema] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [hashDraft, setHashDraft] = useState("");

  const run = useServerFn(generateSeo);

  async function aiFill() {
    setLoading(true);
    try {
      const out = await run({ data: { topic, type: pageType, locale } });
      setTitle(out.title);
      setDescription(out.description);
      setH1(out.h1);
      setKeywords(out.keywords ?? []);
      setHashtags(out.hashtags ?? []);
      setOgTitle(out.ogTitle);
      setOgDescription(out.ogDescription);
      setTwitterTitle(out.twitterTitle);
      setTwitterDescription(out.twitterDescription);
      setCanonical(out.canonical);
      setSchema(out.schema);
    } finally {
      setLoading(false);
    }
  }

  async function aiHashtagsOnly() {
    setLoading(true);
    try {
      const out = await run({ data: { topic, type: pageType, locale } });
      setHashtags(out.hashtags ?? []);
      setKeywords(out.keywords ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="SEO Manager · Global"
        title="SEO Console"
        description="End-to-end SEO: titles, meta, H1, hashtags, schema, OG, Twitter, canonical, hreflang, sitemap and worldwide indexing — with AI auto-generation."
        actions={
          <>
            <PillButton variant="ghost">Export robots.txt</PillButton>
            <PillButton variant="ghost">Generate sitemap.xml</PillButton>
            <PillButton variant="primary">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> AI SEO Assistant
              </span>
            </PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Indexed Pages" value="—" icon={<Globe2 className="h-4 w-4" />} />
        <StatCard label="Organic Traffic" value="—" tone="success" />
        <StatCard label="Top Keywords" value="—" tone="premium" icon={<Hash className="h-4 w-4" />} />
        <StatCard label="Issues" value="—" tone="warning" />
      </div>

      <SubNav
        items={["Page Editor", "Checklist", "Schema", "Hreflang", "Sitemap & Robots", "Global APIs", "Extensions"]}
        active={tab}
        onChange={setTab}
      />

      {tab === "Page Editor" && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* LEFT — Editor */}
          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {PAGE_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPageType(t.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    pageType === t.id
                      ? "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <input
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="w-32 rounded-md border border-border bg-background/40 px-2 py-1 text-xs focus:outline-none"
                  placeholder="locale"
                />
                <button
                  onClick={aiFill}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  AI Auto-Fill
                </button>
              </div>
            </div>

            <Field label="Topic / Page focus">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. CRM Software, Hospital Management ERP"
                className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>

            <Field label="Title Tag" hint={`${title.length}/60`}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={70}
                className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>

            <Field label="Meta Description" hint={`${description.length}/158`}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={180}
                className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>

            <Field label="H1 Heading">
              <input
                value={h1}
                onChange={(e) => setH1(e.target.value)}
                className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>

            <Field
              label="Keywords"
              hint="Manual + AI"
              right={
                <button
                  onClick={aiHashtagsOnly}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-cyan-glow"
                >
                  <Sparkles className="h-3 w-3" /> AI suggest
                </button>
              }
            >
              <TagInput
                items={keywords}
                draft={tagDraft}
                setDraft={setTagDraft}
                onAdd={(v) => setKeywords([...keywords, v])}
                onRemove={(i) => setKeywords(keywords.filter((_, idx) => idx !== i))}
                placeholder="Type and press Enter…"
              />
            </Field>

            <Field
              label="Hashtags"
              hint="# tags · social + on-page"
              right={
                <button
                  onClick={aiHashtagsOnly}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-cyan-glow"
                >
                  <Sparkles className="h-3 w-3" /> AI generate
                </button>
              }
            >
              <TagInput
                items={hashtags}
                draft={hashDraft}
                setDraft={setHashDraft}
                onAdd={(v) =>
                  setHashtags([...hashtags, v.startsWith("#") ? v : `#${v}`])
                }
                onRemove={(i) => setHashtags(hashtags.filter((_, idx) => idx !== i))}
                placeholder="#keyword"
                accent
              />
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="OG Title">
                <input
                  value={ogTitle}
                  onChange={(e) => setOgTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </Field>
              <Field label="OG Description">
                <input
                  value={ogDescription}
                  onChange={(e) => setOgDescription(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </Field>
              <Field label="Twitter Title">
                <input
                  value={twitterTitle}
                  onChange={(e) => setTwitterTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </Field>
              <Field label="Twitter Description">
                <input
                  value={twitterDescription}
                  onChange={(e) => setTwitterDescription(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </Field>
            </div>

            <Field label="Canonical URL">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                <input
                  value={canonical}
                  onChange={(e) => setCanonical(e.target.value)}
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                />
              </div>
            </Field>

            <Field label="JSON-LD Schema">
              <textarea
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </Field>
          </Card>

          {/* RIGHT — Live preview stack */}
          <LivePreviewPanel
            title={title}
            description={description}
            h1={h1}
            canonical={canonical}
            ogTitle={ogTitle}
            ogDescription={ogDescription}
            twitterTitle={twitterTitle}
            twitterDescription={twitterDescription}
            hashtags={hashtags}
            keywords={keywords}
            schema={schema}
          />
        </div>
      )}

      {tab === "Checklist" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {SEO_CHECKLIST.map((c, i) => (
            <Card key={c}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/15 text-[10px] font-bold text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="text-sm font-semibold">{c}</div>
                </div>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <EmptyHint text="Auto-audit when live data connects" />
            </Card>
          ))}
        </div>
      )}

      {tab === "Schema" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[
            "Organization",
            "WebSite + SearchAction",
            "BreadcrumbList",
            "Product",
            "Offer / AggregateOffer",
            "Review / AggregateRating",
            "FAQPage",
            "HowTo",
            "Article",
            "VideoObject",
            "SoftwareApplication",
            "LocalBusiness",
          ].map((s) => (
            <Card key={s}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-accent" />
                  <div className="text-sm font-bold">{s}</div>
                </div>
                <PillButton variant="ghost">Edit JSON-LD</PillButton>
              </div>
              <EmptyHint text="Generates valid schema.org markup" />
            </Card>
          ))}
        </div>
      )}

      {tab === "Hreflang" && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Languages className="h-4 w-4 text-accent" />
            <h3 className="text-base font-bold">Hreflang Matrix</h3>
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {[
              ["en", "Global English"],
              ["en-US", "United States"],
              ["en-GB", "United Kingdom"],
              ["en-IN", "India"],
              ["hi-IN", "Hindi (India)"],
              ["es", "Spanish"],
              ["es-MX", "Spanish (MX)"],
              ["pt-BR", "Portuguese (BR)"],
              ["fr", "French"],
              ["de", "German"],
              ["it", "Italian"],
              ["ru", "Russian"],
              ["zh-CN", "Chinese (CN)"],
              ["zh-TW", "Chinese (TW)"],
              ["ja", "Japanese"],
              ["ko", "Korean"],
              ["ar", "Arabic"],
              ["x-default", "Default fallback"],
            ].map(([code, name]) => (
              <div key={code} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                <div>
                  <div className="text-sm font-semibold">{code}</div>
                  <div className="text-[11px] text-muted-foreground">{name}</div>
                </div>
                <PillButton variant="ghost">Map URL</PillButton>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "Sitemap & Robots" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <MapIcon className="h-4 w-4 text-accent" />
              <h3 className="text-base font-bold">Sitemap</h3>
            </div>
            <ul className="space-y-2 text-sm">
              {["sitemap-index.xml", "sitemap-pages.xml", "sitemap-categories.xml", "sitemap-products.xml", "sitemap-images.xml", "sitemap-news.xml"].map((s) => (
                <li key={s} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2">
                  <span className="font-mono text-xs">/{s}</span>
                  <span className="text-[11px] text-muted-foreground">auto</span>
                </li>
              ))}
            </ul>
            <PillButton variant="primary">Regenerate</PillButton>
          </Card>

          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Bot className="h-4 w-4 text-accent" />
              <h3 className="text-base font-bold">robots.txt</h3>
            </div>
            <pre className="overflow-auto rounded-lg border border-border bg-background/40 p-3 font-mono text-xs">{`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: /sitemap-index.xml`}</pre>
          </Card>
        </div>
      )}

      {tab === "Global APIs" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {GLOBAL_SEO_APIS.map((api) => (
            <Card key={api.name}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold">{api.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {api.region} · {api.type}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    api.free
                      ? "bg-success/15 text-success"
                      : "bg-premium/15 text-premium"
                  }`}
                >
                  {api.free ? "FREE" : "PAID"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <PillButton variant="ghost">Connect</PillButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "Extensions" && (
        <Card>
          <div className="mb-3 text-sm text-muted-foreground">
            Recommended browser extensions used in the SEO workflow:
          </div>
          <div className="flex flex-wrap gap-2">
            {BROWSER_EXTS.map((e) => (
              <span key={e} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/40 px-3 py-1.5 text-xs font-semibold">
                <Tag className="h-3 w-3 text-accent" /> {e}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  right,
  children,
}: {
  label: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
          {right}
        </div>
      </div>
      {children}
    </div>
  );
}

function TagInput({
  items,
  draft,
  setDraft,
  onAdd,
  onRemove,
  placeholder,
  accent,
}: {
  items: string[];
  draft: string;
  setDraft: (v: string) => void;
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              accent
                ? "bg-accent/15 text-accent"
                : "bg-secondary text-foreground"
            }`}
          >
            {t}
            <button onClick={() => onRemove(i)} className="opacity-60 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
              e.preventDefault();
              onAdd(draft.trim());
              setDraft("");
            } else if (e.key === "Backspace" && !draft && items.length) {
              onRemove(items.length - 1);
            }
          }}
          placeholder={placeholder}
          className="min-w-[140px] flex-1 bg-transparent px-2 py-1 text-xs focus:outline-none"
        />
        {draft && (
          <button
            onClick={() => {
              onAdd(draft.trim());
              setDraft("");
            }}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-2 py-1 text-[10px] font-bold text-primary-foreground"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>
    </div>
  );
}

/* =============================================================
   Live SEO + Schema preview
   ============================================================= */

type PreviewProps = {
  title: string;
  description: string;
  h1: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  hashtags: string[];
  keywords: string[];
  schema: string;
};

function LivePreviewPanel(p: PreviewProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [social, setSocial] = useState<"og" | "twitter" | "linkedin">("og");

  const url = `softwarevala.com${p.canonical || "/"}`;
  const displayTitle = p.title || "— Title tag —";
  const displayDesc = p.description || "— Meta description will appear here —";
  const socialTitle =
    social === "twitter"
      ? p.twitterTitle || p.ogTitle || p.title
      : p.ogTitle || p.title;
  const socialDesc =
    social === "twitter"
      ? p.twitterDescription || p.ogDescription || p.description
      : p.ogDescription || p.description;

  // Live scoring
  const checks = [
    { label: "Title 30–60 chars", ok: p.title.length >= 30 && p.title.length <= 60 },
    { label: "Description 120–158 chars", ok: p.description.length >= 120 && p.description.length <= 158 },
    { label: "H1 defined", ok: p.h1.trim().length > 3 },
    { label: "Canonical set", ok: p.canonical.startsWith("/") || p.canonical.startsWith("http") },
    { label: "OG title + description", ok: !!p.ogTitle && !!p.ogDescription },
    { label: "Twitter card fields", ok: !!p.twitterTitle && !!p.twitterDescription },
    { label: "5+ target keywords", ok: p.keywords.length >= 5 },
    { label: "3+ hashtags", ok: p.hashtags.length >= 3 },
    { label: "Valid JSON-LD schema", ok: isValidJson(p.schema) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const scoreTone =
    score >= 85 ? "success" : score >= 60 ? "warning" : "destructive";
  const scoreColor: Record<string, string> = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  const scoreBar: Record<string, string> = {
    success: "from-success/60 to-success",
    warning: "from-warning/60 to-warning",
    destructive: "from-destructive/60 to-destructive",
  };

  const schemaState = analyzeSchema(p.schema);
  const baselineRef = useRef<string>(p.schema);
  const [, forceTick] = useState(0);
  const diff = computeSchemaDiff(baselineRef.current, p.schema);
  const validation = validateSchema(p.schema);
  const errorCount = validation.filter((v) => v.severity === "error").length;
  const warnCount = validation.filter((v) => v.severity === "warning").length;
  const diffTone: "success" | "warning" | "destructive" =
    errorCount ? "destructive" : diff.changed.length || warnCount ? "warning" : "success";

  return (
    <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      {/* SCORE */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Live SEO score
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${scoreColor[scoreTone]}`}>
            {passed}/{checks.length} passing
          </span>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <div className={`font-mono text-4xl font-bold tabular ${scoreColor[scoreTone]}`}>
            {score}
          </div>
          <div className="pb-1.5 text-[11px] text-muted-foreground">/ 100</div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${scoreBar[scoreTone]} transition-all`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-1">
          {checks.map((c) => (
            <div
              key={c.label}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px]"
            >
              {c.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
              )}
              <span className={c.ok ? "text-muted-foreground" : "text-foreground"}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* SERP */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Search className="h-3.5 w-3.5" /> Google SERP
          </div>
          <div className="flex overflow-hidden rounded-full border border-border">
            <button
              onClick={() => setDevice("desktop")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                device === "desktop" ? "bg-accent/15 text-accent" : "text-muted-foreground"
              }`}
            >
              <Monitor className="h-3 w-3" /> Desktop
            </button>
            <button
              onClick={() => setDevice("mobile")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                device === "mobile" ? "bg-accent/15 text-accent" : "text-muted-foreground"
              }`}
            >
              <Smartphone className="h-3 w-3" /> Mobile
            </button>
          </div>
        </div>

        <div
          className={`rounded-xl border border-border bg-white/[0.02] p-4 ${
            device === "mobile" ? "mx-auto max-w-[340px]" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-full bg-white text-[10px] font-bold text-slate-700">
              SV
            </div>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium text-foreground/80">
                Software Vala
              </div>
              <div className="truncate text-[10px] text-muted-foreground">{url}</div>
            </div>
          </div>
          <div
            className={`mt-2 line-clamp-2 font-medium text-[hsl(210_100%_75%)] ${
              device === "mobile" ? "text-[15px]" : "text-[18px]"
            }`}
            style={{ letterSpacing: "-0.01em" }}
          >
            {displayTitle}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px]">
            <div className="flex text-warning">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-3 w-3 fill-current" />
              ))}
            </div>
            <span className="text-muted-foreground">4.9 · 2,847 reviews · Free trial</span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
            {displayDesc}
          </p>
        </div>
      </Card>

      {/* SOCIAL */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" /> Social share
          </div>
          <div className="flex overflow-hidden rounded-full border border-border text-muted-foreground">
            <button
              onClick={() => setSocial("og")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                social === "og" ? "bg-accent/15 text-accent" : ""
              }`}
              title="Facebook / Open Graph"
            >
              OG
            </button>
            <button
              onClick={() => setSocial("twitter")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                social === "twitter" ? "bg-accent/15 text-accent" : ""
              }`}
              title="X / Twitter"
            >
              <MessageSquare className="h-3 w-3" /> X
            </button>
            <button
              onClick={() => setSocial("linkedin")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                social === "linkedin" ? "bg-accent/15 text-accent" : ""
              }`}
              title="LinkedIn"
            >
              <Linkedin className="h-3 w-3" /> In
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <div
            className="relative flex h-32 items-end bg-gradient-to-br from-primary/50 via-surface to-accent/40 p-3"
            aria-hidden
          >
            <span className="rounded-md bg-black/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/80 backdrop-blur">
              1200 × 630 · og:image
            </span>
          </div>
          <div className="space-y-1 border-t border-border bg-background/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              softwarevala.com
            </div>
            <div className="line-clamp-2 text-[13px] font-bold leading-snug">
              {socialTitle || "— Social title —"}
            </div>
            <div className="line-clamp-2 text-[11px] text-muted-foreground">
              {socialDesc || "— Social description —"}
            </div>
          </div>
        </div>
      </Card>

      {/* SCHEMA */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <FileCode2 className="h-3.5 w-3.5" /> JSON-LD schema
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              schemaState.tone === "success"
                ? "border-success/40 bg-success/10 text-success"
                : schemaState.tone === "warning"
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {schemaState.tone === "success" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {schemaState.label}
          </span>
        </div>
        <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
          {p.schema || "// Paste or generate a schema.org JSON-LD block above."}
        </pre>
        {schemaState.type && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground">Detected:</span>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-bold text-accent">
              @type · {schemaState.type}
            </span>
            {schemaState.fields.map((f) => (
              <span
                key={f}
                className="rounded-full bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <PillButton variant="ghost">
            <span className="inline-flex items-center gap-1.5">
              <Copy className="h-3 w-3" /> Copy
            </span>
          </PillButton>
          <PillButton variant="ghost">Rich Results test</PillButton>
        </div>
      </Card>

      {/* SCHEMA DIFF + VALIDATOR OVERLAY */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <GitCompare className="h-3.5 w-3.5" /> Schema diff · validator
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              diffTone === "success"
                ? "border-success/40 bg-success/10 text-success"
                : diffTone === "warning"
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {diffTone === "success" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : diffTone === "warning" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {errorCount
              ? `${errorCount} error${errorCount > 1 ? "s" : ""}`
              : warnCount
              ? `${warnCount} warning${warnCount > 1 ? "s" : ""}`
              : "Clean"}
          </span>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="rounded-md border border-success/30 bg-success/[0.06] px-2 py-1.5 text-center">
            <div className="text-success">+{diff.added.length}</div>
            <div className="uppercase tracking-wider text-muted-foreground">Added</div>
          </div>
          <div className="rounded-md border border-warning/30 bg-warning/[0.06] px-2 py-1.5 text-center">
            <div className="text-warning">~{diff.changed.length}</div>
            <div className="uppercase tracking-wider text-muted-foreground">Changed</div>
          </div>
          <div className="rounded-md border border-destructive/30 bg-destructive/[0.06] px-2 py-1.5 text-center">
            <div className="text-destructive">−{diff.removed.length}</div>
            <div className="uppercase tracking-wider text-muted-foreground">Removed</div>
          </div>
        </div>

        {(diff.added.length + diff.changed.length + diff.removed.length === 0) && (
          <div className="rounded-md border border-dashed border-border bg-background/30 px-3 py-2 text-center text-[11px] text-muted-foreground">
            No changes vs baseline. Edit the schema above to see a diff.
          </div>
        )}

        <div className="max-h-56 space-y-1 overflow-auto rounded-lg border border-border bg-background/60 p-2 font-mono text-[11px]">
          {diff.added.map((r) => (
            <div key={"a-" + r.key} className="flex items-start gap-2 rounded px-1.5 py-0.5 bg-success/[0.07]">
              <Plus className="mt-[3px] h-3 w-3 shrink-0 text-success" />
              <span className="text-success/90">{r.key}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.next}</span>
            </div>
          ))}
          {diff.changed.map((r) => (
            <div key={"c-" + r.key} className="rounded px-1.5 py-0.5 bg-warning/[0.06]">
              <div className="flex items-center gap-2 text-warning/90">
                <GitCompare className="h-3 w-3 shrink-0" />
                <span>{r.key}</span>
              </div>
              <div className="ml-5 mt-0.5 flex items-start gap-2">
                <Minus className="mt-[3px] h-3 w-3 shrink-0 text-destructive/80" />
                <span className="min-w-0 flex-1 truncate text-destructive/80 line-through">{r.prev}</span>
              </div>
              <div className="ml-5 flex items-start gap-2">
                <Plus className="mt-[3px] h-3 w-3 shrink-0 text-success" />
                <span className="min-w-0 flex-1 truncate text-success/90">{r.next}</span>
              </div>
            </div>
          ))}
          {diff.removed.map((r) => (
            <div key={"r-" + r.key} className="flex items-start gap-2 rounded px-1.5 py-0.5 bg-destructive/[0.06]">
              <Minus className="mt-[3px] h-3 w-3 shrink-0 text-destructive" />
              <span className="text-destructive/90 line-through">{r.key}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground line-through">{r.prev}</span>
            </div>
          ))}
        </div>

        {/* Inline validation errors */}
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Validation
          </div>
          <div className="space-y-1">
            {validation.length === 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/[0.06] px-2 py-1 text-[11px] text-success">
                <CheckCircle2 className="h-3 w-3" /> All required fields present for detected type.
              </div>
            )}
            {validation.map((v, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-md border px-2 py-1 text-[11px] ${
                  v.severity === "error"
                    ? "border-destructive/40 bg-destructive/[0.06] text-destructive"
                    : "border-warning/40 bg-warning/[0.06] text-warning"
                }`}
              >
                {v.severity === "error" ? (
                  <XCircle className="mt-[2px] h-3 w-3 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-[2px] h-3 w-3 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold">{v.message}</div>
                  {v.hint && <div className="text-muted-foreground">{v.hint}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[10px] text-muted-foreground">
            Baseline hashed at load · {baselineRef.current.length} chars
          </div>
          <PillButton
            variant="ghost"
            onClick={() => {
              baselineRef.current = p.schema;
              forceTick((n) => n + 1);
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw className="h-3 w-3" /> Set current as baseline
            </span>
          </PillButton>
        </div>
      </Card>


      {/* HASHTAGS */}
      <Card>
        <div className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <Hash className="h-3.5 w-3.5" /> Hashtag preview
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.hashtags.length === 0 && (
            <EmptyHint text="Add hashtags or generate with AI" />
          )}
          {p.hashtags.map((h) => (
            <span
              key={h}
              className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent"
            >
              {h}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function isValidJson(v: string) {
  if (!v || !v.trim()) return false;
  try {
    JSON.parse(v);
    return true;
  } catch {
    return false;
  }
}

function analyzeSchema(v: string): {
  tone: "success" | "warning" | "destructive";
  label: string;
  type?: string;
  fields: string[];
} {
  if (!v || !v.trim()) return { tone: "warning", label: "Empty", fields: [] };
  try {
    const parsed = JSON.parse(v);
    const type =
      typeof parsed?.["@type"] === "string" ? parsed["@type"] : undefined;
    const fields = Object.keys(parsed).filter((k) => !k.startsWith("@")).slice(0, 6);
    if (!parsed["@context"]) {
      return { tone: "warning", label: "Missing @context", ...(type ? { type } : {}), fields };
    }
    return { tone: "success", label: "Valid", ...(type ? { type } : {}), fields };
  } catch {
    return { tone: "destructive", label: "Invalid JSON", fields: [] };
  }
}

/* ------------ Schema diff + validator helpers ------------ */

type SchemaDiff = {
  added:   { key: string; next: string }[];
  removed: { key: string; prev: string }[];
  changed: { key: string; prev: string; next: string }[];
};

function safeParse(v: string): Record<string, unknown> | null {
  if (!v || !v.trim()) return null;
  try {
    const p = JSON.parse(v);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function shortVal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return `"${v.length > 60 ? v.slice(0, 60) + "…" : v}"`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? "" : "s"}]`;
  if (typeof v === "object") return `{${Object.keys(v as object).length} keys}`;
  return String(v);
}

function computeSchemaDiff(prev: string, next: string): SchemaDiff {
  const a = safeParse(prev) ?? {};
  const b = safeParse(next) ?? {};
  const added: SchemaDiff["added"] = [];
  const removed: SchemaDiff["removed"] = [];
  const changed: SchemaDiff["changed"] = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.forEach((k) => {
    const inA = k in a, inB = k in b;
    if (inA && !inB) removed.push({ key: k, prev: shortVal(a[k]) });
    else if (!inA && inB) added.push({ key: k, next: shortVal(b[k]) });
    else {
      const pv = shortVal(a[k]);
      const nv = shortVal(b[k]);
      if (pv !== nv) changed.push({ key: k, prev: pv, next: nv });
    }
  });
  return { added, removed, changed };
}

type Validation = { severity: "error" | "warning"; message: string; hint?: string };

const REQUIRED_BY_TYPE: Record<string, string[]> = {
  Product:            ["name", "image", "offers"],
  SoftwareApplication:["name", "applicationCategory", "operatingSystem", "offers"],
  FAQPage:            ["mainEntity"],
  Article:            ["headline", "author", "datePublished"],
  BlogPosting:        ["headline", "author", "datePublished"],
  Organization:       ["name", "url"],
  WebSite:            ["name", "url"],
  BreadcrumbList:     ["itemListElement"],
  Review:             ["itemReviewed", "reviewRating", "author"],
  HowTo:              ["name", "step"],
  VideoObject:        ["name", "thumbnailUrl", "uploadDate"],
  LocalBusiness:      ["name", "address", "telephone"],
  Event:              ["name", "startDate", "location"],
};

function validateSchema(v: string): Validation[] {
  const out: Validation[] = [];
  const raw = (v ?? "").trim();
  if (!raw) {
    return [{ severity: "warning", message: "Schema is empty", hint: "Paste or generate a JSON-LD block." }];
  }
  let parsed: Record<string, unknown> | null = null;
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) || typeof p !== "object" || p === null) {
      out.push({ severity: "error", message: "Root must be a JSON object", hint: "Wrap your schema in { … } — arrays are only valid inside @graph." });
      return out;
    }
    parsed = p as Record<string, unknown>;
  } catch (e) {
    out.push({ severity: "error", message: "Invalid JSON", hint: (e as Error).message });
    return out;
  }
  if (!parsed["@context"]) {
    out.push({ severity: "warning", message: "Missing @context", hint: 'Add "@context": "https://schema.org" so crawlers can resolve types.' });
  } else if (typeof parsed["@context"] === "string" && !/schema\.org/.test(parsed["@context"] as string)) {
    out.push({ severity: "warning", message: "Unrecognized @context", hint: "Most rich-result parsers expect https://schema.org." });
  }
  const type = parsed["@type"];
  if (!type) {
    out.push({ severity: "error", message: "Missing @type", hint: "Add @type (e.g. Product, FAQPage, Article) so Google can classify the entity." });
    return out;
  }
  const typeStr = Array.isArray(type) ? String(type[0]) : String(type);
  const required = REQUIRED_BY_TYPE[typeStr];
  if (required) {
    required.forEach((f) => {
      if (!(f in parsed!) || parsed![f] === "" || parsed![f] === null) {
        out.push({ severity: "error", message: `Missing required field: ${f}`, hint: `@type "${typeStr}" requires "${f}" for a valid rich result.` });
      }
    });
  }
  // Common lightweight lints
  if (typeStr === "Product" && parsed["offers"] && typeof parsed["offers"] === "object" && !Array.isArray(parsed["offers"])) {
    const offers = parsed["offers"] as Record<string, unknown>;
    if (!offers["price"] && !offers["priceSpecification"]) {
      out.push({ severity: "warning", message: "offers is missing price", hint: "Add offers.price or offers.priceSpecification to be eligible for price rich results." });
    }
    if (!offers["priceCurrency"]) {
      out.push({ severity: "warning", message: "offers is missing priceCurrency", hint: "Set offers.priceCurrency (ISO 4217, e.g. USD / INR)." });
    }
  }
  return out;
}
