import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Download, FileText, FolderOpen, Image as ImageIcon,
  Loader2, RefreshCw, Search, Video,
} from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";

/**
 * Media Library, over the media that exists.
 *
 * The screen had four blank counters and eight category chips. The counters are
 * now counts, and the categories are the ones with something in them.
 *
 * Two numbers on this screen are worth pausing on, and neither is flattering.
 * Nine of the sixteen catalogued rows have no file behind them - declared brand
 * assets and franchise documents with no upload. And of a thousand products,
 * not one has an image: the icon column holds a Lucide component name, not a
 * file. Nine hundred and eighty-seven of those are published. That is shown as
 * a finding at the top rather than folded into a total, because it is the
 * single most useful thing this screen can tell anybody.
 *
 * The static original is kept as MediaLibrarySectionStatic.
 */

type Asset = {
  asset_id: string; source: string; authority: string;
  filename: string; display_name: string;
  mime_type: string | null; extension: string | null; kind: string;
  size_bytes: number | null; width: number | null; height: number | null;
  checksum: string | null; storage_path: string | null;
  is_public: boolean; status: string; uploaded_at: string | null;
  missing_file: boolean; references: number;
};

type Capability = { available: boolean; reason: string | null };

type Data = {
  ok: boolean; total: number; matched: number; page: number; size: number;
  assets: Asset[]; sources: string[]; buckets: string[]; notes: string[];
  storage: {
    used_bytes: number; by_kind_bytes: Record<string, number>;
    by_kind_count: Record<string, number>;
    quota_bytes: number | null; quota_note: string; files_missing: number;
  };
  references: {
    products: number; products_with_image: number; products_without_image: number;
    products_with_icon_name_only: number; published_without_image: number;
    orphan_candidates: number; referenced: number;
  };
  capabilities: Record<string, Capability>;
  permissions: { view: boolean; upload: boolean; manage: boolean; download: boolean; export: boolean };
};

const TABS = ["All", "Images", "Videos", "Documents", "Assets"];
const TAB_KIND: Record<string, string> = {
  All: "all", Images: "image", Videos: "video", Documents: "document", Assets: "icon",
};

const SORTS = [
  { id: "newest", label: "Newest" }, { id: "oldest", label: "Oldest" },
  { id: "name_asc", label: "Name A–Z" }, { id: "name_desc", label: "Name Z–A" },
  { id: "largest", label: "Largest" }, { id: "smallest", label: "Smallest" },
];

const bytes = (v: number | null) => {
  if (v === null || v === undefined) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / 1024 / 1024).toFixed(1)} MB`;
};

const when = (v: string | null) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const KIND_ICON: Record<string, typeof ImageIcon> = {
  image: ImageIcon, icon: ImageIcon, video: Video, document: FileText, archive: FolderOpen,
};

export function MediaLibrary() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState(TABS[0]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Section 5: debounced, so typing does not become one request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(query); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({
        kind: TAB_KIND[tab] ?? "all", source, sort,
        page: String(page), size: "25",
      });
      if (debounced.trim()) params.set("q", debounced.trim());
      const response = await fetch(`/api/marketplace/media?${params}`, { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `The library could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
    } catch (cause) {
      setError(cause);
    }
  }, [tab, source, sort, page, debounced]);

  useEffect(() => { void load(); }, [load]);

  const download = useCallback(async (asset: Asset) => {
    setBusy(asset.asset_id);
    setNote(null);
    try {
      const response = await fetch("/api/marketplace/media", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ asset_id: asset.asset_id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setNote(payload?.message ?? `That download was refused (${response.status}).`);
        return;
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
      setNote(`A five-minute link was issued for ${asset.filename}. The request is on the audit trail.`);
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "That link could not be issued.");
    } finally {
      setBusy(null);
    }
  }, []);

  const exportCsv = useCallback(async () => {
    setBusy("export");
    try {
      const response = await fetch("/api/marketplace/media?format=csv", { headers: await authHeaders() });
      if (!response.ok) {
        setNote(`The export was refused (${response.status}).`);
        return;
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `media-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setNote("Media metadata exported. No storage credential or signed link is included.");
    } finally {
      setBusy(null);
    }
  }, []);

  const pages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.matched / data.size)) : 1),
    [data],
  );

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Media Library" title="Media" description="Central asset store: images, icons, videos, documents, ZIPs and PDFs." />
        <LoadFailure error={error} onRetry={load} what="the media library" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Media Library" title="Media" description="Central asset store: images, icons, videos, documents, ZIPs and PDFs." />
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading storage and the asset tables…</div></Card>
      </div>
    );
  }

  const s = data.storage;
  const r = data.references;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Media Library"
        title="Media"
        description="Central asset store: images, icons, videos, documents, ZIPs and PDFs."
        actions={
          <>
            {data.permissions.export ? (
              <PillButton onClick={exportCsv} disabled={busy === "export"}>
                <Download className="mr-1 h-3.5 w-3.5" /> Export
              </PillButton>
            ) : null}
            <PillButton onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</PillButton>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assets" value={String(data.total)} />
        <StatCard label="Images" value={String(s.by_kind_count.image ?? 0)} tone="premium" />
        <StatCard label="Videos" value={String(s.by_kind_count.video ?? 0)} tone="success" />
        <StatCard label="Storage used" value={bytes(s.used_bytes)} tone="warning" />
      </div>

      {/* The finding that matters more than any of the counters above. */}
      {r.published_without_image > 0 ? (
        <Card className="mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div className="text-sm">
              <div className="font-medium">
                {r.published_without_image} published products have no image.
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Of {r.products} products, {r.products_with_image} have an image file. The icon column on{" "}
                {r.products_with_icon_name_only} of them holds a Lucide component name, not a picture — counting
                those as imagery would be the most misleading number this screen could show, so it does not.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {s.files_missing > 0 ? (
        <Card className="mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <div className="font-medium">{s.files_missing} catalogued rows have no file behind them.</div>
              <p className="mt-1 text-xs text-muted-foreground">
                They are rows that declare an asset — no size, no checksum, nothing uploaded. They are listed and
                marked rather than counted as stored media.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="mb-6">
        <div className="text-xs text-muted-foreground">
          {s.quota_note}
          {" "}Buckets: {data.buckets.join(", ") || "none"}.
          {data.notes.map((n) => <span key={n}> {n}</span>)}
        </div>
      </Card>

      {note ? <Card className="mb-6"><div className="text-sm">{note}</div></Card> : null}

      <SubNav items={TABS} active={tab} onChange={(v) => { setTab(v); setPage(1); }} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a filename, an asset id, a type or a source"
              aria-label="Search media"
              className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm"
            />
          </div>
          <select
            value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}
            aria-label="Filter by source"
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="all">Every source</option>
            {data.sources.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select
            value={sort} onChange={(e) => setSort(e.target.value)}
            aria-label="Sort"
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">
            {data.matched} of {data.total}
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2">Asset</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Size</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Uploaded</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.assets.map((a) => {
                const Icon = KIND_ICON[a.kind] ?? FolderOpen;
                return (
                  <tr key={a.asset_id} className="border-b border-border/60">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{a.display_name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {a.source}
                            {a.checksum ? ` · sha256 ${a.checksum.slice(0, 10)}` : ""}
                            {a.width && a.height ? ` · ${a.width}×${a.height}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs">{a.mime_type ?? a.kind}</td>
                    <td className="px-4 py-2 text-xs">{bytes(a.size_bytes)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{a.authority}</td>
                    <td className="px-4 py-2 text-xs">
                      {a.missing_file ? (
                        <span className="rounded border border-amber-500/30 px-1.5 py-0.5 text-amber-500">no file</span>
                      ) : (
                        <span className="rounded border border-emerald-500/30 px-1.5 py-0.5 text-emerald-500">{a.status}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{when(a.uploaded_at)}</td>
                    <td className="px-4 py-2 text-right">
                      {a.asset_id.startsWith("storage:") && data.permissions.download ? (
                        <button
                          onClick={() => void download(a)}
                          disabled={busy === a.asset_id}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          {busy === a.asset_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Download"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {a.asset_id.startsWith("storage:") ? "no permission" : "served by its own manager"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.assets.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Nothing matches that.</div>
          ) : null}
        </div>
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs">
            <span className="text-muted-foreground">Page {data.page} of {pages}</span>
            <span className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Previous</button>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
            </span>
          </div>
        ) : null}
      </Card>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What this library can and cannot do
        </div>
        {Object.entries(data.capabilities).map(([key, capability]) => (
          <div key={key} className="border-t border-border px-4 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className={capability.available ? "text-emerald-500" : "text-amber-500"}>
                {capability.available ? "✓" : "✕"}
              </span>
              <span className="font-medium">{key.replace(/_/g, " ")}</span>
            </div>
            {capability.reason ? (
              <p className="mt-1 text-xs text-muted-foreground">{capability.reason}</p>
            ) : null}
          </div>
        ))}
      </Card>
    </div>
  );
}
