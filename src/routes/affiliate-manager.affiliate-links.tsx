import { createFileRoute } from "@tanstack/react-router";
import { LinkIcon, MousePointerClick, TrendingUp } from "lucide-react";
import { EntityWall, Row, Cell } from "@/components/affiliate/EntityWall";

type Link = { id: string; slug: string; destination_url: string; clicks_count: number; conversions_count: number };

export const Route = createFileRoute("/affiliate-manager/affiliate-links")({
  head: () => ({ meta: [{ title: "Affiliate Links — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Link>
      title="Affiliate Links"
      description="Tracking, deep, campaign and short links with clicks, conversions, and QR."
      crumbLabel="Affiliate Links"
      table="affiliate_links"
      searchColumns={["slug", "destination_url"]}
      searchPlaceholder="Search by slug or destination…"
      filters={["Campaign", "Affiliate", "Domain", "Status"]}
      tabs={["All", "Top Performing", "Recently Created"]}
      kpis={[
        { label: "Total Links", icon: <LinkIcon className="size-4" />, tone: "primary" },
        { label: "Clicks 30d", icon: <MousePointerClick className="size-4" /> },
        { label: "Conversions", icon: <TrendingUp className="size-4" />, tone: "success" },
      ]}
      columns={[
        { key: "slug", label: "Slug" },
        { key: "dest", label: "Destination" },
        { key: "clicks", label: "Clicks", align: "right" },
        { key: "conv", label: "Conversions", align: "right" },
      ]}
      renderRow={(l) => (
        <Row id={l.id}>
          <Cell className="font-mono text-[12px]">/{l.slug}</Cell>
          <Cell className="truncate max-w-xs text-muted-foreground">{l.destination_url}</Cell>
          <Cell align="right" className="tabular-nums">{l.clicks_count.toLocaleString()}</Cell>
          <Cell align="right" className="tabular-nums">{l.conversions_count.toLocaleString()}</Cell>
        </Row>
      )}
      emptyIcon={LinkIcon}
      emptyTitle="No links yet"
      emptyDescription="Create tracking links from any campaign or affiliate to see clicks and conversions here."
      primaryActionLabel="Create Link"
    />
  ),
});
