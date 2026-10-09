import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { QA } from "@/components/vala-ai/screens/Governance";

export const Route = createFileRoute("/vala-ai/qa")({
  head: pageHead(
    "QA & Verification · Vala AI",
    "Acceptance checks run by the agent and the verifier.",
  ),
  component: QA,
});
