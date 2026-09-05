import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, Search as SearchIcon, Trash2 } from "lucide-react";

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

function PagesScreen() {
  const pages = useQuery(seoQueries.pages());
  const { remove } = useRecordActions();
  const [term, setTerm] = useState("");

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
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${p.url}`}
                      onClick={() => remove.mutate({ table: "seo_pages", id: p.id })}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
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
