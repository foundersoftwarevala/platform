import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Pencil, Search as SearchIcon, Trash2 } from "lucide-react";
import { authHeaders } from "@/lib/auth/operator-fetch";

import { SeoShell } from "@/components/seo/SeoShell";
import { DataTable } from "@/components/seo/DataTable";
import {
  KpiCard,
  Panel,
  QueryBoundary,
  StatusPill,
  formatDateTime,
  nf,
} from "@/components/seo/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { seoQueries, type Row } from "@/lib/seo-queries";
import { seoHead } from "@/lib/seo-head";
import { useRecordActions } from "@/lib/use-seo-actions";

export const Route = createFileRoute("/pages")({
  head: seoHead(
    "/pages",
    "Page Optimization",
    "On-page SEO scores, meta coverage, canonical health and index state for every Software Vala URL.",
  ),
  component: PagesScreen,
});

type PageDraft = {
  url: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  indexStatus: string;
};

const EMPTY_DRAFT: PageDraft = {
  url: "",
  metaTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  indexStatus: "",
};

/**
 * Write one page's SEO.
 *
 * The product page already reads seo_pages and lets a record there win over
 * its own defaults, and /api/internal/seo-page already wrote that record and
 * cleared the page's cache — but no screen called it, so every product's meta
 * could only be what the product row said. This is that caller.
 */
function PageSeoEditor({
  draft,
  onChange,
  onDone,
}: {
  draft: PageDraft;
  onChange: (next: PageDraft) => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/internal/seo-page", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          url: draft.url.trim(),
          metaTitle: draft.metaTitle,
          metaDescription: draft.metaDescription,
          canonicalUrl: draft.canonicalUrl,
          ...(draft.indexStatus ? { indexStatus: draft.indexStatus } : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        warnings?: string[];
      };
      if (!response.ok) throw new Error(body.error ?? `Could not save (${response.status})`);
      return body;
    },
    onSuccess: (body) => {
      toast.success(`Saved. ${draft.url.trim()} now serves this title and description.`);
      for (const warning of body.warnings ?? []) toast.message(warning);
      queryClient.invalidateQueries({ queryKey: seoQueries.pages().queryKey });
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = (key: keyof PageDraft) => (e: { target: { value: string } }) =>
    onChange({ ...draft, [key]: e.target.value });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Input value={draft.url} onChange={set("url")} placeholder="/marketplace/product/slug" aria-label="Page path" />
        <Input
          value={draft.canonicalUrl}
          onChange={set("canonicalUrl")}
          placeholder="Canonical URL (empty = the page's own)"
          aria-label="Canonical URL"
        />
        <Input value={draft.metaTitle} onChange={set("metaTitle")} placeholder="Meta title" aria-label="Meta title" />
        <select
          value={draft.indexStatus}
          onChange={set("indexStatus")}
          aria-label="Index status"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Index status — unchanged</option>
          <option value="indexed">indexed</option>
          <option value="pending">pending</option>
          <option value="crawled_not_indexed">crawled_not_indexed</option>
          <option value="noindex">noindex (hide from search)</option>
        </select>
      </div>
      <textarea
        value={draft.metaDescription}
        onChange={set("metaDescription")}
        placeholder="Meta description (70–160 characters shows in full)"
        aria-label="Meta description"
        rows={3}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Title {draft.metaTitle.trim().length}/60 · Description {draft.metaDescription.trim().length}/160
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={save.isPending || !draft.url.trim().startsWith("/")}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save page SEO"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PagesScreen() {
  const pages = useQuery(seoQueries.pages());
  const { remove } = useRecordActions();
  const [term, setTerm] = useState("");
  const [draft, setDraft] = useState<PageDraft | null>(null);

  const rows = useMemo(() => {
    const list = pages.data ?? [];
    if (!term.trim()) return list;
    const q = term.toLowerCase();
    return list.filter(
      (p) => p.url.toLowerCase().includes(q) || p.title.toLowerCase().includes(q),
    );
  }, [pages.data, term]);

  const all = pages.data ?? [];
  const avgScore = all.length
    ? Math.round(all.reduce((a, p) => a + p.seo_score, 0) / all.length)
    : 0;
  const missingMeta = all.filter((p) => !p.meta_description || !p.meta_title).length;
  const indexed = all.filter((p) => p.index_status === "indexed").length;

  return (
    <SeoShell
      title="Page Optimization"
      description="Every crawled URL with its on-page score, metadata coverage and open issues."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pages tracked" value={nf.format(all.length)} icon={FileText} />
        <KpiCard label="Average SEO score" value={avgScore} hint="0–100" />
        <KpiCard label="Missing metadata" value={missingMeta} hint="title or description" />
        <KpiCard label="Indexed" value={`${indexed}/${all.length}`} />
      </div>

      <Panel
        className="mt-4"
        title="Edit page SEO"
        description="Title, description, canonical and index state for any page — a product page picks it up on its next request."
        actions={
          draft ? null : (
            <Button size="sm" variant="outline" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
              New page record
            </Button>
          )
        }
      >
        {draft ? (
          <PageSeoEditor draft={draft} onChange={setDraft} onDone={() => setDraft(null)} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose the pencil on a page below, or start a new record for a page that is not listed yet.
          </p>
        )}
      </Panel>

      <Panel
        className="mt-4"
        title="Pages"
        description="Search by URL or title"
        actions={
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Filter pages"
              className="w-56 pl-8"
            />
          </div>
        }
      >
        <QueryBoundary query={pages} empty="No pages crawled yet.">
          {() => (
            <DataTable<Row<"seo_pages">>
              rows={rows}
              columns={[
                {
                  key: "url",
                  header: "Page",
                  render: (p) => (
                    <div className="min-w-0 max-w-[320px]">
                      <p className="truncate font-medium text-foreground">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.url}</p>
                    </div>
                  ),
                },
                { key: "type", header: "Type", render: (p) => <StatusPill value={p.page_type} tone="neutral" /> },
                {
                  key: "meta",
                  header: "Meta",
                  render: (p) => (
                    <span className="text-xs text-muted-foreground">
                      {p.meta_title ? "Title ✓" : "Title ✗"} · {p.meta_description ? "Desc ✓" : "Desc ✗"}
                    </span>
                  ),
                },
                { key: "words", header: "Words", render: (p) => nf.format(p.word_count) },
                {
                  key: "score",
                  header: "Score",
                  render: (p) => (
                    <span
                      className={
                        p.seo_score >= 80
                          ? "numeric text-success"
                          : p.seo_score >= 60
                            ? "numeric text-warning"
                            : "numeric text-destructive"
                      }
                    >
                      {p.seo_score}
                    </span>
                  ),
                },
                { key: "issues", header: "Issues", render: (p) => p.issues_count },
                { key: "index", header: "Index", render: (p) => <StatusPill value={p.index_status} /> },
                {
                  key: "crawled",
                  header: "Last crawl",
                  render: (p) => (
                    <span className="text-xs text-muted-foreground">{formatDateTime(p.last_crawled_at)}</span>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (p) => (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit SEO for ${p.url}`}
                        onClick={() => {
                          setDraft({
                            url: p.url,
                            metaTitle: p.meta_title ?? "",
                            metaDescription: p.meta_description ?? "",
                            canonicalUrl: (p as { canonical_url?: string | null }).canonical_url ?? "",
                            indexStatus: "",
                          });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${p.url}`}
                        onClick={() => remove.mutate({ table: "seo_pages", id: p.id })}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </QueryBoundary>
      </Panel>
    </SeoShell>
  );
}
