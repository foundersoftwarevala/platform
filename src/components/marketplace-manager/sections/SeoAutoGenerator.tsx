import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard } from "../ui";

/**
 * SEO Auto-Generator — the screen that already existed, now reading real state.
 *
 * It showed 98% coverage, 1,842 schemas emitted, 12,406 sitemap URLs and 34
 * robots rules. None of those came from anywhere; section 2 of the brief names
 * that exact 98% as the thing not to do. Its preview showed a written-in
 * example for a product called Vala ERP Pro, on softwarewala.net — the testing
 * domain, not the canonical one.
 *
 * Everything here is counted at the moment of the request, and the preview
 * fetches the live product page and reads the tags out of it, so what is shown
 * is what a crawler would actually get rather than what this screen believes
 * ought to be there.
 *
 * Coverage is reported per requirement rather than as one number, because a
 * single percentage hides which requirement is the one failing. The headline
 * card shows the weakest of them, not an average that flatters the rest.
 */

type Requirement = { key: string; label: string; have: number; pct: number | null };

type Console = {
  ok: boolean;
  base: string;
  products: { eligible: number; total: number };
  coverage: { weakest: number | null; requirements: Requirement[] };
  schemas: { stored: number; validated: number | null; note: string };
  sitemap: { urls: number | null; parts: { url: string; urls: number }[]; note: string };
  robots: {
    agents: number; allow: number; disallow: number; sitemap: number; rules: number;
    protects_control_panel: boolean; protects_api: boolean;
  } | null;
  canonical: { product_url_rows: number; note: string };
  catalogue: { categories: number };
  seo_tables: { keywords: number; issues: number; indexing_records: number; integrations: number };
  preview: {
    url: string; status: number; title?: string | null; description?: string | null;
    canonical?: string | null; og_title?: string | null; og_description?: string | null;
    og_type?: string | null; twitter_card?: string | null; robots?: string | null;
    json_ld?: { valid: boolean; type: string; bytes: number }[]; error?: string;
  } | null;
};

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat().format(v);

export function SeoAutoGenerator() {
  const [data, setData] = useState<Console | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (product?: string) => {
    setError(null);
    setLoading(true);
    try {
      const query = product ? `?product=${encodeURIComponent(product)}` : "";
      const response = await fetch(`/api/seo/console${query}`, { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(new Error(payload?.error ?? (response.status === 401 || response.status === 403
          ? "Sign in as an operator to open the SEO console."
          : "Could not read the SEO state.")));
        return;
      }
      setData(payload as Console);
    } catch {
      setError(new Error("Could not reach the server."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const c = data?.coverage;
  const r = data?.robots;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · SEO Automation"
        title="SEO Auto-Generator"
        description="Automatically produce meta tags, OpenGraph, Twitter cards, JSON-LD schemas, sitemap entries and robots rules for every product."
        actions={
          <>
            <PillButton variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent("sv:open-vala-ai"))}>
              Vala AI
            </PillButton>
            <PillButton variant="ghost" onClick={() => void load(slug || undefined)}>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Recount
              </span>
            </PillButton>
          </>
        }
      />

      {error ? <LoadFailure error={error} what="the SEO console" onRetry={() => void load()} /> : null}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="SEO coverage (weakest)"
          value={c ? (c.weakest === null ? "no products" : `${c.weakest}%`) : "—"}
          tone="success"
        />
        <StatCard label="Schemas stored" value={n(data?.schemas.stored)} tone="premium" />
        <StatCard label="Sitemap URLs" value={n(data?.sitemap.urls)} />
        <StatCard label="Robots rules" value={n(r?.rules)} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-bold">Coverage by requirement</div>
          {!data ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Counting…
            </div>
          ) : (
            <>
              <div className="mb-2 text-[11px] text-muted-foreground">
                {n(data.products.eligible)} eligible products of {n(data.products.total)} in the catalogue.
              </div>
              <div className="space-y-1.5">
                {c!.requirements.map((req) => (
                  <div key={req.key} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
                    <div className="text-[12px] font-semibold">{req.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {n(req.have)} · <span className="font-semibold text-foreground">{req.pct === null ? "—" : `${req.pct}%`}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{data.schemas.note}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{data.canonical.note}</p>
            </>
          )}
        </Card>

        <Card>
          <div className="mb-3 text-sm font-bold">Robots &amp; sitemap</div>
          {!data ? (
            <div className="text-[12px] text-muted-foreground">Reading…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
                  <div className="text-muted-foreground">User-agent blocks</div>
                  <div className="font-semibold">{n(r?.agents)}</div>
                </div>
                <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
                  <div className="text-muted-foreground">Allow / Disallow</div>
                  <div className="font-semibold">{n(r?.allow)} / {n(r?.disallow)}</div>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] ${
                  r?.protects_control_panel ? "border-emerald-500/30 text-emerald-500" : "border-rose-500/30 text-rose-500"
                }`}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {r?.protects_control_panel ? "Control Panel is disallowed" : "Control Panel is crawlable"}
                </div>
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] ${
                  r?.protects_api ? "border-emerald-500/30 text-emerald-500" : "border-rose-500/30 text-rose-500"
                }`}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {r?.protects_api ? "/api/ is disallowed" : "/api/ is crawlable"}
                </div>
              </div>

              <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sitemap</div>
              <div className="mt-1 space-y-1">
                {(data.sitemap.parts ?? []).map((p) => (
                  <div key={p.url} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                    <span className="truncate font-mono text-[10px]">{p.url.replace(data.base, "")}</span>
                    <span className="shrink-0 font-semibold">{n(p.urls)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{data.sitemap.note}</p>
            </>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            <div className="text-sm font-bold">Preview — what the live page emits</div>
            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void load(slug || undefined); }}
                placeholder="product slug"
                aria-label="Product slug to preview"
                className="w-56 rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
              />
            </div>
            <PillButton variant="primary" onClick={() => void load(slug || undefined)}>Preview</PillButton>
          </div>

          {!data?.preview ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[12px] text-muted-foreground">
              Enter a product slug to fetch its live page and read the tags it actually emits.
            </div>
          ) : data.preview.error ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-600">
              {data.preview.error} — {data.preview.url}
            </div>
          ) : (
            <>
              <div className="mb-2 text-[11px] text-muted-foreground">
                HTTP {data.preview.status} · <span className="font-mono">{data.preview.url}</span>
              </div>
              <pre className="scroll-row max-h-72 overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
{`<title>${data.preview.title ?? "— missing —"}</title>
<meta name="description" content="${data.preview.description ?? "— missing —"}" />
<link rel="canonical" href="${data.preview.canonical ?? "— missing —"}" />
<meta property="og:title" content="${data.preview.og_title ?? "— missing —"}" />
<meta property="og:description" content="${data.preview.og_description ?? "— missing —"}" />
<meta property="og:type" content="${data.preview.og_type ?? "— missing —"}" />
<meta name="twitter:card" content="${data.preview.twitter_card ?? "— missing —"}" />
<meta name="robots" content="${data.preview.robots ?? "— not set, so the default applies —"}" />

JSON-LD blocks: ${(data.preview.json_ld ?? []).length === 0
  ? "none on this page"
  : (data.preview.json_ld ?? []).map((b) => `${b.type} (${b.valid ? "valid JSON" : "INVALID"}, ${b.bytes} bytes)`).join("\n                ")}`}
              </pre>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
