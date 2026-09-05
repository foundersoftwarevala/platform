import { createFileRoute } from "@tanstack/react-router";
import { IndianRupee, MapPin, Target, Users } from "lucide-react";

import { DataScreen } from "@/components/marketing/data-screen";
import { StatusBadge } from "@/components/marketing/kit";
import { compactInr, compactNum, num, titleCase } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/targeting")({
  head: () => ({
    meta: [
      { title: "Location Targeting — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Geo-target campaigns across cities, states and radius zones with live spend and lead volume per location.",
      },
      { property: "og:title", content: "Location Targeting — Software Vala" },
      {
        property: "og:description",
        content: "City, state and radius targeting with live spend and lead performance.",
      },
    ],
  }),
  component: TargetingScreen,
});

const LOCATION_TYPES = ["city", "state", "country", "radius", "pincode", "region"] as const;
const STATUSES = ["active", "paused", "testing", "archived"] as const;

function TargetingScreen() {
  return (
    <DataScreen
      table="marketing_locations"
      title="Location Targeting"
      description="Every geo target in play, with reachable population, spend and lead output."
      module="Targeting"
      entityLabel="Location"
      order={{ column: "spend" }}
      searchKeys={["name", "city", "state", "country", "location_type"]}
      filterKey="status"
      filterOptions={STATUSES}
      minWidth={1080}
      stats={[
        { label: "Targets", icon: MapPin, tone: "violet", value: (r) => num(r.length) },
        {
          label: "Active targets",
          icon: Target,
          tone: "green",
          value: (r) => num(r.filter((x) => x.status === "active").length),
        },
        {
          label: "Reach population",
          icon: Users,
          tone: "blue",
          value: (r) => compactNum(r.reduce((s, x) => s + Number(x.population ?? 0), 0)),
        },
        {
          label: "Geo spend",
          icon: IndianRupee,
          tone: "gold",
          value: (r) => compactInr(r.reduce((s, x) => s + Number(x.spend ?? 0), 0)),
        },
      ]}
      columns={[
        { key: "name", header: "Location", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "location_type", header: "Type", render: (r) => titleCase(r.location_type) },
        {
          key: "geo",
          header: "Geography",
          render: (r) => [r.city, r.state, r.country].filter(Boolean).join(", "),
        },
        {
          key: "radius_km",
          header: "Radius",
          align: "right",
          render: (r) => (r.radius_km ? `${num(r.radius_km)} km` : "—"),
        },
        {
          key: "population",
          header: "Population",
          align: "right",
          render: (r) => compactNum(r.population),
        },
        {
          key: "active_campaigns",
          header: "Campaigns",
          align: "right",
          render: (r) => num(r.active_campaigns),
        },
        { key: "spend", header: "Spend", align: "right", render: (r) => compactInr(r.spend) },
        { key: "leads", header: "Leads", align: "right", render: (r) => num(r.leads) },
        { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { key: "name", label: "Location name", kind: "text", required: true },
        { key: "location_type", label: "Type", kind: "select", options: LOCATION_TYPES },
        { key: "country", label: "Country", kind: "text", placeholder: "India" },
        { key: "state", label: "State", kind: "text" },
        { key: "city", label: "City", kind: "text" },
        { key: "radius_km", label: "Radius (km)", kind: "number" },
        { key: "population", label: "Population", kind: "number" },
        { key: "active_campaigns", label: "Active campaigns", kind: "number" },
        { key: "spend", label: "Spend (₹)", kind: "number" },
        { key: "leads", label: "Leads", kind: "number" },
        { key: "status", label: "Status", kind: "select", options: STATUSES },
      ]}
    />
  );
}
