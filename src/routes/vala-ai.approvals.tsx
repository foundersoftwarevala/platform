import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { Approvals } from "@/components/vala-ai/screens/Governance";

export const Route = createFileRoute("/vala-ai/approvals")({
  head: pageHead("Approvals · Vala AI", "Restricted actions waiting for an owner."),
  component: Approvals,
});
