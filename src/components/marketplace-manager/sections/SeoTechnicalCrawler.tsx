import { useState } from "react";
import { AlertTriangle, Database, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";

import { Card, SubNav } from "../ui";
import {
  useRunSeoProductCrawl,
  useSeoProductBrokenLinks,
  useSeoProductCrawlJobs,
} from "@/lib/use-seo-technical-crawl";

const SECTIONS = [
  {
    label: "Crawl Jobs",
    columns: ["Domain", "Start URL", "Status", "Pages Scanned", "Started"],
  },
  {
    label: "Broken Links",
    columns: ["Domain", "URL", "Source URL", "HTTP Status", "Status"],
  },
  {
    label: "Redirects",
    columns: ["Domain", "Source URL", "Target URL", "Type", "Status"],
  },
  {
    label: "Core Web Vitals",
    columns: ["Domain", "URL", "LCP", "INP", "CLS", "Status"],
  },
] as const;

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function SeoTechnicalCrawler() {
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].label);
  const section = SECTIONS.find((item) => item.label === activeSection) ?? SECTIONS[0];
  const jobs = useSeoProductCrawlJobs(section.label === "Crawl Jobs");
  const links = useSeoProductBrokenLinks(section.label === "Broken Links");
  const crawl = useRunSeoProductCrawl();
  const selectedQuery = section.label === "Crawl Jobs" ? jobs : links;
  const isQuerySection = section.label === "Crawl Jobs" || section.label === "Broken Links";
  const isLoading = isQuerySection && (selectedQuery.isPending || selectedQuery.isFetching);

  const onAction = () => {
    if (section.label === "Crawl Jobs") {
      crawl.mutate();
      return;
    }
    if (section.label === "Broken Links") {
      void links.refetch();
      return;
    }
    toast.info("API Integration Pending. Connect API to run.");
  };

  const actionLabel =
    section.label === "Crawl Jobs"
      ? "Start Crawl"
      : section.label === "Broken Links"
        ? "Refresh Data"
        : section.label === "Core Web Vitals"
          ? "Start Crawl"
          : "Refresh Data";

  let body: ReactNode;
  if (section.label === "Crawl Jobs" && jobs.isError) {
    body = (
      <tr>
        <td colSpan={section.columns.length} className="px-3 py-8 text-center" role="alert">
          <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-destructive" />
          <p className="text-muted-foreground">Failed to load crawl jobs.</p>
          <button type="button" onClick={() => void jobs.refetch()} className="mt-2 underline">
            Retry
          </button>
        </td>
      </tr>
    );
  } else if (section.label === "Broken Links" && links.isError) {
    body = (
      <tr>
        <td colSpan={section.columns.length} className="px-3 py-8 text-center" role="alert">
          <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-destructive" />
          <p className="text-muted-foreground">Failed to load broken links.</p>
          <button type="button" onClick={() => void links.refetch()} className="mt-2 underline">
            Retry
          </button>
        </td>
      </tr>
    );
  } else if (isLoading) {
    body = (
      <tr>
        <td colSpan={section.columns.length} className="px-3 py-8 text-center" role="status">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading {section.label.toLowerCase()}…
        </td>
      </tr>
    );
  } else if (section.label === "Crawl Jobs" && jobs.data?.length) {
    body = jobs.data.map((job) => (
      <tr key={job.id} className="border-t border-border">
        <td className="whitespace-nowrap px-3 py-2">{job.domain}</td>
        <td className="max-w-[320px] truncate px-3 py-2" title={job.url}>
          {job.url}
        </td>
        <td className="whitespace-nowrap px-3 py-2 capitalize">{job.status}</td>
        <td className="px-3 py-2">
          {job.pages_scanned}
          {job.pages_total === null ? "" : ` / ${job.pages_total}`}
        </td>
        <td className="whitespace-nowrap px-3 py-2">{formatDate(job.started_at)}</td>
      </tr>
    ));
  } else if (section.label === "Broken Links" && links.data?.length) {
    body = links.data.map((link) => (
      <tr key={link.id} className="border-t border-border">
        <td className="whitespace-nowrap px-3 py-2">{link.domain}</td>
        <td className="max-w-[360px] break-all px-3 py-2">
          <a href={link.url} target="_blank" rel="noreferrer" className="text-accent underline">
            {link.url}
          </a>
        </td>
        <td className="max-w-[320px] break-all px-3 py-2">{link.source_url ?? "—"}</td>
        <td className="px-3 py-2">{link.http_status ?? "Connection error"}</td>
        <td className="whitespace-nowrap px-3 py-2 capitalize">{link.status}</td>
      </tr>
    ));
  } else {
    const emptyMessage =
      section.label === "Broken Links"
        ? "No broken links detected."
        : section.label === "Crawl Jobs"
          ? "No crawl jobs yet. Run a scan to begin."
          : "No data available.";
    body = (
      <tr>
        <td
          colSpan={section.columns.length}
          className="px-3 py-10 text-center text-muted-foreground"
          role="status"
        >
          <Database className="mx-auto mb-2 h-5 w-5 opacity-60" />
          <span>{emptyMessage}</span>
        </td>
      </tr>
    );
  }

  return (
    <div data-skip-drawer>
      <div className="mb-5">
        <h2 className="text-xl font-bold">Technical SEO</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Check up to 50 published Marketplace product pages per scan. Requests are limited to this
          site and run at no more than 10 concurrent connections.
        </p>
      </div>
      <SubNav
        items={SECTIONS.map((item) => item.label)}
        active={section.label}
        onChange={setActiveSection}
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{section.label}</h3>
            {section.label === "Crawl Jobs" && (
              <p className="mt-1 text-xs text-muted-foreground">
                The scan checks public product URLs without following off-site redirects.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onAction}
            disabled={crawl.isPending || (section.label === "Broken Links" && links.isFetching)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {section.label === "Crawl Jobs" ? (
              crawl.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {section.label === "Crawl Jobs" && crawl.isPending ? "Scanning…" : actionLabel}
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-left text-xs">
            <thead className="bg-background/50 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {section.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2.5 font-semibold"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{body}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
