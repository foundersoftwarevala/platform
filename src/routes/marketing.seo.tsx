import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Globe, Link2, Search, TrendingUp } from "lucide-react";

import { DataScreen } from "@/components/marketing/data-screen";
import { ScreenHeader, StatusBadge } from "@/components/marketing/kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compactNum, dateTime, inr, num, titleCase } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/seo")({
  head: () => ({
    meta: [
      { title: "SEO Management — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Track keyword rankings, search volume, difficulty and page health across the Software Vala website.",
      },
      { property: "og:title", content: "SEO Management — Software Vala" },
      {
        property: "og:description",
        content: "Keyword rank tracking and technical page health in one live view.",
      },
    ],
  }),
  component: SeoScreen,
});

const INTENTS = ["informational", "navigational", "commercial", "transactional"] as const;
const KEYWORD_STATUS = ["tracking", "opportunity", "at_risk", "won", "paused"] as const;

function delta(row: { position: number; previous_position: number }) {
  const change = Number(row.previous_position ?? 0) - Number(row.position ?? 0);
  if (change === 0) return <span className="text-muted-foreground">—</span>;
  const up = change > 0;
  return (
    <span className={up ? "text-status-success" : "text-status-error"}>
      {up ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />}{" "}
      {Math.abs(change)}
    </span>
  );
}

function SeoScreen() {
  return (
    <div className="space-y-6">
      <ScreenHeader
        title="SEO Management"
        description="Keyword ranks, search demand and technical page health, live from the SEO dataset."
      />
      <Tabs defaultValue="keywords" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
        </TabsList>

        <TabsContent value="keywords">
          <DataScreen
            headless
            table="marketing_seo_keywords"
            title="Keywords"
            description="Rank tracking"
            module="SEO"
            entityLabel="Keyword"
            order={{ column: "search_volume" }}
            searchKeys={["keyword", "page_url", "intent", "country"]}
            filterKey="status"
            filterOptions={KEYWORD_STATUS}
            minWidth={1140}
            stats={[
              { label: "Keywords tracked", icon: Search, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Top 10 ranks",
                icon: TrendingUp,
                tone: "green",
                value: (r) => num(r.filter((x) => Number(x.position) <= 10).length),
              },
              {
                label: "Monthly volume",
                icon: Globe,
                tone: "blue",
                value: (r) => compactNum(r.reduce((s, x) => s + Number(x.search_volume ?? 0), 0)),
              },
              {
                label: "Avg CPC",
                icon: Link2,
                tone: "gold",
                value: (r) =>
                  r.length ? inr(r.reduce((s, x) => s + Number(x.cpc ?? 0), 0) / r.length) : inr(0),
              },
            ]}
            columns={[
              {
                key: "keyword",
                header: "Keyword",
                render: (r) => <span className="font-medium">{r.keyword}</span>,
              },
              { key: "position", header: "Rank", align: "right", render: (r) => num(r.position) },
              { key: "change", header: "Change", align: "right", render: (r) => delta(r) },
              {
                key: "search_volume",
                header: "Volume",
                align: "right",
                render: (r) => compactNum(r.search_volume),
              },
              {
                key: "difficulty",
                header: "Difficulty",
                align: "right",
                render: (r) => num(r.difficulty),
              },
              { key: "cpc", header: "CPC", align: "right", render: (r) => inr(r.cpc) },
              { key: "intent", header: "Intent", render: (r) => titleCase(r.intent) },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
              { key: "page_url", header: "Page", render: (r) => r.page_url ?? "—" },
              { key: "country", header: "Country", render: (r) => r.country },
            ]}
            fields={[
              { key: "keyword", label: "Keyword", kind: "text", required: true, full: true },
              { key: "position", label: "Current position", kind: "number" },
              { key: "previous_position", label: "Previous position", kind: "number" },
              { key: "search_volume", label: "Search volume", kind: "number" },
              { key: "difficulty", label: "Difficulty (0-100)", kind: "number" },
              { key: "cpc", label: "CPC (₹)", kind: "number" },
              { key: "intent", label: "Intent", kind: "select", options: INTENTS },
              { key: "status", label: "Status", kind: "select", options: KEYWORD_STATUS },
              { key: "country", label: "Country", kind: "text", placeholder: "IN" },
              { key: "page_url", label: "Target page", kind: "text", full: true },
            ]}
          />
        </TabsContent>

        <TabsContent value="pages">
          <DataScreen
            headless
            table="marketing_seo_pages"
            title="Pages"
            description="Technical health"
            module="SEO"
            entityLabel="Page"
            order={{ column: "organic_traffic" }}
            searchKeys={["url", "title", "meta_description"]}
            minWidth={1140}
            stats={[
              { label: "Pages crawled", icon: Globe, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Indexed",
                icon: Search,
                tone: "green",
                value: (r) => num(r.filter((x) => x.indexed).length),
              },
              {
                label: "Open issues",
                icon: TrendingUp,
                tone: "rose",
                value: (r) => num(r.reduce((s, x) => s + Number(x.issues ?? 0), 0)),
              },
              {
                label: "Organic traffic",
                icon: Link2,
                tone: "blue",
                value: (r) => compactNum(r.reduce((s, x) => s + Number(x.organic_traffic ?? 0), 0)),
              },
            ]}
            columns={[
              { key: "url", header: "URL", render: (r) => <span className="font-medium">{r.url}</span> },
              { key: "title", header: "Title", render: (r) => r.title },
              {
                key: "health_score",
                header: "Health",
                align: "right",
                render: (r) => num(r.health_score),
              },
              { key: "issues", header: "Issues", align: "right", render: (r) => num(r.issues) },
              { key: "backlinks", header: "Backlinks", align: "right", render: (r) => num(r.backlinks) },
              {
                key: "organic_traffic",
                header: "Traffic",
                align: "right",
                render: (r) => compactNum(r.organic_traffic),
              },
              {
                key: "indexed",
                header: "Indexed",
                render: (r) => <StatusBadge value={r.indexed ? "active" : "paused"} />,
              },
              { key: "last_crawled", header: "Last crawl", render: (r) => dateTime(r.last_crawled) },
            ]}
            fields={[
              { key: "url", label: "URL", kind: "text", required: true, full: true },
              { key: "title", label: "Page title", kind: "text", required: true, full: true },
              { key: "health_score", label: "Health score (0-100)", kind: "number" },
              { key: "issues", label: "Issues", kind: "number" },
              { key: "backlinks", label: "Backlinks", kind: "number" },
              { key: "organic_traffic", label: "Organic traffic", kind: "number" },
              { key: "last_crawled", label: "Last crawled", kind: "datetime" },
              { key: "meta_description", label: "Meta description", kind: "textarea", full: true },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
