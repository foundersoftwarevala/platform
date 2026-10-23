import { useState } from "react";
import { RefreshCw, Play, Database } from "lucide-react";
import { toast } from "sonner";

import { Card, SubNav } from "../ui";
import { useTranslation } from "@/lib/i18n/use-translation";

export type SeoFrameworkPhase =
  | "backlinks-foundation"
  | "technical-foundation"
  | "keywords-foundation"
  | "local-phase2"
  | "international-phase2"
  | "reporting-phase2";

type Section = {
  label: string;
  table: string;
  columns: string[];
  action: "refresh" | "crawl" | "sync" | "hreflang" | "export";
};

const PHASES: Record<SeoFrameworkPhase, { title: string; sections: Section[] }> = {
  "backlinks-foundation": {
    title: "Backlinks & Competitors",
    sections: [
      {
        label: "Referring Domains",
        table: "seo_referring_domains",
        columns: ["Domain", "Backlinks", "First Seen", "Status"],
        action: "refresh",
      },
      {
        label: "New / Lost Backlinks",
        table: "seo_backlinks",
        columns: ["Source Domain", "Source URL", "Target URL", "Status", "Last Checked"],
        action: "refresh",
      },
      {
        label: "Competitor Gap",
        table: "seo_competitors",
        columns: ["Competitor", "Domain", "Region", "Keywords", "Backlinks"],
        action: "refresh",
      },
    ],
  },
  "technical-foundation": {
    title: "Technical SEO",
    sections: [
      {
        label: "Crawl Jobs",
        table: "seo_crawl_jobs",
        columns: ["Domain", "Start URL", "Status", "Pages Scanned", "Started"],
        action: "crawl",
      },
      {
        label: "Broken Links",
        table: "seo_broken_links",
        columns: ["Domain", "URL", "Source URL", "HTTP Status", "Status"],
        action: "refresh",
      },
      {
        label: "Redirects",
        table: "seo_redirects",
        columns: ["Domain", "Source URL", "Target URL", "Type", "Status"],
        action: "refresh",
      },
      {
        label: "Core Web Vitals",
        table: "seo_core_web_vitals",
        columns: ["Domain", "URL", "LCP", "INP", "CLS", "Status"],
        action: "refresh",
      },
    ],
  },
  "keywords-foundation": {
    title: "Keywords & Rankings",
    sections: [
      {
        label: "Tracked Keywords",
        table: "seo_keywords",
        columns: ["Keyword", "Target URL", "Country", "Status"],
        action: "refresh",
      },
      {
        label: "Rankings",
        table: "seo_rankings",
        columns: ["Keyword", "Domain", "URL", "Position", "Country", "Recorded"],
        action: "refresh",
      },
      {
        label: "Search Volume",
        table: "seo_search_volume",
        columns: ["Keyword", "Country", "Search Volume", "Measured", "Status"],
        action: "refresh",
      },
    ],
  },
  "local-phase2": {
    title: "Local SEO",
    sections: [
      {
        label: "Listings",
        table: "seo_local_listings",
        columns: ["Business", "Domain", "Country", "Listing URL", "Status"],
        action: "refresh",
      },
      {
        label: "Reviews",
        table: "seo_reviews",
        columns: ["Business", "Reviewer", "Rating", "Country", "Review URL", "Status"],
        action: "sync",
      },
      {
        label: "Citations",
        table: "seo_local_citations",
        columns: ["Business", "Source", "Country", "Citation URL", "Status"],
        action: "refresh",
      },
    ],
  },
  "international-phase2": {
    title: "International SEO",
    sections: [
      {
        label: "Hreflang Maps",
        table: "seo_hreflang_maps",
        columns: ["Source URL", "Alternate URL", "Locale", "Country", "Status"],
        action: "hreflang",
      },
      {
        label: "Translations",
        table: "seo_translations",
        columns: ["Source URL", "Translated URL", "Source Locale", "Target Locale", "Status"],
        action: "refresh",
      },
      {
        label: "Country Targets",
        table: "seo_country_targets",
        columns: ["Country", "Domain", "Target URL", "Status"],
        action: "refresh",
      },
    ],
  },
  "reporting-phase2": {
    title: "Reporting & Business",
    sections: [
      {
        label: "SEO Reports",
        table: "seo_reports",
        columns: ["Report", "Type", "Period Start", "Period End", "Country", "Status"],
        action: "export",
      },
      {
        label: "Revenue Attribution",
        table: "seo_revenue_attribution",
        columns: ["Landing URL", "Country", "Revenue", "Currency", "Conversions", "Status"],
        action: "refresh",
      },
      {
        label: "Custom Dashboards",
        table: "seo_custom_dashboards",
        columns: ["Dashboard", "Scope URL", "Updated", "Status"],
        action: "export",
      },
    ],
  },
};

export function SeoFrameworkTabs({ phase }: { phase: SeoFrameworkPhase }) {
  const { t } = useTranslation();
  const config = PHASES[phase];
  const [activeSection, setActiveSection] = useState(config.sections[0].label);
  const section =
    config.sections.find((item) => item.label === activeSection) ?? config.sections[0];

  const notifyPending = () => {
    toast.info(t("seo.api_integration_pending"));
  };
  const actionLabel = {
    refresh: "Refresh Data",
    crawl: "Start Crawl",
    sync: "Sync Reviews",
    hreflang: "Generate Hreflang",
    export: "Export Report",
  }[section.action];

  return (
    <div data-skip-drawer>
      <div className="mb-5">
        <h2 className="text-xl font-bold">{config.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("seo.foundation_tables_ready")}</p>
      </div>

      <SubNav
        items={config.sections.map((item) => item.label)}
        active={section.label}
        onChange={setActiveSection}
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{section.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("seo.storage")} {section.table}
            </p>
          </div>
          <button
            type="button"
            onClick={notifyPending}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:border-accent/40 hover:text-accent"
          >
            {section.action === "crawl" || section.action === "hreflang" ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {actionLabel}
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
            <tbody>
              <tr>
                <td
                  colSpan={section.columns.length}
                  className="px-3 py-10 text-center text-muted-foreground"
                  role="status"
                >
                  <Database className="mx-auto mb-2 h-5 w-5 opacity-60" />
                  <span>{t("seo.no_data_available_connect_api")}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
