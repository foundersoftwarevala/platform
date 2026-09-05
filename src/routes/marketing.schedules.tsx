import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Clock, Repeat, Send } from "lucide-react";

import { DataScreen } from "@/components/marketing/data-screen";
import { StatusBadge } from "@/components/marketing/kit";
import { dateTime, num, titleCase } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/schedules")({
  head: () => ({
    meta: [
      { title: "Schedules — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Plan every campaign send, post and flight with recurrence rules, owners and live schedule status.",
      },
      { property: "og:title", content: "Schedules — Software Vala" },
      {
        property: "og:description",
        content: "Marketing calendar with recurrence, owners and live run status.",
      },
    ],
  }),
  component: SchedulesScreen,
});

const CHANNELS = [
  "Google Ads",
  "Meta Ads",
  "Instagram",
  "LinkedIn",
  "YouTube",
  "WhatsApp",
  "SMS",
  "Email",
  "Blog",
] as const;
const RECURRENCE = ["one_time", "daily", "weekly", "biweekly", "monthly", "quarterly"] as const;
const STATUSES = ["scheduled", "active", "paused", "completed", "cancelled"] as const;

function SchedulesScreen() {
  return (
    <DataScreen
      table="marketing_schedules"
      title="Schedules"
      description="Every scheduled activation, send and flight across channels."
      module="Schedules"
      entityLabel="Schedule"
      order={{ column: "scheduled_at", ascending: true }}
      searchKeys={["title", "channel", "owner", "recurrence"]}
      filterKey="status"
      filterOptions={STATUSES}
      minWidth={900}
      stats={[
        { label: "Scheduled items", icon: CalendarDays, tone: "violet", value: (r) => num(r.length) },
        {
          label: "Upcoming",
          icon: Clock,
          tone: "blue",
          value: (r) => num(r.filter((x) => new Date(x.scheduled_at) > new Date()).length),
        },
        {
          label: "Recurring",
          icon: Repeat,
          tone: "teal",
          value: (r) => num(r.filter((x) => x.recurrence !== "one_time").length),
        },
        {
          label: "Completed",
          icon: Send,
          tone: "green",
          value: (r) => num(r.filter((x) => x.status === "completed").length),
        },
      ]}
      columns={[
        { key: "title", header: "Title", render: (r) => <span className="font-medium">{r.title}</span> },
        { key: "channel", header: "Channel", render: (r) => r.channel },
        { key: "scheduled_at", header: "Runs at", render: (r) => dateTime(r.scheduled_at) },
        { key: "recurrence", header: "Recurrence", render: (r) => titleCase(r.recurrence) },
        { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
        { key: "owner", header: "Owner", render: (r) => r.owner ?? "—" },
      ]}
      fields={[
        { key: "title", label: "Title", kind: "text", required: true, full: true },
        { key: "channel", label: "Channel", kind: "select", options: CHANNELS },
        { key: "scheduled_at", label: "Scheduled at", kind: "datetime" },
        { key: "recurrence", label: "Recurrence", kind: "select", options: RECURRENCE },
        { key: "status", label: "Status", kind: "select", options: STATUSES },
        { key: "owner", label: "Owner", kind: "text" },
      ]}
    />
  );
}
