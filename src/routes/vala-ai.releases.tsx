import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { Releases } from "@/components/vala-ai/screens/Governance";

export const Route = createFileRoute("/vala-ai/releases")({
  head: pageHead("Versions & Releases · Vala AI", "Immutable, verified release records."),
  component: Releases,
});
