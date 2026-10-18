import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { ActivityLog } from "@/components/vala-ai/screens/Governance";

export const Route = createFileRoute("/vala-ai/activity")({
  head: pageHead("Activity & Audit · Vala AI", "Hash-chained record of every Vala AI action."),
  component: ActivityLog,
});
