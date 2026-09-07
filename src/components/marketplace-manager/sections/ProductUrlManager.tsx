import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy, ExternalLink, Info, Link2, QrCode, RefreshCw, Search, Share2, Wand2,
} from "lucide-react";

import { Card, EmptyHint, PageHeader, StatCard } from "../ui";
import {
  bulkGenerateUrls, createProductQr, createShortLink, generateProductUrl,
  getProductUrls, getShareSnippets, previewSlug, recordShare, setUrlSettings,
  type UrlRow, type UrlView,
} from "@/lib/marketplace-manager/producturl.functions";

/**
 * Auto Product URL & Sharing — the screen that already existed, now connected.
 *
 * It showed a canonical pattern of /software/{category}/{product-name} in a text
 * box. Nothing serves that path: it returns 404 on the live site, while
 * /marketplace/product/{slug} returns 200 and is what the sitemap already emits.
 * Saving that pattern would have pointed every canonical URL, every share link
 * and the whole sitemap at a 404, so the pattern is configurable but validated
 * against the routes this application actually has.
 *
 * Short links are real. No vanity domain is configured, so they resolve at
 * /s/{code} on this site — a real route that redirects and records the click.
 * QR images are rendered server-side at /api/qr/{code} by the qrcode library
 * that is already a dependency, from the URL the database says the QR encodes.
 *
 * Every number on this screen is counted from events that happened.
 */

const label = (s: string) => s.replace(/_/g, " ");

export function ProductUrlManager() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState<{ code: string; product: string; target: string } | null>(null);
  const [share, setShare] = useState<
    (Awaited<ReturnType<typeof getShareSnippets>> & { product?: string }) | null
  >(null);
  const [preview, setPreview] = useState<{ text: string; slug: string } | null>(null);
  const [bulk, setBulk] = useState<{ done: number; remaining: number; running: boolean } | null>(null);

  const q = useQuery({
    queryKey: ["marketplace", "product-urls", search],
    queryFn: () => getProductUrls({ data: { search: search || undefined } }),
    staleTime: 10_000,
  });
  const d = q.data as UrlView | undefined;

  const settled = (res: { ok: boolean; reason?: string; message?: string; note?: string | null }) => {
    setNote(res.ok ? res.note ?? null : res.message ?? `That did not work (${res.reason ?? "unknown"})`);
    void qc.invalidateQueries({ queryKey: ["marketplace", "product-urls"] });
  };

  const generate = useMutation({
    mutationFn: (v: { product_id: string }) => generateProductUrl({ data: v }),
    onSuccess: settled,
    onError: (e: Error) => setNote(e.message),
  });

  const shortLink = useMutation({
    mutationFn: (v: { product_id: string }) => createShortLink({ data: v }),
    onSuccess: (res) => {
      setNote(res.ok
        ? res.existing ? `That product already had ${res.url}` : `Short link created: ${res.url}`
        : `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "product-urls"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const makeQr = useMutation({
    mutationFn: (v: { product_id: string; product: string }) =>
      createProductQr({ data: { product_id: v.product_id } }).then((r) => ({ ...r, product: v.product })),
    onSuccess: (res) => {
      if (res.ok && res.qr) {
        setQr({
          code: String(res.qr.qr_code), product: res.product,
          target: String(res.target ?? ""),
        });
        setNote(null);
      } else setNote(res.message ?? `That did not work (${res.reason})`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "product-urls"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const openShare = useMutation({
    mutationFn: (v: { product_id: string; product: string }) =>
      getShareSnippets({ data: { product_id: v.product_id } }).then((r) => ({ ...r, product: v.product })),
    onSuccess: (res) => {
      if (res.ok) { setShare(res); setNote(null); }
      else setNote(res.message ?? `That did not work (${res.reason})`);
    },
    onError: (e: Error) => setNote(e.message),
  });

  const settings = useMutation({
    mutationFn: (v: Parameters<typeof setUrlSettings>[0]["data"]) => setUrlSettings({ data: v }),
    onSuccess: (res) => {
      setNote(res.ok
        ? null
        : `${res.message ?? res.reason}${res.served_prefixes ? ` Served prefixes: ${res.served_prefixes.join(", ")}` : ""}`);
      void qc.invalidateQueries({ queryKey: ["marketplace", "product-urls"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const slugPreview = useMutation({
    mutationFn: (v: { text: string }) => previewSlug({ data: { text: v.text } }),
    onSuccess: (res, v) => setPreview({ text: v.text, slug: res.slug ?? "" }),
    onError: (e: Error) => setNote(e.message),
  });

  const copy = (url: string, productId?: string, kind: "canonical" | "short" = "canonical") => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(url);
        setTimeout(() => setCopied(null), 2000);
        // Only recorded once the clipboard actually accepted it.
        if (productId) void recordShare({ data: { product_id: productId, channel: "copy", kind } });
      })
      .catch(() => setNote("The clipboard is not available in this browser."));
  };

  /**
   * Bulk generation, a batch at a time.
   *
   * The catalogue holds thousands of products, so the browser asks for a batch,
   * shows the progress and asks again — rather than one request that would sit
   * for minutes and time out.
   */
  const runBulk = async () => {
    setBulk({ done: 0, remaining: 0, running: true });
    let jobId: string | undefined;
    let done = 0;
    try {
      for (;;) {
        const res = await bulkGenerateUrls({
          data: { scope: "published", batch: 200, job_id: jobId },
        });
        if (!res.ok) { setNote(`Bulk generation stopped: ${res.reason}`); break; }
        jobId = res.job_id;
        done += res.batch_processed ?? 0;
        setBulk({ done, remaining: res.remaining ?? 0, running: !res.done });
        if (res.done || (res.batch_processed ?? 0) === 0) {
          setNote(`Bulk generation finished: ${done} product(s) processed.`);
          break;
        }
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBulk((b) => (b ? { ...b, running: false } : null));
      void qc.invalidateQueries({ queryKey: ["marketplace", "product-urls"] });
    }
  };

  if (d && d.ok === false) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Governance · URL Automation" title="Auto Product URL & Sharing" />
        <EmptyHint text="This console is for marketplace operators. Sign in with an operator account." />
      </div>
    );
  }

  const s = d?.settings;
  const a = d?.analytics;
  const rows = d?.rows ?? [];

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · URL Automation"
        title="Auto Product URL & Sharing"
        description="SEO URLs, canonical links, short links, QR codes and share snippets for every product."
        actions={
          <button
            onClick={() => {
              if (window.confirm(
                `Generate canonical URLs for every published product that has none. Existing URLs are kept, and any that change leave a 301 behind so shared links keep working.`,
              )) void runBulk();
            }}
            disabled={bulk?.running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {bulk?.running ? `Generating… ${bulk.done} done` : "Generate missing URLs"}
          </button>
        }
      />

      {note && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          {note}
        </div>
      )}

      {bulk && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold">Bulk generation</span>
            <span>{bulk.done} processed</span>
            <span className="text-muted-foreground">{bulk.remaining} remaining</span>
            <span className={bulk.running ? "text-amber-600" : "text-emerald-500"}>
              {bulk.running ? "running" : "finished"}
            </span>
            {!bulk.running && (
              <button onClick={() => setBulk(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                Dismiss
              </button>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Products with a canonical URL"
          value={`${(d?.counts?.with_canonical ?? 0).toLocaleString()} / ${(d?.counts?.products ?? 0).toLocaleString()}`}
        />
        <StatCard label="Redirects kept" value={String(d?.counts?.redirects ?? "—")} />
        <StatCard label="Short links" value={String(d?.counts?.short_links ?? "—")} tone="premium" />
        <StatCard label="QR codes" value={String(d?.counts?.qr_codes ?? "—")} />
      </div>

      {/* ------------------------------------------------- the short domain */}
      {d?.short_domain && (
        <Card className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">Short links</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              d.short_domain.configured
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-amber-500/10 text-amber-600"
            }`}>
              {d.short_domain.state}
            </span>
            <code className="text-[11px] text-muted-foreground">{d.short_domain.serving_from}</code>
          </div>
          {d.short_domain.note && (
            <p className="mt-1 text-[11px] text-muted-foreground">{d.short_domain.note}</p>
          )}
        </Card>
      )}

      {/* ----------------------------------------------------- URL pattern */}
      {s && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-2 text-sm font-bold">URL pattern</h3>
            <input
              defaultValue={s.canonical_pattern}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== s.canonical_pattern) settings.mutate({ canonical_pattern: v });
              }}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Variables: {"{category}"}, {"{product-name}"}, {"{product-id}"}, {"{brand}"},{" "}
              {"{language}"}. A pattern whose path nothing serves is refused — every URL it produced
              would be a 404.
            </p>
            <div className="mt-2 space-y-1">
              {d?.routes?.map((r) => (
                <div key={r.prefix} className="rounded-lg bg-muted px-2.5 py-1.5">
                  <code className="text-[11px]">{r.prefix}</code>
                  <div className="text-[10px] text-muted-foreground">{r.note}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {([
                ["lowercase_hyphenate", "Lowercase & hyphenate"],
                ["strip_stop_words", "Strip stop words"],
                ["include_product_id_suffix", "Include product ID suffix"],
                ["generate_qr_on_publish", "Generate QR on publish"],
                ["track_short_link_clicks", "Track short-link clicks"],
              ] as const).map(([k, lbl]) => (
                <label key={k} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(s[k as keyof typeof s])}
                    onChange={(e) => settings.mutate({ [k]: e.target.checked })}
                    className="h-3.5 w-3.5"
                  />
                  {lbl}
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-bold">Slug preview</h3>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Try a product name against the current settings before regenerating anything.
            </p>
            <div className="flex items-center gap-2">
              <input
                placeholder="Vala ERP Pro — Business Suite"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) slugPreview.mutate({ text: v });
                  }
                }}
                className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <span className="text-[11px] text-muted-foreground">press enter</span>
            </div>
            {preview && (
              <div className="mt-2 rounded-lg bg-muted px-2.5 py-1.5">
                <div className="text-[11px] text-muted-foreground">{preview.text}</div>
                <code className="text-xs">
                  {s.site_url}
                  {s.canonical_pattern.replace("{product-name}", preview.slug).replace("{category}", "…")}
                </code>
              </div>
            )}
            <div className="mt-3">
              <h4 className="mb-1 text-xs font-bold">QR appearance</h4>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <label className="flex items-center gap-1.5">
                  foreground
                  <input
                    type="color"
                    defaultValue={s.qr_foreground}
                    onBlur={(e) => settings.mutate({ qr_foreground: e.target.value.toUpperCase() })}
                    className="h-6 w-10 rounded border border-border bg-background"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  size
                  <input
                    type="number"
                    min={64}
                    max={2048}
                    defaultValue={s.qr_size}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v && v !== s.qr_size) settings.mutate({ qr_size: v });
                    }}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                </label>
                <span>correction {s.qr_error_correction}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ---------------------------------------------------- the QR panel */}
      {qr && (
        <Card className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <QrCode className="h-4 w-4 text-muted-foreground" /> QR for {qr.product}
            </h3>
            <button onClick={() => setQr(null)} className="text-xs text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Rendered server-side by the qrcode library from the URL the
                database says this QR encodes. */}
            <img
              src={`/api/qr/${qr.code}.png`}
              alt={`QR code encoding ${qr.target}`}
              width={200}
              height={200}
              className="rounded-lg border border-border bg-white p-2"
            />
            <div className="text-[11px] text-muted-foreground">
              <div>Encodes: <code className="text-foreground">{qr.target}</code></div>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={`/api/qr/${qr.code}.png`}
                  download={`${qr.code}.png`}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
                >
                  Download PNG
                </a>
                <a
                  href={`/api/qr/${qr.code}.svg`}
                  download={`${qr.code}.svg`}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
                >
                  Download SVG
                </a>
                <button
                  onClick={() => copy(qr.target)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
                >
                  Copy target
                </button>
              </div>
              <p className="mt-2 max-w-md">
                A scan is counted when somebody follows the encoded link, not when this preview is
                drawn. Rendering the image here is not a scan.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------- the share panel */}
      {share && share.ok && (
        <Card className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Share2 className="h-4 w-4 text-muted-foreground" /> Share {share.product}
            </h3>
            <button onClick={() => setShare(null)} className="text-xs text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-muted px-2.5 py-1.5 text-[11px]">
                {share.short_url ?? share.canonical_url}
              </code>
              <button
                onClick={() => copy(share.short_url ?? share.canonical_url ?? "", undefined, "short")}
                className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
              >
                <Copy className="mr-1 inline h-3 w-3" />
                {copied === (share.short_url ?? share.canonical_url) ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([
                ["whatsapp", "WhatsApp", share.whatsapp],
                ["facebook", "Facebook", share.facebook],
                ["x", "X", share.x],
                ["linkedin", "LinkedIn", share.linkedin],
                ["email", "Email", share.email],
              ] as const).map(([channel, lbl, href]) =>
                href ? (
                  <a
                    key={channel}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
                  >
                    {lbl}
                  </a>
                ) : null,
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{share.share_text}</p>
          </div>
        </Card>
      )}

      {/* --------------------------------------------------- generated URLs */}
      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">Generated URLs</h3>
          <div className="relative ml-auto min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Product name or slug"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <button
            onClick={() => void q.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {q.isLoading ? (
          <EmptyHint text="Loading…" />
        ) : rows.length === 0 ? (
          <EmptyHint text="No product matches this search." />
        ) : (
          <div className="space-y-2">
            {rows.map((r: UrlRow) => (
              <div key={r.product_id} className="rounded-xl border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[200px] flex-1">
                    <div className="text-sm font-semibold">{r.product}</div>
                    {r.canonical ? (
                      <code className="text-[11px] text-muted-foreground">{r.canonical_path}</code>
                    ) : (
                      <span className="text-[11px] text-amber-600">no canonical URL yet</span>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      {r.short_url ? `${r.short_url} · ${r.clicks} click(s)` : "no short link"}
                      {r.qr_code ? ` · QR ${r.qr_code} · ${r.scans} scan(s)` : ""}
                      {r.redirects > 0 ? ` · ${r.redirects} redirect(s) kept` : ""}
                    </div>
                  </div>

                  {!r.visible && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {label(r.moderation_status)}
                    </span>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.canonical ? (
                      <>
                        <button
                          onClick={() => copy(r.canonical!, r.product_id, "canonical")}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                        >
                          <Copy className="h-3 w-3" /> {copied === r.canonical ? "Copied" : "Copy"}
                        </button>
                        {/* Only offered when the product is actually public. */}
                        {r.visible ? (
                          <a
                            href={r.canonical}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                          >
                            <ExternalLink className="h-3 w-3" /> Open
                          </a>
                        ) : (
                          <span
                            title={`This product is ${label(r.moderation_status)} and not publicly visible.`}
                            className="rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground"
                          >
                            not public
                          </span>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => generate.mutate({ product_id: r.product_id })}
                        className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                      >
                        Generate URL
                      </button>
                    )}
                    {r.canonical && !r.short_url && (
                      <button
                        onClick={() => shortLink.mutate({ product_id: r.product_id })}
                        className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                      >
                        Short link
                      </button>
                    )}
                    {r.canonical && (
                      <>
                        <button
                          onClick={() =>
                            r.qr_code
                              ? setQr({
                                  code: r.qr_code, product: r.product,
                                  target: r.short_url ?? r.canonical ?? "",
                                })
                              : makeQr.mutate({ product_id: r.product_id, product: r.product })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                        >
                          <QrCode className="h-3 w-3" /> QR
                        </button>
                        <button
                          onClick={() => openShare.mutate({ product_id: r.product_id, product: r.product })}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted"
                        >
                          <Share2 className="h-3 w-3" /> Share
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------- analytics */}
      {a && (
        <Card className="mt-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Info className="h-4 w-4 text-muted-foreground" /> Link analytics
          </h3>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Counted from real click and scan events. No address is stored — a repeat visitor is
            recognised by a hash that changes every day.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Clicks" value={String(a.clicks_total)} />
            <StatCard label="Clicks today" value={String(a.clicks_today)} />
            <StatCard label="Unique visitors" value={String(a.unique_visitors)} />
            <StatCard label="QR scans" value={String(a.scans_total)} />
            <StatCard label="Scans today" value={String(a.scans_today)} />
            <StatCard label="Shares" value={String(a.shares)} />
          </div>

          {a.clicks_total === 0 ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              No link has been clicked yet, so there is nothing to break down. These fill in as
              short links are used.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {([
                ["Top products", Object.fromEntries((a.top_products ?? []).map((p) => [p.product ?? "—", p.clicks]))],
                ["Campaigns", a.top_campaigns],
                ["Referrers", a.top_referrers],
                ["Devices", a.devices],
              ] as const).map(([title, obj]) => (
                <div key={title}>
                  <h4 className="mb-1 text-xs font-bold">{title}</h4>
                  <div className="space-y-0.5">
                    {Object.entries(obj ?? {}).slice(0, 6).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-[11px]">
                        <span className="flex-1 truncate text-muted-foreground">{k}</span>
                        <span className="font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default ProductUrlManager;
