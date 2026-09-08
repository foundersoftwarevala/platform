import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, ChevronRight, FileText, Gavel, History,
  Layers, Loader2, RefreshCw, Search, Settings2, ShieldAlert, Sparkles, Upload,
  Wand2, XCircle,
} from "lucide-react";

import { Card, EmptyHint, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";
import {
  approveContent, archiveContent, cancelBulkJob, createBulkJob, editContent,
  generateContent, getAiContentConsole, getAiContentProducts, getItemVersions,
  getProductContext, legalDecide, publishContent, rejectContent, retryBulkJob,
  rollbackVersion, runBulkBatch, setAiContentSettings, submitContent,
  type ConsoleView, type ContentType,
} from "@/lib/marketplace-manager/aicontent.functions";

/**
 * AI Content Generator — the screen that already existed, now connected.
 *
 * What it used to show: "Generated Today 182", "Awaiting Review 24",
 * "Auto-published 146", "Rejected 4", nine toggles with no handler, and a live
 * preview of a product called Vala ERP Pro that is not in the catalogue. Every
 * one of those numbers is now a count of rows, the toggles are the settings the
 * generator obeys, and the preview shows the draft that exists for the product
 * you selected — or says there is not one yet.
 *
 * The honest part first: no AI credential is configured on this server, so
 * pressing Generate records a real run that reports AI PROVIDER NOT CONFIGURED.
 * It does not invent content and it does not pretend to have called anything.
 * The moment a key is set, the same button makes a real request.
 */

const TYPES: { key: ContentType; label: string; structured: boolean }[] = [
  { key: "summary", label: "Product Summary", structured: false },
  { key: "short_description", label: "Short Description", structured: false },
  { key: "long_description", label: "Long Description", structured: false },
  { key: "seo_description", label: "SEO Description", structured: false },
  { key: "meta_keywords", label: "Meta Keywords", structured: true },
  { key: "faq", label: "FAQ", structured: true },
  { key: "features", label: "Feature List", structured: true },
  { key: "benefits", label: "Benefits", structured: true },
  { key: "use_cases", label: "Use Cases", structured: true },
];

const REJECTIONS: { code: string; label: string }[] = [
  { code: "incorrect_information", label: "Incorrect information" },
  { code: "unsupported_claim", label: "Unsupported claim" },
  { code: "poor_quality", label: "Poor quality" },
  { code: "legal_concern", label: "Legal concern" },
  { code: "duplicate", label: "Duplicate" },
  { code: "seo_issue", label: "SEO issue" },
  { code: "brand_violation", label: "Brand violation" },
  { code: "out_of_date", label: "Out of date" },
  { code: "other", label: "Other" },
];

const TABS = ["Generate", "Review queue", "Bulk generation", "Settings", "Activity"];

const label = (s: string) => s.replace(/_/g, " ");
const num = (v: unknown) => Number(v ?? 0).toLocaleString("en-IN");

function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  const map: Record<string, string> = {
    ok: "border-success/40 bg-success/10 text-success",
    warn: "border-warning/40 bg-warning/10 text-warning",
    bad: "border-destructive/40 bg-destructive/10 text-destructive",
    info: "border-accent/40 bg-accent/10 text-accent",
    mute: "border-border bg-background/40 text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[tone] ?? map.mute}`}>
      {children}
    </span>
  );
}

const statusTone = (s: string) =>
  s === "PUBLISHED" ? "ok"
  : s === "APPROVED" ? "info"
  : s === "IN_REVIEW" || s === "GENERATED" ? "warn"
  : s === "REJECTED" || s === "FAILED" ? "bad"
  : "mute";

const legalTone = (s: string) =>
  s === "CLEARED" ? "ok" : s === "BLOCKED" ? "bad" : s === "REVIEW_REQUIRED" ? "warn" : "mute";

/** Renders a structured block the way the content type means it. */
function Structured({ type, items }: { type: string; items: unknown }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <EmptyHint text="No entries." />;
  }
  if (type === "faq") {
    return (
      <div className="space-y-1.5">
        {(items as { question?: string; answer?: string }[]).map((f, i) => (
          <div key={i} className="rounded-md border border-border bg-background/40 px-3 py-2">
            <div className="text-[12px] font-semibold">{f.question}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">{f.answer}</div>
          </div>
        ))}
      </div>
    );
  }
  if (type === "features") {
    return (
      <div className="space-y-1">
        {(items as { text?: string; source?: string }[]).map((f, i) => (
          <div key={i} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-1.5">
            <span className="text-[12px]">{f.text}</span>
            {/* 11/38. A suggestion is never displayed as though it were a
                verified capability of the product. */}
            <Badge tone={f.source === "PRODUCT_DATA" ? "ok" : f.source === "MANUAL" ? "info" : "warn"}>
              {label(f.source ?? "AI_SUGGESTION")}
            </Badge>
          </div>
        ))}
      </div>
    );
  }
  if (type === "use_cases") {
    return (
      <div className="space-y-1.5">
        {(items as { title?: string; description?: string }[]).map((u, i) => (
          <div key={i} className="rounded-md border border-border bg-background/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold">{u.title}</span>
              <Badge tone="warn">Suggested</Badge>
            </div>
            {u.description && <div className="mt-1 text-[12px] text-muted-foreground">{u.description}</div>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {(items as string[]).map((k, i) => (
        <span key={i} className="rounded-full border border-border bg-background/40 px-2.5 py-1 text-[11px]">
          {String(k)}
        </span>
      ))}
    </div>
  );
}

export function AiContentGenerator() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(TABS[0]);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<"all" | "missing_description" | "no_content" | "stale">("all");
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null);
  const [chosen, setChosen] = useState<ContentType[]>(["summary", "short_description", "seo_description"]);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; type: string; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; code: string; reason: string } | null>(null);
  const [history, setHistory] = useState<{ id: string; data?: Record<string, unknown> } | null>(null);
  const [bulkScope, setBulkScope] = useState("missing_description");
  const [bulkRun, setBulkRun] = useState<{ job: string; processed: number; running: boolean; log: string[] } | null>(null);

  const console_ = useQuery({
    queryKey: ["mm", "ai-content", product?.id ?? null],
    queryFn: () => getAiContentConsole({ data: { product_id: product?.id, limit: 60 } }),
    staleTime: 8_000,
  });
  const d = console_.data as ConsoleView | undefined;

  const products = useQuery({
    queryKey: ["mm", "ai-content", "products", search, productFilter],
    queryFn: () =>
      getAiContentProducts({ data: { search: search || undefined, filter: productFilter, limit: 20 } }),
    staleTime: 15_000,
    enabled: tab === "Generate" || tab === "Bulk generation",
  });

  const context = useQuery({
    queryKey: ["mm", "ai-content", "context", product?.id],
    queryFn: () => getProductContext({ data: { product_id: product!.id } }),
    enabled: Boolean(product?.id) && tab === "Generate",
    staleTime: 30_000,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["mm", "ai-content"] });
  const settled = (res: Record<string, unknown>, good: string) => {
    setNote(
      res.ok
        ? good
        : `${String(res.detail ?? "")} ${res.detail ? "" : `(${String(res.reason ?? "unknown")})`}`.trim() ||
          `That did not work (${String(res.reason ?? "unknown")})`,
    );
    refresh();
  };

  const settings = (d?.settings ?? {}) as Record<string, unknown>;
  const blocks = (settings.blocks ?? {}) as Record<string, boolean>;
  const enabledTypes = TYPES.filter((t) => blocks[t.key] !== false);

  const rowsForProduct = useMemo(
    () => (d?.rows ?? []).filter((r) => !product || r.product_id === product.id),
    [d?.rows, product],
  );

  const gen = useMutation({
    mutationFn: () => generateContent({ data: { product_id: product!.id, types: chosen } }),
    onSuccess: (res) =>
      settled(
        res,
        `Generated ${Array.isArray(res.written) ? (res.written as string[]).length : 0} blocks for ${String(res.product_name ?? "the product")}.`,
      ),
    onError: (e: Error) => setNote(e.message),
  });

  const act = {
    edit: useMutation({
      mutationFn: (v: { item_id: string; content: string }) => editContent({ data: v }),
      onSuccess: (r) => { setEditing(null); settled(r, "Saved. The model's original text is kept beside your edit."); },
      onError: (e: Error) => setNote(e.message),
    }),
    submit: useMutation({
      mutationFn: (id: string) => submitContent({ data: { item_id: id } }),
      onSuccess: (r) => settled(r, "Sent for review."),
      onError: (e: Error) => setNote(e.message),
    }),
    approve: useMutation({
      mutationFn: (id: string) => approveContent({ data: { item_id: id } }),
      onSuccess: (r) => settled(r, "Approved."),
      onError: (e: Error) => setNote(e.message),
    }),
    reject: useMutation({
      mutationFn: (v: { item_id: string; code: string; reason: string }) =>
        rejectContent({ data: { item_id: v.item_id, code: v.code as never, reason: v.reason } }),
      onSuccess: (r) => { setRejecting(null); settled(r, "Rejected. The content and the reason are kept."); },
      onError: (e: Error) => setNote(e.message),
    }),
    publish: useMutation({
      mutationFn: (id: string) => publishContent({ data: { item_id: id } }),
      onSuccess: (r) => {
        const state = String(r.publish_state ?? "");
        setNote(
          state === "COMPLETE" ? "Published, and every target was written."
          : state === "PARTIAL" ? "Published, but a target failed. Open the item to see which, then retry."
          : state === "SKIPPED" ? String(r.detail ?? "Nothing was written.")
          : `Not published (${String(r.reason ?? "failed")}). ${String(r.detail ?? "")}`,
        );
        refresh();
      },
      onError: (e: Error) => setNote(e.message),
    }),
    archive: useMutation({
      mutationFn: (id: string) => archiveContent({ data: { item_id: id } }),
      onSuccess: (r) => settled(r, "Archived. The version history is kept."),
      onError: (e: Error) => setNote(e.message),
    }),
    legal: useMutation({
      mutationFn: (v: { item_id: string; to: "CLEARED" | "BLOCKED"; reason?: string }) =>
        legalDecide({ data: v }),
      onSuccess: (r) => settled(r, "Legal decision recorded."),
      onError: (e: Error) => setNote(e.message),
    }),
    rollback: useMutation({
      mutationFn: (v: { item_id: string; version: number }) => rollbackVersion({ data: v }),
      onSuccess: (r) => { setHistory(null); settled(r, "Restored. The rollback is itself a new version."); },
      onError: (e: Error) => setNote(e.message),
    }),
    settings: useMutation({
      mutationFn: (patch: Record<string, unknown>) => setAiContentSettings({ data: patch as never }),
      onSuccess: (r) => settled(r, "Settings saved."),
      onError: (e: Error) => setNote(e.message),
    }),
  };

  const openHistory = async (id: string) => {
    setHistory({ id });
    const data = await getItemVersions({ data: { item_id: id } });
    setHistory({ id, data });
  };

  /* 28. Bulk runs a batch at a time from here, so the browser never fires
     thousands of requests and the job can be watched as it goes. */
  const startBulk = useMutation({
    mutationFn: () =>
      createBulkJob({ data: { scope: bulkScope as never, types: chosen, category_id: undefined } }),
    onSuccess: (r) => {
      if (!r.ok) { setNote(`Could not start (${String(r.reason)})`); return; }
      const total = Number(r.total ?? 0);
      if (total === 0) { setNote(String(r.detail ?? "Nothing matched.")); refresh(); return; }
      setBulkRun({ job: String(r.job_id), processed: 0, running: true, log: [`Queued ${total} products.`] });
      refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });

  useEffect(() => {
    if (!bulkRun?.running) return;
    let cancelled = false;
    void (async () => {
      const res = await runBulkBatch({ data: { job_id: bulkRun.job, batch: 5 } });
      if (cancelled) return;
      const lines = (res.results ?? []).map(
        (x) => `${x.ok ? "ok" : "failed"} — ${x.product}${x.detail ? `: ${x.detail}` : ""}`,
      );
      setBulkRun((prev) =>
        prev && prev.job === bulkRun.job
          ? {
              ...prev,
              processed: prev.processed + Number(res.processed ?? 0),
              running: !res.done,
              log: [...lines, ...prev.log].slice(0, 40),
            }
          : prev,
      );
      refresh();
    })();
    return () => { cancelled = true; };
    // Each completed batch schedules the next by changing `processed`.
  }, [bulkRun?.running, bulkRun?.processed, bulkRun?.job]);

  const stats = (d?.stats ?? {}) as Record<string, number>;
  const state = d?.provider_state;

  if (console_.isError) {
    return (
      <div className="px-4 py-8 md:px-8">
        <LoadFailure
          error={console_.error}
          what="the content generator"
          onRetry={() => void console_.refetch()}
        />
      </div>
    );
  }
  if (console_.isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-16 text-sm text-muted-foreground md:px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the content generator…
      </div>
    );
  }
  if (d && !d.ok) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Governance · AI Content" title="AI Content Generator" />
        <Card>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" />
            You do not have permission to use this module ({d.reason}).
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Governance · AI Content"
        title="AI Content Generator"
        description="Generates product copy from the marketplace record only, then validates, versions and governs it before anything reaches the storefront."
        actions={
          <PillButton variant="ghost" onClick={() => refresh()}>
            <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Refresh</span>
          </PillButton>
        }
      />

      {/* 51. The first thing the screen says is whether it can generate at all. */}
      {state && (
        <div
          className={`mb-6 rounded-xl border p-4 text-[12px] ${
            state.state === "CONFIGURED"
              ? "border-success/40 bg-success/10 text-success"
              : "border-warning/40 bg-warning/10 text-warning"
          }`}
        >
          <div className="flex items-start gap-2">
            {state.state === "CONFIGURED" ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
            <div>
              <div className="font-bold uppercase tracking-wider">{label(state.state)}</div>
              <div className="mt-1 text-foreground/80">{state.detail}</div>
              {d?.binding?.provider_slug && (
                <div className="mt-1 text-muted-foreground">
                  Provider {String(d.binding.provider_name ?? d.binding.provider_slug)} · model{" "}
                  {String(d.binding.model_id ?? "not selected")} · credential variable{" "}
                  {state.credential_env ?? "not set in the registry"} · a key stored in the AI API Manager:{" "}
                  {d.binding.stored_key_present ? "yes" : "no"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {note && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-[12px] text-foreground">
          {note}
        </div>
      )}

      {/* 18. Counted, every one of them. */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Generated today" value={num(stats.generated_today)} tone="premium" icon={<Sparkles className="h-3.5 w-3.5" />} />
        <StatCard label="Awaiting review" value={num(stats.awaiting_review)} tone="warning" icon={<FileText className="h-3.5 w-3.5" />} />
        <StatCard label="Published" value={num(stats.published)} tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
        <StatCard label="Rejected" value={num(stats.rejected)} tone="destructive" icon={<XCircle className="h-3.5 w-3.5" />} />
        <StatCard label="Legal blocked" value={num(stats.legal_blocked)} tone="destructive" icon={<Gavel className="h-3.5 w-3.5" />} />
        <StatCard label="Stale" value={num(stats.stale)} tone="warning" icon={<History className="h-3.5 w-3.5" />} />
      </div>

      <div className="mb-6">
        <SubNav items={TABS} active={tab} onChange={setTab} />
      </div>

      {/* ------------------------------------------------------- Generate */}
      {tab === "Generate" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <Card>
              <div className="mb-3 text-sm font-bold">1 · Choose a real product</div>
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search the catalogue…"
                  className="w-full bg-transparent text-[12px] outline-none"
                />
              </div>
              <div className="mb-2 flex flex-wrap gap-1">
                {(["all", "missing_description", "no_content", "stale"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setProductFilter(f)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      productFilter === f ? "border-accent/50 bg-accent/15 text-accent" : "border-border text-muted-foreground"
                    }`}
                  >
                    {label(f)}
                  </button>
                ))}
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {(products.data?.rows ?? []).map((p) => {
                  const row = p as Record<string, unknown>;
                  return (
                    <button
                      key={String(row.id)}
                      onClick={() => setProduct({ id: String(row.id), name: String(row.name) })}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                        product?.id === row.id ? "border-accent/50 bg-accent/10" : "border-border bg-background/40"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold">{String(row.name)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {String(row.category ?? "uncategorised")} · {num(row.feature_count)} verified features
                        </div>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-1">
                        {Number(row.published_items) > 0 && <Badge tone="ok">{num(row.published_items)} live</Badge>}
                        {Number(row.stale_items) > 0 && <Badge tone="warn">stale</Badge>}
                      </div>
                    </button>
                  );
                })}
                {(products.data?.rows ?? []).length === 0 && <EmptyHint text="No product matched." />}
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                {num(products.data?.total)} products match. Searching and paging happen on the server.
              </div>
            </Card>

            <Card>
              <div className="mb-3 text-sm font-bold">2 · Content blocks</div>
              <div className="space-y-1.5">
                {TYPES.map((t) => {
                  const on = blocks[t.key] !== false;
                  const picked = chosen.includes(t.key);
                  return (
                    <div key={t.key} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-1.5">
                      <label className="flex items-center gap-2 text-[12px]">
                        <input
                          type="checkbox"
                          disabled={!on}
                          checked={picked && on}
                          onChange={(e) =>
                            setChosen((prev) => (e.target.checked ? [...prev, t.key] : prev.filter((x) => x !== t.key)))
                          }
                        />
                        {t.label}
                      </label>
                      {!on && <Badge tone="mute">off in settings</Badge>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3">
                <PillButton
                  variant="primary"
                  disabled={!product || chosen.length === 0 || gen.isPending}
                  onClick={() => gen.mutate()}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {gen.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    Generate AI
                  </span>
                </PillButton>
              </div>
              {enabledTypes.length < TYPES.length && (
                <div className="mt-2 text-[10px] text-muted-foreground">
                  Blocks switched off in Settings are not generated, whatever is ticked here.
                </div>
              )}
            </Card>

            {/* 2/25. What the model is allowed to know, and what it is not. */}
            {context.data && (context.data as { ok?: boolean }).ok && (
              <Card>
                <div className="mb-2 text-sm font-bold">Verified product data</div>
                <div className="mb-2 text-[11px] text-muted-foreground">
                  Only these fields are sent. The model is told the record outranks anything it knows.
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {((context.data as { present_fields?: string[] }).present_fields ?? []).map((f) => (
                    <Badge key={f} tone="ok">{label(f)}</Badge>
                  ))}
                </div>
                {((context.data as { missing_fields?: string[] }).missing_fields ?? []).length > 0 && (
                  <>
                    <div className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Not in the product record
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {((context.data as { missing_fields?: string[] }).missing_fields ?? []).map((f) => (
                        <Badge key={f} tone="warn">{label(f)}</Badge>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      For these the model must write “Information not available in verified product data.”
                    </div>
                  </>
                )}
                <div className="mt-3 text-[10px] text-muted-foreground">
                  Template: {String((context.data as { template_label?: string }).template_label ?? "none matched")} · structure only, never a fact.
                </div>
              </Card>
            )}
          </div>

          {/* 14. The live preview: the actual draft, or the truth that there isn't one. */}
          <div className="space-y-3 lg:col-span-2">
            <Card>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <div className="text-sm font-bold">
                  Live preview {product ? `— ${product.name}` : ""}
                </div>
              </div>
              {!product && <EmptyHint text="Choose a product to see the content that exists for it." />}
              {product && rowsForProduct.length === 0 && (
                <EmptyHint text="No content has been generated for this product yet." />
              )}
            </Card>

            {rowsForProduct.map((raw) => {
              const r = raw as Record<string, unknown>;
              const id = String(r.id);
              const type = String(r.content_type);
              const errors = ((r.validation as { errors?: unknown[] })?.errors ?? []) as { code?: string; detail?: string }[];
              const warnings = ((r.validation as { warnings?: unknown[] })?.warnings ?? []) as { code?: string; detail?: string }[];
              const findings = (r.legal_findings ?? []) as { label?: string; action?: string; severity?: string }[];
              const targets = (r.publish_targets ?? {}) as Record<string, { state?: string; detail?: string }>;
              return (
                <Card key={id}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-bold">{TYPES.find((t) => t.key === type)?.label ?? label(type)}</div>
                      <Badge tone={statusTone(String(r.status))}>{label(String(r.status))}</Badge>
                      {/* 38. Provenance is always on the face of it. */}
                      <Badge tone={r.provenance === "PUBLISHED" ? "ok" : r.human_edited ? "info" : "warn"}>
                        {label(String(r.provenance))}
                      </Badge>
                      <Badge tone={legalTone(String(r.legal_state))}>legal: {label(String(r.legal_state))}</Badge>
                      {r.duplicate_state !== "UNCHECKED" && (
                        <Badge tone={r.duplicate_state === "DUPLICATE" ? "bad" : r.duplicate_state === "HIGH_SIMILARITY" ? "warn" : "ok"}>
                          {label(String(r.duplicate_state))}
                          {r.duplicate_score ? ` ${(Number(r.duplicate_score) * 100).toFixed(0)}%` : ""}
                        </Badge>
                      )}
                      {Boolean(r.stale) && <Badge tone="warn">stale</Badge>}
                      <span className="text-[10px] text-muted-foreground">v{num(r.version)} · {num(r.versions)} versions</span>
                    </div>
                    <button onClick={() => void openHistory(id)} className="text-[11px] text-accent hover:underline">
                      History
                    </button>
                  </div>

                  {Boolean(r.stale) && (
                    <div className="mb-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-warning">
                      {String(r.stale_reason ?? "The product changed after this was written.")} Regenerate or review before relying on it.
                    </div>
                  )}

                  {editing?.id === id ? (
                    <div>
                      <textarea
                        value={editing.text}
                        onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                        rows={10}
                        className="w-full rounded-lg border border-border bg-background/60 p-3 text-[12px] outline-none"
                      />
                      <div className="mt-2 flex gap-2">
                        <PillButton variant="primary" onClick={() => act.edit.mutate({ item_id: id, content: editing.text })}>
                          Save edit
                        </PillButton>
                        <PillButton onClick={() => setEditing(null)}>Cancel</PillButton>
                      </div>
                    </div>
                  ) : TYPES.find((t) => t.key === type)?.structured ? (
                    <Structured type={type} items={r.items} />
                  ) : (
                    <div className="whitespace-pre-wrap rounded-lg border border-border bg-background/50 p-3 text-[12px]">
                      {String(r.content ?? "")}
                    </div>
                  )}

                  {/* 33. The model's own words, kept for comparison. */}
                  {Boolean(r.human_edited) && Boolean(r.ai_original) && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-muted-foreground">
                        Compare with the AI original
                      </summary>
                      <div className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-background/30 p-3 text-[11px] text-muted-foreground">
                        {String(r.ai_original)}
                      </div>
                    </details>
                  )}

                  {(errors.length > 0 || warnings.length > 0) && (
                    <div className="mt-2 space-y-1">
                      {errors.map((e, i) => (
                        <div key={`e${i}`} className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
                          {label(e.code ?? "error")}: {e.detail}
                        </div>
                      ))}
                      {warnings.map((w, i) => (
                        <div key={`w${i}`} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-[11px] text-warning">
                          {label(w.code ?? "warning")}: {w.detail}
                        </div>
                      ))}
                    </div>
                  )}

                  {findings.length > 0 && (
                    <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-destructive">
                        Legal findings
                      </div>
                      {findings.map((f, i) => (
                        <div key={i} className="text-[11px] text-destructive">
                          {f.label} — {f.action === "block" ? "blocks publication" : "needs review"} ({f.severity})
                        </div>
                      ))}
                      {d?.can_approve && (
                        <div className="mt-2 flex gap-2">
                          <PillButton onClick={() => act.legal.mutate({ item_id: id, to: "CLEARED", reason: "Reviewed against the product record." })}>
                            Clear for publication
                          </PillButton>
                          <PillButton onClick={() => act.legal.mutate({ item_id: id, to: "BLOCKED", reason: "Confirmed as a risk." })}>
                            Keep blocked
                          </PillButton>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 55. What publishing actually did, target by target. */}
                  {Object.keys(targets).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(targets).map(([k, v]) => (
                        <div key={k} className="flex items-start justify-between gap-2 rounded-md border border-border bg-background/40 px-3 py-1.5">
                          <span className="font-mono text-[11px]">{k}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-right text-[10px] text-muted-foreground">{v.detail}</span>
                            <Badge tone={v.state === "written" ? "ok" : v.state === "skipped" ? "mute" : "bad"}>{v.state}</Badge>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {rejecting?.id === id ? (
                    <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
                      <div className="mb-2 text-[11px] font-bold">Why is this being rejected?</div>
                      <select
                        value={rejecting.code}
                        onChange={(e) => setRejecting({ ...rejecting, code: e.target.value })}
                        className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
                      >
                        {REJECTIONS.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
                      </select>
                      <input
                        value={rejecting.reason}
                        onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })}
                        placeholder="What exactly is wrong?"
                        className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
                      />
                      <div className="flex gap-2">
                        <PillButton variant="primary" onClick={() => act.reject.mutate(rejecting)}>Reject</PillButton>
                        <PillButton onClick={() => setRejecting(null)}>Cancel</PillButton>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!TYPES.find((t) => t.key === type)?.structured && r.status !== "ARCHIVED" && (
                        <PillButton onClick={() => setEditing({ id, type, text: String(r.content ?? "") })}>Edit</PillButton>
                      )}
                      {(r.status === "GENERATED" || r.status === "DRAFT" || r.status === "REJECTED") && (
                        <PillButton onClick={() => act.submit.mutate(id)}>Send for review</PillButton>
                      )}
                      {(r.status === "IN_REVIEW" || r.status === "GENERATED") && (
                        <PillButton variant="primary" onClick={() => act.approve.mutate(id)}>Approve</PillButton>
                      )}
                      {r.status === "APPROVED" && (
                        <PillButton variant="primary" onClick={() => act.publish.mutate(id)}>
                          <span className="inline-flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Publish</span>
                        </PillButton>
                      )}
                      {r.status !== "REJECTED" && r.status !== "ARCHIVED" && (
                        <PillButton onClick={() => setRejecting({ id, code: "incorrect_information", reason: "" })}>Reject</PillButton>
                      )}
                      {r.status !== "ARCHIVED" && (
                        <PillButton onClick={() => act.archive.mutate(id)}>Archive</PillButton>
                      )}
                      <PillButton
                        onClick={() => { setChosen([type as ContentType]); gen.mutate(); }}
                      >
                        <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Regenerate</span>
                      </PillButton>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------- Review queue */}
      {tab === "Review queue" && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold">Awaiting review</div>
            <Badge tone="warn">{num((d?.queue ?? []).length)} open</Badge>
          </div>
          {(d?.queue ?? []).length === 0 && <EmptyHint text="Nothing is waiting for review." />}
          <div className="space-y-1.5">
            {(d?.queue ?? []).map((raw) => {
              const q = raw as Record<string, unknown>;
              const id = String(q.id);
              return (
                <div key={id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-semibold">{String(q.product)}</span>
                    <Badge tone="info">{label(String(q.content_type))}</Badge>
                    <Badge tone={q.validation_state === "PASSED" ? "ok" : "bad"}>{label(String(q.validation_state))}</Badge>
                    <Badge tone={legalTone(String(q.legal_state))}>{label(String(q.legal_state))}</Badge>
                    {Boolean(q.human_edited) && <Badge tone="info">human edited</Badge>}
                    {Boolean(q.stale) && <Badge tone="warn">stale</Badge>}
                  </div>
                  <div className="text-[12px] text-muted-foreground">{String(q.preview ?? "")}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PillButton
                      onClick={() => { setProduct({ id: String(q.product_id ?? ""), name: String(q.product) }); setTab("Generate"); }}
                    >
                      <span className="inline-flex items-center gap-1.5">Open <ChevronRight className="h-3.5 w-3.5" /></span>
                    </PillButton>
                    <PillButton variant="primary" onClick={() => act.approve.mutate(id)}>Approve</PillButton>
                    <PillButton onClick={() => setRejecting({ id, code: "incorrect_information", reason: "" })}>Reject</PillButton>
                  </div>
                  {rejecting?.id === id && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select
                        value={rejecting.code}
                        onChange={(e) => setRejecting({ ...rejecting, code: e.target.value })}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-[12px]"
                      >
                        {REJECTIONS.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
                      </select>
                      <input
                        value={rejecting.reason}
                        onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })}
                        placeholder="Reason"
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px]"
                      />
                      <PillButton variant="primary" onClick={() => act.reject.mutate(rejecting)}>Confirm</PillButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ----------------------------------------------- Bulk generation */}
      {tab === "Bulk generation" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <div className="mb-3 text-sm font-bold">Start a job</div>
            <div className="mb-2 text-[11px] text-muted-foreground">
              A job records every product it will touch before it starts, then runs in batches from the
              server. A product whose blocks are already published is not queued at all.
            </div>
            <select
              value={bulkScope}
              onChange={(e) => setBulkScope(e.target.value)}
              className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
            >
              <option value="missing_description">Products with no description ({num(stats.products_missing_description)})</option>
              <option value="missing_seo">Products with no SEO description ({num(stats.products_missing_seo)})</option>
              <option value="rejected_content">Products with rejected content</option>
              <option value="stale">Products whose content is stale ({num(stats.stale)})</option>
              <option value="all_eligible">Every approved, visible product ({num(stats.products_total)})</option>
            </select>
            <div className="mb-2 text-[11px] text-muted-foreground">
              Blocks: {chosen.length ? chosen.map(label).join(", ") : "none selected — choose them on the Generate tab"}
            </div>
            <PillButton
              variant="primary"
              disabled={chosen.length === 0 || startBulk.isPending || Boolean(bulkRun?.running)}
              onClick={() => startBulk.mutate()}
            >
              <span className="inline-flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Queue the job</span>
            </PillButton>
            {bulkRun && (
              <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
                <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold">
                  {bulkRun.running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {bulkRun.running ? "Running" : "Finished"} · {num(bulkRun.processed)} processed
                </div>
                <div className="max-h-40 space-y-0.5 overflow-y-auto">
                  {bulkRun.log.map((l, i) => (
                    <div key={i} className="font-mono text-[10px] text-muted-foreground">{l}</div>
                  ))}
                </div>
                {!bulkRun.running && (
                  <div className="mt-2 flex gap-2">
                    <PillButton onClick={() => { void retryBulkJob({ data: { job_id: bulkRun.job } }).then(() => setBulkRun({ ...bulkRun, running: true })); }}>
                      Retry failures
                    </PillButton>
                    <PillButton onClick={() => setBulkRun(null)}>Close</PillButton>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <div className="mb-3 text-sm font-bold">Recent jobs</div>
            {(d?.jobs ?? []).length === 0 && <EmptyHint text="No bulk job has been run." />}
            <div className="space-y-1.5">
              {(d?.jobs ?? []).map((raw) => {
                const j = raw as Record<string, unknown>;
                return (
                  <div key={String(j.id)} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={j.status === "COMPLETED" ? "ok" : j.status === "FAILED" ? "bad" : j.status === "CANCELLED" ? "mute" : "warn"}>
                        {label(String(j.status))}
                      </Badge>
                      <span className="text-[12px] font-semibold">{label(String(j.scope))}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {(j.types as string[])?.map(label).join(", ")}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span>total {num(j.total)}</span>
                      <span>queued {num(j.queued)}</span>
                      <span>processing {num(j.processing)}</span>
                      <span className="text-success">completed {num(j.completed)}</span>
                      <span className="text-warning">needs review {num(j.needs_review)}</span>
                      <span className="text-destructive">failed {num(j.failed)}</span>
                      <span>skipped {num(j.skipped)}</span>
                    </div>
                    {Boolean(j.last_error) && (
                      <div className="mt-1 text-[11px] text-destructive">{String(j.last_error)}</div>
                    )}
                    <div className="mt-2 flex gap-2">
                      {Number(j.failed) > 0 && (
                        <PillButton onClick={() => void retryBulkJob({ data: { job_id: String(j.id) } }).then(refresh)}>
                          Retry {num(j.failed)} failures
                        </PillButton>
                      )}
                      {(j.status === "QUEUED" || j.status === "PROCESSING") && (
                        <>
                          <PillButton onClick={() => setBulkRun({ job: String(j.id), processed: 0, running: true, log: ["Resumed."] })}>
                            Resume
                          </PillButton>
                          <PillButton onClick={() => void cancelBulkJob({ data: { job_id: String(j.id), reason: "Cancelled from the console." } }).then(refresh)}>
                            Cancel
                          </PillButton>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* --------------------------------------------------------- Settings */}
      {tab === "Settings" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Settings2 className="h-4 w-4" /> Content blocks
            </div>
            <div className="space-y-1.5">
              {TYPES.map((t) => (
                <label key={t.key} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px]">
                  {t.label}
                  <input
                    type="checkbox"
                    checked={blocks[t.key] !== false}
                    onChange={(e) =>
                      act.settings.mutate({
                        blocks: { ...blocks, [t.key]: e.target.checked },
                        reason: `Turned ${t.label} ${e.target.checked ? "on" : "off"}.`,
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-3 text-sm font-bold">Governance</div>
            <div className="mb-1 text-[11px] text-muted-foreground">Publishing policy</div>
            <select
              value={String(settings.publish_policy ?? "MANUAL_APPROVAL")}
              onChange={(e) => act.settings.mutate({ publish_policy: e.target.value, reason: "Policy changed." })}
              className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
            >
              <option value="MANUAL_APPROVAL">Manual approval</option>
              <option value="ROLE_BASED_APPROVAL">Role-based approval</option>
              <option value="LEGAL_REVIEW_REQUIRED">Legal review required</option>
              <option value="AUTO_PUBLISH">Auto publish</option>
            </select>
            <div className="mb-3 rounded-lg border border-border bg-background/40 p-3 text-[11px] text-muted-foreground">
              A legal block is absolute. Under every policy, including auto publish, content the legal
              scan blocked cannot publish until a reviewer clears it.
            </div>
            <label className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[12px]">
              Allow publishing to overwrite copy a person already wrote
              <input
                type="checkbox"
                checked={Boolean(settings.overwrite_existing_product_copy)}
                onChange={(e) =>
                  act.settings.mutate({
                    overwrite_existing_product_copy: e.target.checked,
                    reason: "Overwrite policy changed.",
                  })
                }
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">Daily request cap</div>
                <input
                  type="number"
                  defaultValue={Number(settings.daily_request_cap ?? 500)}
                  onBlur={(e) => act.settings.mutate({ daily_request_cap: Number(e.target.value), reason: "Cap changed." })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">Bulk batch size</div>
                <input
                  type="number"
                  defaultValue={Number(settings.bulk_batch_size ?? 10)}
                  onBlur={(e) => act.settings.mutate({ bulk_batch_size: Number(e.target.value), reason: "Batch size changed." })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px]"
                />
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-3 text-sm font-bold">Brand voice</div>
            <div className="mb-2 text-[11px] text-muted-foreground">
              Tone only. A brand rule never changes a fact, and a prohibited phrase fails validation
              outright rather than being softened.
            </div>
            <div className="mb-1 text-[11px] text-muted-foreground">Prohibited phrases</div>
            <textarea
              defaultValue={((settings.brand_voice as { prohibited_phrases?: string[] })?.prohibited_phrases ?? []).join("\n")}
              rows={7}
              onBlur={(e) =>
                act.settings.mutate({
                  brand_voice: {
                    ...(settings.brand_voice as Record<string, unknown>),
                    prohibited_phrases: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  },
                  reason: "Prohibited phrases updated.",
                })
              }
              className="w-full rounded-lg border border-border bg-background/60 p-3 text-[12px] outline-none"
            />
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Gavel className="h-4 w-4" /> Legal rules in force
            </div>
            <div className="mb-2 text-[11px] text-muted-foreground">
              Regular expressions a person wrote, run over every generated block. Each finding names the
              rule that produced it, so nothing here is a model's opinion.
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {(d?.legal_rules ?? []).map((raw) => {
                const x = raw as Record<string, unknown>;
                return (
                  <div key={String(x.code)} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-1.5">
                    <span className="text-[11px]">{String(x.label)}</span>
                    <Badge tone={x.action === "block" ? "bad" : "warn"}>{String(x.action)}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* -------------------------------------------------------- Activity */}
      {tab === "Activity" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 text-sm font-bold">Provider usage</div>
            {/* 27. Reported, or plainly marked unavailable. Never invented. */}
            {(() => {
              const u = (d?.usage as { last_30_days?: Record<string, unknown> })?.last_30_days ?? {};
              return (
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between"><span>Requests, 30 days</span><span className="font-mono">{num(u.requests)}</span></div>
                  <div className="flex justify-between"><span>Succeeded</span><span className="font-mono text-success">{num(u.succeeded)}</span></div>
                  <div className="flex justify-between"><span>Failed</span><span className="font-mono text-destructive">{num(u.failed)}</span></div>
                  <div className="flex justify-between"><span>Blocked by missing configuration</span><span className="font-mono text-warning">{num(u.not_configured)}</span></div>
                  <div className="flex justify-between">
                    <span>Tokens</span>
                    <span className="font-mono">{u.usage_available ? `${num(u.tokens_in)} in / ${num(u.tokens_out)} out` : "UNAVAILABLE"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost</span>
                    <span className="font-mono">{u.cost_available ? `$${Number(u.cost_usd ?? 0).toFixed(4)}` : "UNAVAILABLE"}</span>
                  </div>
                  {!u.cost_available && (
                    <div className="text-[11px] text-muted-foreground">
                      The provider does not bill in its response, so no cost is shown. A figure calculated
                      from a price list would be a guess.
                    </div>
                  )}
                </div>
              );
            })()}
          </Card>

          <Card>
            <div className="mb-3 text-sm font-bold">Recent generations</div>
            {(d?.generations ?? []).length === 0 && <EmptyHint text="No generation has been attempted." />}
            <div className="max-h-96 space-y-1.5 overflow-y-auto">
              {(d?.generations ?? []).map((raw) => {
                const g = raw as Record<string, unknown>;
                return (
                  <div key={String(g.id)} className="rounded-lg border border-border bg-background/40 p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={g.status === "SUCCEEDED" ? "ok" : g.status === "NOT_CONFIGURED" ? "warn" : "bad"}>
                        {label(String(g.status))}
                      </Badge>
                      <span className="text-[12px] font-semibold">{String(g.product)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {String(g.provider ?? "—")} · {String(g.model ?? "—")} · prompt {String(g.prompt_key ?? "—")} v{num(g.prompt_version)}
                      </span>
                    </div>
                    {Boolean(g.error_code) && (
                      <div className="mt-1 text-[11px] text-destructive">
                        {String(g.error_code)}: {String(g.error_detail ?? "")}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {(g.context_fields as string[])?.length ?? 0} facts given · {(g.missing_fields as string[])?.length ?? 0} missing ·{" "}
                      {g.usage_available ? `${num(g.tokens_in)}/${num(g.tokens_out)} tokens` : "usage unavailable"}
                      {g.latency_ms ? ` · ${num(g.latency_ms)}ms` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <div className="mb-3 text-sm font-bold">Audit trail</div>
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {(d?.audit ?? []).map((raw, i) => {
                const a = raw as Record<string, unknown>;
                return (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background/40 px-3 py-1.5">
                    <span className="font-mono text-[11px]">{String(a.action)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {String(a.actor ?? "system")} ({String(a.role ?? "—")}) · {new Date(String(a.at)).toLocaleString()}
                      {a.reason ? ` · ${String(a.reason)}` : ""}
                    </span>
                  </div>
                );
              })}
              {(d?.audit ?? []).length === 0 && <EmptyHint text="Nothing recorded yet." />}
            </div>
          </Card>
        </div>
      )}

      {/* 32. Version history and rollback. */}
      {history && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setHistory(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <History className="h-4 w-4" /> Version history
            </div>
            {!history.data && <div className="text-[12px] text-muted-foreground">Loading…</div>}
            <div className="space-y-2">
              {(((history.data as { versions?: Record<string, unknown>[] })?.versions) ?? []).map((v) => (
                <div key={String(v.version)} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone="info">v{num(v.version)}</Badge>
                    <Badge tone="mute">{label(String(v.kind))}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {String(v.actor ?? "system")} · {new Date(String(v.created_at)).toLocaleString()}
                    </span>
                  </div>
                  {Boolean(v.note) && <div className="mb-1 text-[11px] text-muted-foreground">{String(v.note)}</div>}
                  <div className="max-h-24 overflow-hidden whitespace-pre-wrap text-[11px]">
                    {String(v.content ?? JSON.stringify(v.items ?? "", null, 1)).slice(0, 400)}
                  </div>
                  <div className="mt-2">
                    <PillButton onClick={() => act.rollback.mutate({ item_id: history.id, version: Number(v.version) })}>
                      Restore this version
                    </PillButton>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Review decisions</div>
              {(((history.data as { reviews?: Record<string, unknown>[] })?.reviews) ?? []).map((r, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-1 text-[11px]">
                  <span className="font-semibold">{label(String(r.decision))}</span>
                  <span className="text-muted-foreground">
                    {String(r.reviewer ?? "system")} · {String(r.reason ?? r.reason_code ?? "")}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <PillButton onClick={() => setHistory(null)}>Close</PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
