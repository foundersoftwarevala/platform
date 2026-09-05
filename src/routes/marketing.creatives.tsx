import { createFileRoute } from "@tanstack/react-router";
import { Image as ImageIcon, Layers, Sparkles, Star } from "lucide-react";

import { DataScreen } from "@/components/marketing/data-screen";
import { StatusBadge } from "@/components/marketing/kit";
import { num, shortDate, titleCase } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/creatives")({
  head: () => ({
    meta: [
      { title: "Creatives Library — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Manage every ad creative: formats, dimensions, performance scores, usage counts and approval status.",
      },
      { property: "og:title", content: "Creatives Library — Software Vala" },
      {
        property: "og:description",
        content: "Central creative asset library with live performance scores and usage tracking.",
      },
    ],
  }),
  component: CreativesScreen,
});

const ASSET_TYPES = ["image", "video", "carousel", "html5", "audio", "copy"] as const;
const FORMATS = ["square", "story", "landscape", "portrait", "banner", "reel"] as const;
const STATUSES = ["draft", "in_review", "approved", "active", "archived", "rejected"] as const;

function CreativesScreen() {
  return (
    <DataScreen
      table="marketing_creatives"
      title="Creatives Library"
      description="Every ad asset with live performance scoring, usage counts and approval state."
      module="Creatives"
      entityLabel="Creative"
      order={{ column: "created_at" }}
      searchKeys={["name", "asset_type", "format", "uploaded_by"]}
      filterKey="status"
      filterOptions={STATUSES}
      minWidth={1080}
      stats={[
        {
          label: "Total assets",
          icon: ImageIcon,
          tone: "violet",
          value: (rows) => num(rows.length),
        },
        {
          label: "Approved / active",
          icon: Sparkles,
          tone: "green",
          value: (rows) =>
            num(rows.filter((r) => r.status === "approved" || r.status === "active").length),
        },
        {
          label: "Avg performance",
          icon: Star,
          tone: "gold",
          value: (rows) =>
            rows.length
              ? (
                  rows.reduce((s, r) => s + Number(r.performance_score ?? 0), 0) / rows.length
                ).toFixed(1)
              : "0.0",
          sublabel: () => "out of 10",
        },
        {
          label: "Total placements",
          icon: Layers,
          tone: "blue",
          value: (rows) => num(rows.reduce((s, r) => s + Number(r.usage_count ?? 0), 0)),
        },
      ]}
      columns={[
        { key: "name", header: "Creative", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "asset_type", header: "Type", render: (r) => titleCase(r.asset_type) },
        { key: "format", header: "Format", render: (r) => titleCase(r.format) },
        { key: "dimensions", header: "Dimensions", render: (r) => r.dimensions ?? "—" },
        {
          key: "tags",
          header: "Tags",
          render: (r) => (r.tags?.length ? r.tags.join(", ") : "—"),
        },
        { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
        {
          key: "performance_score",
          header: "Score",
          align: "right",
          render: (r) => Number(r.performance_score ?? 0).toFixed(1),
        },
        {
          key: "usage_count",
          header: "Used",
          align: "right",
          render: (r) => num(r.usage_count),
        },
        { key: "uploaded_by", header: "Uploaded by", render: (r) => r.uploaded_by ?? "—" },
        { key: "created_at", header: "Created", render: (r) => shortDate(r.created_at) },
      ]}
      fields={[
        { key: "name", label: "Creative name", kind: "text", required: true },
        { key: "asset_type", label: "Asset type", kind: "select", options: ASSET_TYPES },
        { key: "format", label: "Format", kind: "select", options: FORMATS },
        { key: "status", label: "Status", kind: "select", options: STATUSES },
        { key: "dimensions", label: "Dimensions", kind: "text", placeholder: "1080x1080" },
        { key: "uploaded_by", label: "Uploaded by", kind: "text" },
        { key: "performance_score", label: "Performance score (0-10)", kind: "number" },
        { key: "usage_count", label: "Usage count", kind: "number" },
        { key: "tags", label: "Tags", kind: "tags", full: true },
      ]}
    />
  );
}
