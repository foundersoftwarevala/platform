import { createFileRoute } from "@tanstack/react-router";
import { Store, Image as ImageIcon } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate } from "@/components/affiliate/EntityWall";

type Asset = { id: string; name: string; kind: string; format: string | null; downloads: number; status: string; created_at: string };

export const Route = createFileRoute("/affiliate-manager/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Asset>
      title="Marketplace"
      description="Featured products, marketing assets, creatives and homepage promotion."
      crumbLabel="Marketplace"
      table="marketing_assets"
      searchColumns={["name"]}
      searchPlaceholder="Search assets…"
      filters={["Kind", "Format", "Status", "Campaign"]}
      tabs={["All", "Banners", "Creatives", "Emails", "Landing Pages"]}
      kpis={[
        { label: "Assets", icon: <Store className="size-4" />, tone: "primary" },
        { label: "Banners", icon: <ImageIcon className="size-4" />, filter: [{ column: "kind", value: "banner" }] },
      ]}
      columns={[
        { key: "name", label: "Asset" },
        { key: "kind", label: "Kind" },
        { key: "fmt", label: "Format" },
        { key: "dl", label: "Downloads", align: "right" },
        { key: "created", label: "Created" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(a) => (
        <Row id={a.id}>
          <Cell className="font-medium">{a.name}</Cell>
          <Cell className="uppercase text-[11px]">{a.kind}</Cell>
          <Cell>{a.format ?? "—"}</Cell>
          <Cell align="right" className="tabular-nums">{a.downloads.toLocaleString()}</Cell>
          <Cell>{fmtDate(a.created_at)}</Cell>
          <Cell><StatusCell value={a.status} /></Cell>
        </Row>
      )}
      emptyIcon={Store}
      emptyTitle="No marketplace assets"
      emptyDescription="Upload banners, creatives, email templates and landing pages for affiliates to promote."
      primaryActionLabel="Upload Asset"
    />
  ),
});
