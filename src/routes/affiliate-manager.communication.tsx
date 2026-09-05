import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Pin, CalendarClock } from "lucide-react";
import { EntityWall, Row, Cell, fmtDate } from "@/components/affiliate/EntityWall";

type Announcement = { id: string; title: string; audience: string; pinned: boolean; published_at: string | null; created_at: string };

export const Route = createFileRoute("/affiliate-manager/communication")({
  head: () => ({ meta: [{ title: "Communication — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Announcement>
      title="Communication"
      description="Announcements, broadcasts, meetings and internal chat across all affiliates."
      crumbLabel="Communication"
      table="announcements"
      searchColumns={["title", "body"]}
      searchPlaceholder="Search announcements…"
      filters={["Audience", "Pinned", "Date"]}
      tabs={["All", "Pinned", "Scheduled", "Published"]}
      kpis={[
        { label: "Announcements", icon: <Megaphone className="size-4" />, tone: "primary" },
        { label: "Pinned", icon: <Pin className="size-4" />, tone: "warning", filter: [{ column: "pinned", value: true }] },
        { label: "Meetings", icon: <CalendarClock className="size-4" /> },
      ]}
      columns={[
        { key: "title", label: "Title" },
        { key: "aud", label: "Audience" },
        { key: "pin", label: "Pinned" },
        { key: "pub", label: "Published" },
      ]}
      renderRow={(a) => (
        <Row id={a.id}>
          <Cell className="font-medium">{a.title}</Cell>
          <Cell>{a.audience}</Cell>
          <Cell>{a.pinned ? "Yes" : "—"}</Cell>
          <Cell>{fmtDate(a.published_at ?? a.created_at)}</Cell>
        </Row>
      )}
      emptyIcon={Megaphone}
      emptyTitle="No announcements"
      emptyDescription="Publish announcements, schedule broadcasts and log operator communications."
      primaryActionLabel="New Announcement"
    />
  ),
});
