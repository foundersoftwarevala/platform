import { createFileRoute } from "@tanstack/react-router";
import { Package, Image as ImageIcon } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate } from "@/components/affiliate/EntityWall";

type Asset = { id: string; name: string; kind: string; downloads: number; status: string; created_at: string };

export const Route = createFileRoute("/affiliate-manager/products")({
  head: () => ({ meta: [{ title: "Products — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Asset>
      title="Product Promotion"
      description="Marketplace products, featured products, pricing, discount and SEO promotion."
      crumbLabel="Products"
      table="marketing_assets"
      searchColumns={["name"]}
      searchPlaceholder="Search products…"
      filters={["Featured", "Campaign", "Status"]}
      tabs={["All", "Featured", "Campaign", "Homepage"]}
      kpis={[
        { label: "Promoted", icon: <Package className="size-4" />, tone: "primary" },
        { label: "With Creative", icon: <ImageIcon className="size-4" />, filter: [{ column: "kind", value: "creative" }] },
      ]}
      columns={[
        { key: "name", label: "Product / Asset" },
        { key: "kind", label: "Kind" },
        { key: "dl", label: "Downloads", align: "right" },
        { key: "created", label: "Created" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(a) => (
        <Row id={a.id}>
          <Cell className="font-medium">{a.name}</Cell>
          <Cell className="uppercase text-[11px]">{a.kind}</Cell>
          <Cell align="right" className="tabular-nums">{a.downloads.toLocaleString()}</Cell>
          <Cell>{fmtDate(a.created_at)}</Cell>
          <Cell><StatusCell value={a.status} /></Cell>
        </Row>
      )}
      emptyIcon={Package}
      emptyTitle="No promoted products"
      emptyDescription="Feature products in campaigns, homepage promotions or the affiliate marketplace."
      primaryActionLabel="Promote Product"
    />
  ),
});
